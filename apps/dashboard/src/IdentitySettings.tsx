import { useEffect, useState } from "react";
import { api, isDemo } from "./api";
import type { components } from "../../../packages/contracts/src/api.generated";
type Policy = components["schemas"]["IdentityPolicy"];
const labels: Record<string, string> = {
  missing: "未报告域身份",
  local: "本地账号，待人工关联",
  unknown: "域身份未知",
  disabled: "自动关联未启用",
  domain_not_allowed: "域不在允许规则内",
  invalid_account: "工号格式不匹配",
  employee_missing: "员工不存在，自动创建未启用",
  employee_archived: "员工已停用",
  identity_conflict: "身份冲突，需人工确认",
  binding_preserved: "保留人工确认的归属",
  matched: "域账号匹配成功",
};
export const identityLabel = (state?: string) =>
  labels[state ?? "missing"] ?? state;
export function IdentitySettings({ admin }: { admin: boolean }) {
  const [policy, setPolicy] = useState<Policy | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!isDemo)
      api<{ data: Policy }>("/v1/admin/settings/identity")
        .then((r) => {
          if (active) setPolicy(r.data);
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    return () => {
      active = false;
    };
  }, []);
  if (isDemo) return null;
  return (
    <section className="panel identity-settings">
      <div className="panel-heading">
        <div>
          <h2>域账号自动关联</h2>
          <p>
            按域登录账号匹配工号；从匹配当天生效，已有人工归属不会自动覆盖。
          </p>
        </div>
      </div>
      <div className="panel-body">
        <p role="status">{message}</p>
        {policy && (
          <form
            className="settings-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const result = await api<{ data: Policy }>(
                  "/v1/admin/settings/identity",
                  {
                    policy: { ...policy, version: policy.version + 1 },
                    expected_revision: policy.version,
                    reason: "管理员更新域账号规则",
                  },
                  "PATCH",
                );
                setPolicy(result.data);
                setMessage("域账号规则已保存；已有设备下次补报身份时应用");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={!admin || busy} className="identity-fields">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={policy.enabled}
                  onChange={(e) =>
                    setPolicy({ ...policy, enabled: e.target.checked })
                  }
                />
                启用域账号自动关联
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={policy.auto_create}
                  onChange={(e) =>
                    setPolicy({ ...policy, auto_create: e.target.checked })
                  }
                />
                不存在时自动创建员工
              </label>
              {policy.rules.map((rule, index) => (
                <fieldset key={index} className="identity-rule">
                  <legend>域规则 {index + 1}</legend>
                  <label>
                    域名
                    <input
                      required
                      maxLength={128}
                      aria-label={`域名 ${index + 1}`}
                      value={rule.domain}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          rules: policy.rules.map((r, i) =>
                            i === index ? { ...r, domain: e.target.value } : r,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    工号前缀
                    <input
                      aria-label={`工号前缀 ${index + 1}`}
                      value={rule.employee_prefix}
                      maxLength={32}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          rules: policy.rules.map((r, i) =>
                            i === index
                              ? { ...r, employee_prefix: e.target.value }
                              : r,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    工号格式
                    <select
                      aria-label={`工号格式 ${index + 1}`}
                      value={rule.format}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          rules: policy.rules.map((r, i) =>
                            i === index
                              ? {
                                  ...r,
                                  format: e.target.value as typeof r.format,
                                }
                              : r,
                          ),
                        })
                      }
                    >
                      <option value="digits">纯数字（保留前导零）</option>
                      <option value="alphanumeric">
                        字母、数字、下划线或连字符
                      </option>
                    </select>
                  </label>
                  <label>
                    字母大小写
                    <select
                      aria-label={`字母大小写 ${index + 1}`}
                      value={rule.case}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          rules: policy.rules.map((r, i) =>
                            i === index
                              ? { ...r, case: e.target.value as typeof r.case }
                              : r,
                          ),
                        })
                      }
                    >
                      <option value="preserve">保持原样</option>
                      <option value="upper">统一大写</option>
                      <option value="lower">统一小写</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setPolicy({
                        ...policy,
                        rules: policy.rules.filter((_, i) => i !== index),
                      })
                    }
                  >
                    删除域规则 {index + 1}
                  </button>
                </fieldset>
              ))}
              <p className="muted">
                单域可留空工号前缀。多个域须使用不同前缀，避免同名账号被误合并。客户端报告的域账号仅用于统计归属，不授予后台权限。
              </p>
              <button
                type="button"
                className="secondary"
                disabled={policy.rules.length >= 20}
                onClick={() =>
                  setPolicy({
                    ...policy,
                    rules: [
                      ...policy.rules,
                      {
                        domain: "",
                        employee_prefix: "",
                        format: "digits",
                        case: "preserve",
                      },
                    ],
                  })
                }
              >
                添加域规则
              </button>{" "}
              <button className="primary" type="submit">
                保存域账号规则
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </section>
  );
}
