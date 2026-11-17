# 数据库字段字典（自动生成）

PostgreSQL 18；UTC timestamptz，统计日固定 Asia/Shanghai。初始化 SQL：[0001_initial.sql](../database/migrations/0001_initial.sql)。所有计数在 API 中为十进制字符串；NULL 不能转换为零。跨表关系、重算、保留与事务见 [数据库行为](database-design.md)。

## organizations

v1 单组织，结构保留租户隔离。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| name | varchar(120) | NOT NULL | 组织名称 |
| timezone | text | NOT NULL DEFAULT 'Asia/Shanghai' CHECK (timezone = 'Asia/Shanghai') | 固定统计时区 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：



## departments

部门维度，不物理删除历史部门。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| name | varchar(120) | NOT NULL | 部门名称 |
| status | text | NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')) | 状态 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- UNIQUE (org_id,id)
- UNIQUE (org_id,name)

## employees

管理员确认的人员；用户名不作为主键。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| name | varchar(120) | NOT NULL | 显示名 |
| employee_no | varchar(64) | 可空 | 可选工号 |
| status | text | NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')) | 状态 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- UNIQUE (org_id,id)
- UNIQUE (org_id,employee_no)

## employee_department_periods

部门归属生效区间；不重叠。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| employee_id | uuid | NOT NULL | 员工 |
| department_id | uuid | 可空 | 部门；空为未分配 |
| valid_days | daterange | NOT NULL | [起始日,结束日)，无穷上界表示持续 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| reason | varchar(500) | NOT NULL | 调整原因 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- FOREIGN KEY (org_id, employee_id) REFERENCES employees(org_id, id)
- FOREIGN KEY (org_id, department_id) REFERENCES departments(org_id, id)
- CHECK (NOT isempty(valid_days) AND lower(valid_days) IS NOT NULL AND lower_inc(valid_days) AND NOT upper_inc(valid_days))
- EXCLUDE USING gist (org_id WITH =, employee_id WITH =, valid_days WITH &&)

## installations

Windows 安装实例，用户名仅供匹配。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| registration_id | uuid | NOT NULL | 注册请求幂等键 |
| registration_hash | bytea | NOT NULL | 规范化注册请求摘要；不保存明文密钥 |
| windows_username | varchar(128) | NOT NULL | 当前 Windows 账号 |
| device_label | varchar(128) | NOT NULL | 设备显示名 |
| app_version | varchar(64) | NOT NULL | 最后上报版本 |
| sdk_version | varchar(64) | NOT NULL | SDK 版本 |
| capabilities | text[] | NOT NULL | 允许列表能力 |
| status | text | NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')) | 状态 |
| first_seen_at | timestamptz | NOT NULL DEFAULT now() | 首次注册 |
| last_received_at | timestamptz | 可空 | 收到事件时间 |
| last_event_at | timestamptz | 可空 | 最近可信发生时间 |
| reported_queue_events | bigint | NOT NULL DEFAULT 0 CHECK (reported_queue_events >= 0) | 上次报告积压 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| identity_match_version | integer | NOT NULL DEFAULT 0 | 自动账号关联处理版本；0 为等待后台回补 |

表约束：

- UNIQUE (org_id,id)
- UNIQUE (org_id,registration_id)

## installation_bindings

一台安装实例在任一天最多归属一个员工。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| employee_id | uuid | NOT NULL | 员工 |
| valid_days | daterange | NOT NULL | 按北京时间日期归属 |
| reason | varchar(500) | NOT NULL | 绑定/纠错原因 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |
| source | text | NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','domain','automatic')) | manual 人工优先；domain 旧版域关联；automatic 自动账号关联 |

表约束：

- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
- FOREIGN KEY (org_id, employee_id) REFERENCES employees(org_id, id)
- CHECK (NOT isempty(valid_days) AND (lower_inf(valid_days) OR lower_inc(valid_days)) AND NOT upper_inc(valid_days))
- EXCLUDE USING gist (org_id WITH =, installation_id WITH =, valid_days WITH &&)

## admin_accounts

后台账号，员工无需登录。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| username | varchar(80) | NOT NULL | 统一小写唯一账号 |
| display_name | varchar(120) | NOT NULL | 显示名 |
| password_hash | text | NOT NULL | Argon2id 哈希，含参数与随机盐 |
| role | text | NOT NULL CHECK (role IN ('admin','viewer')) | 角色 |
| status | text | NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')) | 状态 |
| must_change_password | boolean | NOT NULL DEFAULT true | 初始密码必须更改 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- UNIQUE (org_id,id)
- UNIQUE (org_id,username)
- CHECK (username = lower(username))

## admin_sessions

随机服务端会话；不保存 cookie 明文。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| account_id | uuid | NOT NULL | 账号 |
| token_hash | bytea | NOT NULL UNIQUE | 会话令牌 HMAC |
| csrf_hash | bytea | NOT NULL | CSRF 令牌哈希 |
| last_seen_at | timestamptz | NOT NULL | 空闲过期依据 |
| expires_at | timestamptz | NOT NULL | 绝对过期时间 |
| revoked_at | timestamptz | 可空 | 撤销 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- FOREIGN KEY (org_id, account_id) REFERENCES admin_accounts(org_id, id)

## enrollment_keys

短期、有次数上限的组织注册凭证。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| label | varchar(120) | NOT NULL | 用途 |
| secret_hash | bytea | NOT NULL | HMAC 哈希 |
| expires_at | timestamptz | NOT NULL | 过期 |
| max_registrations | integer | NOT NULL CHECK (max_registrations BETWEEN 1 AND 5000) | 次数上限 |
| used_registrations | integer | NOT NULL DEFAULT 0 CHECK (used_registrations >= 0) | 消费次数 |
| revoked_at | timestamptz | 可空 | 撤销 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- UNIQUE (org_id,id)
- CHECK (used_registrations <= max_registrations)

## installation_credentials

安装鉴权凭证，轮换时双凭证过渡。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| rotation_id | uuid | NOT NULL | 轮换请求幂等键 |
| secret_hash | bytea | NOT NULL | 带服务端 pepper 的 HMAC-SHA256 |
| expires_at | timestamptz | NOT NULL | 绝对过期 |
| valid_until | timestamptz | NOT NULL | 被替换后最多再有效 24 小时 |
| revoked_at | timestamptz | 可空 | 撤销 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
- UNIQUE (org_id,installation_id,rotation_id)
- CHECK (valid_until <= expires_at)

## idempotency_keys

管理写请求 24 小时响应重放，不存明文秘密。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| actor_id | uuid | NOT NULL | 管理账号 |
| route | varchar(200) | NOT NULL | method + 路径 |
| key | varchar(128) | NOT NULL | 客户端幂等键 |
| request_hash | bytea | NOT NULL | 规范化请求摘要 |
| response_status | integer | NOT NULL | 成功状态码 |
| response_body | jsonb | NOT NULL | 脱敏重放响应；一次性 secret 用 envelope 加密 |
| expires_at | timestamptz | NOT NULL | 清理时间 |

表约束：

- PRIMARY KEY (org_id,actor_id,route,key)
- FOREIGN KEY (org_id, actor_id) REFERENCES admin_accounts(org_id, id)

## org_settings

版本化同步与保留策略。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| name | text | NOT NULL CHECK (name IN ('sync','retention','identity')) | sync / retention / identity |
| value | jsonb | NOT NULL | 按对应 OpenAPI 模型验证 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 修改时间 |

表约束：

- PRIMARY KEY (org_id,name)

## event_receipts

跨月去重账本；与事件同事务写入。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| event_id | uuid | NOT NULL | 稳定事件 ID |
| event_seq | bigint | NOT NULL CHECK (event_seq > 0) | 本地事件递增序号 |
| source_key_hash | bytea | NOT NULL | 业务来源键摘要 |
| content_hash | bytea | NOT NULL | RFC 8785 规范 JSON SHA-256 |
| received_at | timestamptz | NOT NULL DEFAULT now() | 首次接收 |
| occurred_at | timestamptz | NOT NULL | 可信发生时间 |
| expires_at | timestamptz | NOT NULL | 至少保留 90 天；不得先于允许重传窗口 |

表约束：

- PRIMARY KEY (org_id,installation_id,event_id)
- UNIQUE (org_id,installation_id,event_seq)
- UNIQUE (org_id,installation_id,source_key_hash)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## telemetry_events

按 received_at 月分区的原始允许列表事件。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 认证确定的安装 |
| event_id | uuid | NOT NULL | 事件 ID |
| received_at | timestamptz | NOT NULL | 接收月决定分区 |
| occurred_at | timestamptz | NOT NULL | 业务发生时间 |
| event_type | varchar(40) | NOT NULL | 协议事件名 |
| payload | jsonb | NOT NULL | 已验证的完整事件；无提示词、代码、路径 |

表约束：

- PRIMARY KEY (received_at,org_id,installation_id,event_id)
- FOREIGN KEY (org_id,installation_id,event_id) REFERENCES event_receipts(org_id,installation_id,event_id)

## aggregation_jobs

持久工作队列；租约 + SKIP LOCKED。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 需要重算的安装 |
| day | date | NOT NULL | 重算自然日 |
| requested_revision | bigint | NOT NULL DEFAULT 1 CHECK (requested_revision > 0) | 新数据/纠错递增版本 |
| completed_revision | bigint | NOT NULL DEFAULT 0 CHECK (completed_revision >= 0) | 已完成版本 |
| lease_owner | uuid | 可空 | worker 租约持有者 |
| lease_until | timestamptz | 可空 | 租约截止 |
| available_at | timestamptz | NOT NULL DEFAULT now() | 退避截止 |
| attempts | integer | NOT NULL DEFAULT 0 | 失败重试次数 |
| last_error_code | varchar(64) | 可空 | 脱敏错误码 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 最后触发 |

表约束：

- UNIQUE (org_id,installation_id,day)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
- CHECK (completed_revision <= requested_revision)

## app_launches

冷启动事实，仅保留明细窗口。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| id | uuid | NOT NULL | app_launch_id |
| started_at | timestamptz | NOT NULL | 首次启动 |
| reason | varchar(20) | NOT NULL | 启动原因 |
| app_version | varchar(64) | NOT NULL | 版本 |

表约束：

- PRIMARY KEY (org_id,installation_id,id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## activity_intervals

明细窗口内的分钟活动事实。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| event_id | uuid | NOT NULL | 来源事件 |
| span | tstzrange | NOT NULL | [start,end)，最长一分钟 |
| active_ranges | tstzmultirange | NOT NULL | 该分钟可信有效活动区间 |
| runtime_ms | bigint | NOT NULL DEFAULT 0 CHECK (runtime_ms >= 0) | 非休眠运行时长 |
| app_version | varchar(64) | NOT NULL | 版本 |

表约束：

- PRIMARY KEY (org_id,installation_id,event_id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
- CHECK (NOT isempty(span) AND lower(span) IS NOT NULL AND upper(span) IS NOT NULL AND upper(span)-lower(span) <= interval '60 seconds' AND lower_inc(span) AND NOT upper_inc(span))
- CHECK (active_ranges <@ tstzmultirange(span))
- CHECK (runtime_ms <= extract(epoch FROM upper(span)-lower(span))*1000)

## queries

逻辑提交事实；状态按 revision 更新。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| id | uuid | NOT NULL | query_id |
| command_id | varchar(256) | NOT NULL | 本地命令唯一键 |
| accepted_at | timestamptz | NOT NULL | 接收时间 |
| source | varchar(32) | NOT NULL | 来源 |
| trigger | text | NOT NULL CHECK (trigger IN ('human','automation','system')) | 触发者 |
| status | text | NOT NULL CHECK (status IN ('accepted','queued','running','completed','failed','cancelled','interrupted')) | 状态 |
| revision | integer | NOT NULL DEFAULT 1 CHECK (revision > 0) | 乐观锁版本 |
| app_version | varchar(64) | NOT NULL | 提交版本 |

表约束：

- PRIMARY KEY (org_id,installation_id,id)
- UNIQUE (org_id,installation_id,command_id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## runs

任务事实；未知耗时保留空值。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| id | uuid | NOT NULL | run_id |
| query_id | uuid | 可空 | 可空归属 Query；允许乱序到达 |
| parent_run_id | uuid | 可空 | 父任务 |
| source | varchar(32) | NOT NULL | 来源 |
| started_at | timestamptz | 可空 | 开始时间 |
| finished_at | timestamptz | 可空 | 可信结束时间 |
| status | text | NOT NULL CHECK (status IN ('running','completed','failed','cancelled','interrupted')) | running/终态 |
| duration_ms | bigint | CHECK (duration_ms >= 0) | 任务耗时 |
| waiting_ms | bigint | CHECK (waiting_ms >= 0) | 人工等待耗时 |
| app_version | varchar(64) | NOT NULL | 版本 |

表约束：

- PRIMARY KEY (org_id,installation_id,id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
- CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)

## model_calls

每次实际供应商调用；含重试/辅助调用。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| id | uuid | NOT NULL | call_id |
| query_id | uuid | 可空 | 冻结归属，允许空及乱序 |
| run_id | uuid | 可空 | 任务 |
| provider | varchar(128) | NOT NULL | 供应商 |
| model | varchar(256) | NOT NULL | 实际模型 |
| source | varchar(32) | NOT NULL | 来源 |
| status | text | NOT NULL CHECK (status IN ('running','completed','failed','cancelled','interrupted')) | running/终态 |
| started_at | timestamptz | NOT NULL | 开始 |
| finished_at | timestamptz | 可空 | 结束 |
| duration_ms | bigint | CHECK (duration_ms >= 0) | 耗时 |
| usage_status | text | NOT NULL CHECK (usage_status IN ('reported','partial','unavailable')) | 用量完整性 |
| input_tokens | bigint | CHECK (input_tokens >= 0) | 归一化用量；未知为 NULL |
| output_tokens | bigint | CHECK (output_tokens >= 0) | 归一化用量；未知为 NULL |
| cache_read_tokens | bigint | CHECK (cache_read_tokens >= 0) | 归一化用量；未知为 NULL |
| cache_write_tokens | bigint | CHECK (cache_write_tokens >= 0) | 归一化用量；未知为 NULL |
| total_tokens | bigint | CHECK (total_tokens >= 0) | 归一化用量；未知为 NULL |
| app_version | varchar(64) | NOT NULL | 版本 |

表约束：

- PRIMARY KEY (org_id,installation_id,id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
- CHECK (finished_at IS NULL OR finished_at >= started_at)
- CHECK (usage_status <> 'unavailable' OR (input_tokens IS NULL AND output_tokens IS NULL AND cache_read_tokens IS NULL AND cache_write_tokens IS NULL AND total_tokens IS NULL))

## file_changes

可靠文件工具操作事实，不保存文件路径/代码。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| id | uuid | NOT NULL | operation_id |
| query_id | uuid | 可空 | 冻结 Query 归属 |
| run_id | uuid | 可空 | 任务 |
| tool_call_id | varchar(256) | NOT NULL | 本地工具 ID |
| file_key | char(64) | NOT NULL | 本地随机密钥 HMAC 路径 |
| language | varchar(80) | NOT NULL | 语言 |
| file_category | text | NOT NULL CHECK (file_category IN ('code','config','document','other')) | 文件类别 |
| kind | text | NOT NULL CHECK (kind IN ('created','updated','unchanged','unknown')) | created/updated/unchanged/unknown |
| added_lines | bigint | CHECK (added_lines >= 0) | 新增 |
| deleted_lines | bigint | CHECK (deleted_lines >= 0) | 删除 |
| measurement_status | text | NOT NULL | measured 等协议状态 |
| occurred_at | timestamptz | NOT NULL | 执行结束时间 |
| source | varchar(32) | NOT NULL | 由 run/query 关联补充；未知为 system |
| app_version | varchar(64) | NOT NULL | 版本 |

表约束：

- PRIMARY KEY (org_id,installation_id,id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
- CHECK (file_key ~ '^[a-f0-9]{64}$')
- CHECK (measurement_status IN ('measured','unsupported','too_large','binary','unreadable','concurrent_change','failed'))
- CHECK ((measurement_status = 'measured' AND added_lines IS NOT NULL AND deleted_lines IS NOT NULL) OR (measurement_status <> 'measured' AND added_lines IS NULL AND deleted_lines IS NULL))

## installation_daily_metrics

24 月可重映射的安装×日期×来源×版本汇总。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装实例 |
| day | date | NOT NULL | 北京时间自然日 |
| source | varchar(32) | NOT NULL | 调用/事件来源 |
| app_version | varchar(64) | NOT NULL | 发生时版本 |
| queries | bigint | NOT NULL DEFAULT 0 CHECK (queries >= 0) | 同名 API 指标；允许求和 |
| completed_queries | bigint | NOT NULL DEFAULT 0 CHECK (completed_queries >= 0) | 同名 API 指标；允许求和 |
| failed_queries | bigint | NOT NULL DEFAULT 0 CHECK (failed_queries >= 0) | 同名 API 指标；允许求和 |
| cancelled_queries | bigint | NOT NULL DEFAULT 0 CHECK (cancelled_queries >= 0) | 同名 API 指标；允许求和 |
| interrupted_queries | bigint | NOT NULL DEFAULT 0 CHECK (interrupted_queries >= 0) | 同名 API 指标；允许求和 |
| pending_queries | bigint | NOT NULL DEFAULT 0 CHECK (pending_queries >= 0) | 同名 API 指标；允许求和 |
| opens | bigint | NOT NULL DEFAULT 0 CHECK (opens >= 0) | 同名 API 指标；允许求和 |
| launches | bigint | NOT NULL DEFAULT 0 CHECK (launches >= 0) | 同名 API 指标；允许求和 |
| unknown_task_runs | bigint | NOT NULL DEFAULT 0 CHECK (unknown_task_runs >= 0) | 同名 API 指标；允许求和 |
| model_calls | bigint | NOT NULL DEFAULT 0 CHECK (model_calls >= 0) | 同名 API 指标；允许求和 |
| added_lines | bigint | NOT NULL DEFAULT 0 CHECK (added_lines >= 0) | 同名 API 指标；允许求和 |
| deleted_lines | bigint | NOT NULL DEFAULT 0 CHECK (deleted_lines >= 0) | 同名 API 指标；允许求和 |
| files_created | bigint | NOT NULL DEFAULT 0 CHECK (files_created >= 0) | 同名 API 指标；允许求和 |
| file_operations | bigint | NOT NULL DEFAULT 0 CHECK (file_operations >= 0) | 同名 API 指标；允许求和 |
| known_model_calls | bigint | NOT NULL DEFAULT 0 CHECK (known_model_calls >= 0) | 同名 API 指标；允许求和 |
| unknown_model_calls | bigint | NOT NULL DEFAULT 0 CHECK (unknown_model_calls >= 0) | 同名 API 指标；允许求和 |
| measured_file_operations | bigint | NOT NULL DEFAULT 0 CHECK (measured_file_operations >= 0) | 同名 API 指标；允许求和 |
| unmeasured_file_operations | bigint | NOT NULL DEFAULT 0 CHECK (unmeasured_file_operations >= 0) | 同名 API 指标；允许求和 |
| task_ms | bigint | CHECK (task_ms >= 0) | 已知任务耗时和 |
| input_tokens | bigint | CHECK (input_tokens >= 0) | 归一化用量；未知为 NULL |
| output_tokens | bigint | CHECK (output_tokens >= 0) | 归一化用量；未知为 NULL |
| cache_read_tokens | bigint | CHECK (cache_read_tokens >= 0) | 归一化用量；未知为 NULL |
| cache_write_tokens | bigint | CHECK (cache_write_tokens >= 0) | 归一化用量；未知为 NULL |
| total_tokens | bigint | CHECK (total_tokens >= 0) | 归一化用量；未知为 NULL |
| aggregated_at | timestamptz | NOT NULL | 聚合时间 |
| quality_codes | text[] | NOT NULL DEFAULT ARRAY[]::text[] | 缺口、未知用量等原因 |

表约束：

- PRIMARY KEY (org_id,installation_id,day,source,app_version)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## installation_daily_activity

24 月保留的压缩区间；跨安装计算员工并集。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| day | date | NOT NULL | 北京时间日期 |
| app_version | varchar(64) | NOT NULL | 版本 |
| active_ranges | tstzmultirange | NOT NULL | 该日真实有效活动并集 |
| runtime_ms | bigint | NOT NULL DEFAULT 0 CHECK (runtime_ms >= 0) | 运行时长 |
| aggregated_at | timestamptz | NOT NULL | 聚合时间 |

表约束：

- PRIMARY KEY (org_id,installation_id,day,app_version)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## installation_daily_models

24 月模型统计。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装实例 |
| day | date | NOT NULL | 北京时间自然日 |
| source | varchar(32) | NOT NULL | 调用/事件来源 |
| app_version | varchar(64) | NOT NULL | 发生时版本 |
| provider | varchar(128) | NOT NULL | 供应商 |
| model | varchar(256) | NOT NULL | 模型 |
| calls | bigint | NOT NULL DEFAULT 0 CHECK (calls >= 0) | 同名模型指标 |
| failed_calls | bigint | NOT NULL DEFAULT 0 CHECK (failed_calls >= 0) | 同名模型指标 |
| known_calls | bigint | NOT NULL DEFAULT 0 CHECK (known_calls >= 0) | 同名模型指标 |
| unknown_calls | bigint | NOT NULL DEFAULT 0 CHECK (unknown_calls >= 0) | 同名模型指标 |
| duration_ms | bigint | NOT NULL DEFAULT 0 CHECK (duration_ms >= 0) | 同名模型指标 |
| input_tokens | bigint | CHECK (input_tokens >= 0) | 归一化用量；未知为 NULL |
| output_tokens | bigint | CHECK (output_tokens >= 0) | 归一化用量；未知为 NULL |
| cache_read_tokens | bigint | CHECK (cache_read_tokens >= 0) | 归一化用量；未知为 NULL |
| cache_write_tokens | bigint | CHECK (cache_write_tokens >= 0) | 归一化用量；未知为 NULL |
| total_tokens | bigint | CHECK (total_tokens >= 0) | 归一化用量；未知为 NULL |
| aggregated_at | timestamptz | NOT NULL | 聚合时间 |

表约束：

- PRIMARY KEY (org_id,installation_id,day,source,app_version,provider,model)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## daily_query_models

保留 24 月的模型相关 Query 去重键；无原文。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装实例 |
| day | date | NOT NULL | 北京时间自然日 |
| source | varchar(32) | NOT NULL | 调用/事件来源 |
| app_version | varchar(64) | NOT NULL | 发生时版本 |
| provider | varchar(128) | NOT NULL | 供应商 |
| model | varchar(256) | NOT NULL | 模型 |
| query_id | uuid | NOT NULL | 人工 Query ID；无短期事实表外键 |

表约束：

- PRIMARY KEY (org_id,installation_id,day,source,app_version,provider,model,query_id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## daily_file_keys

24 月文件去重与语言统计；跨日 files_touched 不求和。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装实例 |
| day | date | NOT NULL | 北京时间自然日 |
| source | varchar(32) | NOT NULL | 调用/事件来源 |
| app_version | varchar(64) | NOT NULL | 发生时版本 |
| file_key | char(64) | NOT NULL | 文件实例 HMAC |
| language | varchar(80) | NOT NULL | 语言 |
| file_category | text | NOT NULL | 分类 |
| added_lines | bigint | NOT NULL DEFAULT 0 CHECK (added_lines >= 0) | 文件日指标 |
| deleted_lines | bigint | NOT NULL DEFAULT 0 CHECK (deleted_lines >= 0) | 文件日指标 |
| files_created | bigint | NOT NULL DEFAULT 0 CHECK (files_created >= 0) | 文件日指标 |
| measured_operations | bigint | NOT NULL DEFAULT 0 CHECK (measured_operations >= 0) | 文件日指标 |
| unmeasured_operations | bigint | NOT NULL DEFAULT 0 CHECK (unmeasured_operations >= 0) | 文件日指标 |

表约束：

- PRIMARY KEY (org_id,installation_id,day,source,app_version,file_key)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## data_quality_daily

客户端丢失、拒绝、未知用量的可见缺口。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| day | date | NOT NULL | 影响日期或观察日期 |
| code | varchar(64) | NOT NULL | 质量原因码 |
| event_count | bigint | NOT NULL DEFAULT 0 CHECK (event_count >= 0) | 事件数 |
| last_observed_at | timestamptz | NOT NULL | 最近观察 |

表约束：

- PRIMARY KEY (org_id,installation_id,day,code)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## export_jobs

异步 CSV 导出；只读用户可导出其可见数据。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| account_id | uuid | NOT NULL | 创建者 |
| filters | jsonb | NOT NULL | 与报表相同的筛选快照 |
| status | text | NOT NULL CHECK (status IN ('queued','running','completed','failed','expired')) | 任务状态 |
| object_key | varchar(300) | 可空 | 私有文件存储键；非公网 URL |
| row_count | bigint | CHECK (row_count >= 0) | 行数 |
| lease_owner | uuid | 可空 | worker |
| lease_until | timestamptz | 可空 | 租约 |
| expires_at | timestamptz | NOT NULL | 24 小时 |
| error_code | varchar(64) | 可空 | 错误码 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- FOREIGN KEY (org_id, account_id) REFERENCES admin_accounts(org_id, id)

## audit_logs

管理操作审计，无密码、原始设备凭证。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| id | uuid | PRIMARY KEY | 业务 UUID |
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| actor_id | uuid | NOT NULL | 操作者；identity.* 动作为设备安装 UUID，管理动作为后台账号 |
| action | varchar(80) | NOT NULL | 动作 |
| target_type | varchar(80) | NOT NULL | 对象类型 |
| target_id | uuid | NOT NULL | 对象 |
| summary | varchar(500) | NOT NULL | 脱敏摘要 |
| before_redacted | jsonb | 可空 | 脱敏前值 |
| after_redacted | jsonb | 可空 | 脱敏后值 |
| request_id | uuid | NOT NULL | 请求追踪 |
| occurred_at | timestamptz | NOT NULL DEFAULT now() | 发生时间 |

表约束：



## installation_identities

客户端域身份及最近匹配结果，不代表企业认证。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| installation_id | uuid | NOT NULL | 安装 |
| claim | jsonb | NOT NULL | 最近报告的身份；JSON null 表示旧客户端仅报告注册用户名 |
| state | varchar(40) | NOT NULL | 最近匹配结果 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 最近变化 |

表约束：

- PRIMARY KEY (org_id,installation_id)
- FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)

## employee_domain_accounts

已报告域账号的归属记录；多个允许域的同一工号归到同一员工。

| 字段 | PostgreSQL 类型 | SQL 约束/默认值 | 说明 |
|---|---|---|---|
| org_id | uuid | NOT NULL REFERENCES organizations(id) | 组织隔离键 |
| domain | varchar(128) | NOT NULL | 规范化域 |
| account_name | varchar(128) | NOT NULL | 规范化域账号 |
| employee_id | uuid | NOT NULL | 员工 |
| created_at | timestamptz | NOT NULL DEFAULT now() | 创建时间 |

表约束：

- PRIMARY KEY (org_id,domain,account_name)
- FOREIGN KEY (org_id, employee_id) REFERENCES employees(org_id, id)
