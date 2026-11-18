import { ApiError, uuid, audit, one, digest, sameHash } from "./core.mjs";
// Keep the old settings API readable by older dashboards, but behavior is fixed.
export const defaultIdentityPolicy = {
  version: 0,
  enabled: true,
  auto_create: true,
  rules: [],
};
export async function identityPolicy(c, org) {
  const row = (
    await c.query(
      "SELECT value FROM org_settings WHERE org_id=$1 AND name='identity'",
      [org],
    )
  ).rows[0];
  return { ...defaultIdentityPolicy, version: row?.value.version ?? 0 };
}
export async function updateIdentityPolicy(c, b, ctx) {
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    ctx.org + ":domain-identity",
  ]);
  const old = await identityPolicy(c, ctx.org);
  if (
    old.version !== b.expected_revision ||
    b.policy.version !== old.version + 1
  )
    throw new ApiError(409, "REVISION_CONFLICT");
  const policy = { ...defaultIdentityPolicy, version: old.version + 1 };
  await c.query(
    "INSERT INTO org_settings(org_id,name,value,revision) VALUES($1,'identity',$2,$3) ON CONFLICT(org_id,name) DO UPDATE SET value=EXCLUDED.value,revision=EXCLUDED.revision,updated_at=now()",
    [ctx.org, policy, policy.version],
  );
  await audit(
    c,
    ctx,
    "identity.policy.updated",
    "organization",
    ctx.org,
    "账号自动关联为固定行为；兼容旧客户端保存请求",
  );
  return policy;
}
export async function identityResult(c, org, installation) {
  const identity = (
    await c.query(
      "SELECT claim,state FROM installation_identities WHERE org_id=$1 AND installation_id=$2",
      [org, installation],
    )
  ).rows[0];
  const binding = (
    await c.query(
      "SELECT employee_id,source FROM installation_bindings WHERE org_id=$1 AND installation_id=$2 AND valid_days @> (now() AT TIME ZONE 'Asia/Shanghai')::date",
      [org, installation],
    )
  ).rows[0];
  return {
    identity: identity?.claim ?? null,
    state:
      binding?.source === "manual"
        ? "binding_preserved"
        : (identity?.state ?? "missing"),
    employee_id: binding?.employee_id ?? null,
    binding_source: binding?.source ?? "none",
  };
}
export async function matchIdentity(c, claim, ctx) {
  // Serialize mapping and policy changes per organization; registration and manual binding
  // still lock the installation row. All decisions are committed with the request transaction.
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    ctx.org + ":domain-identity",
  ]);
  const installation = await one(
    c,
    "SELECT * FROM installations WHERE org_id=$1 AND id=$2 FOR UPDATE",
    [ctx.org, ctx.installation],
  );
  const old = (
    await c.query(
      "SELECT claim,state FROM installation_identities WHERE org_id=$1 AND installation_id=$2",
      [ctx.org, ctx.installation],
    )
  ).rows[0];
  const finish = async (state) => {
    if (
      !old ||
      !sameHash(digest(old.claim), digest(claim)) ||
      old.state !== state
    ) {
      await c.query(
        "INSERT INTO installation_identities(org_id,installation_id,claim,state) VALUES($1,$2,$3,$4) ON CONFLICT(org_id,installation_id) DO UPDATE SET claim=EXCLUDED.claim,state=EXCLUDED.state,updated_at=now()",
        [ctx.org, ctx.installation, JSON.stringify(claim), state],
      );
      await audit(
        c,
        { ...ctx, account: { id: ctx.installation } },
        "identity.reported",
        "installation",
        ctx.installation,
        "客户端域身份匹配结果：" + state,
      );
    }
    return identityResult(c, ctx.org, ctx.installation);
  };
  if (installation.status === "revoked") return finish(old?.state ?? "missing");
  // A domain identity must come from the explicit OS claim. Local/legacy clients
  // may only have the registration username; never treat it as a verified domain.
  if (claim?.account_type === "unknown") return finish("unknown");
  const domainAccount = claim?.account_type === "domain";
  const domain = domainAccount
    ? (claim.domain ?? "").trim().toUpperCase()
    : null;
  const account = domainAccount
    ? (claim.account_name ?? "")
    : claim?.account_name || installation.windows_username;
  if (
    domainAccount &&
    (claim.source !== "windows_logon" || !/^[A-Z0-9][A-Z0-9._-]*$/.test(domain))
  )
    return finish("invalid_account");
  // Employee numbers are opaque strings: preserve leading zeroes and spelling.
  if (!account || account.length > 64 || !/^[\p{L}\p{N}_.-]+$/u.test(account))
    return finish("invalid_account");
  const employeeNo = account;
  // Manual decisions always take priority, including historical and future periods.
  const bindings = (
    await c.query(
      "SELECT employee_id,source FROM installation_bindings WHERE org_id=$1 AND installation_id=$2",
      [ctx.org, ctx.installation],
    )
  ).rows;
  if (bindings.some((b) => b.source === "manual"))
    return finish("binding_preserved");
  const mapped = domainAccount
    ? (
        await c.query(
          "SELECT e.* FROM employee_domain_accounts a JOIN employees e ON e.org_id=a.org_id AND e.id=a.employee_id WHERE a.org_id=$1 AND a.domain=$2 AND a.account_name=$3 FOR UPDATE OF e",
          [ctx.org, domain, account],
        )
      ).rows[0]
    : null;
  // Employee numbers are unique organization-wide, including across allowed domains.
  let employee = (
    await c.query(
      "SELECT * FROM employees WHERE org_id=$1 AND employee_no=$2 FOR UPDATE",
      [ctx.org, employeeNo],
    )
  ).rows[0];
  if (
    (mapped && mapped.id !== employee?.id) ||
    (bindings.length &&
      (!employee || bindings.some((b) => b.employee_id !== employee.id)))
  )
    return finish("identity_conflict");
  if (employee?.status === "archived") return finish("employee_archived");
  const displayName = domainAccount ? claim.display_name?.trim() : undefined;
  if (employee?.name_is_placeholder && displayName) {
    await c.query(
      "UPDATE employees SET name=$3,name_is_placeholder=false,revision=revision+1 WHERE org_id=$1 AND id=$2",
      [ctx.org, employee.id, displayName],
    );
  }
  if (!employee) {
    employee = (
      await c.query(
        "INSERT INTO employees(id,org_id,name,employee_no,name_is_placeholder) VALUES($1,$2,$3,$4,$5) ON CONFLICT(org_id,employee_no) DO NOTHING RETURNING *",
        [uuid(), ctx.org, displayName || employeeNo, employeeNo, !displayName],
      )
    ).rows[0];
    if (!employee) return finish("identity_conflict");
    await audit(
      c,
      { ...ctx, account: { id: ctx.installation } },
      "identity.employee.created",
      "employee",
      employee.id,
      "根据上报账号自动创建",
    );
  }
  if (domainAccount && !mapped)
    await c.query(
      "INSERT INTO employee_domain_accounts(org_id,domain,account_name,employee_id) VALUES($1,$2,$3,$4)",
      [ctx.org, domain, account, employee.id],
    );
  if (!bindings.length) {
    await c.query(
      "INSERT INTO installation_bindings(id,org_id,installation_id,employee_id,valid_days,reason,source) VALUES($1,$2,$3,$4,daterange(NULL,NULL,'[)'),'账号自动关联；包含历史统计','automatic')",
      [uuid(), ctx.org, ctx.installation, employee.id],
    );
    await c.query(
      "UPDATE installations SET revision=revision+1 WHERE org_id=$1 AND id=$2",
      [ctx.org, ctx.installation],
    );
    await audit(
      c,
      { ...ctx, account: { id: ctx.installation } },
      "identity.binding.created",
      "installation",
      ctx.installation,
      "自动关联员工；包含历史及后续补传的统计",
    );
  }
  return finish("matched");
}
