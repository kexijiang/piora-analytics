import { useEffect, useRef, useState } from "react";
import type { components } from "../../../packages/contracts/src/api.generated";
import { api, isDemo } from "./api";
type S = components["schemas"];
const endpoint = "/v1/admin/enrollment-keys";
function status(key: S["EnrollmentKey"]) {
  if (key.revoked_at) return "已撤销";
  if (Date.parse(key.expires_at) <= Date.now()) return "已过期";
  if (key.used_registrations >= key.max_registrations) return "次数已用尽";
  return "可用";
}
export function EnrollmentKeys() {
  const [keys, setKeys] = useState<S["EnrollmentKey"][]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cursor, setCursor] = useState("");
  const [trail, setTrail] = useState<string[]>([]);
  const [total, setTotal] = useState("0");
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"create" | "secret" | "revoke" | null>(null);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(7);
  const [limit, setLimit] = useState(50);
  const [secret, setSecret] = useState("");
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [target, setTarget] = useState<S["EnrollmentKey"] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const request = useRef(0);
  async function load(cursor = "", trail: string[] = [], search = searchTerm) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const r = await api<{ data: S["EnrollmentKeyPage"] }>(
        endpoint +
          "?limit=20" +
          (search ? "&search=" + encodeURIComponent(search) : "") +
          (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      );
      if (id !== request.current) return;
      setKeys(r.data.items);
      setCursor(cursor);
      setTrail(trail);
      setSearchTerm(search);
      setTotal(r.data.total);
      setNext(r.data.next_cursor);
    } catch {
      if (id === request.current) setError("无法加载接入凭证，请刷新重试。");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, []);
  useEffect(() => {
    if (mode && !dialog.current?.open) dialog.current?.showModal();
    if (!mode) dialog.current?.close();
  }, [mode]);
  useEffect(() => {
    if (!secret) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [secret]);
  function close() {
    if (busy) return;
    if (
      secret &&
      !window.confirm(
        "明文仅本次显示，关闭后无法再次查看。请确认已安全保存完整凭证，是否关闭？",
      )
    )
      return;
    setMode(null);
    setSecret("");
    setFeedback("");
    setFormError("");
    setTarget(null);
  }
  function openCreate() {
    setLabel("");
    setDays(7);
    setLimit(50);
    setFormError("");
    setMode("create");
  }
  return (
    <section className="panel table-panel enrollment-panel" aria-label="接入凭证管理">
      <div className="panel-heading">
        <div>
          <h2>接入凭证</h2>
          <p>
            列表仅显示元数据，历史明文无法恢复。
            {isDemo && "演示操作仅保存在内存，刷新后重置。"}
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            刷新凭证
          </button>
          <button className="primary" onClick={openCreate}>
            创建接入凭证
          </button>
        </div>
      </div>
      <form
        className="enrollment-search"
        onSubmit={(e) => {
          e.preventDefault();
          void load("", [], searchInput.trim());
        }}
      >
        <label>
          搜索用途名称
          <input
            type="search"
            maxLength={120}
            placeholder="输入用途名称关键词"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          搜索凭证
        </button>
        <button
          type="button"
          disabled={loading || (!searchInput && !searchTerm)}
          onClick={() => {
            setSearchInput("");
            void load("", [], "");
          }}
        >
          清除搜索
        </button>
      </form>
      {error && (
        <p role="alert" className="enrollment-message">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="enrollment-message">
          正在加载凭证…
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>用途名称</th>
              <th>有效期至（本地时间）</th>
              <th>允许注册次数</th>
              <th>已使用次数</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>{key.label}</td>
                <td>{new Date(key.expires_at).toLocaleString("zh-CN")}</td>
                <td>{key.max_registrations}</td>
                <td>{key.used_registrations}</td>
                <td>{status(key)}</td>
                <td>
                  <button
                    disabled={!!key.revoked_at}
                    onClick={() => {
                      setTarget(key);
                      setFormError("");
                      setMode("revoke");
                    }}
                  >
                    撤销
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !error && keys.length === 0 && (
        <p className="enrollment-message">
          {searchTerm ? "没有匹配的接入凭证" : "暂无接入凭证"}
        </p>
      )}
      <div className="table-footer enrollment-pagination" aria-label="凭证分页">
        <span>
          共 {total} 条 · 第 {trail.length + 1} 页 · 每页 20 条
        </span>
        <div className="heading-actions">
          <button
            disabled={loading || trail.length === 0}
            onClick={() =>
              void load(trail[trail.length - 1], trail.slice(0, -1))
            }
          >
            上一页凭证
          </button>
          <button
            disabled={loading || !next}
            onClick={() => next && void load(next, [...trail, cursor])}
          >
            下一页凭证
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="modal enrollment-dialog"
        aria-label={
          mode === "secret"
            ? "保存接入凭证"
            : mode === "revoke"
              ? "撤销接入凭证"
              : "创建接入凭证"
        }
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="panel-heading">
          <h2>
            {mode === "secret"
              ? "保存接入凭证"
              : mode === "revoke"
                ? "撤销接入凭证"
                : "创建接入凭证"}
          </h2>
          <button aria-label="关闭接入凭证弹窗" disabled={busy} onClick={close}>
            关闭
          </button>
        </div>
        {formError && <p role="alert">{formError}</p>}
        {mode === "create" && (
          <form
            className="settings-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              if (
                !label.trim() ||
                !Number.isInteger(days) ||
                days < 1 ||
                days > 30 ||
                !Number.isInteger(limit) ||
                limit < 1 ||
                limit > 5000
              ) {
                setFormError(
                  "请填写用途，有效期为 1–30 天，注册次数为 1–5000 的整数。",
                );
                return;
              }
              setBusy(true);
              setFormError("");
              try {
                const r = await api<{ data: S["EnrollmentCreated"] }>(
                  endpoint,
                  {
                    label: label.trim(),
                    expires_at: new Date(
                      Date.now() + days * 86400000,
                    ).toISOString(),
                    max_registrations: limit,
                  },
                );
                setSecret(r.data.secret);
                setFeedback("");
                setMode("secret");
                void load();
              } catch {
                setFormError("创建失败，请检查连接和权限后重试。");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              用途名称
              <input
                required
                maxLength={120}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label>
              有效期（天）
              <input
                required
                type="number"
                min={1}
                max={30}
                step={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
            <label>
              允许注册次数
              <input
                required
                type="number"
                min={1}
                max={5000}
                step={1}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </label>
            <p className="muted">有效期从创建时开始，最多 30 天。</p>
            <button className="primary" disabled={busy} type="submit">
              {busy ? "正在创建…" : "创建"}
            </button>
          </form>
        )}
        {mode === "secret" && (
          <div className="settings-form">
            <p>
              明文仅本次显示，关闭后无法再次查看。请安全保存，通过企业安全配置分发。
            </p>
            <label>
              完整接入凭证
              <textarea ref={textarea} readOnly rows={4} value={secret} />
            </label>
            <div className="heading-actions">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret);
                    setFeedback("已复制完整凭证，请安全保存。");
                  } catch {
                    textarea.current?.focus();
                    textarea.current?.select();
                    setFeedback(
                      "复制失败：已选中完整凭证，请按 Ctrl+C 或使用系统复制菜单手动复制。",
                    );
                  }
                }}
              >
                复制完整凭证
              </button>
              <button
                onClick={() => {
                  textarea.current?.focus();
                  textarea.current?.select();
                  setFeedback("已选中完整凭证，请手动复制。");
                }}
              >
                选择全部
              </button>
            </div>
            <p role="status">{feedback}</p>
            <button className="primary" onClick={close}>
              已保存，关闭
            </button>
          </div>
        )}
        {mode === "revoke" && target && (
          <div className="settings-form">
            <p>
              确认撤销“{target.label}
              ”？撤销后不可恢复，此凭证将不能注册新设备，已注册设备不受影响。
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setFormError("");
                try {
                  await api(endpoint + "/" + target.id + "/revoke", {
                    expected_revision: target.revision,
                    reason: "管理员在组织设置撤销接入凭证",
                  });
                  setMode(null);
                  setTarget(null);
                  void load();
                } catch {
                  setFormError(
                    "撤销失败，凭证可能已变更。请关闭弹窗并刷新列表后重试。",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认撤销
            </button>
            <button disabled={busy} onClick={close}>
              取消
            </button>
          </div>
        )}
      </dialog>
    </section>
  );
}
