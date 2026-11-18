import { identityPolicy, updateIdentityPolicy } from "./identity.mjs";
import {
  ApiError,
  one,
  uuid,
  token,
  secretHash,
  audit,
  page,
  adminDTO,
  departmentDTO,
  employeeDTO,
  clean,
} from "./core.mjs";
import { passwordHash } from "./auth.mjs";
import { employees, installations } from "./reports.mjs";
import { getPolicy } from "./ingest.mjs";
import { validatePolicy } from "../../../packages/contracts/telemetry.mjs";
const bindingDTO = (r) => ({
  id: r.id,
  installation_id: r.installation_id,
  employee_id: r.employee_id,
  valid_from: r.valid_from,
  valid_to: r.valid_to,
  reason: r.reason,
  revision: r.revision,
});
const enrollDTO = (r) =>
  clean(
    Object.fromEntries(
      [
        "id",
        "label",
        "expires_at",
        "max_registrations",
        "used_registrations",
        "revoked_at",
        "revision",
      ].map((k) => [k, r[k]]),
    ),
  );
const locked = async (c, table, id, ctx, expected) => {
  const r = await one(
    c,
    "SELECT * FROM " + table + " WHERE org_id=$1 AND id=$2 FOR UPDATE",
    [ctx.org, id],
  );
  if (expected !== undefined && r.revision !== expected)
    throw new ApiError(409, "REVISION_CONFLICT");
  return r;
};
const currentDay = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );
async function departmentChange(c, ctx, employee, department, from) {
  if (department)
    await one(
      c,
      "SELECT id FROM departments WHERE org_id=$1 AND id=$2 AND status='active'",
      [ctx.org, department],
    );
  const next = (
    await c.query(
      "SELECT min(lower(valid_days))::text AS day FROM employee_department_periods WHERE org_id=$1 AND employee_id=$2 AND lower(valid_days)>$3::date",
      [ctx.org, employee, from],
    )
  ).rows[0].day;
  await c.query(
    "DELETE FROM employee_department_periods WHERE org_id=$1 AND employee_id=$2 AND lower(valid_days)=$3::date",
    [ctx.org, employee, from],
  );
  await c.query(
    "UPDATE employee_department_periods SET valid_days=daterange(lower(valid_days),$3::date,'[)'),revision=revision+1 WHERE org_id=$1 AND employee_id=$2 AND valid_days @> $3::date",
    [ctx.org, employee, from],
  );
  await c.query(
    "INSERT INTO employee_department_periods(id,org_id,employee_id,department_id,valid_days,reason) VALUES($1,$2,$3,$4,daterange($5::date,$6::date,'[)'),'管理员维护')",
    [uuid(), ctx.org, employee, department, from, next],
  );
}
export async function adminOperation(c, id, b, q, p, ctx) {
  if (id === "listEmployee")
    return page(
      (await employees(c, ctx.org)).filter(
        (r) =>
          !q.search ||
          (r.name + " " + (r.employee_no ?? "")).toLowerCase().includes(q.search.trim().toLowerCase()),
      ),
      q,
      ctx,
    );
  if (id === "listDepartment")
    return page(
      (
        await c.query(
          "SELECT * FROM departments WHERE org_id=$1 ORDER BY name,id",
          [ctx.org],
        )
      ).rows
        .filter((r) => !q.search || r.name.includes(q.search))
        .map(departmentDTO),
      q,
      ctx,
    );
  if (id === "listAdminUser")
    return page(
      (
        await c.query(
          "SELECT * FROM admin_accounts WHERE org_id=$1 ORDER BY username,id",
          [ctx.org],
        )
      ).rows
        .filter(
          (r) =>
            !q.search || (r.username + " " + r.display_name).includes(q.search),
        )
        .map(adminDTO),
      q,
      ctx,
    );
  if (["createEmployee", "createDepartment", "createAdminUser"].includes(id)) {
    const key = uuid();
    if (id === "createEmployee") {
      await c.query(
        "INSERT INTO employees(id,org_id,name,employee_no) VALUES($1,$2,$3,$4)",
        [key, ctx.org, b.name, b.employee_no],
      );
      await departmentChange(c, ctx, key, b.department_id, currentDay());
    }
    if (id === "createDepartment")
      await c.query(
        "INSERT INTO departments(id,org_id,name) VALUES($1,$2,$3)",
        [key, ctx.org, b.name],
      );
    if (id === "createAdminUser")
      await c.query(
        "INSERT INTO admin_accounts(id,org_id,username,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)",
        [
          key,
          ctx.org,
          b.username.toLowerCase(),
          b.display_name,
          await passwordHash(b.temporary_password),
          b.role,
        ],
      );
    await audit(c, ctx, id, "admin_resource", key, "创建管理对象");
    if (id === "createEmployee")
      return (await employees(c, ctx.org)).find((e) => e.id === key);
    if (id === "createDepartment")
      return departmentDTO(
        await one(c, "SELECT * FROM departments WHERE id=$1", [key]),
      );
    return adminDTO(
      await one(c, "SELECT * FROM admin_accounts WHERE id=$1", [key]),
    );
  }
  const match = /^(update|archive)(Employee|Department|AdminUser)$/.exec(id);
  if (match) {
    const [, action, kind] = match,
      table = {
        Employee: "employees",
        Department: "departments",
        AdminUser: "admin_accounts",
      }[kind];
    // Serialize all account role mutations to preserve the last-administrator invariant.
    if (kind === "AdminUser")
      await c.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
        ctx.org,
      ]);
    const r = await locked(c, table, p.id, ctx, b.expected_revision);
    if (
      kind === "AdminUser" &&
      r.role === "admin" &&
      r.status === "active" &&
      (action === "archive" || b.role !== "admin" || b.status !== "active")
    ) {
      if (
        Number(
          (
            await c.query(
              "SELECT count(*) FROM admin_accounts WHERE org_id=$1 AND role='admin' AND status='active'",
              [ctx.org],
            )
          ).rows[0].count,
        ) <= 1
      )
        throw new ApiError(409, "LAST_ADMIN_REQUIRED");
    }
    if (action === "archive") {
      if (
        kind === "Department" &&
        (
          await c.query(
            "SELECT 1 FROM employee_department_periods WHERE org_id=$1 AND department_id=$2 AND valid_days @> (now() AT TIME ZONE 'Asia/Shanghai')::date",
            [ctx.org, p.id],
          )
        ).rowCount
      )
        throw new ApiError(409, "DEPARTMENT_IN_USE");
      await c.query(
        "UPDATE " +
          table +
          " SET status=$3,revision=revision+1 WHERE org_id=$1 AND id=$2",
        [ctx.org, p.id, kind === "AdminUser" ? "disabled" : "archived"],
      );
    } else if (kind === "Employee") {
      if (Date.parse(b.effective_from) < Date.now() - 731 * 86400000)
        throw new ApiError(422, "RANGE_OUT_OF_RETENTION");
      await c.query(
        "UPDATE employees SET name=$3,name_is_placeholder=false,employee_no=$4,revision=revision+1 WHERE org_id=$1 AND id=$2",
        [ctx.org, p.id, b.name, b.employee_no],
      );
      await departmentChange(c, ctx, p.id, b.department_id, b.effective_from);
    } else if (kind === "Department")
      await c.query(
        "UPDATE departments SET name=$3,revision=revision+1 WHERE org_id=$1 AND id=$2",
        [ctx.org, p.id, b.name],
      );
    else
      await c.query(
        "UPDATE admin_accounts SET display_name=$3,role=$4,status=$5,revision=revision+1 WHERE org_id=$1 AND id=$2",
        [ctx.org, p.id, b.display_name, b.role, b.status],
      );
    if (kind === "AdminUser")
      await c.query(
        "UPDATE admin_sessions SET revoked_at=now() WHERE org_id=$1 AND account_id=$2",
        [ctx.org, p.id],
      );
    await audit(c, ctx, id, table, p.id, b.reason ?? "更新管理对象");
    if (action === "archive") return { ok: true };
    if (kind === "Employee")
      return (await employees(c, ctx.org)).find((e) => e.id === p.id);
    return (kind === "Department" ? departmentDTO : adminDTO)(
      await one(c, "SELECT * FROM " + table + " WHERE id=$1", [p.id]),
    );
  }
  if (id === "revokeSessions") {
    await locked(c, "admin_accounts", p.id, ctx, b.expected_revision);
    await c.query(
      "UPDATE admin_sessions SET revoked_at=now() WHERE org_id=$1 AND account_id=$2",
      [ctx.org, p.id],
    );
    await audit(c, ctx, id, "account", p.id, b.reason);
    return { ok: true };
  }
  if (id === "listInstallations" || id === "getInstallation") {
    const rows = (await installations(c, ctx.org)).filter(
      (r) =>
        !q.search ||
        (r.windows_username + " " + r.device_label).includes(q.search),
    );
    if (id === "listInstallations") return page(rows, q, ctx);
    const r = rows.find((x) => x.id === p.id);
    if (!r) throw new ApiError(404, "NOT_FOUND");
    return r;
  }
  if (id === "listBindings") {
    await one(c, "SELECT id FROM installations WHERE org_id=$1 AND id=$2", [
      ctx.org,
      p.id,
    ]);
    return page(
      (
        await c.query(
          "SELECT *,lower(valid_days)::text AS valid_from,upper(valid_days)::text AS valid_to FROM installation_bindings WHERE org_id=$1 AND installation_id=$2 ORDER BY lower(valid_days),id",
          [ctx.org, p.id],
        )
      ).rows.map(bindingDTO),
      q,
      ctx,
    );
  }
  if (id === "createBinding" || id === "correctBinding") {
    if (
      (b.valid_from && b.valid_to && b.valid_to <= b.valid_from) ||
      (b.valid_from && Date.parse(b.valid_from) < Date.now() - 731 * 86400000)
    )
      throw new ApiError(422, "RANGE_OUT_OF_RETENTION");
    // Identity matching locks installation before employee; use the same order.
    if (id === "correctBinding") {
      const binding = await one(c, "SELECT installation_id FROM installation_bindings WHERE org_id=$1 AND id=$2", [ctx.org, p.id]);
      await one(c, "SELECT id FROM installations WHERE org_id=$1 AND id=$2 FOR UPDATE", [ctx.org, binding.installation_id]);
    }
    const old = await locked(
        c,
        id === "createBinding" ? "installations" : "installation_bindings",
        p.id,
        ctx,
        b.expected_revision,
      ),
      key = id === "createBinding" ? uuid() : p.id,
      inst = id === "createBinding" ? p.id : old.installation_id;
    await one(
      c,
      "SELECT id FROM employees WHERE org_id=$1 AND id=$2 AND status='active' FOR UPDATE",
      [ctx.org, b.employee_id],
    );
    if (id === "createBinding")
      await c.query(
        "INSERT INTO installation_bindings(id,org_id,installation_id,employee_id,valid_days,reason) VALUES($1,$2,$3,$4,daterange($5::date,$6::date,'[)'),$7)",
        [key, ctx.org, inst, b.employee_id, b.valid_from, b.valid_to, b.reason],
      );
    else
      await c.query(
        "UPDATE installation_bindings SET source='manual',employee_id=$3,valid_days=daterange($4::date,$5::date,'[)'),reason=$6,revision=revision+1 WHERE org_id=$1 AND id=$2",
        [ctx.org, key, b.employee_id, b.valid_from, b.valid_to, b.reason],
      );
    await c.query(
      "UPDATE installations SET revision=revision+1 WHERE org_id=$1 AND id=$2",
      [ctx.org, inst],
    );
    await audit(c, ctx, id, "binding", key, b.reason);
    return bindingDTO(
      await one(
        c,
        "SELECT *,lower(valid_days)::text AS valid_from,upper(valid_days)::text AS valid_to FROM installation_bindings WHERE id=$1",
        [key],
      ),
    );
  }
  if (id === "revokeInstallation") {
    await locked(c, "installations", p.id, ctx, b.expected_revision);
    await c.query(
      "UPDATE installations SET status='revoked',revision=revision+1 WHERE org_id=$1 AND id=$2",
      [ctx.org, p.id],
    );
    await c.query(
      "UPDATE installation_credentials SET revoked_at=now() WHERE org_id=$1 AND installation_id=$2",
      [ctx.org, p.id],
    );
    await audit(c, ctx, id, "installation", p.id, b.reason);
    return { ok: true };
  }
  if (id === "listEnrollment")
    return page(
      (
        await c.query(
          "SELECT id,label,expires_at,max_registrations,used_registrations,revoked_at,revision FROM enrollment_keys WHERE org_id=$1 AND strpos(lower(label), lower($2::text)) > 0 ORDER BY created_at DESC,id",
          [ctx.org, (q.search ?? "").trim()],
        )
      ).rows.map(enrollDTO),
      q,
      ctx,
    );
  if (id === "createEnrollment") {
    if (
      !Number.isFinite(Date.parse(b.expires_at)) ||
      Date.parse(b.expires_at) <= Date.now()
    )
      throw new ApiError(422, "POLICY_INVALID");
    const key = uuid(),
      secret = token();
    await c.query(
      "INSERT INTO enrollment_keys(id,org_id,label,secret_hash,expires_at,max_registrations) VALUES($1,$2,$3,$4,$5,$6)",
      [
        key,
        ctx.org,
        b.label,
        secretHash(secret, ctx.pepper),
        b.expires_at,
        b.max_registrations,
      ],
    );
    await audit(c, ctx, id, "enrollment", key, b.label);
    return {
      key: enrollDTO(
        await one(c, "SELECT * FROM enrollment_keys WHERE id=$1", [key]),
      ),
      secret: "enroll." + key + "." + secret,
    };
  }
  if (id === "revokeEnrollment") {
    await locked(c, "enrollment_keys", p.id, ctx, b.expected_revision);
    await c.query(
      "UPDATE enrollment_keys SET revoked_at=now(),revision=revision+1 WHERE org_id=$1 AND id=$2",
      [ctx.org, p.id],
    );
    await audit(c, ctx, id, "enrollment", p.id, b.reason);
    return { ok: true };
  }
  if (id === "getIdentityPolicy") return identityPolicy(c, ctx.org);
  if (id === "updateIdentityPolicy") return updateIdentityPolicy(c,b,ctx);
  if (id === "getSync") return getPolicy(c, ctx.org);
  if (id === "getRetention")
    return (
      await one(
        c,
        "SELECT value FROM org_settings WHERE org_id=$1 AND name='retention'",
        [ctx.org],
      )
    ).value;
  if (id === "updateSync" || id === "updateRetention") {
    const name = id === "updateSync" ? "sync" : "retention",
      r = await one(
        c,
        "SELECT * FROM org_settings WHERE org_id=$1 AND name=$2 FOR UPDATE",
        [ctx.org, name],
      );
    if (
      r.revision !== b.expected_revision ||
      (b.policy.version ?? b.policy.revision) !== b.expected_revision + 1
    )
      throw new ApiError(409, "REVISION_CONFLICT");
    if (name === "sync")
      try {
        validatePolicy(b.policy);
      } catch {
        throw new ApiError(422, "POLICY_INVALID");
      }
    await c.query(
      "UPDATE org_settings SET value=$3,revision=revision+1,updated_at=now() WHERE org_id=$1 AND name=$2",
      [ctx.org, name, b.policy],
    );
    await audit(c, ctx, id, "organization", ctx.org, b.reason);
    return b.policy;
  }
  if (id === "listAudit") {
    const rows = clean(
      (
        await c.query(
          "SELECT id,actor_id,action,target_type,target_id,occurred_at,summary FROM audit_logs WHERE org_id=$1 AND occurred_at>=($2::date::timestamp AT TIME ZONE 'Asia/Shanghai') AND occurred_at<($3::date::timestamp AT TIME ZONE 'Asia/Shanghai') ORDER BY occurred_at DESC,id",
          [ctx.org, q.from, q.to],
        )
      ).rows,
    );
    return page(rows, q, ctx);
  }
  throw new ApiError(404, "NOT_FOUND");
}
