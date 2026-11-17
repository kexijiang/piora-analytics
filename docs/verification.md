# 本地验证记录

2026-11-17：新增域身份可选注册字段、能力发现与已有设备补报、组织规则和自动员工关联，以及未绑定设备总览和空员工引导。见[域账号自动关联](domain-identity.md)。该功能在独立开发目录验证，未升级正在运行的本地服务；真实公司域环境及客户端端到端接入仍待 Piora #462。

本次服务端功能验证结果（全部为合成域账号，未部署当前运行服务）：

- 契约：55 个操作、150 个 Schema、90 个结构示例；生成产物与源同步，0001/0002 迁移无变更，新增 0003 清理前缀配置并允许跨域同工号归属。
- check、typecheck、9 项单元测试、build、数据库约束测试、原有 API 集成测试通过。
- test:identity：独立 PostgreSQL 验证旧库升级与重复迁移、原人工绑定保留、并发/重复注册、前导零、规范化、跨组织隔离、允许域之间同工号合并、已有员工/设备补报、策略更新、身份冲突和人工纠错优先。重复相同补报不增加绑定或审计。
- 3 项浏览器测试通过：原演示页回归、原登录/管理回归、新增未绑定设备总览、空员工创建引导、规则保存、自动归属与员工明细、人工纠错。新场景使用真实 HTTP handler、PostgreSQL 和 Worker，事件由测试夹具发出，不能视为真实公司设备上报。
- 两次连续 CI 方式的浏览器数据库初始化/清理通过；每个浏览器夹具独占临时数据库，不共用上一个场景的数据。
- 已在 CI 增加 test:identity，浏览器场景由原 test:ui 执行。本地验证通过不代表远程 CI 已执行。

2026-11-17 员工列表补充：check、typecheck、9 项单测、build、独立 PostgreSQL API 集成、两项 Edge 浏览器回归通过。25 名合成员工验证 20/5 分页、前后翻页无累加、跨页姓名/工号搜索（忽略大小写）、无结果与清除搜索、创建员工后列表重载并可搜索；API 校验搜索变化拒绝复用游标。浏览器检查表格高度不超过 480px，并记录桌面和 800px 窄屏截图；仅合成测试数据，无生产员工数据或新增实机接入结论。

2026-11-17 分页/搜索补充：独立 PostgreSQL API 回归和 Edge 真实 API 浏览器回归使用 25 条合成凭证，验证第一页 20 条、第二页 5 条、前后翻页不累加、从第一页搜索第二页用途（忽略大小写）、无结果及清除搜索恢复第一页；API 额外验证搜索条件变化不能复用旧游标、百分号按字面匹配。桌面与 800px 窄屏检查搜索栏、480px 内滚动表格和分页栏。首次浏览器回归发现空 search 被契约拒绝，已改为无关键词时不发送参数；随后修正测试定位名称歧义，完整场景通过。check、typecheck、9 项单测、build 和既有演示浏览器回归通过。仅合成数据，无生产接入结论。

2026-11-17 接入凭证管理（issue #4）：check、typecheck、9 项单测、build、独立 PostgreSQL 的 API 集成，以及 Edge 的演示全页面和真实 API 两项浏览器场景通过。新增覆盖自定义创建、完整复制（剪贴板替身校验内容）、复制拒绝时自动选中、取消关闭、Esc 确认关闭、刷新后凭证存在、取消/确认撤销及刷新状态；API 校验列表不含 secret/secret_hash、撤销凭证不能注册新设备（403 ENROLLMENT_INVALID）。首次新增 API 测试的幂等键与预期 HTTP 状态不符，修正测试后通过。涉及凭证的浏览器测试关闭截图、trace 和视频，全部使用合成凭证；未验证系统剪贴板权限弹窗、生产部署或真实员工接入。08-settings.png 为更新的合成原型截图。

2026-11-16 内网部署补充：新增显式 HTTP 会话配置、Compose 自动初始化/迁移及 tag 镜像发布工作流。Docker Desktop Linux 容器本地验收已通过：镜像构建、空库 Compose 启动、HTTP 浏览器登录/首次改密/刷新、保留卷重建容器及已改密码登录。仅使用独立合成数据；GHCR/Release 发布尚未执行。

2026-11-16：[实际安装版 v0.5.11-beta.8 验收记录](verification/2026-11-16-installed-windows-beta8.md)。自然同步、重启保留截止时间、真实 Qwen 的两次人工提交、文件落盘计量、23 条离线事件自动补传及 CSV 均已核对；首次长间隔健康回归复现误报，修正后独立 PostgreSQL 接口测试通过。当前修复的最终 CI 结果以对应提交的 GitHub Actions 为准。

2026-11-14 可配置同步间隔回归：9 项后端规则测试、完整 API + 独立 PostgreSQL 回归、两项浏览器场景和 React 类型检查通过。浏览器实际保存 5–15、180–1440、1–1 分钟并刷新恢复，倒置范围不能保存；旧客户端继续通过兼容策略上传。Piora 17 项相关测试与 desktop 类型检查通过。首次 HTTP 回归发现上报处理未转交能力请求头，补齐后通过；首次页面回归发现策略尚未加载就可编辑导致输入丢失，修正加载状态后通过。浏览器 API 使用隔离端口，未占用正在运行的本机联调服务。没有将当前 beta.5 记为支持新范围的新客户端。

日期：2026-11-13 至 2026-11-14；Windows 开发机，Node.js 24.5.0。测试数据全部合成，没有读取或上传真实员工会话。

| 检查 | 实际结果 / 范围 |
|---|---|
| OpenAPI/JSON Schema | 51 操作、139 Schema、84 结构示例通过解析与校验 |
| 后端规则单测 | 跨日、区间并集、int64、ACK、未知 Token、事件边界、CSV 公式中和 |
| PostgreSQL 18 DDL | 真数据库空库迁移；租户外键、绑定重叠排斥约束、range union |
| API + PostgreSQL | 真 API handler + 真 PG；迁移就绪、登录/CSRF/RBAC、并发注册、逐事件去重/拒收、重复业务 ID、终态冲突、乱序 model start、未知 Token、多设备时长合并、跨日时长守恒、历史部门、报表筛选、游标隔离、CSV、轮换、维护、密码会话更新 |
| React 类型与 Vite 构建 | TypeScript 无错误；Vite 静态产物构建成功 |
| 演示 UI | Chromium/Edge 中操作全部六页、筛选、侧栏、Query 详情、下载、只读、深色、窄屏、错误与空状态；输出 10 张 UI 图 |
| 真实浏览器/真实 API | 独立 PG + Fastify + Vite；真实登录 Cookie/CSRF、创建部门、刷新后持久存在；无 pageerror |
| Piora 新增采集测试 | 14 项：Windows 自启识别、SQLite/序号、ACK、白名单、队列、暂停、抖动、补传、DPAPI 不可用、usage、群聊、provider、文件、恢复 |
| Piora 既有相关回归 | prompt-run-registry、session-control-store、model-stall-guard、task-timing、session-message-router、room-chat-dispatch；50 项既有相关测试通过，不代替全套 CI |
| Piora CI 修复复测 | 首轮 CI 发现共享 .mts 生产编译和旧 VM 夹具缺依赖；修复后 55 项定向测试通过，包含上述 14 项采集测试及自启/启动/托盘/模型采样/会话创建/真实 Webpack 单模块编译与 SQLite 重开 |
| Piora 类型检查 | 根与 desktop TypeScript 无错误；没有运行 next build 或构建本地安装包 |
| Windows 原生夹具 | 真实 Electron 45、SQLite WAL、异步 DPAPI 加解密、powerMonitor；锁屏/休眠事件为注入，不是实际 OS 操作 |
| Piora 开发桌面 UI | 实际设置导航、未配置状态、刷新/重载；API 200、无 renderer error。两次启动被 worktree 共享依赖路径阻断，按本地 Next.js 文档临时配置 additional root 后复测通过，配置已恢复 |
| 依赖安全查询 | 官方 npm registry 的生产依赖 audit：0 项漏洞；默认镜像不提供 audit API，因此改用官方接口 |

调试过程中修复：桌面 CommonJS/ESM 边界、暂停后 journal 回填、健康事件过早确认、解锁尾段、重复模型/文件业务 ID、分页路由隔离、真实页面参数校验、部门创建后缺少可见展示。失败后重跑对应场景，不能将首次失败算作通过。

2026-11-14 的 Linux CI 暴露了 Query 明细/审计日志的日期转换依赖数据库时区问题：Windows 本地默认时区未触发。已改为显式 date → timestamp → Asia/Shanghai 的半开区间，增加 UTC、Asia/Shanghai、America/New_York 三种真实数据库连接下的 HTTP 回归，校验午夜前 1ms、午夜、次日午夜前 1ms、次日午夜的包含/排除，并覆盖 Query 详情及子资源。新回归先在旧实现上复现失败，修复后通过。常规日汇总夹具也避免凌晨运行时意外跨日。

## 复现

~~~powershell
npm ci
npm run design:generate
npm run types:generate
npm run check
npm test
npm run typecheck
npm run build
npm run test:database
npm run test:api
npm run test:ui
~~~

不设置 DATABASE_URL 时，PG 测试自动创建隔离实例；设置时必须使用每个入口专属的空 *_test 数据库。运行结果文件在 .verification、test-results、playwright-report（不提交）。UI 图提交在 docs/ui/screenshots。

## 尚未验证

GitHub CI 状态以相应提交的 Actions 为准，本文件不预报未来结果。没有做 500 台容量压测、生产数据库备份恢复、生产服务器/TLS 部署、真实付费模型逐供应商对账、Windows 安装包升级或员工实机多日试点。不要把本地夹具通过解释为生产部署完成。

后端初始提交 8ad50fd 的 [GitHub Actions](https://github.com/kexijiang/piora-analytics/actions/runs/43455329174) 已通过 quality、test:database、test:api 三项任务，包括 Linux PostgreSQL 18 与 Chromium 浏览器复测。后续提交需查看其各自工作流结果。

时区修复提交 7bdb7d8 的 [GitHub Actions](https://github.com/kexijiang/piora-analytics/actions/runs/43461319975) 三项任务全部通过。Piora 另补充独立包源码依赖与 Electron/ASAR 隔离加载测试，16 项打包相关回归通过；文件差异预算也覆盖 20,000 行重写，14 项采集测试和 2 项共享模块测试复测通过。Piora 最终完整 CI 以 [PR #425](https://github.com/kexijiang/pi-desktop/pull/425) 的当前提交状态为准。

本次内网改造本地验证：npm run check、npm run typecheck、npm test（9 项）、npm run build 和隔离 PostgreSQL 的 npm run test:api 全部通过；HTTP 生产显式启用、默认拒绝 HTTP、HTTPS Secure/__Host Cookie、HTTP 无 Secure 会话均纳入接口回归。Compose config 和 Release YAML 解析通过。首次类型检查/构建在 npm ci 尚未完成时失败，安装完成后重跑通过。后续 Docker 引擎修复后，容器冒烟通过；Release 发布未执行。

本地 Docker 验收补充：2026-11-16，Docker Engine 29.6.2 / Docker Desktop Linux。Node 24 bookworm 镜像完成 npm ci 与 Vite 构建；独立 piora-compose-test 项目端口 14319，PostgreSQL 18 健康、init 退出 0、API 健康、Worker 运行且日志无错误。Edge 实际验证 HTTP 登录、首次改密、刷新会话保留，无 pageerror。浏览器脚本首次因未等待改密完成而过早刷新失败，修正等待弹窗关闭后从空库复测通过。保留卷 down/up 后仍只有 1 个组织、1 个管理员，修改后的密码可登录。镜像首次下载遇连接中断，重试下载完成后构建成功。没有验证真实设备采集、负载或 GitHub 镜像发布。
