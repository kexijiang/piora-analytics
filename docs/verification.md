# 本地验证记录

日期：2026-11-13；Windows 开发机，Node.js 24.5.0。测试数据全部合成，没有读取或上传真实员工会话。

| 检查 | 实际结果 / 范围 |
|---|---|
| OpenAPI/JSON Schema | 51 操作、139 Schema、84 结构示例通过解析与校验 |
| 后端规则单测 | 跨日、区间并集、int64、ACK、未知 Token、事件边界、CSV 公式中和 |
| PostgreSQL 18 DDL | 真数据库空库迁移；租户外键、绑定重叠排斥约束、range union |
| API + PostgreSQL | 真 API handler + 真 PG；迁移就绪、登录/CSRF/RBAC、并发注册、逐事件去重/拒收、重复业务 ID、终态冲突、乱序 model start、未知 Token、多设备时长合并、跨日时长守恒、历史部门、报表筛选、游标隔离、CSV、轮换、维护、密码会话更新 |
| React 类型与 Vite 构建 | TypeScript 无错误；Vite 静态产物构建成功 |
| 演示 UI | Chromium/Edge 中操作全部六页、筛选、侧栏、Query 详情、下载、只读、深色、窄屏、错误与空状态；输出 10 张 UI 图 |
| 真实浏览器/真实 API | 独立 PG + Fastify + Vite；真实登录 Cookie/CSRF、创建部门、刷新后持久存在；无 pageerror |
| Piora 新增采集测试 | 13 项：SQLite/序号、ACK、白名单、队列、暂停、抖动、补传、DPAPI 不可用、usage、群聊、provider、文件、恢复 |
| Piora 既有相关回归 | prompt-run-registry、session-control-store、model-stall-guard、task-timing、session-message-router、room-chat-dispatch；50 项既有相关测试，加新增 13 项共 63 项通过，不代替全套 CI |
| Piora 类型检查 | 根与 desktop TypeScript 无错误；没有运行 next build 或构建本地安装包 |
| Windows 原生夹具 | 真实 Electron 45、SQLite WAL、异步 DPAPI 加解密、powerMonitor；锁屏/休眠事件为注入，不是实际 OS 操作 |
| 依赖安全查询 | 官方 npm registry 的生产依赖 audit：0 项漏洞；默认镜像不提供 audit API，因此改用官方接口 |

调试过程中修复：桌面 CommonJS/ESM 边界、暂停后 journal 回填、健康事件过早确认、解锁尾段、重复模型/文件业务 ID、分页路由隔离、真实页面参数校验、部门创建后缺少可见展示。失败后重跑对应场景，不能将首次失败算作通过。

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

GitHub CI 状态以相应提交的 Actions 为准，本文件不预报未来结果。没有做 500 台容量压测、生产数据库备份恢复、Linux 容器/TLS 部署、真实付费模型逐供应商对账、Windows 安装包升级或员工实机多日试点。不要把本地夹具通过解释为生产部署完成。
