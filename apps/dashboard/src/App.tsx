import { BindingDialog } from "./BindingDialog";
import { IdentitySettings, identityLabel } from "./IdentitySettings";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Command,
  Database,
  FileCode2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Monitor,
  MoreHorizontal,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  X,
  Zap,
  AlertCircle,
  Link2,
} from "lucide-react";
import type { components } from "../../../packages/contracts/src/api.generated";
import { employeeLabel } from "./employeeLabel";
import { api, isDemo } from "./api";
import { Chart } from "./Chart";
import { EmployeeTable } from "./EmployeeTable";
import { EnrollmentKeys } from "./EnrollmentKeys";
type S = components["schemas"];
type Envelope<T> = { data: T; meta?: S["ReportMeta"] };
type Page = "overview" | "people" | "models" | "code" | "health" | "settings";
const reported = (r: S["DailyRow"], key: keyof S["Metrics"]) =>
  ["no_reports", "not_enrolled"].includes(r.coverage.state)
    ? null
    : r.metrics[key];
const nav = [
  { id: "overview" as Page, title: "使用总览", icon: LayoutDashboard },
  { id: "people" as Page, title: "员工每日明细", icon: Users },
  { id: "models" as Page, title: "请求与模型", icon: Zap },
  { id: "code" as Page, title: "代码产出", icon: Code2 },
  { id: "health" as Page, title: "采集健康", icon: Activity },
  { id: "settings" as Page, title: "组织设置", icon: Settings2 },
];
const titles: Record<Page, [string, string]> = {
  overview: [
    "使用总览",
    "了解团队如何使用 Piora，以及 AI 在工作中产生的变化。",
  ],
  people: [
    "员工每日明细",
    "按人、按天查看真实使用情况，所有指标使用同一统计口径。",
  ],
  models: [
    "请求与模型",
    "区分人工 Query 和实际模型调用，追踪已报告的 Token 用量。",
  ],
  code: ["代码产出", "观察 AI 文件工具实际落盘的变化，以及可计量范围。"],
  health: ["采集健康", "查看最近报告、设备积压与身份绑定，及时发现数据缺口。"],
  settings: ["组织设置", "管理团队身份、后台访问权限和数据同步策略。"],
};
const fmt = (v: string | number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : typeof v === "string" && /^-?\d+$/.test(v)
      ? BigInt(v).toLocaleString("zh-CN")
      : Number(v).toLocaleString("zh-CN");
const compact = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return n >= 1e6
    ? (n / 1e6).toFixed(2) + " M"
    : n >= 1e4
      ? (n / 1e3).toFixed(1) + " K"
      : fmt(n);
};
const duration = (v: string | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : Math.floor(Number(v) / 3600000) +
      "h " +
      Math.floor((Number(v) % 3600000) / 60000) +
      "m";
const day = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
const statusName: Record<string, string> = {
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  interrupted: "已中断",
  running: "进行中",
  accepted: "待处理",
  queued: "排队中",
  complete: "已收到",
  partial: "部分数据",
  no_reports: "尚无报告",
  not_enrolled: "未接入",
  active: "启用",
  revoked: "已撤销",
};
function Badge({
  status,
  children,
}: {
  status: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={
        "badge " +
        (status === "complete" || status === "completed" || status === "active"
          ? "good"
          : status === "failed" || status === "revoked"
            ? "bad"
            : status === "partial"
              ? "warn"
              : "neutral")
      }
    >
      <i />
      {children ?? statusName[status] ?? status}
    </span>
  );
}
function downloadCSV(rows: S["DailyRow"][]) {
  const escape = (v: unknown) => {
    let x = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(x)) x = "'" + x;
    return '"' + x.replaceAll('"', '""') + '"';
  };
  const csv =
    "\ufeff" +
    [
      [
        "日期",
        "员工",
        "部门",
        "Query",
        "打开次数",
        "活跃毫秒",
        "Token",
        "新增行",
        "数据状态",
      ],
      ...rows.map((r) => [
        r.date,
        r.employee_name,
        r.department_name,
        r.metrics.queries,
        r.metrics.opens,
        r.metrics.active_ms,
        r.metrics.total_tokens,
        r.metrics.added_lines,
        r.coverage.state,
      ]),
    ]
      .map((r) => r.map(escape).join(","))
      .join("\r\n");
  const u = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = "piora-demo-current-page.csv";
  a.click();
  URL.revokeObjectURL(u);
}


export default function App() {
  const [page, setPage] = useState<Page>("overview"),
    [dark, setDark] = useState(
      localStorage.getItem("piora-analytics-theme") === "dark",
    ),
    [me, setMe] = useState<S["AdminUser"] | null>(null),
    [authReady, setAuthReady] = useState(false);
  const [from, setFrom] = useState(
      isDemo ? "2026-11-07" : day(new Date(Date.now() - 6 * 86400000)),
    ),
    [to, setTo] = useState(
      isDemo ? "2026-11-14" : day(new Date(Date.now() + 86400000)),
    );
  const [dept, setDept] = useState(""),
    [employee, setEmployee] = useState(""),
    [version, setVersion] = useState(""),
    [sort, setSort] = useState("date"),
    [direction, setDirection] = useState("desc"),
    [cursor, setCursor] = useState(""),
    [history, setHistory] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<S["Catalog"]>({
      employees: [],
      departments: [],
      app_versions: [],
      sources: [],
      languages: [],
    }),
    [overview, setOverview] = useState<S["Overview"] | null>(null),
    [trend, setTrend] = useState<S["TrendPoint"][]>([]),
    [daily, setDaily] = useState<S["DailyRowPage"]>({
      items: [],
      total: "0",
      next_cursor: null,
    }),
    [models, setModels] = useState<S["ModelRow"][]>([]),
    [code, setCode] = useState<S["CodeRow"][]>([]),
    [health, setHealth] = useState<S["HealthSummary"] | null>(null),
    [queries, setQueries] = useState<S["QueryPage"]>({
      items: [],
      next_cursor: null,
      total: "0",
    }),
    [meta, setMeta] = useState<S["ReportMeta"] | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [toast, setToast] = useState(""),
    [demoPanel, setDemoPanel] = useState(false),
    [demoState, setDemoState] = useState("normal"),
    [viewer, setViewer] = useState(false),
    [tab, setTab] = useState("models");
  const [person, setPerson] = useState<S["EmployeeDetail"] | null>(null),
    [query, setQuery] = useState<S["QueryDetail"] | null>(null),
    [bind, setBind] = useState<S["Installation"] | null>(null),
    [policy, setPolicy] = useState<S["SyncPolicy"] | null>(null),
    [appliedPolicy, setAppliedPolicy] = useState<S["SyncPolicy"] | null>(null),
    [accounts, setAccounts] = useState<S["AdminUser"][]>([]),
    [newForm, setNewForm] = useState(""),
    [newName, setNewName] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [newRole, setNewRole] = useState<"admin" | "viewer">("viewer"),
    [loginName, setLoginName] = useState(""),
    [loginPassword, setLoginPassword] = useState("");
  const admin = me?.role === "admin" && !(isDemo && viewer);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("piora-analytics-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    api<Envelope<S["Session"]>>("/v1/admin/auth/session")
      .then((r) => setMe(r.data.user))
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const params = useMemo(() => {
    const p = new URLSearchParams({ from, to, limit: "20", sort, direction });
    if (dept) p.set("department_ids", dept);
    if (employee) p.set("employee_ids", employee);
    if (version) p.set("app_versions", version);
    return p;
  }, [from, to, dept, employee, version, sort, direction]);
  const baseParams = useMemo(() => {
    const q = new URLSearchParams(params);
    for (const k of ["limit", "sort", "direction"]) q.delete(k);
    return q;
  }, [params]);
  useEffect(() => {
    setCursor("");
    setHistory([]);
  }, [from, to, dept, employee, version, sort, direction]);
  useEffect(() => {
    if (!me || me.must_change_password) return;
    let live = true;
    setLoading(true);
    setError("");
    const suffix = "?" + baseParams.toString(),
      p = new URLSearchParams(params);
    if (cursor) p.set("cursor", cursor);
    Promise.all([
      api<Envelope<S["Catalog"]>>("/v1/admin/analytics/catalog"),
      api<Envelope<S["Overview"]>>("/v1/admin/analytics/overview" + suffix),
      api<Envelope<S["TrendPointList"]>>("/v1/admin/analytics/trends" + suffix),
      api<Envelope<S["DailyRowPage"]>>(
        "/v1/admin/analytics/employees/daily?" + p,
      ),
      api<Envelope<S["ModelRowList"]>>("/v1/admin/analytics/models" + suffix),
      api<Envelope<S["CodeRowList"]>>("/v1/admin/analytics/code" + suffix),
      api<Envelope<S["HealthSummary"]>>("/v1/admin/analytics/health" + suffix),
      api<Envelope<S["QueryPage"]>>(
        "/v1/admin/analytics/queries" + suffix,
      ).catch((e) => {
        if (e.message === "RANGE_OUT_OF_RETENTION")
          return { data: { items: [], next_cursor: null, total: "0" } };
        throw e;
      }),
    ])
      .then(([c, o, t, d, m, co, h, q]) => {
        if (!live) return;
        setCatalog(c.data);
        setOverview(o.data);
        setTrend(t.data.items);
        setDaily(d.data);
        setModels(m.data.items);
        setCode(co.data.items);
        setHealth(h.data);
        setQueries(q.data);
        setMeta(o.meta ?? null);
      })
      .catch((e) => {
        if (live) {
          if (e.message === "CURSOR_INVALID" && cursor) {
            setCursor("");
            setHistory([]);
          } else setError(e.message);
        }
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [me, params, baseParams, cursor, refresh]);
  useEffect(() => {
    if (!me || me.must_change_password || !admin) return;
    let live = true;
    api<Envelope<S["SyncPolicy"]>>("/v1/admin/settings/sync")
      .then(({ data }) => {
        if (live)
          setAppliedPolicy((current) =>
            !current || data.version > current.version ? data : current,
          );
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [me, admin, refresh]);
  useEffect(() => {
    if (page === "settings") setPolicy(appliedPolicy);
  }, [appliedPolicy, page]);
  useEffect(() => {
    if (me && !me.must_change_password && admin && page === "settings")
      api<Envelope<S["AdminUserPage"]>>("/v1/admin/accounts")
        .then((a) => {
          setAccounts(a.data.items);
        })
        .catch((e) => setError(e.message));
  }, [me, admin, page, refresh]);
  const syncInterval = appliedPolicy
    ? `${appliedPolicy.interval_min_seconds / 60}–${appliedPolicy.interval_max_seconds / 60} 分钟`
    : admin
      ? "读取中"
      : "按组织策略";
  const notify = (message: string) => setToast(message);
  async function showPerson(id: string) {
    try {
      setPerson(
        (
          await api<Envelope<S["EmployeeDetail"]>>(
            "/v1/admin/analytics/employees/" + id + "?" + baseParams,
          )
        ).data,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function showQuery(id: string) {
    try {
      setQuery(
        (
          await api<Envelope<S["QueryDetail"]>>(
            "/v1/admin/analytics/queries/" + id + "?" + baseParams,
          )
        ).data,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function exportData() {
    if (isDemo) {
      downloadCSV(daily.items);
      notify("已导出演示数据当前页 CSV");
      return;
    }
    try {
      const kind =
        page === "models"
          ? "models"
          : page === "code"
            ? "code"
            : "employee_daily";
      const job = (
        await api<Envelope<S["ExportJob"]>>("/v1/admin/exports", {
          kind,
          from,
          to,
          employee_ids: employee ? [employee] : [],
          department_ids: dept ? [dept] : [],
          app_versions: version ? [version] : [],
        })
      ).data;
      notify("导出任务已创建，正在生成文件");
      for (const delay of [2000, 4000, 8000, 15000, 15000]) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        const r = (
          await api<Envelope<S["ExportJob"]>>("/v1/admin/exports/" + job.id)
        ).data;
        if (r.status === "completed" && r.download_path) {
          const a = document.createElement("a");
          a.href = r.download_path;
          a.download = "piora-analytics.csv";
          a.click();
          notify("导出已完成");
          return;
        }
        if (r.status === "failed") throw new Error("导出失败，请重试");
      }
      notify("导出仍在处理，可稍后重新创建或通过任务接口查询");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const lineOption = useMemo(
    () => ({
      color: ["#3978ef", "#9bb5e8"],
      textStyle: {
        fontFamily: "Inter, Microsoft YaHei UI, sans-serif",
        color: dark ? "#a1a1aa" : "#71717a",
      },
      grid: { left: 40, right: 18, top: 18, bottom: 34 },
      tooltip: { trigger: "axis" as const },
      xAxis: {
        type: "category" as const,
        data: trend.map((t) => t.bucket.slice(5).replace("-", "/")),
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        splitLine: {
          lineStyle: {
            color: dark ? "#303036" : "#eeeef0",
            type: "dashed" as const,
          },
        },
      },
      series: [
        {
          name: "人工 Query",
          type: "line" as const,
          data: trend.map((t) => Number(t.metrics.queries)),
          smooth: 0.3,
          symbolSize: 6,
          lineStyle: { width: 3 },
          areaStyle: { color: newGradient() },
        },
      ],
    }),
    [trend, dark],
  );
  function newGradient() {
    return {
      type: "linear" as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: "rgba(57,120,239,.15)" },
        { offset: 1, color: "rgba(57,120,239,0)" },
      ],
    };
  }
  const barOption = useMemo(
    () => ({
      color: ["#3978ef"],
      textStyle: { color: dark ? "#a1a1aa" : "#71717a" },
      grid: { left: 24, right: 16, top: 16, bottom: 34 },
      tooltip: { trigger: "axis" as const },
      xAxis: {
        type: "category" as const,
        data: trend.map((t) => t.bucket.slice(5)),
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        splitLine: {
          lineStyle: {
            color: dark ? "#303036" : "#eeeef0",
            type: "dashed" as const,
          },
        },
        minInterval: 1,
      },
      series: [
        {
          name: "活跃员工",
          type: "bar" as const,
          barMaxWidth: 28,
          itemStyle: { borderRadius: [5, 5, 0, 0] },
          data: trend.map((t) => Number(t.active_employees)),
        },
      ],
    }),
    [trend, dark],
  );
  const pieOption = useMemo(
    () => ({
      color: ["#3978ef", "#91afe5", "#c9d7ee", "#e6e9ef"],
      tooltip: { trigger: "item" as const },
      series: [
        {
          type: "pie" as const,
          radius: ["65%", "85%"],
          center: ["50%", "50%"],
          label: { show: false },
          itemStyle: { borderColor: dark ? "#18181b" : "#fff", borderWidth: 3 },
          data: models.map((m) => ({
            name: m.model,
            value: Number(m.total_tokens ?? 0),
          })),
        },
      ],
    }),
    [models, dark],
  );
  const activeMetrics = overview?.metrics;
  const showEmpty =
      demoState === "empty" ||
      (!loading &&
        daily.total === "0" &&
        (page === "people" || !meta?.coverage.last_received_at)),
    showError = demoState === "error" || !!error;
  const cards = [
    {
      label: "活跃员工",
      value: overview?.active_employees ?? "—",
      unit: "人",
      sub: "已确认员工 " + (overview?.confirmed_employees ?? "—") + " 人",
      icon: Users,
    },
    {
      label: "人工 Query",
      value: compact(activeMetrics?.queries),
      unit: "次",
      sub: "一次持久接收的人工提交",
      icon: Command,
    },
    {
      label: "有效活跃时长",
      value: duration(activeMetrics?.active_ms),
      unit: "",
      sub: "前台使用 · 多设备取并集",
      icon: Clock3,
    },
    {
      label: "已报告 Token",
      value: compact(activeMetrics?.total_tokens),
      unit: "",
      sub: (meta?.coverage.unknown_model_calls ?? "0") + " 次调用用量尚不完整",
      icon: Zap,
    },
    {
      label: "代码新增行",
      value: compact(activeMetrics?.added_lines),
      unit: "行",
      sub: "同时删除 " + compact(activeMetrics?.deleted_lines) + " 行",
      icon: FileCode2,
    },
    {
      label: "软件打开",
      value: fmt(activeMetrics?.opens),
      unit: "次",
      sub: "冷启动 " + fmt(activeMetrics?.launches) + " 次",
      icon: Monitor,
    },
  ];
  const table = (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>员工 / 部门</th>
            <th>日期</th>
            {[
              ["queries", "Query"],
              ["opens", "打开次数"],
              ["active_ms", "活跃时长"],
              ["total_tokens", "已报告 Token"],
              ["added_lines", "新增 / 删除行"],
            ].map(([key, label]) => (
              <th key={key}>
                <button
                  className="table-sort"
                  onClick={() => {
                    setSort(key);
                    setDirection(
                      sort === key && direction === "desc" ? "asc" : "desc",
                    );
                  }}
                >
                  {label}
                  {sort === key ? <ArrowDown size={12} /> : null}
                </button>
              </th>
            ))}
            <th>数据状态</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(page === "overview" ? daily.items.slice(0, 6) : daily.items).map(
            (r) => (
              <tr key={r.employee_id + r.date}>
                <td>
                  <button
                    className="person-cell"
                    onClick={() => showPerson(r.employee_id)}
                  >
                    <span className="avatar">{r.employee_name.slice(-2)}</span>
                    <span>
                      <strong>{r.employee_name}</strong>
                      <small>{r.department_name ?? "未分配部门"}</small>
                    </span>
                  </button>
                </td>
                <td className="muted date-cell">
                  {r.date.slice(5).replace("-", " / ")}
                </td>
                <td className="number emph">{fmt(reported(r, "queries"))}</td>
                <td className="number">{fmt(reported(r, "opens"))}</td>
                <td className="number">{duration(reported(r, "active_ms"))}</td>
                <td className="number">
                  {compact(reported(r, "total_tokens"))}
                </td>
                <td className="number">
                  <span className="positive">
                    +{fmt(reported(r, "added_lines"))}
                  </span>
                  <span className="muted deletion">
                    −{fmt(reported(r, "deleted_lines"))}
                  </span>
                </td>
                <td>
                  <Badge status={r.coverage.state} />
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={"查看 " + r.employee_name}
                    onClick={() => showPerson(r.employee_id)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
  if (!authReady)
    return <div className="loading-screen">正在连接 Piora Analytics…</div>;
  if (!me)
    return (
      <div className="login">
        <div className="login-card">
          <div className="brand-mark">
            <Command size={23} />
          </div>
          <h1>Piora Analytics</h1>
          <p className="muted">登录团队使用分析看板</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await api<Envelope<S["Session"]>>(
                  "/v1/admin/auth/login",
                  { username: loginName, password: loginPassword },
                );
                setMe(r.data.user);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              后台账号
              <input
                autoComplete="username"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                required
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="primary full" type="submit">
              登录看板 <ArrowRight size={16} />
            </button>
          </form>
          <small>员工无需登录。仅限管理员和授权查看者。</small>
          {isDemo && <p>当前为合成数据演示</p>}
        </div>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href={isDemo ? "?demo=1" : "/"}>
          <span className="brand-mark">
            <Command size={23} />
          </span>
          <span>
            Piora<span className="brand-sub">ANALYTICS</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">P</span>
          <span>
            <strong>团队工作空间</strong>
            <small>Windows 使用分析</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">工作台</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "nav-item selected" : "nav-item"}
              onClick={() => setPage(n.id)}
            >
              <n.icon size={18} />
              <span>{n.title}</span>
              {n.id === "health" &&
              health &&
              Number(health.unbound_count) > 0 ? (
                <span className="nav-count">{health.unbound_count}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-mini">
            <span className="live-dot" />
            <div>
              <strong>
                {appliedPolicy?.enabled
                  ? "批量同步已启用"
                  : appliedPolicy
                    ? "组织采集已暂停"
                    : admin
                      ? "正在读取同步策略"
                      : "设备批量同步"}
              </strong>
              <small>
                {appliedPolicy
                  ? `随机间隔 ${syncInterval}`
                  : admin
                    ? "正在读取间隔"
                    : "由管理员配置同步间隔"}
              </small>
            </div>
          </div>
          <button
            className="profile"
            onClick={() =>
              isDemo
                ? setDemoPanel(!demoPanel)
                : api("/v1/admin/auth/logout", {}, "POST").then(() =>
                    setMe(null),
                  )
            }
          >
            <span className="avatar profile-avatar">{admin ? "管" : "阅"}</span>
            <span>
              <strong>{isDemo ? "演示工作空间" : me.display_name}</strong>
              <small>{admin ? "管理员" : "只读查看者"}</small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            工作台 <ChevronRight size={13} /> <span>{titles[page][0]}</span>
          </div>
          <div className="top-actions">
            {isDemo && (
              <button
                className="demo-label"
                onClick={() => setDemoPanel(!demoPanel)}
              >
                演示 · 合成数据 <ChevronDown size={12} />
              </button>
            )}
            <span className="timezone">UTC+8 · 北京时间</span>
            <button
              className="icon-button"
              aria-label={dark ? "切换浅色主题" : "切换深色主题"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        {demoPanel && isDemo && (
          <div className="demo-panel">
            <strong>原型演示控制</strong>
            <label>
              数据状态
              <select
                value={demoState}
                onChange={(e) => setDemoState(e.target.value)}
              >
                <option value="normal">正常数据</option>
                <option value="empty">空数据</option>
                <option value="error">服务错误</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={viewer}
                onChange={(e) => setViewer(e.target.checked)}
              />
              模拟只读权限
            </label>
            <p>全部姓名、设备和数值为虚构。请求页仅展示示例请求样本。</p>
            <button onClick={() => setDemoPanel(false)}>关闭</button>
          </div>
        )}
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PIORA / TEAM INSIGHTS</div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                onClick={() => {
                  setRefresh((r) => r + 1);
                  notify("正在刷新服务端统计");
                }}
              >
                <RefreshCw size={15} className={loading ? "spin" : ""} />
                刷新
              </button>
              {page !== "settings" && (
                <button className="primary" onClick={exportData}>
                  <ArrowDownToLine size={15} />
                  导出数据
                </button>
              )}
            </div>
          </div>
          {page !== "settings" && (
            <div className="filters">
              <div className="date-filter">
                <Clock3 size={15} />
                <input
                  aria-label="开始日期"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <span>—</span>
                <input
                  aria-label="结束日期（不包含）"
                  title="结束日期不包含在统计内"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <select
                aria-label="部门筛选"
                value={dept}
                onChange={(e) => {
                  setDept(e.target.value);
                  setEmployee("");
                }}
              >
                <option value="">全部部门</option>
                {catalog.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="员工筛选"
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
              >
                <option value="">全部员工</option>
                {catalog.employees
                  .filter((e) => !dept || e.department_id === dept)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name ?? e.employee_no}
                    </option>
                  ))}
              </select>
              <select
                aria-label="版本筛选"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              >
                <option value="">全部版本</option>
                {catalog.app_versions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <button
                className="filter-reset"
                onClick={() => {
                  setDept("");
                  setEmployee("");
                  setVersion("");
                }}
              >
                <SlidersHorizontal size={14} />
                重置筛选
              </button>
            </div>
          )}
          {page !== "settings" && (
            <div className="freshness">
              <span>
                <span className="live-dot" />
                统计截至{" "}
                {meta?.coverage.data_through
                  ? new Date(meta.coverage.data_through).toLocaleTimeString(
                      "zh-CN",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Shanghai",
                      },
                    )
                  : "尚无报告"}{" "}
                <span className="separator">·</span> 低频批量同步
              </span>
              <span>
                最近报告不代表实时在线 <HelpCircle size={13} />
              </span>
            </div>
          )}
          {page === "overview" &&
            overview &&
            Number(overview.unconfirmed_installations) > 0 && (
              <div className="panel identity-notice" role="status">
                已接入 {overview.unconfirmed_installations}{" "}
                台未关联员工的设备，设备数据仍计入总览。系统会自动匹配上报账号；身份未知或冲突可到采集健康处理。
              </div>
            )}
          {showError ? (
            <div className="empty-state">
              <AlertCircle size={32} />
              <h2>暂时无法获取统计</h2>
              <p>
                {demoState === "error" ? "这是服务不可用的演示状态。" : error}
              </p>
              <button
                className="primary"
                onClick={() => {
                  setDemoState("normal");
                  setRefresh((r) => r + 1);
                }}
              >
                重新加载
              </button>
            </div>
          ) : showEmpty && page !== "settings" && page !== "health" ? (
            <div className="empty-state">
              <BarChart3 size={34} />
              <h2>这个范围内还没有数据</h2>
              <p>试试调整日期或筛选条件；尚未上报不会被当作零使用量。</p>
              <button
                onClick={() => {
                  setDemoState("normal");
                  setDept("");
                  setEmployee("");
                }}
              >
                清除筛选
              </button>
            </div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <section className="metric-grid">
                    {cards.map((c) => (
                      <article className="metric-card" key={c.label}>
                        <div className="metric-label">
                          {c.label}
                          <c.icon size={16} />
                        </div>
                        <div className="metric-value">
                          {c.value}
                          <small>{c.unit}</small>
                        </div>
                        <div className="metric-note">{c.sub}</div>
                      </article>
                    ))}
                  </section>
                  <div className="chart-grid">
                    <section className="panel trend-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>使用趋势</h2>
                          <p>人工提交的 Query，按自然日统计</p>
                        </div>
                        <span className="legend">
                          <i />
                          人工 Query
                        </span>
                      </div>
                      <Chart option={lineOption} label="每日 Query 趋势" />
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>团队活跃度</h2>
                          <p>每天有活跃行为的已确认员工</p>
                        </div>
                        <Users size={17} />
                      </div>
                      <Chart option={barOption} label="每日活跃员工柱状图" />
                    </section>
                  </div>
                  <div className="insight-strip">
                    <span className="info-icon">
                      <ShieldCheck size={19} />
                    </span>
                    <p>
                      <strong>让每个数字都可解释</strong> 当前 Token
                      含已知部分，代码指标仅覆盖可计量的文件工具操作。
                    </p>
                    <button onClick={() => setPage("health")}>
                      查看数据质量 <ArrowRight size={15} />
                    </button>
                  </div>
                  <section className="panel table-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>员工使用概览</h2>
                        <p>点击员工查看每日记录与关联设备</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setPage("people")}
                      >
                        查看全部明细 <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {table}
                    <div className="table-footer">
                      <span>
                        当前显示 {Math.min(6, daily.items.length)} 条 · 共{" "}
                        {fmt(daily.total)} 条每日记录
                      </span>
                      <span>活跃时长不等于任务运行时长</span>
                    </div>
                  </section>
                </>
              )}
              {page === "people" && (
                <>
                  <div className="summary-line">
                    <Users size={17} />
                    <strong>
                      {overview?.active_employees ?? "—"} 位活跃员工
                    </strong>
                    <span>
                      当前范围 {fmt(activeMetrics?.queries)} 个 Query ·{" "}
                      {duration(activeMetrics?.active_ms)} 有效活跃
                    </span>
                  </div>
                  <section className="panel table-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>每人每天的使用情况</h2>
                        <p>点击表头排序；未知用量显示 —，数据缺口单独标记</p>
                      </div>
                      <span className="pill">{fmt(daily.total)} 条记录</span>
                    </div>
                    {table}
                    <div className="table-footer">
                      <span>第 {history.length + 1} 页 · 每页 20 条</span>
                      <div className="pager">
                        <button
                          aria-label="上一页"
                          disabled={!history.length}
                          onClick={() => {
                            setCursor(history.at(-1) ?? "");
                            setHistory((h) => h.slice(0, -1));
                          }}
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <button
                          aria-label="下一页"
                          disabled={!daily.next_cursor}
                          onClick={() => {
                            setHistory((h) => [...h, cursor]);
                            setCursor(daily.next_cursor ?? "");
                          }}
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )}
              {page === "models" && (
                <>
                  <div className="tabs">
                    <button
                      className={tab === "models" ? "active" : ""}
                      onClick={() => setTab("models")}
                    >
                      模型用量
                    </button>
                    <button
                      className={tab === "queries" ? "active" : ""}
                      onClick={() => setTab("queries")}
                    >
                      Query 明细
                    </button>
                  </div>
                  {tab === "models" ? (
                    <>
                      <div className="model-grid">
                        <section className="panel token-panel">
                          <div className="panel-heading">
                            <div>
                              <h2>Token 分布</h2>
                              <p>仅累加供应商实际报告的用量</p>
                            </div>
                            <Zap size={18} />
                          </div>
                          <div className="donut">
                            <Chart option={pieOption} label="模型 Token 占比" />
                            <div className="donut-label">
                              <strong>
                                {compact(activeMetrics?.total_tokens)}
                              </strong>
                              <span>已报告 Token</span>
                            </div>
                          </div>
                        </section>
                        <section className="panel model-breakdown">
                          <div className="panel-heading">
                            <div>
                              <h2>用量构成</h2>
                              <p>互不重叠的 Token 分类</p>
                            </div>
                          </div>
                          {[
                            ["input_tokens", "普通输入"],
                            ["output_tokens", "模型输出"],
                            ["cache_read_tokens", "缓存读取"],
                            ["cache_write_tokens", "缓存写入"],
                          ].map(([k, t], i) => (
                            <div className="breakdown-row" key={k}>
                              <span>
                                <i
                                  style={{
                                    background: [
                                      "#3978ef",
                                      "#799dde",
                                      "#b0c6ed",
                                      "#dfe6f1",
                                    ][i],
                                  }}
                                />
                                {t}
                              </span>
                              <strong>
                                {compact(
                                  activeMetrics?.[k as keyof S["Metrics"]],
                                )}
                              </strong>
                            </div>
                          ))}
                          <div className="note-box">
                            <AlertCircle size={16} />
                            用量未完整报告的调用会保留缺口，不按免费调用处理。
                          </div>
                        </section>
                      </div>
                      <section className="panel table-panel">
                        <div className="panel-heading">
                          <h2>模型明细</h2>
                          <span className="muted">Query 跨模型不可相加</span>
                        </div>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                {[
                                  "模型 / 供应商",
                                  "实际调用",
                                  "涉及 Query",
                                  "输入 Token",
                                  "输出 Token",
                                  "缓存读取",
                                  "已报告总量",
                                  "未知调用",
                                ].map((x) => (
                                  <th key={x}>{x}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {models.map((m) => (
                                <tr key={m.provider + m.model}>
                                  <td>
                                    <strong>{m.model}</strong>
                                    <small className="subline">
                                      {m.provider}
                                    </small>
                                  </td>
                                  {[
                                    m.calls,
                                    m.queries,
                                    m.input_tokens,
                                    m.output_tokens,
                                    m.cache_read_tokens,
                                    m.total_tokens,
                                    m.unknown_calls,
                                  ].map((x, i) => (
                                    <td className="number" key={i}>
                                      {compact(x)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </>
                  ) : (
                    <section className="panel table-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>人工提交与执行记录</h2>
                          <p>
                            {isDemo
                              ? "这里展示合成请求样本，用于预览下钻交互。"
                              : "不展示提示词或代码内容。"}
                          </p>
                        </div>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {[
                                "Query ID",
                                "员工",
                                "接收时间",
                                "来源",
                                "状态",
                                "操作",
                              ].map((x) => (
                                <th key={x}>{x}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queries.items.map((q) => (
                              <tr key={q.id}>
                                <td className="mono">{q.id.slice(-12)}</td>
                                <td>
                                  {employeeLabel(catalog.employees.find((e) => e.id === q.employee_id))}
                                </td>
                                <td>
                                  {new Date(q.accepted_at).toLocaleString(
                                    "zh-CN",
                                  )}
                                </td>
                                <td>{q.source}</td>
                                <td>
                                  <Badge status={q.status} />
                                </td>
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() => showQuery(q.id)}
                                  >
                                    查看调用 <ChevronRight size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}
              {page === "code" && (
                <>
                  <section className="metric-grid four">
                    {[
                      {
                        title: "代码新增",
                        value: "+" + fmt(activeMetrics?.added_lines),
                        note: "实际落盘新增行",
                      },
                      {
                        title: "代码删除",
                        value: "−" + fmt(activeMetrics?.deleted_lines),
                        note: "修改一行通常记 +1 / −1",
                      },
                      {
                        title: "触及文件",
                        value: fmt(activeMetrics?.files_touched),
                        note: "范围内按安装与文件去重",
                      },
                      {
                        title: "新建文件",
                        value: fmt(activeMetrics?.files_created),
                        note: "成功创建文件的操作数",
                      },
                    ].map((c) => (
                      <article className="metric-card" key={c.title}>
                        <div className="metric-label">
                          {c.title}
                          <FileCode2 size={17} />
                        </div>
                        <div className="metric-value">{c.value}</div>
                        <div className="metric-note">{c.note}</div>
                      </article>
                    ))}
                  </section>
                  <div className="insight-strip">
                    <Code2 size={20} />
                    <p>
                      <strong>按落盘结果计量</strong> 包含已接入的 write /
                      edit；shell、MCP 和外部编辑器的修改不在完整覆盖范围内。
                    </p>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>语言与文件类型</h2>
                        <p>配置与文档独立列出，不计入默认“代码新增行”</p>
                      </div>
                      <span className="pill">文件工具统计</span>
                    </div>
                    <div className="language-list">
                      {code.map((c, i) => (
                        <div className="language-row" key={c.language}>
                          <span className="language-index">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="language-title">
                            <strong>{c.language}</strong>
                            <small>
                              {c.file_category === "code"
                                ? "代码"
                                : c.file_category === "config"
                                  ? "配置"
                                  : "文档"}{" "}
                              · {c.files_touched} 个文件
                            </small>
                          </div>
                          <div className="language-bar">
                            <div
                              style={{
                                width:
                                  Math.max(
                                    5,
                                    (Number(c.added_lines) /
                                      Math.max(
                                        ...code.map((x) =>
                                          Number(x.added_lines),
                                        ),
                                      )) *
                                      100,
                                  ) + "%",
                              }}
                            />
                          </div>
                          <span className="positive number">
                            +{fmt(c.added_lines)}
                          </span>
                          <span className="muted number">
                            −{fmt(c.deleted_lines)}
                          </span>
                          <span className="muted">
                            {c.unmeasured_operations} 次未计量
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {page === "health" && (
                <>
                  <section className="metric-grid four">
                    {[
                      {
                        title: "已接入安装",
                        value: health?.installations.length ?? 0,
                        note: "设备实例，不等于员工人数",
                      },
                      {
                        title: "待确认身份",
                        value: health?.unbound_count ?? 0,
                        note: "绑定后计入员工统计",
                      },
                      {
                        title: "报告较旧",
                        value: health?.stale_report_count ?? 0,
                        note: "超过同步策略与缓冲窗口",
                      },
                      {
                        title: "聚合延迟",
                        value: (health?.aggregation_lag_seconds ?? 0) + "s",
                        note: "服务端收到后的处理延迟",
                      },
                    ].map((c) => (
                      <article className="metric-card" key={c.title}>
                        <div className="metric-label">
                          {c.title}
                          <Activity size={16} />
                        </div>
                        <div className="metric-value">{c.value}</div>
                        <div className="metric-note">{c.note}</div>
                      </article>
                    ))}
                  </section>
                  <section className="panel table-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>安装实例与同步状态</h2>
                        <p>
                          域账号自动关联员工，本地账号可人工绑定；身份冲突可由管理员纠错
                        </p>
                      </div>
                      <span className="pill">
                        {appliedPolicy
                          ? `组织策略 ${syncInterval}`
                          : "按组织策略同步"}
                      </span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {[
                              "设备 / Windows 账号",
                              "归属员工",
                              "版本",
                              "最近报告",
                              "上次积压",
                              "身份状态",
                              "操作",
                            ].map((x) => (
                              <th key={x}>{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {health?.installations.map((i) => (
                            <tr key={i.id}>
                              <td>
                                <strong>{i.device_label}</strong>
                                <small className="subline">
                                  {i.windows_username}
                                </small>
                              </td>
                              <td>
                                {employeeLabel(
                                  catalog.employees.find(
                                    (e) => e.id === i.employee_id,
                                  ),
                                )}
                              </td>
                              <td>
                                <span className="version-chip">
                                  {i.app_version}
                                </span>
                              </td>
                              <td>
                                {i.last_received_at
                                  ? new Date(
                                      i.last_received_at,
                                    ).toLocaleTimeString("zh-CN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "尚无报告"}
                              </td>
                              <td className="number">
                                {fmt(i.reported_queue_events)}
                              </td>
                              <td>
                                <Badge
                                  status={
                                    i.employee_id ? "complete" : "partial"
                                  }
                                >
                                  {i.employee_id ? "已绑定" : "待绑定"}
                                </Badge>
                                <div className="muted">
                                  {identityLabel(i.identity_status?.state)}
                                  {["automatic"].includes(
                                    i.identity_status?.binding_source ?? "",
                                  )
                                    ? " · 自动关联"
                                    : i.identity_status?.binding_source ===
                                        "manual"
                                      ? " · 人工绑定"
                                      : ""}
                                </div>
                                {i.identity_status?.identity?.domain && (
                                  <div className="muted">
                                    {i.identity_status.identity.domain}\
                                    {i.identity_status.identity.account_name}
                                  </div>
                                )}
                              </td>
                              <td>
                                {admin ? (
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      setBind(i);
                                    }}
                                  >
                                    <Link2 size={14} />
                                    绑定员工
                                  </button>
                                ) : (
                                  <span className="muted">只读</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <div className="insight-strip">
                    <Clock3 size={20} />
                    <p>
                      <strong>同步不抢占正常工作</strong>{" "}
                      本地持续记账，断网保留队列；恢复网络后随机错峰补传，退出时只保存本地。
                    </p>
                  </div>
                </>
              )}
              {page === "settings" &&
                (!admin ? (
                  <div className="empty-state">
                    <ShieldCheck size={32} />
                    <h2>当前账号为只读角色</h2>
                    <p>可以查看和导出统计，组织设置由管理员维护。</p>
                  </div>
                ) : (
                  <>
                    <div className="settings-grid">
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>同步策略</h2>
                            <p>低频、错峰，策略随下一次上报下发</p>
                          </div>
                          <span className="pill">v{policy?.version ?? 1}</span>
                        </div>
                        <form
                          className="settings-form"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!policy) return;
                            if (
                              ![
                                policy.interval_min_seconds,
                                policy.interval_max_seconds,
                              ].every(
                                (seconds) =>
                                  Number.isSafeInteger(seconds / 60) &&
                                  seconds > 0,
                              )
                            ) {
                              notify("请输入大于 0 的整数分钟");
                              return;
                            }
                            if (
                              policy.interval_max_seconds <
                              policy.interval_min_seconds
                            ) {
                              notify("最长同步间隔不能小于最短同步间隔");
                              return;
                            }
                            try {
                              const result = await api<
                                Envelope<S["SyncPolicy"]>
                              >(
                                "/v1/admin/settings/sync",
                                {
                                  policy: {
                                    ...policy,
                                    version: policy.version + 1,
                                  },
                                  expected_revision: policy.version,
                                  reason: "后台调整同步策略",
                                },
                                "PATCH",
                              );
                              setPolicy(result.data);
                              setAppliedPolicy(result.data);
                              notify(
                                isDemo
                                  ? "演示策略已保存（不会发送到真实设备）"
                                  : "策略已保存，将在设备下次上报时下发",
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          <div className="input-pair">
                            <label>
                              最短间隔（分钟）
                              <input
                                aria-label="最短同步间隔"
                                type="number"
                                min={1}
                                step={1}
                                required
                                disabled={!policy}
                                value={
                                  (policy?.interval_min_seconds ?? 1500) / 60
                                }
                                onChange={(e) =>
                                  setPolicy((p) =>
                                    p
                                      ? {
                                          ...p,
                                          interval_min_seconds:
                                            Number(e.target.value) * 60,
                                        }
                                      : p,
                                  )
                                }
                              />
                            </label>
                            <label>
                              最长间隔（分钟）
                              <input
                                aria-label="最长同步间隔"
                                type="number"
                                min={1}
                                step={1}
                                required
                                disabled={!policy}
                                value={
                                  (policy?.interval_max_seconds ?? 2100) / 60
                                }
                                onChange={(e) =>
                                  setPolicy((p) =>
                                    p
                                      ? {
                                          ...p,
                                          interval_max_seconds:
                                            Number(e.target.value) * 60,
                                        }
                                      : p,
                                  )
                                }
                              />
                            </label>
                          </div>
                          <div className="setting-note">
                            <Check size={15} />
                            可设置任意正整数分钟，每台设备每轮独立随机选择间隔
                          </div>
                          <p className="muted">
                            默认建议 25–35 分钟。旧版 Piora
                            会保留其支持的兼容间隔，请升级客户端后验证自定义策略。
                          </p>
                          <div className="key-values">
                            <span>
                              首次启动延迟<strong>1–5 分钟</strong>
                            </span>
                            <span>
                              网络恢复延迟<strong>2–10 分钟</strong>
                            </span>
                            <span>
                              单批上限<strong>500 条 / 256 KiB</strong>
                            </span>
                            <span>
                              本地离线保留<strong>30 天 / 256 MiB</strong>
                            </span>
                          </div>
                          <button
                            className="primary"
                            type="submit"
                            disabled={!policy}
                          >
                            保存同步策略
                          </button>
                        </form>
                      </section>
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>数据与接入</h2>
                            <p>只采集统计元数据</p>
                          </div>
                          <Database size={18} />
                        </div>
                        <div className="settings-form">
                          <div className="key-values">
                            <span>
                              原始事件与明细<strong>90 天</strong>
                            </span>
                            <span>
                              日汇总<strong>24 个月</strong>
                            </span>
                            <span>
                              统计时区<strong>Asia/Shanghai</strong>
                            </span>
                            <span>
                              代码计量<strong>文件工具落盘结果</strong>
                            </span>
                          </div>
                          <p className="muted">
                            不上传提示词、回复、代码、diff 或文件路径。
                          </p>
                        </div>
                      </section>
                    </div>
                    <IdentitySettings />
                    <EnrollmentKeys />
                    <section
                      className="panel table-panel enrollment-panel"
                      aria-label="员工管理"
                    >
                      <div className="panel-heading">
                        <div>
                          <h2>员工与部门</h2>
                          <p>
                            上报账号自动创建并关联员工；可补充姓名和部门，或在采集健康纠正归属
                          </p>
                          <p>
                            已建部门：
                            {catalog.departments.length
                              ? catalog.departments.map((d) => (
                                  <span className="badge" key={d.id}>
                                    {d.name}
                                  </span>
                                ))
                              : "暂无"}
                          </p>
                        </div>
                        <div className="heading-actions">
                          <button
                            onClick={() => {
                              setNewForm("department");
                              setNewName("");
                            }}
                          >
                            <Plus size={14} />
                            添加部门
                          </button>
                          <button
                            onClick={() => {
                              setNewForm("employee");
                              setNewName("");
                            }}
                          >
                            <Plus size={14} />
                            添加员工
                          </button>
                        </div>
                      </div>
                      <EmployeeTable
                        departments={catalog.departments}
                        refresh={refresh}
                      />
                    </section>
                    <section className="panel table-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>后台访问账号</h2>
                          <p>员工无需登录后台；查看者不能修改组织设置</p>
                        </div>
                        <button
                          onClick={() => {
                            setNewForm("account");
                            setNewName("");
                            setNewPassword("");
                          }}
                        >
                          <Plus size={14} />
                          添加账号
                        </button>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>账号</th>
                              <th>显示名</th>
                              <th>角色</th>
                              <th>状态</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accounts.map((a) => (
                              <tr key={a.id}>
                                <td>{a.username}</td>
                                <td>{a.display_name}</td>
                                <td>
                                  {a.role === "admin" ? "管理员" : "只读查看者"}
                                </td>
                                <td>
                                  <Badge status={a.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                ))}
            </>
          )}
          <footer className="page-footer">
            <span>
              Piora Analytics <span className="separator">/</span> 团队使用分析
            </span>
            <span>
              UTC+8 · 日期范围不包含结束日 {isDemo ? "· 所有数据均为演示" : ""}
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {person && (
        <div className="drawer-backdrop" onClick={() => setPerson(null)}>
          <aside
            className="drawer"
            role="dialog"
            aria-label="员工详情"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="drawer-close icon-button"
              aria-label="关闭员工详情"
              onClick={() => setPerson(null)}
            >
              <X size={20} />
            </button>
            <span className="avatar large">
              {(person.employee.name ?? person.employee.employee_no ?? "").slice(-2)}
            </span>
            <div className="eyebrow">EMPLOYEE INSIGHT</div>
            <h2>{person.employee.name ?? person.employee.employee_no}</h2>
            <p className="muted">
              {person.employee.employee_no ?? "未设置工号"} ·{" "}
              {catalog.departments.find(
                (d) => d.id === person.employee.department_id,
              )?.name ?? "未分配部门"}
            </p>
            <div className="drawer-summary">
              <div>
                <strong>
                  {fmt(
                    person.daily.reduce(
                      (s, r) => s + Number(r.metrics.queries),
                      0,
                    ),
                  )}
                </strong>
                <span>人工 Query</span>
              </div>
              <div>
                <strong>
                  {duration(
                    String(
                      person.daily.reduce(
                        (s, r) => s + Number(r.metrics.active_ms),
                        0,
                      ),
                    ),
                  )}
                </strong>
                <span>有效活跃</span>
              </div>
            </div>
            <h3>每日记录</h3>
            <div className="drawer-days">
              {person.daily.map((r) => (
                <div key={r.date}>
                  <span>{r.date}</span>
                  <strong>{r.metrics.queries} Query</strong>
                  <span>{duration(r.metrics.active_ms)}</span>
                </div>
              ))}
            </div>
            <h3>关联安装</h3>
            {person.installations.map((i) => (
              <div className="device-card" key={i.id}>
                <Monitor size={19} />
                <div>
                  <strong>{i.device_label}</strong>
                  <small>
                    {i.windows_username} · {i.app_version}
                  </small>
                </div>
                <Badge status="complete">已绑定</Badge>
              </div>
            ))}
            <div className="note-box">
              <HelpCircle size={16} />
              活跃时长对该员工的多台设备取时间并集。
            </div>
          </aside>
        </div>
      )}
      {query && (
        <div className="modal-backdrop" onClick={() => setQuery(null)}>
          <section
            className="modal wide"
            role="dialog"
            aria-label="Query 详情"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <h2>Query 调用详情</h2>
                <p className="mono">{query.query.id}</p>
              </div>
              <button
                className="icon-button"
                aria-label="关闭 Query 详情"
                onClick={() => setQuery(null)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="summary-line">
              <Badge status={query.query.status} />
              <span>
                {query.calls.length} 次已返回模型调用 ·{" "}
                {compact(query.query.metrics.total_tokens)} Token
              </span>
            </div>
            {query.calls.map((c) => (
              <div className="call-card" key={c.id}>
                <Zap size={19} />
                <div>
                  <strong>{c.model}</strong>
                  <small>
                    {c.provider} · {c.source} · {duration(c.duration_ms)}
                  </small>
                </div>
                <strong>{compact(c.total_tokens)}</strong>
              </div>
            ))}
            <div className="note-box">
              <ShieldCheck size={16} />
              仅显示统计元数据，不保存请求原文和代码内容。
            </div>
          </section>
        </div>
      )}
      {bind && (
        <BindingDialog
          installation={bind}
          employees={catalog.employees}
          from={from}
          onClose={() => setBind(null)}
          onCreate={() => {
            setBind(null);
            setPage("settings");
            setNewForm("employee");
            setNewName("");
          }}
          onSaved={() => {
            setBind(null);
            setRefresh((r) => r + 1);
            notify("归属已保存，人工确认结果优先");
          }}
        />
      )}
      {newForm && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog">
            <div className="panel-heading">
              <h2>
                {
                  {
                    employee: "添加员工",
                    department: "添加部门",
                    account: "添加后台账号",
                  }[newForm]
                }
              </h2>
              <button
                className="icon-button"
                aria-label="关闭表单"
                onClick={() => setNewForm("")}
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (isDemo) {
                    notify("演示模式：创建操作预览完成，不写入真实组织");
                    setNewForm("");
                    return;
                  }
                  const endpoint = {
                    employee: "employees",
                    department: "departments",
                    account: "accounts",
                  }[newForm];
                  const body =
                    newForm === "employee"
                      ? {
                          name: newName,
                          employee_no: null,
                          department_id: dept || null,
                        }
                      : newForm === "department"
                        ? { name: newName }
                        : {
                            username: newName,
                            display_name: newName,
                            role: newRole,
                            temporary_password: newPassword,
                          };
                  await api("/v1/admin/" + endpoint, body);
                  setNewForm("");
                  setRefresh((r) => r + 1);
                  notify("已创建");
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <label>
                {newForm === "account" ? "账号" : "名称"}
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              {newForm === "employee" && (
                <label>
                  部门
                  <select
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                  >
                    <option value="">未分配</option>
                    {catalog.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {newForm === "account" && (
                <>
                  <label>
                    角色
                    <select
                      value={newRole}
                      onChange={(e) =>
                        setNewRole(e.target.value as "admin" | "viewer")
                      }
                    >
                      <option value="viewer">只读查看者</option>
                      <option value="admin">管理员</option>
                    </select>
                  </label>
                  <label>
                    临时密码
                    <input
                      type="password"
                      minLength={12}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </label>
                </>
              )}
              <button className="primary" type="submit">
                创建
              </button>
            </form>
          </section>
        </div>
      )}
      {me.must_change_password && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-label="修改初始密码">
            <h2>请修改临时密码</h2>
            <form
              className="settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api("/v1/admin/auth/change-password", {
                    current_password: loginPassword,
                    new_password: newPassword,
                  });
                  const s = await api<Envelope<S["Session"]>>(
                    "/v1/admin/auth/session",
                  );
                  setMe(s.data.user);
                  setRefresh((r) => r + 1);
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <label>
                当前密码
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </label>
              <label>
                新密码（至少 12 位）
                <input
                  type="password"
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </label>
              <button className="primary" type="submit">
                保存新密码
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
