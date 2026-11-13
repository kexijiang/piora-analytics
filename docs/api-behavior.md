# API 行为、权限与边界

字段级契约以 [OpenAPI](../contracts/openapi.yaml) 为准；所有 51 个操作的参数、返回体、示例与 139 个对象在 [API 参考](api-reference.md)。本文件补足 Schema 无法表达的事务、比较约束和状态变化。

## 通用约定

- 路径 /v1，JSON UTF-8，UTC RFC3339 时间；日期 from 包含、to 不包含。from<to，日汇总最多 731 天且必须在配置保留期内；请求/调用/文件明细默认 90 天保留。请求超保留窗口 422 RANGE_OUT_OF_RETENTION，不能返回“零”假装没有活动。
- GET 参数有员工/部门/版本/source 多选时使用重复参数：employee_ids=id1&employee_ids=id2；各维度之间 AND，同维度 OR。部门按发生日归属。空数组代表所有；ID 不属于当前组织统一 404。
- 每个非空计数必须 <=9223372036854775807；字符串不得带负号、小数、前导零。JSON Schema 之外必须用 BigInt 校验上界。
- 分页 limit 默认 50、最大 200；cursor 为服务器签名的 opaque 值，绑定 org、endpoint、筛选、排序、快照版本和 15 分钟有效期。错筛选/过期返回 400 CURSOR_INVALID，前端从首页重新查询。
- 日表排序允许 date/employee_name/queries/active_ms/total_tokens/added_lines；方向 asc/desc，空值始终最后；同值按 employee_id,date 升序。请求/审计默认时间倒序、id 升序，员工等列表默认名称和 id。不能把未校验字符串拼入 SQL。
- 所有业务 UUID 同租户验证。installation_id 从设备凭证获取；禁止上报 employee_id/org_id，防止客户端指定统计归属。
- 成功响应统一 data/meta。未知值 null；Schema 必填的 nullable 字段不能省略。错误统一 error.code/message/retryable/request_id/field_errors。

## 认证与角色

| API 类别 | 匿名 | 安装凭证 | viewer | admin |
|---|---|---|---|---|
| live/ready、后台 login | 是 | 无特殊权限 | 是 | 是 |
| installations/register | 仅 enrollment key | 不代替注册密钥 | 否 | 管理员也必须走注册密钥 |
| telemetry/batches、credentials/rotate | 否 | 本安装 | 否 | 否 |
| auth/session/logout/change-password | 否 | 否 | 自己 | 自己 |
| analytics/*、员工/部门/安装只读 | 否 | 否 | 是 | 是 |
| exports | 否 | 否 | 自己创建与下载 | 自己创建与下载 |
| 员工/部门/绑定管理、安装撤销 | 否 | 否 | 否 | 是 |
| accounts、enrollment-keys、settings、audit-logs（含 GET） | 否 | 否 | 否 | 是 |
| 绑定历史读取 | 否 | 否 | 否 | 是 |

cookie 为 __Host-piora_analytics，Secure/HttpOnly/SameSite=Strict/Path=/；无 Domain。管理写操作要求 X-CSRF-Token + Origin/Fetch-Metadata 检查。登录要求同源 Origin、防跨站登录及失败节流；初始密码会话只允许 session/logout/change-password，其他操作 403 PASSWORD_CHANGE_REQUIRED。密码变化撤销其他会话并重新签发当前会话/CSRF；响应仍为 Ok，浏览器随后 GET session 获取新 CSRF。

viewer 能看到组织全部已授权统计；v1 没有部门级权限。若将来需要部门隔离，必须新增服务端权限范围，不能只隐藏 UI。最后一个 active admin 禁止降级/停用/归档，409 LAST_ADMIN_REQUIRED。

## 幂等、乐观锁与更新

管理 POST/PATCH（auth 除外）要求 Idempotency-Key。作用域为账号 + method/path，保存 24 小时。相同键同内容重放首次响应，不重复创建/导出；同键不同内容 409 IDEMPOTENCY_CONFLICT。包含新 enrollment secret 的响应以服务端 envelope 加密保存 24 小时，避免明文日志和响应丢失后无法恢复；重新获取只能用原账号和原幂等键。

注册和轮换以 registration_id/rotation_id 为业务幂等键；OpenAPI 中的 Idempotency-Key 填相同 UUID，二者不相等 400。telemetry 使用 event_id，而非依赖 batch_id。

PATCH 在这里是完整“可编辑字段集合”替换，所有 Schema 必填字段都提交，不采用 JSON Merge Patch；明确清空的 nullable 字段传 null。expected_revision 必须与当前版本相等，修改成功 revision+1，否则 409 REVISION_CONFLICT。PolicyUpdate.policy.version 必须等于 expected_revision+1；RetentionUpdate.policy.revision 同理。

员工创建同时创建当前部门生效区间，起始日为创建日；需要归属更早日期时通过更新 effective_from。员工更新部门：事务内分割/截断相交部门区间，再建新 [effective_from,后续已排定变更日)；名字/工号更新不回写历史展示快照以外的业务事件。员工/部门 archive 保留历史，不能继续创建新绑定到归档员工；部门归档前必须迁移当前成员，409 DEPARTMENT_IN_USE。

创建绑定的 expected_revision 对应安装版本，修改绑定对应原绑定版本。有效日期范围不能超出日汇总保留期，valid_to 必须大于 valid_from。重叠 409 BINDING_OVERLAP，客户端展示冲突区间并让管理员调整；不能悄悄覆盖其他员工。同一事务写绑定、版本、审计；查询时按有效期映射，无员工冗余汇总表需要重算，202 不是绑定接口返回码：201/200 表示配置已保存，报表 meta 与质量提示显示重算进度。

## 上报约束

desktop.activity：start<end<=start+60s；runtime_ms<=区间毫秒；active_ranges 非空区间、不重叠、位于父区间且总长度<=runtime；sample_interval=5000。不允许跨越休眠未知时间。服务端再按日切分。

query.updated：revision>0；低版本忽略但仍 ACK；相同版本不同状态 EVENT_CONFLICT。终态不回退；submitted 尚未到达时先保留原始事件，等待其到达再投影。

model.finished：usage_status=unavailable 时所有用量为 null；reported 要有全部非重叠桶或仅 total（其余 null、标明 TOTAL_ONLY）；存在全部桶时 total 必须等于其和。partial 必须至少有一项已知；非 interrupted 的 finished_at/duration 必须非空且 end>=start。不能用任意 usage 字典绕过白名单。

file.changed：measured 必须非空 added/deleted、kind 不能 unknown；created 的 deleted=0；unchanged 的 added=deleted=0；非 measured 的 added/deleted 必须 null。source 从可信 run/query 关系派生，不接受客户端硬塞不同员工。

每批逐事件错误处理见 [同步协议](sync-protocol.md)。额外字段、超过类型/枚举范围、未来异常时间永久拒绝；不保存被拒绝的敏感正文。未知 event_type 在当前版本拒绝并记 INVALID_EVENT，保留本地隔离供升级检查。

## 报表与导出

总览统计当前已确认员工数与筛选范围内活跃员工数；前者不因日期变化，部门筛选按当前员工所属范围，解释在 UI 提示中。模型/来源筛选不适用于桌面指标。员工每日列表按已确认员工×日生成已接入范围行；无报告标 no_reports，不能拼 0。未接入员工标 not_enrolled。

Query 详情包括最多 500 条调用和文件操作，truncated=true 后使用独立 /calls 和 /file-changes 游标接口。filters 中的日期用于选择 Query 的接收日；其详情包含该 Query 全生命周期关联明细（仍受明细保留期限制），不能仅返回接收日内的调用。

健康表 last_received_at 是收到数据时间，不是实时在线状态。模型涉及 Query 数按 DISTINCT 安装+query_id，跨模型相加会重复。历史多设备活跃按区间并集，文件数按范围去重。

导出 POST 持久创建任务 202；每账号最多 3 个未完成任务、100 万行，超限 422 EXPORT_LIMIT。GET 状态由页面以 2/4/8/15 秒退避查询，仅导出进行时请求；与客户端统计上报频率无关。完成后受保护下载链接有效 24 小时，验证当前会话仍有角色、且为任务创建者；对象文件不可公开访问。CSV UTF-8 BOM、RFC4180 引号转义，字符串以 =,+,-,@、制表符、回车开头时加单引号，防公式执行。导出与页面使用同一筛选，聚合变动会导致游标失效并使导出失败，可重新创建任务；metadata 附加导出时刻/质量列。

## 错误码与客户端动作

| HTTP | 代表错误码 | 客户端动作 |
|---|---|---|
| 400 | VALIDATION_ERROR / CURSOR_INVALID / PROTOCOL_INVALID | 改参数；不盲重试 |
| 401 | AUTH_REQUIRED / CREDENTIAL_EXPIRED | 管理端登录；终端按轮换恢复规则处理 |
| 403 | FORBIDDEN / INSTALLATION_REVOKED / CSRF_INVALID | 不重试上报；后台重新取会话或提示无权限 |
| 404 | NOT_FOUND | 资源不存在或跨组织，避免泄露 |
| 409 | REVISION_CONFLICT / BINDING_OVERLAP / IDEMPOTENCY_CONFLICT / LAST_ADMIN_REQUIRED | 重新读取并解决冲突 |
| 413 | PAYLOAD_TOO_LARGE | 减小批次；单事件超限隔离 |
| 422 | RANGE_OUT_OF_RETENTION / POLICY_INVALID / EXPORT_LIMIT | 调整业务条件 |
| 429 | RATE_LIMITED | 遵守 Retry-After + jitter |
| 503 | STORAGE_UNAVAILABLE / PARTITION_UNAVAILABLE | 保留全部未确认事件，退避重试 |

字段 Schema 示例是结构示例，真实值仍需满足本文件的跨字段约束。可执行行为用例见 tests/telemetry.test.mjs；生产实现需逐项扩展至数据库/HTTP 端到端测试。
