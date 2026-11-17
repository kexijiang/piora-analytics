import { isDemo } from "./api";
const labels: Record<string, string> = {
  missing: "等待账号关联",
  local: "本地账号，等待自动关联",
  unknown: "域身份未知",
  disabled: "等待历史账号自动关联",
  domain_not_allowed: "等待历史账号自动关联",
  invalid_account: "工号格式不匹配",
  employee_missing: "等待自动创建员工",
  employee_archived: "员工已停用",
  identity_conflict: "身份冲突，需人工确认",
  binding_preserved: "保留人工确认的归属",
  matched: "账号匹配成功",
};
export const identityLabel = (state?: string) =>
  labels[state ?? "missing"] ?? state;
export function IdentitySettings() {
  if (isDemo) return null;
  return (
    <section className="panel identity-settings">
      <div className="panel-heading">
        <div>
          <h2>账号自动关联</h2>
          <p>新上报和历史记录均自动关联员工，无需配置或保存。</p>
        </div>
      </div>
      <div className="identity-description">
        <p>
          域账号使用域后的登录工号，本地账号使用账号名作为员工编号。员工不存在时自动创建，姓名和部门可在员工管理中补充。
        </p>
        <p className="muted">
          员工编号在组织内唯一，不同域的同一工号关联同一员工。自动关联涵盖历史记录和后续补传；人工确认的归属不会被覆盖，账号变化或已停用员工仍需人工处理。
        </p>
      </div>
    </section>
  );
}
