# 指标口径与边界

所有日期为 Asia/Shanghai 自然日；API 使用 [from,to) 半开区间。事件存 UTC，持续时间用单调时钟测量。计数传非负 int64 字符串，避免 JavaScript 精度损失。界面用本地格式化；未知使用 —，不能默认为 0。

## 人、安装与时间

| 指标 | 精确定义 | 去重/日期 |
|---|---|---|
| 已确认员工 | 管理员创建、未归档的员工数 | employee_id；不是安装总数 |
| 活跃人数 DAU/范围人数 | 范围内存在可信活跃区间或人工 Query 的已绑定员工数 | employee_id DISTINCT；跨日人数不能累加 |
| 未绑定安装 | 有注册记录但在对应日无员工绑定的实例 | installation_id；与人数分开 |
| 冷启动 launches | 获得 Electron 单实例锁后启动一次主进程 | app_launch_id；自动启动/升级启动都算 |
| 打开 opens | 手动启动、快捷方式、托盘、菜单明确唤起工作窗口 | activation_id；同一触发链只记一次，2 秒本地去抖；普通 focus 不记 |
| 运行时长 runtime_ms | 主进程存活且系统未 suspend 的采样区间 | 单安装按区间去重；多设备是设备时间总和，可能超过 24 小时 |
| 活跃时长 active_ms | 工作窗口可见、前台聚焦、未锁屏/休眠且系统 idle < 60 秒的采样区间 | 每 5 秒采样、每分钟本地合并；同一员工多设备区间取并集，日上限 24 小时 |
| 任务时长 task_ms | 从 dispatching/running 到终态的单调耗时 | 每个 run 一次；包括人工等待，waiting_ms 可单列；并发任务求和可超过活跃时长 |

宠物悬浮窗、通知和托盘本身不计工作窗口活跃。关闭到托盘继续计运行，但不计活跃。锁屏、睡眠、窗口被其他应用遮住/失焦不计活跃。单次采样误差最多约 5 秒；应用崩溃最多损失未落盘的一分钟活动段，不能补造直到下次开机的时间。

休眠恢复发现单调时间/墙钟间隔异常时丢弃未知间隔并报质量码；只合并可信区间。active_ms 的筛选只支持员工、部门、日期、发生时版本，模型/来源筛选不改变桌面活动时长，并在响应 warning_codes 标明 SOURCE_FILTER_NOT_APPLICABLE_TO_ACTIVITY。

## Query 与任务

人工 Query = 可信人工入口中，输入通过校验并由本地命令日志**持久接收**的一次提交。网络重试、页面刷新、SSE 重连、模型重试、模型 fallback 不增加 Query。用户再次提交相同文本是新的 Query。UI 中未送达且仍处于恢复草稿的内容尚不计数。

room 中人工入口只记一个 Query，分派给多个 Agent 的内部消息不再计；自动任务、扩展/system 消息另记来源和任务，不能伪装为人工。remote 入口只能由已验证为人工发起的入口赋予 human；未知来源计 system。手动 slash 命令被持久接收后也算 Query，即使没有模型调用。

Query ID 基于安装 ID + command idempotency key 派生。状态 revision 单调增加。人工 steer/followup 是新的 Query；某次模型调用归属于它开始前**最后实际送入该任务的 Query**，不会因排队消息到达而改变已有调用归属。一个 Query 可关联多个 run；一个 run 可因 steer 关联多个 Query，API 的 run_ids 与 run 触发 query_id 不等同。

所有人工 Query 的状态构成必须相等：

~~~text
queries = completed + failed + cancelled + interrupted + pending
~~~

pending 含 accepted/queued/running。状态按 Query 接收日统计，晚到终态回补接收日；终态互相冲突须查明，不允许低 revision 或 running 覆盖终态。应用重启检查未闭合 run，标 interrupted；没有可信结束时 duration=null、unknown_task_runs+1，不把中断至重启间隔当任务时长。

## Token 与实际模型调用

每次**具体供应商请求**分配 call_id。一次人工 Query 可触发若干调用，且失败调用也可能已消耗 Token。包括 chat/room、压缩、review、vision、prompt_optimize、prediction、model_test、后台任务等。complete -> stream 的内部委托只算一次；虚拟模型路由只计算最终具体请求。自动重试和 fallback 各记新 call_id。

按供应商返回的 usage 适配成互不重叠的桶：

~~~text
total = input_uncached + output + cache_read + cache_write
~~~

- 输入包含缓存时，先减去该供应商说明中已包含的 cache_read/cache_write，不能再次把缓存相加。
- 推理 Token 若是 output 子项，不再加入 total。
- 仅有可靠 total 时保留 total，其余为 null；不根据文本字符估算。
- SDK 默认填 0 不能证明供应商返回了 0；需要 known/partial/unavailable 的来源判定。
- 返回错误/取消但有部分 usage：保存已知部分，并标 partial。无 usage 的调用不算免费。
- 聚合对每个桶累加已知值，若无已知值则 null；部分缺失时显示“已知部分”，并携带 unknown_model_calls 与 warning_codes。total 与各桶不完整时可能无法相加，界面不能强行补齐。

Token 归属调用结束日；无可信结束的调用归属开始日并标未知。对话 Query 数归接收日，因此“当日 Query 关联 Token”与“当日实际消耗 Token”不是同一字段。Query 详情显示全生命周期关联值，日看板显示实际发生日。

不把价格计算纳入 v1，不把模型报告用量承诺为供应商账单一致。归一化原则参考 [Langfuse Token 跟踪](https://langfuse.com/docs/observability/features/token-and-cost-tracking)。

## AI 修改/生成代码

v1 计量可靠的 Piora 文件 write/edit 工具，执行成功后读取真实文件前后内容，用行差异计算。新文件 +N/-0，修改文件 +A/-D；修改一行通常算 +1/-1。重复改同一行累计多次，这是**操作量**。

| 指标 | 定义 |
|---|---|
| 代码新增/删除行 | file_category=code 的已计量行差异之和 |
| 新建文件数 | 成功 created 操作数；删后重新生成也算一次 |
| 触及文件数 | 范围内 DISTINCT(installation_id,file_key)，不累加各日文件数 |
| 文件操作数 | 文件工具执行次数，含不可计量/失败；另列 measured/unmeasured |
| 语言分布 | 扩展名/受控语言映射；配置和文档单独筛选，不默认算代码 |

本地 file_key = HMAC-SHA256(安装私有随机 salt, 规范化真实绝对路径)，不上传路径。Windows 大小写与分隔符规范化，读取 realpath 处理别名；无法解析时标未知而不是跨实例合并文件。

不计生成在回复气泡但未落盘的代码；shell、MCP、外部编辑器和间接生成器改动不声称完整覆盖。被覆盖工具内部遇到二进制、>2 MiB、>100,000 行、读取失败或并发外部变化，行数 null 并显示原因。审批拒绝发生在 execute 前，不能算已落盘；工具执行失败记 unmeasured，不从“计划写入内容”推算。

代码行数解释参考 [GitHub Copilot LOC 指标](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/lines-of-code-metrics)，本项目并不复刻其接受率口径。

## 缺失与质量

complete 仅表示**声明覆盖的采集能力**内当前已收到数据完整；不表示覆盖全部代码或实时完整。partial 为存在已知缺口；unknown 为无法判断；no_reports 为已接入但所选范围尚无报告；not_enrolled 为未接入；out_of_retention 为明细已过期。零表示确实收到且明确为零。

时间范围跨午夜时活动区间拆日，恰好午夜属于后一日。部门/人员按事件发生日的生效区间映射；管理员纠错重新关联保留期内统计，不修改原始事件。
