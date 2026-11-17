import { ApiError, uuid, audit, one, digest, sameHash } from "./core.mjs";
export const defaultIdentityPolicy = {
  version: 0,
  enabled: false,
  auto_create: false,
  rules: [],
};
export async function identityPolicy(c, org) {
  return (
    (
      await c.query(
        "SELECT value FROM org_settings WHERE org_id=$1 AND name='identity'",
        [org],
      )
    ).rows[0]?.value ?? defaultIdentityPolicy
  );
}
export function validateIdentityPolicy(policy) {
  const domains = new Set(),
    prefixes = new Set();
  for (const rule of policy.rules) {
    const domain = rule.domain.trim().toUpperCase();
    if (
      !/^[A-Z0-9][A-Z0-9._-]*$/.test(domain) ||
      domains.has(domain) ||
      prefixes.has(rule.employee_prefix)
    )
      throw new ApiError(422, "POLICY_INVALID", "域和工号前缀不能重复");
    domains.add(domain);
    prefixes.add(rule.employee_prefix);
  }
  if (policy.enabled && !policy.rules.length)
    throw new ApiError(422, "POLICY_INVALID", "启用自动关联需要至少一个域规则");
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
  validateIdentityPolicy(b.policy);
  const policy = {
    ...b.policy,
    rules: b.policy.rules.map((r) => ({
      ...r,
      domain: r.domain.trim().toUpperCase(),
    })),
  };
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
    b.reason,
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
  await one(
    c,
    "SELECT id FROM installations WHERE org_id=$1 AND id=$2 FOR UPDATE",
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
        [ctx.org, ctx.installation, claim, state],
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
  if (claim.account_type !== "domain") return finish(claim.account_type);
  const policy = await identityPolicy(c, ctx.org);
  if (!policy.enabled) return finish("disabled");
  const domain = (claim.domain ?? "").trim().toUpperCase();
  const rule = policy.rules.find((r) => r.domain === domain);
  if (!rule) return finish("domain_not_allowed");
  let account = claim.account_name ?? "";
  if (
    claim.source !== "windows_logon" ||
    !(rule.format === "digits" ? /^[0-9]+$/ : /^[A-Za-z0-9_-]+$/).test(account)
  )
    return finish("invalid_account");
  if (rule.case === "upper") account = account.toUpperCase();
  if (rule.case === "lower") account = account.toLowerCase();
  const employeeNo = rule.employee_prefix + account;
  if (employeeNo.length > 64) return finish("invalid_account");
  // Do not rewrite any existing/future/historical association automatically.
  const bindings = (
    await c.query(
      "SELECT employee_id,source FROM installation_bindings WHERE org_id=$1 AND installation_id=$2",
      [ctx.org, ctx.installation],
    )
  ).rows;
  if (bindings.some((b) => b.source === "manual"))
    return finish("binding_preserved");
  const mapped = (
    await c.query(
      "SELECT e.* FROM employee_domain_accounts a JOIN employees e ON e.org_id=a.org_id AND e.id=a.employee_id WHERE a.org_id=$1 AND a.domain=$2 AND a.account_name=$3 FOR UPDATE OF e",
      [ctx.org, domain, account],
    )
  ).rows[0];
  if (
    bindings.length &&
    (!mapped || bindings.some((b) => b.employee_id !== mapped.id))
  )
    return finish("identity_conflict");
  let employee =
    mapped ??
    (
      await c.query(
        "SELECT * FROM employees WHERE org_id=$1 AND employee_no=$2 FOR UPDATE",
        [ctx.org, employeeNo],
      )
    ).rows[0];
  if (employee?.status === "archived") return finish("employee_archived");
  if (
    employee &&
    !mapped &&
    (
      await c.query(
        "SELECT 1 FROM employee_domain_accounts WHERE org_id=$1 AND employee_id=$2",
        [ctx.org, employee.id],
      )
    ).rowCount
  )
    return finish("identity_conflict");
  if (!employee) {
    if (!policy.auto_create) return finish("employee_missing");
    employee = (
      await c.query(
        "INSERT INTO employees(id,org_id,name,employee_no) VALUES($1,$2,$3,$3) ON CONFLICT(org_id,employee_no) DO NOTHING RETURNING *",
        [uuid(), ctx.org, employeeNo],
      )
    ).rows[0];
    if (!employee) return finish("identity_conflict");
    await audit(
      c,
      { ...ctx, account: { id: ctx.installation } },
      "identity.employee.created",
      "employee",
      employee.id,
      "根据组织域账号规则自动创建",
    );
  }
  if (!mapped)
    await c.query(
      "INSERT INTO employee_domain_accounts(org_id,domain,account_name,employee_id) VALUES($1,$2,$3,$4)",
      [ctx.org, domain, account, employee.id],
    );
  if (!bindings.length) {
    await c.query(
      "INSERT INTO installation_bindings(id,org_id,installation_id,employee_id,valid_days,reason,source) VALUES($1,$2,$3,$4,daterange((now() AT TIME ZONE 'Asia/Shanghai')::date,NULL,'[)'),'域账号自动关联；从匹配当天生效','domain')",
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
      "自动关联员工；不改写匹配日之前历史",
    );
  }
  return finish("matched");
}
