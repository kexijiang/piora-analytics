import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { employeeLabel } from "./employeeLabel";
import { api, isDemo } from "./api";
import type { components } from "../../../packages/contracts/src/api.generated";
type S = components["schemas"];
export function BindingDialog({
  installation,
  employees,
  from,
  onClose,
  onCreate,
  onSaved,
}: {
  installation: S["Installation"];
  employees: S["Employee"][];
  from: string;
  onClose: () => void;
  onCreate: () => void;
  onSaved: () => void;
}) {
  const [history, setHistory] = useState<S["Binding"][]>([]),
    [selected, setSelected] = useState(""),
    [employee, setEmployee] = useState(
      installation.employee_id ?? employees[0]?.id ?? "",
    ),
    [start, setStart] = useState(from),
    [end, setEnd] = useState(""),
    [reason, setReason] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows: S["Binding"][] = [];
        let cursor: string | null = null;
        if (!isDemo)
          do {
            const r: { data: S["BindingPage"] } = await api(
              `/v1/admin/installations/${installation.id}/bindings?limit=200${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
            );
            rows.push(...r.data.items);
            cursor = r.data.next_cursor;
          } while (cursor);
        if (active) {
          setHistory(rows);
          const current = rows.find(
            (b) =>
              b.employee_id === installation.employee_id &&
              (!b.valid_from ||
                b.valid_from <=
                  new Date().toLocaleDateString("sv-SE", {
                    timeZone: "Asia/Shanghai",
                  })) &&
              (!b.valid_to ||
                b.valid_to >
                  new Date().toLocaleDateString("sv-SE", {
                    timeZone: "Asia/Shanghai",
                  })),
          );
          if (current) {
            setSelected(current.id);
            setStart(current.valid_from ?? "");
            setEnd(current.valid_to ?? "");
          }
          setLoading(false);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [installation.id]);
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-label="绑定员工">
        <div className="panel-heading">
          <h2>{selected ? "纠正安装归属" : "确认安装归属"}</h2>
          <button
            className="icon-button"
            aria-label="关闭绑定"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          {installation.device_label} · {installation.windows_username}
        </p>
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!employee || loading || busy) return;
            setBusy(true);
            setError("");
            try {
              const original = history.find((b) => b.id === selected);
              await api(
                original
                  ? `/v1/admin/bindings/${original.id}`
                  : `/v1/admin/installations/${installation.id}/bindings`,
                {
                  employee_id: employee,
                  valid_from: start || null,
                  valid_to: end || null,
                  reason,
                  expected_revision:
                    original?.revision ?? installation.revision,
                },
                original ? "PATCH" : "POST",
              );
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {loading && <p>正在读取绑定历史…</p>}
          {error && <p role="alert">{error}</p>}
          {history.length > 0 && (
            <label>
              绑定记录
              <select
                disabled={loading || busy}
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  const b = history.find((b) => b.id === e.target.value);
                  setStart(b ? (b.valid_from ?? "") : from);
                  setEnd(b?.valid_to ?? "");
                  setEmployee(b?.employee_id ?? employees[0]?.id ?? "");
                }}
              >
                <option value="">新增绑定期间</option>
                {history.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.valid_from ?? "全部历史"} 至 {b.valid_to ?? "持续"} ·{" "}
                    {employeeLabel(employees.find((e) => e.id === b.employee_id))}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!employees.length && (
            <p>
              暂无员工，请先创建员工。
              <button type="button" className="text-button" onClick={onCreate}>
                创建员工
              </button>
            </p>
          )}
          <label>
            归属员工
            <select
              disabled={loading || busy || !employees.length}
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {[e.name, e.employee_no].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </label>
          <div className="input-pair">
            <label>
              生效日期（留空包含全部历史）
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              结束日期（不包含）
              <input
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <label>
            绑定或纠错原因
            <input
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="muted">
            {selected
              ? "保存会更新所选期间的历史统计归属，并记录人工纠错。"
              : "新增期间不能与已有绑定重叠。"}
            人工确认后不再自动覆盖此设备归属。
          </p>
          <button
            className="primary"
            type="submit"
            disabled={loading || busy || !employee || !employees.length}
          >
            {selected ? "保存纠错" : "确认绑定"}
          </button>
        </form>
      </section>
    </div>
  );
}
