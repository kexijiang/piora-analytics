import { useEffect, useRef, useState } from "react";
import type { components } from "../../../packages/contracts/src/api.generated";
import { api } from "./api";
type S = components["schemas"];
export function EmployeeTable({
  departments,
  refresh,
}: {
  departments: S["Department"][];
  refresh: number;
}) {
  const [rows, setRows] = useState<S["Employee"][]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState("");
  const [trail, setTrail] = useState<string[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  async function load(cursor = "", trail: string[] = [], term = search) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "20" });
    if (term) params.set("search", term);
    if (cursor) params.set("cursor", cursor);
    try {
      const { data } = await api<{ data: S["EmployeePage"] }>(
        "/v1/admin/employees?" + params,
      );
      if (id !== request.current) return;
      setRows(data.items);
      setTotal(data.total);
      setNext(data.next_cursor);
      setCursor(cursor);
      setTrail(trail);
      setSearch(term);
    } catch {
      if (id === request.current)
        setError("无法加载员工列表，数据可能已变更，请刷新员工重试。");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [refresh]);
  return (
    <>
      <form
        className="enrollment-search"
        onSubmit={(e) => {
          e.preventDefault();
          void load("", [], input.trim());
        }}
      >
        <label>
          搜索姓名或工号
          <input
            type="search"
            maxLength={120}
            value={input}
            placeholder="输入姓名或工号关键词"
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          搜索员工
        </button>
        <button
          type="button"
          disabled={loading || (!input && !search)}
          onClick={() => {
            setInput("");
            void load("", [], "");
          }}
        >
          清除员工搜索
        </button>
        <button type="button" disabled={loading} onClick={() => void load()}>
          刷新员工
        </button>
      </form>
      {error && (
        <p role="alert" className="enrollment-message">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="enrollment-message">
          正在加载员工…
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>员工</th>
              <th>工号</th>
              <th>部门</th>
              <th>已绑定安装</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.name}</td>
                <td className="muted">{employee.employee_no ?? "—"}</td>
                <td>
                  {departments.find((d) => d.id === employee.department_id)
                    ?.name ?? "未分配"}
                </td>
                <td>{employee.installation_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !error && rows.length === 0 && (
        <p className="enrollment-message">
          {search ? "没有匹配的员工" : "暂无员工"}
        </p>
      )}
      <div className="table-footer enrollment-pagination" aria-label="员工分页">
        <span>
          共 {total} 条 · 第 {trail.length + 1} 页 · 每页 20 条
        </span>
        <div className="heading-actions">
          <button
            disabled={loading || !trail.length}
            onClick={() =>
              void load(trail[trail.length - 1], trail.slice(0, -1))
            }
          >
            上一页员工
          </button>
          <button
            disabled={loading || !next}
            onClick={() => next && void load(next, [...trail, cursor])}
          >
            下一页员工
          </button>
        </div>
      </div>
    </>
  );
}
