# Windows 采集与同步协议

协议 1.0。采集频率与网络同步频率分离：本地事件即时持久化，活动每 5 秒采样、每 60 秒合并；网络正常 25–35 分钟一轮。

## 调度参数与算法

| 场景 | 行为 |
|---|---|
| 每轮正常上传结束 | CSPRNG uniform(1500,2100) 秒，持久化 next_due_at |
| 首次注册 | 启动后随机 60–300 秒，注册成功后开始常规周期 |
| 退出再启动、next_due_at 未到 | 继续原截止时间，不能每次启动都刷新为 30 分钟以后 |
| 截止时间已过 / 从未上传 | 启动后随机 60–300 秒补传 |
| 离线恢复 / 系统唤醒 | 随机 120–600 秒；同一恢复窗口只调度一次 |
| 退出 | 最多 1 秒完成本地提交/关闭，不为同步等待网络；下一次启动补传 |
| 批次 | 最多 500 事件且未压缩 UTF-8 JSON <=262,144 bytes；按先到达限制切分 |
| 一轮积压 | 最多 5 批，批间随机 10–30 秒；仍有积压则随机 5–10 分钟继续 |
| 空队列 | 不发空批；每正常周期至多合并一条 client.health 用于健康与策略下发 |
| HTTP 超时 | 15 秒；取消 HTTP 不能删除本地事件 |
| 本地保留 | 30 天或 256 MiB；达到限制按最旧优先清理并持久记录缺口 |

各客户端独立使用系统安全随机数，不能用固定分钟、相同种子或仅按用户名散列。重新启动、断网恢复、Retry-After 后都加抖动。参考 [AWS 关于 jitter 的建议](https://aws.github.io/aws-elb-best-practices/reliability/failure_management/)。

网络错误/408/429/5xx：第 n 次失败随机 [0,min(1800,30×2^n)] 秒，客户端设置至少 5 秒底线；Retry-After 存在时按 max(本地退避,服务端秒数)+uniform(0,30) 执行。同一轮重试也受单上传器与最多 5 批限制。401 只允许已有可用旧/新凭证切换一次，否则暂停并显示凭证失效；403 撤销立即停止上报，不能循环注册绕过。

服务端按安装限流（默认 12 批/分钟、突发 20），并设组织总吞吐上限。后台限流按账号/IP；公司 NAT 下不能只按 IP 限制正常终端。超过阈值返回 429，提供 Retry-After。

## 持久队列与一次性效果

SQLite WAL；写入 outbox 与分配 event_seq 在同一短事务，source_key UNIQUE，event_id 由稳定业务键派生。发出请求前不删除事件。batch_id 代表一次传输，重新组批可变化，但事件 ID、seq、内容不能变化。拒绝给同一 event_id 重写新内容。

服务端分两层检查：

1. 先验证压缩前后尺寸、协议、JSON 语法、事件数组长度、可识别且唯一的 event_id；结构无法安全逐条定位时整批 400/413，无任何 ACK。
2. 逐事件校验完整允许列表 Schema、业务约束和内容摘要。有效项在同一数据库事务写 event_receipts、telemetry_events、聚合任务；永久错误列入 rejected_events，记录脱敏质量计数。
3. 提交后 200 返回 accepted、duplicate、rejected 三个互不交叉集合，必须覆盖全部请求 event_id。duplicate 仅允许 ID、seq、source_key 和规范内容全部相同；冲突返回 EVENT_CONFLICT。
4. 客户端验证 ACK 集合：缺少项/重复项/未知 ID/响应无效时保留未确认数据。accepted 和 duplicate 删除；rejected 移到本地 quarantine（7 天、最多 10 MiB），保留原因并累计缺口。

HTTP 200 只代表对应列表中的事件已处理；不能直接删整个批次。ACK 丢失时重发原事件，由跨月 receipt 表去重，不能把分区表的月内唯一键当全局去重。

## 传哪些数据

| 事件 | 何时写本地 | 主要字段 |
|---|---|---|
| desktop.started | 获得单实例锁、开始运行 | app_launch_id、reason |
| desktop.opened | 明确手动唤起工作窗口 | activation_id、reason |
| desktop.activity | 每分钟/锁屏/暂停/退出 | start/end、runtime、active_ranges、time_quality |
| query.submitted | 命令日志持久接收后 | query_id、command_id、source、trigger、accepted_at |
| query.updated | 持久状态改变 | query_id、revision、status、run_id |
| run.started / finished | 任务调度/终态 | run、query、parent、source、单调耗时 |
| model.started / finished | 具体供应商调用边界 | call、query、run、实际模型、usage、状态 |
| file.changed | 真实文件工具 execute 完成 | operation、file_key、language、分类、行变化、质量 |
| client.health | 每上传轮合并 | 本地积压、丢弃、隔离、时钟偏差、异常码 |

全部字段定义见 [events.schema.json](../contracts/events.schema.json) 与 [API 参考](api-reference.md)。不把工具参数、提示词、错误堆栈、原始模型响应作为“extra”混入。

## 时钟、离线与策略

任务与模型时长用单调时钟计算。桌面活动每 5 秒比较单调间隔与本机 UTC 间隔，只累计二者偏差小于 1 秒且间隔不超过 7.5 秒的采样段；运行时长是采样估计。事件 UTC 为本机时间加最近一次服务端偏差；注册/上传响应的 server_time 与请求往返中点估计偏差，RTT >= 5 秒或绝对偏差超过 24 小时的测量不采用。一个活动段内保持同一偏差；跳变区间舍弃，已生成事件不改写。客户端当前产生 synchronized / local_only；suspect 是协议支持的拒收状态。

接收允许发生时间在服务端当前时间前 30 天内、未来 5 分钟内；超出分别 EVENT_TOO_OLD/CLOCK_SUSPECT。先查历史 receipt 识别已接收重传，再拒绝从未接收的过期事件。时钟异常不得默默改为上传日期。local_only 的普通事件在合理窗口内接收并标 CLOCK_UNVERIFIED；suspect 活动事件隔离，避免虚增活跃。本地尚未生成事件时可重新校正时钟，已有事件一经生成保持不可变。

策略每次响应可附带更新；不单独轮询配置。服务端 enabled=false 后客户端暂停业务采集，仅按常规低频提交最小 client.health 控制事件读取策略，UI 显示“组织采集已暂停”；恢复只从恢复时刻继续。暂停期间不补采，不扫描历史会话。已经排队的业务事件按管理员暂停策略先保留，恢复后仍受 30 天窗口限制。

正常间隔服务端不能配置低于 25 分钟，min<=max；首次/重连 min<=max，所有限制服务端验证。批次/队列上限只能在协议范围内调整。策略修改要记录审计并显示生效版本；离线终端使用最近合法策略。

## 注册、轮换与丢响应恢复

1. 企业部署配置写入 backend_url 与短期 enrollment key；不可把长期组织秘密硬编码进公开 Piora 安装包。
2. 本机生成 installation_id、registration_id、credential_id 和 32 字节 secret，先用 Electron safeStorage/Windows DPAPI 保存。注册请求携带该材料；secret 只走 TLS，服务端只存带 pepper 的哈希。
3. 注册响应不包含设备 secret，因此响应丢失也不会丢密钥；同 registration_id + 相同请求返回原结果、不重复消费注册次数。重试身份验证先查既有注册并匹配其内容/设备密钥，再处理 bootstrap 已到期场景；不能允许不同数据占用旧 registration_id。
4. 设备凭证 90 天；剩余 <=7 天触发轮换。新 secret 先本地保存 pending，再调用 rotate；rotation_id 唯一，响应丢失可用旧/新凭证请求相同轮换结果。
5. 旧凭证过渡 24 小时，新凭证确认后启用；90 天彻底离线失效的设备需要管理员重新下发注册流程，不自动使用无效 bootstrap。

注册并发需锁 enrollment key 行；次数达到上限或已撤销时不能新注册。凭证撤销/换组织不合并旧安装历史。用户名只在注册作为线索保存；后续更名由管理员备注/重新绑定确认，不用改名自动合并员工。
