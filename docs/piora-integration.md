# Piora Windows 接入实现设计

代码基线：Piora origin/main 21d610f63797733fa53a1296be0c02a82b0878d0（2026-11-13 检查）；现有本地 usage 看板只能复用格式化/已有 usage 字段，不能把历史会话跨度当活跃时长。本次已实现采集代码。下文保留完整设计要求，实际模块、验证边界及差异以 [当前实现](piora-implementation.md) 与 [交付状态](implementation-status.md) 为准。

## 规划模块与代码入口（已按实际职责合并实现）

| 新模块 / 现有入口 | 职责与接入点 |
|---|---|
| desktop/src/telemetry/identity.ts | installation UUID、注册与 DPAPI 凭证；存 %LOCALAPPDATA%\Piora\telemetry，不跟随会话导出 |
| desktop/src/telemetry/activity.ts | 主工作窗口活动采样、启动/唤起事件；powerMonitor 锁屏/睡眠事件 |
| desktop/src/telemetry/uploader.ts | 唯一网络上传器；调度、退避、凭证轮换、ACK 与策略 |
| lib/telemetry/outbox.ts | Node/Electron 共用 SQLite schema、稳定事件键、WAL 短事务 |
| lib/telemetry/context.ts | AsyncLocalStorage 保存 query/run/source；冻结每次调用的归属 |
| lib/telemetry/model-observer.ts | 包装实际具体模型 stream 请求，完成后归一化 usage |
| lib/telemetry/file-observer.ts | 配置中真正生效的文件工具 execute 前后快照、diff、质量标记 |
| lib/session-message-router.ts | admitSubmission 的持久命令确认后记录 Query；终态日志版本变化时补 query.updated |
| lib/prompt-run-registry.ts、lib/task-timing.ts | 已有运行身份与时间语义；start/terminal/recovery 对应 run 事件 |
| lib/model-runtime-context.ts、lib/global-model-services.ts | 在共用 factory 安装幂等 observer；辅助调用不遗漏 |
| lib/rpc-manager.ts | createAgentSessionFromServices 前后接入观察器与实际工具装饰，保持审批和 fallback |
| desktop/src/main.ts | 单实例锁后 cold launch；托盘/menu/second-instance 明确手动唤起 |
| desktop/src/server-supervisor.ts、server-host.ts | 向本地 Node 子进程传 telemetry DB 路径与非秘密运行配置；不传设备密钥给 renderer |
| extensions/piora-file-changes.ts | 现有审阅 UI 保持用途；不得拿计划写入文本直接计量实际落盘 |

已有 desktop/src/clipboard-database.ts 使用 node:sqlite，可参考当前 Electron/Node ABI 支持；新增队列仍须 Windows CI/真实桌面验证。Next dev 热重载的服务观察器保存在全局稳定注册位置，使用 Symbol 标识避免重复包装。

## 本地状态模型

本地 SQL：[client-outbox.sql](../database/client-outbox.sql)。采集队列 DB 只允许当前 Windows 用户访问；DPAPI credential 独立文件，不存在 SQLite 事件中。文件路径只在短暂内存快照中使用，outbox 只存 file_key。

- installation_id 生命周期为该 Windows 用户下的安装数据目录；普通升级不重置，重装保留数据则不变，清除数据后为新安装。
- app_launch_id 每次取得 Electron 单实例锁随机生成；第二个进程未取得锁，不生成 launch 事件。
- event_id 使用 SHA-1(installation_id + source_key) 截断并设置 UUID 版本/变体位的稳定派生值；source_key 只由受控 ID 组成，不能含命令文本或路径。event_seq 在 SQLite 事务分配，正整数，不因删除已发项归零。
- Query 的 source_key=query:{commandId}:submitted；状态=query:{commandId}:revision:{n}；模型=model:{callId}:started/finished；文件=file:{operationId}；活动=activity:{launchId}:{minuteSequence}。
- 新增字段必须更新协议版本兼容矩阵和允许列表，不能使用任意 properties。

## 命令持久化与恢复

现有 command journal 与 telemetry SQLite 不在同一事务，不能声称原子。采用 outbox reconciler：

1. 原命令持久确认后尝试幂等写 query.submitted；失败不阻止原 Query。
2. 从“启用采集时刻”的 journal cursor 开始，后台扫描之后已持久确认的命令；按稳定 source_key 补齐遗漏事件。
3. 逐事件独立事务提交，全部成功后更新扫描进度；重扫依靠稳定源键去重；不会从现有旧会话回填历史。
4. 对状态更新同样按原 journal revision 扫描；SSE 仅 UI 通知，不能作为计数依据。
5. 采集自身磁盘失败写本地诊断计数；恢复后发 DATA_LOSS/OUTBOX_WRITE_FAILED 健康码。未持久化的模型调用结果无法凭空恢复，应显示未知。

用户重发同一文本且新 idempotency key 是新 Query。room 的人工入口创建 query context，内部 Agent fanout 继承 parent query 而不创建新的人工计数。自动/扩展任务显式 source 和 trigger；不要根据 role=user 推断是人。

## 模型调用完整覆盖

SDK 的 completeSimple 会委托 streamSimple；虚拟模型可能递归路由。仅包装最底层具体供应商调用，一次真正发起才分配 call_id。禁止同时在 MessageView、SSE message_end 和 SDK stream 完成各算一次。

共用 ModelServices factory 中安装 observer，使用 AsyncLocalStorage 传归属，避免并发会话共享 services 时把 Token 记给另一人/Query。在真正发起请求时复制 context 快照到 call record；后续 steer 不改变该 record。

检查覆盖所有创建 services 的分支：普通聊天、room、后台任务、压缩、工具独立 review、Harmony vision、vision-agent、prompt 优化/预测、模型配置 test。参考入口 lib/tool-review-model.ts、lib/harmony/vision.ts、lib/vision-agent.ts、app/api/models-config/test/route.ts。部署实现时重新搜索 createTrustedModelServices/createCoreModelServices/streamSimple，避免 SDK 升级遗漏新增入口。

观察器不得更改 stream 返回行为、错误类别、abort、stall watchdog 或 fallback 顺序。终态一次性落盘；异常/取消仍读取可靠 usage，未报告不能默认为 0。流式 chunk 的累计 usage 不逐 chunk 相加，只在最终归一化一次。崩溃后只有 model.started 没有终态时上报 interrupted、duration/usage null。

## 文件落盘计量与并发

tool_execution_start 发生在审批之前，不能在该事件直接读前快照并把失败当成功。通过 inner.getToolDefinition(name) 取得实际配置定义，装饰其 execute，保留原对象的参数 schema、来源、权限和生命周期；SDK 的工具适配层在执行时调用 definition.execute。

只装饰已确认来自本地文件工具的 write/edit，不能按同名识别 MCP 工具。当前 edit 参数为 path + edits 数组，不是旧版 root.oldText；遵循实际工具 schema。装饰函数保持 (toolCallId,params,signal,onUpdate,ctx) 调用签名。

在实际 execute 边界使用自己的按规范化路径串行锁，锁范围包含前快照、原 execute、后快照；不能在 tool_call 审批事件先占锁造成等待审批死锁。SDK 内部已存在文件 mutation queue，装饰器锁是外层一致顺序，不反向进入 SDK 队列。

执行成功后重读实际文件，使用 diffLines 对比规范 LF 文本。文件末尾换行按行 diff 算法固定行为，测试无末尾换行、CRLF、空文件、仅删除、替换、中文、真实新增内容以 +++ 开头等情况。禁止仅按 patch 字符前缀猜测行数；禁止取 write 的计划 content 代替读后快照。

同路径外部编辑仍可能并发：比较 stat/内容哈希及工具结果，发现漂移标 concurrent_change，不能宣称覆盖所有外部写入。>2 MiB、>100,000 行、二进制、读失败只记操作与原因；成功落盘不可因统计失败回滚或改写用户代码。

## 桌面时长与 IPC

Electron 主进程每 5 秒读取主工作窗口 focus/visible、powerMonitor.getSystemIdleTime、锁屏/休眠状态。只记录布尔状态与时间，禁止键盘内容。保持可信的上次采样时间；单调间隔异常不延伸。每分钟合并 active_ranges，锁屏/suspend/quit 先截断并写队列。

renderer 不负责产生最终统计，避免刷新、多个窗口和浏览器定时器节流重复。preload 若需状态展示，仅暴露经过 main-frame/same-origin 校验的只读摘要；不提供通用“上报任意事件”IPC。

Node 与 Electron 可并发写同一个 SQLite WAL，但使用 busy_timeout=1000、短事务，不能在事务中读大文件或发网络。后台本地服务重启不增加 opens/launches；上传仅 Electron 主进程单一实例持有租约，Node 不竞争网络发送。

## UI 设置与兼容策略

Piora 设置新增“组织统计”：展示组织名、采集字段摘要、身份是否待确认、最近成功同步、排队条数、策略间隔、异常码。没有“每次发送立即同步”的默认开关；首版仅提供状态刷新，不提供手动补传按钮。

未配置组织 URL/enrollment key 时采集关闭，不影响普通个人用户；从启用时刻开始。backend URL 只接受 HTTPS 受控配置，防止 renderer 任意指定发送目标。Piora 公开仓库仅提交通用接入代码与设计，不能加入内部部署 URL、注册 secret、员工名单。

协议兼容：1.x 仅增加可协商能力；字段新增需服务器先支持、客户端后发布。服务端保留前一稳定客户端协议至少 90 天。禁用采集、离线、认证失败、队列故障均不阻塞聊天/文件工具。
