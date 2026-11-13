# 可执行开发计划

A01–A10、C01–C05 已进入实际代码交付，具体完成范围与本地验证见 [交付状态](implementation-status.md) 和 [验证记录](verification.md)。下表保留开发依赖与完整验收标准；未覆盖条件仍需试点，不把单元测试等同生产验收。V01/V02 尚未开展。

| 编号 / 阶段 | 仓库与改动 | 依赖 | 完成标准 |
|---|---|---|---|
| A01 契约基线 | analytics：OpenAPI、Schema、DDL、规范、UI | 无 | 本设计包检查通过，图集与原型可打开 |
| A02 服务骨架 | analytics：API/Worker 启动、配置、迁移、health、CI 容器 | A01 | 空库可迁移，错误配置 fail fast，生产镜像可运行 |
| A03 后台认证 | analytics：登录/session/CSRF/RBAC/账号审计 | A02 | viewer 写操作服务端拒绝，最后 admin 保护，失效会话失权 |
| A04 安装注册 | analytics：enrollment/注册/轮换/撤销 | A02 | 响应丢失重试不丢密钥、不多消费；跨组织拒绝 |
| C01 Windows 记账 | Piora：身份/SQLite/注册/DPAPI/调度 | A04 | 重启恢复、离线、队列限制、抖动，30 天窗，升级不换 ID |
| A05 事件接收 | analytics：batch/Ajv/跨字段规则/receipt/限流 | A04 | ACK 后杀进程仍能查到；跨月重复不双计；逐项拒绝 |
| C02 桌面时长 | Piora：main/activity/powerMonitor/唤起 | C01 | Windows 实测锁屏/休眠/托盘/二次进程/多窗口正确 |
| C03 Query/run | Piora：journal admission/reconcile/context | C01 | 相同文本新提交+1、重试+0、room fanout+0、自动任务单列 |
| C04 模型用量 | Piora：factory/observer/normalizer | C03 | 所有模型入口覆盖，重试/取消/partial/unknown，虚拟路由不双计 |
| C05 文件计量 | Piora：真实 execute wrapper/快照/行 diff | C03 | 审批拒绝无落盘、并发/大文件/外部变化明确质量 |
| A06 Worker | analytics：事实投影/日期拆分/汇总/租约 | A05,C02–05 | 随机乱序/重复/重放结果一致；处理中新事件不丢 |
| A07 人员管理 | analytics：员工/部门/有效期绑定/历史纠错 | A03,A06 | 重叠绑定拒绝；24 月内旧汇总可重映射 |
| A08 报表 API | analytics：总览/员工日表/详情/模型/代码/健康 | A06,A07 | DISTINCT、区间并集、缺失/0 区分，与固定真值数据一致 |
| A09 真实 UI | analytics：将 demo adapter 换 authenticated API | A03,A08 | UI 图对应页面、分页筛选、加载/空/错误、角色权限 |
| A10 导出运维 | analytics：导出/清理/备份/告警 | A08 | CSV 公式防护、到期删除、恢复演练、保留期边界 |
| V01 五台试点 | 两仓库 | A09,A10,C05 | 至少 3 工作日人工对账；功能/性能/上传流量验收 |
| V02 扩容发布 | 两仓库 | V01 | 50 台再全员；开关回退；Windows 安装包仅 GitHub Actions |

推荐提交顺序：后端 A02–A05 为第一批；Piora C01–C03 与后端 A06 并行开发可行，但各自保持独立 PR；再 C04/C05 与 A07–A09；最后真实试点。各 PR 在提交前与推送前 fetch/rebase，更新 Piora 独立 changelog.d 片段，CI 后才合并。

生产上线前仍需组织提供：部署域名/服务器、初始管理员、员工/部门表、企业配置分发渠道。设计和原型不依赖这些值；不得为推进原型而编造真实账号或密钥。
