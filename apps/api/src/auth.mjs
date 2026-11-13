import { hash, verify } from "@node-rs/argon2";
import {
  ApiError,
  one,
  secretHash,
  sameHash,
  token,
  uuid,
  adminDTO,
  audit,
} from "./core.mjs";
export const passwordHash = (password) =>
  hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
const cookie = "__Host-piora_analytics";
export async function authenticate(c, req, role, config) {
  if (role === "public") return {};
  if (role === "device") {
    const parts = String(req.headers.authorization ?? "").split(".");
    if (
      parts.length !== 3 ||
      parts[0] !== "Bearer pa1" ||
      !/^[0-9a-f-]{36}$/i.test(parts[1])
    )
      throw new ApiError(401, "AUTH_REQUIRED");
    const r = await one(
      c,
      "SELECT c.*,i.status FROM installation_credentials c JOIN installations i ON i.id=c.installation_id AND i.org_id=c.org_id WHERE c.id=$1",
      [parts[1]],
      401,
    );
    if (
      !sameHash(r.secret_hash, secretHash(parts[2], config.pepper)) ||
      r.revoked_at ||
      new Date(r.valid_until) <= new Date()
    )
      throw new ApiError(401, "CREDENTIAL_EXPIRED");
    if (r.status !== "active") throw new ApiError(403, "INSTALLATION_REVOKED");
    return { org: r.org_id, installation: r.installation_id, credential: r };
  }
  if (role === "enrollment") return {};
  const raw = req.cookies[cookie];
  if (!raw) throw new ApiError(401, "AUTH_REQUIRED");
  const r = await one(
    c,
    "SELECT s.id AS session_id,s.csrf_hash,s.created_at AS session_created,s.expires_at,a.* FROM admin_sessions s JOIN admin_accounts a ON a.id=s.account_id AND a.org_id=s.org_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND s.last_seen_at>now()-interval '2 hours' AND a.status='active'",
    [secretHash(raw, config.pepper)],
    401,
  );
  if (role === "admin" && r.role !== "admin")
    throw new ApiError(403, "FORBIDDEN");
  if (r.must_change_password && !req.url.startsWith("/v1/admin/auth/"))
    throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED");
  if (
    req.method !== "GET" &&
    (!sameHash(
      r.csrf_hash,
      secretHash(req.headers["x-csrf-token"] ?? "", config.pepper),
    ) ||
      req.headers.origin !== config.origin)
  )
    throw new ApiError(403, "CSRF_INVALID");
  await c.query("UPDATE admin_sessions SET last_seen_at=now() WHERE id=$1", [
    r.session_id,
  ]);
  return {
    org: r.org_id,
    account: adminDTO(r),
    sessionId: r.session_id,
    expiresAt: r.expires_at,
    rawSession: raw,
  };
}
export async function authOperation(c, id, body, ctx, req, reply, config) {
  if (id === "login") {
    if (req.headers.origin !== config.origin)
      throw new ApiError(403, "CSRF_INVALID");
    const attempts = (config.loginAttempts ??= new Map()),
      key = req.ip + ":" + body.username.toLowerCase(),
      previous = attempts.get(key);
    if (previous?.until > Date.now() && previous.count >= 5) {
      reply.header(
        "Retry-After",
        Math.ceil((previous.until - Date.now()) / 1000),
      );
      throw new ApiError(429, "RATE_LIMITED");
    }
    const r = (
      await c.query(
        "SELECT * FROM admin_accounts WHERE org_id=$1 AND username=$2 AND status='active'",
        [config.org, body.username.toLowerCase()],
      )
    ).rows[0];
    const fake = config.dummyPasswordHash;
    if (!(await verify(r?.password_hash ?? fake, body.password)) || !r) {
      if (attempts.size > 20000)
        for (const [k, v] of attempts)
          if (v.until < Date.now()) attempts.delete(k);
      attempts.set(key, {
        count: (previous?.until > Date.now() ? previous.count : 0) + 1,
        until:
          previous?.until > Date.now() ? previous.until : Date.now() + 900000,
      });
      throw new ApiError(401, "AUTH_REQUIRED", "账号或密码错误");
    }
    attempts.delete(key);
    const session = token(),
      csrf = secretHash("csrf:" + session, config.pepper).toString("base64url"),
      expires = new Date(Date.now() + 43200000).toISOString();
    await c.query(
      "INSERT INTO admin_sessions(id,org_id,account_id,token_hash,csrf_hash,last_seen_at,expires_at) VALUES($1,$2,$3,$4,$5,now(),$6)",
      [
        uuid(),
        r.org_id,
        r.id,
        secretHash(session, config.pepper),
        secretHash(csrf, config.pepper),
        expires,
      ],
    );
    reply.setCookie(cookie, session, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 43200,
    });
    return { user: adminDTO(r), csrf_token: csrf, expires_at: expires };
  }
  if (id === "session")
    return {
      user: ctx.account,
      csrf_token: secretHash("csrf:" + ctx.rawSession, config.pepper).toString(
        "base64url",
      ),
      expires_at: new Date(ctx.expiresAt).toISOString(),
    };
  if (id === "logout") {
    await c.query("UPDATE admin_sessions SET revoked_at=now() WHERE id=$1", [
      ctx.sessionId,
    ]);
    reply.clearCookie(cookie, {
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "strict",
    });
    return { ok: true };
  }
  if (id === "changePassword") {
    const a = await one(
      c,
      "SELECT password_hash FROM admin_accounts WHERE id=$1 FOR UPDATE",
      [ctx.account.id],
    );
    if (!(await verify(a.password_hash, body.current_password)))
      throw new ApiError(401, "AUTH_REQUIRED");
    await c.query(
      "UPDATE admin_accounts SET password_hash=$2,must_change_password=false,revision=revision+1 WHERE id=$1",
      [ctx.account.id, await passwordHash(body.new_password)],
    );
    await c.query(
      "UPDATE admin_sessions SET revoked_at=now() WHERE account_id=$1 AND id<>$2",
      [ctx.account.id, ctx.sessionId],
    );
    const next = token(),
      csrf = secretHash("csrf:" + next, config.pepper).toString("base64url");
    await c.query(
      "UPDATE admin_sessions SET token_hash=$2,csrf_hash=$3 WHERE id=$1",
      [
        ctx.sessionId,
        secretHash(next, config.pepper),
        secretHash(csrf, config.pepper),
      ],
    );
    reply.setCookie(cookie, next, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: Math.max(
        1,
        Math.floor((new Date(ctx.expiresAt) - Date.now()) / 1000),
      ),
    });
    await audit(
      c,
      ctx,
      "password.changed",
      "account",
      ctx.account.id,
      "修改自己的密码",
    );
    return { ok: true };
  }
  throw new ApiError(404, "NOT_FOUND");
}
