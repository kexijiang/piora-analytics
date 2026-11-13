# 数据库关系、事务与保留

完整 29 张表和列说明见 [字段字典](database-reference.md)，初始化 [SQL](../database/migrations/0001_initial.sql)。本设计使用 PostgreSQL 18 的 range/multirange 与 btree_gist；时间使用 timestamptz，不依赖数据库会话时区计算业务日期。

~~~mermaid
erDiagram
  organizations ||--o{ employees : owns
  organizations ||--o{ installations : owns
  employees ||--o{ employee_department_periods : history
  departments ||--o{ employee_department_periods : contains
  employees ||--o{ installation_bindings : maps
  installations ||--o{ installation_bindings : history
  installations ||--o{ installation_credentials : authenticates
  installations ||--o{ event_receipts : deduplicates
  event_receipts ||--|| telemetry_events : persists
  installations ||--o{ aggregation_jobs : projects
  installations ||--o{ queries : submits
  installations ||--o{ model_calls : consumes
  installations ||--o{ file_changes : changes
  installations ||--o{ installation_daily_metrics : summarizes
  installations ||--o{ installation_daily_activity : intervals
  installations ||--o{ daily_file_keys : distinct_files
~~~

## 身份与隔离

所有事实与维度携带 org_id，跨组织外键使用 (org_id,id)。一台安装有效期重叠绑定由 GiST exclusion constraint 拒绝；同员工多设备合法。部门归属也用不重叠 daterange。范围统一 [from,to)，无限上界表示持续；同一天交接按整天归属，v1 不支持一天内拆给两名员工。

后台每个 SQL 查询都从认证上下文注入 org_id，不能接受用户指定组织。服务启动必须确认单组织配置；迁移工具用单独 DDL 角色，API 使用最小 DML 权限，不能给应用数据库超级用户。

## 接收事务

先锁安装行，再逐事件保存点插入 receipt，串行化同安装并发上报。receipt 同时唯一约束 seq 与 source_key_hash，内容采用 RFC8785 规范 JSON 摘要。重传先比较摘要与 seq，不能把任何唯一冲突都当重复成功。

事务内插入 receipt、分区原始事件、事实投影，并 upsert 对应 day 的 aggregation_jobs.requested_revision+1。需要更新旧 Query 接收日/跨日活动/跨日 run 时，标记所有受影响日期。客户端收到成功前必须完成 commit；提交后连接断开由下一次重传解决。

按 received_at 月分区，避免迟到事件写入已删除发生月分区。分区唯一约束必须含 partition key，故不能承担跨月去重；独立非分区 receipt 表解决。参考 [PostgreSQL 分区约束](https://www.postgresql.org/docs/current/ddl-partitioning.html)。

## 乱序、Worker 与重算

Worker 用 FOR UPDATE SKIP LOCKED 领取到期任务，记录 lease_owner、lease_until=now+60s、目标 requested_revision，然后释放领取事务。处理期 20s 续租；写回时必须验证仍持有租约。终态先到、起始后到均保留原始事件并以 ID 重放，不使用接收顺序作为业务状态顺序。

一个安装/日有且只有一个写投影者，提交事务获取 advisory lock 或对应任务行锁。基于一致快照重建该日**整组**日聚合，使用 replace/upsert，不能每次重试做 amount+=delta。提交聚合与 completed_revision=目标版本在同一事务；期间有新事件会提高 requested_revision，任务仍保持待处理。禁止把 completed_revision 直接赋为最新 requested_revision，否则会吞掉处理中到达的新事件。

query.updated 以最大合法 revision 合并；不同 event_id 复用同一 model/file business ID 会拒绝。终态先到时保存原始记录，起始到达后再投影，不虚构 Query。失败累计 attempts，延后 60 秒重试。当前没有扫描所有未闭合引用的独立补偿任务或自动通知渠道，健康看板可观察积压。

## 日汇总与非可加指标

安装日汇总以 (installation,day,source,app_version) 为粒度。Token NULL 使用 COUNT(nonnull)>0 ? SUM : NULL，另带未知调用数量。已知部分可以展示，但必须显示质量。

活跃时长保留压缩后的 tstzmultirange 24 月；员工跨设备使用 range_agg 并集后计算长度。不能直接 SUM 各设备 active_ms。runtime 是设备运行累计，可相加。活动跨午夜先裁剪到日边界，再写 daily_activity。

文件保留 daily_file_keys（HMAC，不是路径）24 月，报表按 DISTINCT(installation,file_key) 计算范围文件数；模型相关 Query 保留 daily_query_models 以避免跨日/跨模型重复。统计人数按 employee DISTINCT，不累加 DAU。

绑定/部门改动不改变原始事实中的安装身份；查询按日期关联有效期。可选员工聚合缓存必须带 identity_revision 并失效。本期不额外持久员工日表，避免同一事实冗余。历史绑定重算只重新映射安装日维度，因此超过原始事件 90 天、仍在日汇总 24 月内也可纠错。

## 保留、备份与删除顺序

| 数据 | 默认保留 | 删除顺序 / 行为 |
|---|---|---|
| 原始事件、短期事实 app_launches/activity/queries/runs/model_calls/file_changes | 90 天 | 按行按 occurred_at 保留明细；原始分区按 received_at，边界月按行清理，整月过期再 detach/drop |
| event_receipts | 至少首次接收后 90 天 | 必须先删除引用它的原始事件，再清理 receipt；允许接收窗口仅 30 天 |
| installation_daily_*、daily_file_keys、daily_query_models、data_quality_daily | 24 个自然月 | 删除完整到期日，整组一致；不因无原始数据把旧聚合重建为空 |
| 身份与绑定历史 | 相关统计保留期内至少保留 | 归档而非级联删除 |
| audit_logs | 365 天 | 管理变更有审计，定时清理通过 Worker 运行日志排障 |
| 导出文件 | 24 小时 | 删除私有对象，保留过期任务状态 7 天 |
| 管理幂等重放 | 24 小时 | 包含加密一次性 secret 的缓存一起清除 |

只重算有原始事实可重建的最近窗口；旧日仅变更人员/部门映射，不运行“清空再重建”。清理必须检查该日聚合已完成、无未决任务，否则延后并告警。分区维护提前两个月建好，无默认分区；漏建分区返回 503，不能 ACK 丢弃。

每天加密备份 + 连续 WAL 归档，规划 RPO<=15 分钟、RTO<=4 小时，恢复演练后才可认定达标。删除生产数据库、清理卷或修改保留期必须走独立运维流程。本仓库数据库检查只针对名称以 _test 结尾的空临时数据库。
