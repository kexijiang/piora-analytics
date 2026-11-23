import { isDemo } from "./api";
const labels: Record<string, string> = {
  missing: "等待账号关联",
  local: "本地账号，可人工绑定",
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
          <p>设备可先上传；补报域身份后，历史记录也按员工归属。</p>
        </div>
      </div>
      <div className="identity-description">
        <p>
          域身份上报后按登录工号关联或创建员工。本地账号可上传数据，由管理员绑定员工。
        </p>
        <p className="muted">
          员工编号在组织内唯一，不同域的同一工号关联同一员工。自动关联涵盖历史记录和后续补传；人工确认的归属不会被覆盖，账号变化或已停用员工仍需人工处理。
        </p>
      </div>
    </section>
  );
}
