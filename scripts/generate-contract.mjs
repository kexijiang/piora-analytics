import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '..');
const schemas = {};
const str = (description, maxLength=256) => ({type:'string',description,minLength:1,maxLength});
const integer = (description, maximum=2147483647) => ({type:'integer',description,minimum:0,maximum});
const flag = description => ({type:'boolean',description});
const en = (values,description) => ({type:'string',enum:values,description});
const uuid = description => ({type:'string',format:'uuid',description});
const time = description => ({type:'string',format:'date-time',description});
const date = description => ({type:'string',format:'date',description});
const count = description => ({type:'string',pattern:'^(0|[1-9][0-9]*)$',maxLength:19,description:description+'；非负 int64 十进制字符串，最大 9223372036854775807'});
const ref = name => ({$ref:'#/components/schemas/'+name});
const nil = schema => ({anyOf:[schema,{type:'null'}]});
const list = (items,description,maxItems=500) => ({type:'array',items,description,maxItems});
const obj = (properties,optional=[]) => ({type:'object',additionalProperties:false,properties,required:Object.keys(properties).filter(k=>!optional.includes(k))});
const add = (name,properties,optional=[]) => (schemas[name]=obj(properties,optional),ref(name));
const id = uuid('稳定 UUID，不能使用用户名代替');
const outcome = en(['completed','failed','cancelled','interrupted'],'终态；不得被迟到的运行态覆盖');
const source = en(['chat','room','remote','automation','system','compaction','review','vision','prompt_optimize','prediction','model_test','shell','companion'],'实际调用来源；人工身份由入口确定');
add('ErrorBody',{code:str('稳定机器错误码',64),message:str('安全错误信息，不含密钥或对话',512),retryable:flag('是否可按协议自动重试'),request_id:id,field_errors:list(obj({path:str('JSON Pointer 或参数名'),message:str('校验原因',300)}),'逐字段错误',100)});
add('ErrorResponse',{error:ref('ErrorBody')});
add('Meta',{request_id:id,server_time:time('服务端响应时间')});
add('Coverage',{state:en(['complete','partial','unknown','no_reports','not_enrolled','out_of_retention'],'数据状态；与在线状态无关'),known_model_calls:count('有用量的调用'),unknown_model_calls:count('无可靠用量的调用'),measured_file_operations:count('可靠计量文件操作'),unmeasured_file_operations:count('未计量文件操作'),last_received_at:nil(time('最近收到事件时间')),data_through:nil(time('最近已处理的实际事件时间')),warning_codes:list(str('质量原因码',64),'质量提示',30)});
add('ReportMeta',{request_id:id,server_time:time('响应时间'),timezone:en(['Asia/Shanghai'],'固定统计时区'),aggregation_as_of:nil(time('当前聚合完成时间')),from:date('统计起始日，包含'),to:date('统计结束日，不包含'),coverage:ref('Coverage')});
add('SyncPolicy',{version:integer('策略版本',1000000),enabled:flag('组织采集是否启用'),interval_min_seconds:{type:'integer',description:'正常同步最小间隔，正整数秒；后台可设置任意正整数分钟',minimum:1,default:1500},interval_max_seconds:{type:'integer',description:'正常同步最大间隔，不小于最小间隔；不设业务时间上限',minimum:1,default:2100},initial_delay_min_seconds:{...integer('首次/逾期启动最小抖动',600),default:60},initial_delay_max_seconds:{...integer('首次/逾期启动最大抖动',600),default:300},reconnect_min_seconds:{...integer('网络恢复最小抖动',1800),default:120},reconnect_max_seconds:{...integer('网络恢复最大抖动',1800),default:600},max_batch_events:{...integer('每批事件上限',500),minimum:1,default:500},max_batch_bytes:{...integer('未压缩 JSON 字节上限',262144),minimum:4096,default:262144},queue_max_days:{...integer('本地保留天数',30),minimum:1,default:30},queue_max_bytes:{...integer('本地队列字节上限',268435456),minimum:1048576,default:268435456}});
add('AdminUser',{id,username:str('后台账号，组织内唯一',80),display_name:str('显示名',120),role:en(['admin','viewer'],'服务端权限角色'),status:en(['active','disabled'],'账号状态'),revision:integer('乐观锁版本'),must_change_password:flag('是否必须修改临时密码')});
add('LoginInput',{username:str('后台账号',80),password:{...str('密码，仅通过 TLS 提交，禁止记录日志',256),minLength:12,writeOnly:true}});
add('Session',{user:ref('AdminUser'),csrf_token:str('用于管理写请求的 CSRF 值',128),expires_at:time('绝对过期时间；12 小时，空闲 2 小时失效')});
add('PasswordInput',{current_password:{...str('当前密码',256),writeOnly:true},new_password:{...str('新密码',256),minLength:12,writeOnly:true}});
add('Ok',{ok:flag('操作成功')});
add('Department',{id,name:str('部门名称，组织内唯一',120),status:en(['active','archived'],'状态'),revision:integer('版本')});
add('DepartmentInput',{name:str('部门名称',120)});
add('DepartmentUpdate',{name:str('部门名称',120),expected_revision:integer('提交时看到的版本')});
add('Employee',{id,name:nil(str('姓名；未知时展示工号',120)),employee_no:nil(str('可选工号；非空时组织内唯一',64)),department_id:nil(uuid('当前部门')),status:en(['active','archived'],'状态'),installation_count:integer('绑定安装实例数量'),revision:integer('版本')});
add('EmployeeInput',{name:nil(str('姓名；未知时须提供工号',120)),employee_no:nil(str('工号',64)),department_id:nil(uuid('部门 ID'))});
add('EmployeeUpdate',{name:nil(str('姓名；未知时须提供工号',120)),employee_no:nil(str('工号',64)),department_id:nil(uuid('部门 ID')),effective_from:date('部门调整生效日；北京时间'),expected_revision:integer('版本')});
add('RevisionInput',{expected_revision:integer('版本'),reason:str('操作原因',500)});
add('CredentialMaterial',{credential_id:id,secret:{type:'string',minLength:43,maxLength:43,pattern:'^[A-Za-z0-9_-]{43}$',description:'客户端生成的 32 随机字节 base64url；注册前使用 DPAPI 保存；仅认证接口可携带',writeOnly:true}});
for (const schema of [schemas.Employee, schemas.EmployeeInput, schemas.EmployeeUpdate]) schema.properties.name.example = '示例姓名';
for (const schema of [schemas.EmployeeInput, schemas.EmployeeUpdate]) schema.allOf = [{anyOf:['name','employee_no'].map(key => ({type:'object',required:[key],properties:{[key]:{type:'string'}}}))}];
add('WindowsIdentity',{account_type:en(['domain','local','unknown'],'客户端报告的账号类型，不是身份认证'),domain:nil(str('域名；本地或未知时为空',128)),account_name:nil(str('域登录名，不能用显示名或目录猜测',128)),source:en(['windows_logon','unavailable'],'采集来源'),display_name:str('域账号显示名，仅用于员工姓名',120)},['display_name']);
add('IdentityRule',{domain:str('允许的域，大小写不敏感',128),format:en(['digits','alphanumeric'],'工号格式，保留前导零'),case:en(['preserve','upper','lower'],'登录名大小写归一化')});
add('IdentityPolicy',{version:integer('版本'),enabled:flag('兼容字段，服务端固定为 true'),auto_create:flag('兼容字段，服务端固定为 true'),rules:list(ref('IdentityRule'),'兼容字段，服务端固定为空；所有域均按账号匹配工号',20)});
add('IdentityPolicyUpdate',{policy:ref('IdentityPolicy'),expected_revision:integer('当前版本'),reason:str('修改原因',500)});
add('IdentityResult',{identity:nil(ref('WindowsIdentity')),state:en(['missing','local','unknown','disabled','domain_not_allowed','invalid_account','employee_missing','employee_archived','identity_conflict','binding_preserved','matched'],'匹配结果'),employee_id:nil(id),binding_source:en(['none','manual','automatic'],'当前绑定来源')});
add('IdentityUpdate',{identity:ref('WindowsIdentity')});
add('ServerCapabilities',{capabilities:list(en(['windows-domain-identity-v1','windows-display-name-v1'],'服务端能力'),'能力列表',10)});
add('RegisterInput',{registration_id:id,installation_id:id,credential:ref('CredentialMaterial'),windows_username:str('当前系统账号；不是员工 ID',128),device_label:str('设备显示名',128),app_version:str('Piora 版本',64),sdk_version:str('Pi SDK 版本',64),protocol_version:en(['1.0'],'协议版本'),capabilities:list(en(['desktop_activity','query','model_usage','file_write','file_edit'],'采集能力'),'客户端能力',20),windows_identity:{...ref('WindowsIdentity'),description:'兼容旧版注册载荷；员工匹配通过注册后的身份接口执行'}},['windows_identity']);
add('RegisterResult',{installation_id:id,status:en(['active','pending_identity'],'可上报；人员绑定待确认不阻止接收'),organization_name:str('组织显示名称',120),credential_id:id,credential_expires_at:time('凭证有效期；90 天'),policy:ref('SyncPolicy')});
add('RecoverInput',{recovery_id:id,installation_id:id,previous_credential:ref('CredentialMaterial'),next_credential:ref('CredentialMaterial')});
add('RecoverResult',{installation_id:id,credential_id:id,expires_at:time('恢复后的设备凭证有效期；90 天')});
add('RotateInput',{rotation_id:id,next_credential:ref('CredentialMaterial')});
add('RotateResult',{credential_id:id,expires_at:time('新凭证 90 天有效期'),previous_valid_until:time('旧凭证过渡期，24 小时')});
add('Installation',{id,windows_username:str('Windows 账号',128),device_label:str('设备显示名',128),employee_id:nil(uuid('当前绑定员工')),app_version:str('上次上报版本',64),status:en(['active','revoked'],'安装状态'),last_received_at:nil(time('最后收到数据')),last_event_at:nil(time('最后事件发生时间')),reported_queue_events:count('上次上报时的积压，不是实时值'),coverage:ref('Coverage'),revision:integer('版本')});
schemas.Installation.properties.identity_status=ref('IdentityResult');
add('Binding',{id,installation_id:id,employee_id:id,valid_from:nil(date('包含；null 覆盖全部历史')),valid_to:nil(date('不包含；null 为持续')),reason:str('绑定/纠错原因',500),revision:integer('版本')});
add('BindingInput',{employee_id:id,valid_from:nil(date('包含；北京时间自然日；null 覆盖全部历史')),valid_to:nil(date('不包含')),reason:str('原因',500),expected_revision:integer('安装/原绑定版本')});
add('EnrollmentKey',{id,label:str('用途',120),expires_at:time('过期时间'),max_registrations:{...integer('最多允许注册次数',5000),minimum:1},used_registrations:integer('已注册次数'),revoked_at:nil(time('撤销时间')),revision:integer('乐观锁版本')});
add('EnrollmentInput',{label:str('用途',120),expires_at:time('过期时间；必须晚于当前时间，不设业务期限上限'),max_registrations:{...integer('最多允许注册次数',5000),minimum:1}});
add('EnrollmentCreated',{key:ref('EnrollmentKey'),secret:str('只在本次响应展示；部署时通过安全配置分发',128)});
add('AdminCreate',{username:str('唯一后台账号',80),display_name:str('显示名',120),role:en(['admin','viewer'],'角色'),temporary_password:{...str('临时密码，首次登录强制修改',256),minLength:12,writeOnly:true}});
add('AdminUpdate',{display_name:str('显示名',120),role:en(['admin','viewer'],'角色'),status:en(['active','disabled'],'状态'),expected_revision:integer('版本')});
add('PolicyUpdate',{policy:ref('SyncPolicy'),expected_revision:integer('当前版本'),reason:str('变更原因',500)});
add('RetentionPolicy',{raw_days:{...integer('事件和明细保留天数',365),minimum:90,default:90},daily_months:{...integer('日汇总保留月数',60),minimum:24,default:24},audit_days:{...integer('审计保留天数',1825),minimum:365,default:365},revision:integer('版本')});
add('RetentionUpdate',{policy:ref('RetentionPolicy'),expected_revision:integer('版本'),reason:str('变更原因',500)});

const metricProps = {
  queries:count('人工提交数量'),completed_queries:count('完成数量'),failed_queries:count('失败数量'),cancelled_queries:count('取消数量'),interrupted_queries:count('异常中断数量'),pending_queries:count('等待/运行/尚无终态数量'),
  opens:count('明确手动打开/唤起次数'),launches:count('进程冷启动次数'),runtime_ms:count('非休眠运行时长'),active_ms:count('前台有效活跃时长，多设备取并集'),task_ms:nil(count('任务累计耗时；未知任务另计')),
  unknown_task_runs:count('没有可信结束时间的任务数'),model_calls:count('实际模型调用次数'),input_tokens:nil(count('排除缓存后的输入')),output_tokens:nil(count('输出；推理子项不再相加')),cache_read_tokens:nil(count('缓存读取')),cache_write_tokens:nil(count('缓存写入')),total_tokens:nil(count('非重叠桶之和；仅有总量时保留总量')),
  added_lines:count('代码新增行'),deleted_lines:count('代码删除行'),files_created:count('新建文件操作数'),files_touched:count('按安装实例与文件标识去重'),file_operations:count('文件工具操作数')
};
add('Metrics',metricProps);
add('DailyRow',{date:date('北京时间统计日期'),employee_id:id,employee_name:str('员工姓名',120),department_id:nil(uuid('部门')),department_name:nil(str('部门名称',120)),metrics:ref('Metrics'),coverage:ref('Coverage')});
add('Overview',{confirmed_employees:count('已确认员工总数'),active_employees:count('范围内去重活跃员工'),unconfirmed_installations:count('未绑定安装实例'),metrics:ref('Metrics')});
add('TrendPoint',{bucket:str('日期或带时区的小时桶',40),active_employees:count('该桶活跃人数'),metrics:ref('Metrics')});
add('ModelRow',{provider:str('供应商标识',128),model:str('模型 ID',256),calls:count('调用次数'),queries:count('涉及 Query 去重数；不同模型之间不可相加'),failed_calls:count('失败次数'),input_tokens:nil(count('输入')),output_tokens:nil(count('输出')),cache_read_tokens:nil(count('缓存读取')),cache_write_tokens:nil(count('缓存写入')),total_tokens:nil(count('总量')),known_calls:count('用量已知调用'),unknown_calls:count('用量未知调用'),duration_ms:count('累计调用耗时')});
add('CodeRow',{language:str('语言分类',80),file_category:en(['code','config','document','other'],'文件分类'),added_lines:count('新增行'),deleted_lines:count('删除行'),files_touched:count('文件实例去重数'),measured_operations:count('可靠计量数'),unmeasured_operations:count('无法计量数')});
add('Query',{id,installation_id:id,employee_id:nil(uuid('根据发生日映射员工')),source,accepted_at:time('持久接收时间'),status:en(['accepted','queued','running','completed','failed','cancelled','interrupted'],'请求状态'),revision:integer('状态版本'),run_ids:list(uuid('关联任务'),'任务列表',100),metrics:ref('Metrics'),coverage:ref('Coverage')});
add('ModelCall',{id,query_id:nil(uuid('调用开始时确定的归属 Query')),run_id:nil(uuid('任务')),provider:str('供应商',128),model:str('实际模型',256),source,status:outcome,started_at:time('开始'),finished_at:nil(time('结束；崩溃且无可信终点时为 null')),duration_ms:nil(count('单调时钟耗时；崩溃未知为 null')),usage_status:en(['reported','partial','unavailable'],'用量来源/完整性'),input_tokens:nil(count('普通输入')),output_tokens:nil(count('输出')),cache_read_tokens:nil(count('缓存读取')),cache_write_tokens:nil(count('缓存写入')),total_tokens:nil(count('总量'))});
add('FileChange',{operation_id:id,run_id:nil(uuid('关联任务')),query_id:nil(uuid('关联 Query')),tool_call_id:str('原工具调用 ID',256),file_key:{...str('安装实例内 HMAC-SHA256 文件标识',64),pattern:'^[a-f0-9]{64}$'},language:str('语言',80),file_category:en(['code','config','document','other'],'分类'),kind:en(['created','updated','unchanged','unknown'],'变化类型'),added_lines:nil(count('新增行')),deleted_lines:nil(count('删除行')),measurement_status:en(['measured','unsupported','too_large','binary','unreadable','concurrent_change','failed'],'计量状态')});
add('QueryDetail',{query:ref('Query'),calls:list(ref('ModelCall'),'调用明细',500),file_changes:list(ref('FileChange'),'文件明细',500),truncated:flag('超过明细上限；可按单独游标接口继续查询')});
add('AuditRow',{id,actor_id:id,action:str('管理动作',80),target_type:str('对象类型',80),target_id:id,occurred_at:time('操作时间'),summary:str('脱敏操作摘要',500)});
add('ExportInput',{kind:en(['employee_daily','models','code'],'导出类型'),from:date('包含'),to:date('不包含'),employee_ids:list(uuid('员工'),'员工筛选',500),department_ids:list(uuid('部门'),'部门筛选',100),app_versions:list(str('版本',64),'版本筛选',30)});
add('ExportJob',{id,status:en(['queued','running','completed','failed','expired'],'任务状态'),created_at:time('创建时间'),row_count:nil(count('导出行数')),expires_at:time('24 小时后过期'),download_path:nil(str('同源受保护下载路径',300)),error_code:nil(str('失败原因码',64))});
add('Catalog',{employees:list(ref('Employee'),'员工',5000),departments:list(ref('Department'),'部门',500),app_versions:list(str('版本',64),'版本',100),sources:list(source,'来源',30),languages:list(str('语言',80),'语言',200)});
add('HealthSummary',{installations:list(ref('Installation'),'安装实例',5000),unbound_count:count('未绑定数'),stale_report_count:count('超过组织最长同步间隔加 5 分钟后的未上报数；兼容旧客户端的判断窗口至少为 40 分钟，不等于离线'),rejected_events:count('范围内拒收数'),aggregation_lag_seconds:integer('服务端聚合延迟'),warning_codes:list(str('原因码',64),'异常',100)});

const payloads = {
 'desktop.started':add('DesktopStarted',{reason:en(['manual','autostart','update','unknown'],'启动来源')}),
 'desktop.opened':add('DesktopOpened',{activation_id:id,reason:en(['manual_launch','shortcut','tray','menu'],'明确唤起来源')}),
 'desktop.activity':add('DesktopActivity',{start_at:time('包含'),end_at:time('不包含，最长 60 秒'),runtime_ms:count('运行毫秒'),active_ranges:list(obj({start_at:time('包含'),end_at:time('不包含')}),'区间；必须在事件区间内且互不重叠',30),sample_interval_ms:{type:'integer',const:5000,description:'采样周期'},time_quality:en(['synchronized','local_only','suspect'],'时间质量')}),
 'query.submitted':add('QuerySubmitted',{query_id:id,command_id:str('稳定接收命令 ID',256),source,trigger:en(['human','automation','system'],'人工仅由可信入口标记'),accepted_at:time('本地持久接收时间')}),
 'query.updated':add('QueryUpdated',{query_id:id,revision:integer('状态递增版本'),status:en(['queued','running','completed','failed','cancelled','interrupted'],'状态'),run_id:nil(uuid('关联任务'))}),
 'run.started':add('RunStarted',{run_id:id,query_id:nil(uuid('触发 Query')),parent_run_id:nil(uuid('父任务')),source,started_at:time('开始时间')}),
 'run.finished':add('RunFinished',{run_id:id,outcome,duration_ms:nil(count('可信单调时钟总耗时')),waiting_ms:nil(count('等待人工时间')),finished_at:nil(time('没有可信终点时为 null'))}),
 'model.started':add('ModelStarted',{call_id:id,query_id:nil(uuid('归属 Query')),run_id:nil(uuid('归属任务')),provider:str('实际供应商',128),model:str('实际模型',256),source,started_at:time('请求开始时间')}),
 'model.finished':ref('ModelCall'),
 'file.changed':ref('FileChange'),
 'client.health':add('ClientHealth',{queue_events:count('当前本地排队数'),queue_bytes:count('排队字节'),dropped_events:count('新增丢弃数'),quarantined_events:count('新增隔离数'),clock_offset_ms:{type:'integer',minimum:-86400000,maximum:86400000,description:'上次测得服务端与客户端偏差'},clock_sync_at:nil(time('测量时间')),codes:list(str('异常码',64),'原因码',30)})
};
const variants=[];
for(const [type,payload] of Object.entries(payloads)){
 const name=type.split('.').map(x=>x[0].toUpperCase()+x.slice(1)).join('')+'Event';
 add(name,{event_id:id,event_seq:count('安装实例内事务分配的递增序号'),source_key:str('稳定业务来源键，用于本地重放去重',512),event_type:{type:'string',const:type,description:'事件类型'},occurred_at:time('实际发生时间；不是上传时间'),app_launch_id:id,app_version:str('发生时的版本',64),payload});
 variants.push(ref(name));
}
schemas.TelemetryEvent={oneOf:variants,discriminator:{propertyName:'event_type'},description:'允许列表；不接受任意内容和额外字段'};
add('BatchInput',{batch_id:id,protocol_version:en(['1.0'],'协议版本'),client_sent_at:time('发送时间'),policy_version:integer('策略版本'),events:{...list(ref('TelemetryEvent'),'新增事件；相同 ID 重传不再次累计',500),minItems:1}});
add('RejectedEvent',{event_id:id,code:en(['INVALID_EVENT','EVENT_CONFLICT','UNSUPPORTED_VERSION','EVENT_TOO_OLD','CLOCK_SUSPECT'],'拒绝原因'),message:str('安全信息',300),retryable:{type:'boolean',const:false,description:'此事件需隔离；同内容重试不会恢复'}});
add('BatchResult',{accepted_event_ids:list(id,'已持久接收',500),duplicate_event_ids:list(id,'已接收过且内容相同',500),rejected_events:list(ref('RejectedEvent'),'永久拒绝',500),retry_after_seconds:nil(integer('最早允许再发时间；延后指令',7200)),policy:nil(ref('SyncPolicy')),credential_rotation_due:flag('凭证剩余有效期小于 7 天')});
add('EmployeeDetail',{employee:ref('Employee'),daily:list(ref('DailyRow'),'日统计',731),installations:list(ref('Installation'),'关联设备',100)});
add('ServiceHealth',{status:en(['ok'],'服务状态')});
const page = name => {const n=name+'Page'; schemas[n]=obj({items:list(ref(name),'本页记录',200),next_cursor:nil(str('后续游标',2048)),total:count('匹配记录数')});return n;};
for(const n of ['DailyRow','Employee','Department','Installation','Binding','EnrollmentKey','AdminUser','AuditRow','Query','ModelCall','FileChange']) page(n);
for(const n of ['TrendPoint','ModelRow','CodeRow']) schemas[n+'List']=obj({items:list(ref(n),'完整汇总序列',1000)});
const params = {
 range:[['from',date('起始日，包含'),true],['to',date('结束日，不包含；日汇总最长 731 天，明细限最近 90 天'),true]],
 filters:[['employee_ids',list(uuid('员工 ID'),'重复 query 参数',500),false],['department_ids',list(uuid('部门 ID'),'重复 query 参数',100),false],['app_versions',list(str('版本',64),'发生时版本',30),false],['sources',list(source,'来源',30),false]],
 pagination:[['limit',{...integer('每页条数',200),minimum:1,default:50},false],['cursor',str('opaque 游标；与筛选、排序绑定',2048),false]],
 enrollmentSearch:[['search',str('用途名称包含匹配，不区分大小写；空白忽略',120),false]],
 search:[['search',str('姓名/账号/设备检索',120),false]],
};
const routes=[];
function route(method,p,operationId,summary,input,output,auth='admin',groups=[],status=200){
 const isReport=p.includes('/analytics/');
 const responseName=operationId+'Response';
 if(output!=='csv') schemas[responseName]=obj({data:ref(output),meta:ref(isReport && groups.includes('range')?'ReportMeta':'Meta')});
 const parameters=groups.flatMap(g=>params[g]).map(([name,schema,required])=>({name,in:'query',required,schema,style:'form',explode:true}));
 for(const m of p.matchAll(/\{([^}]+)\}/g)) parameters.push({name:m[1],in:'path',required:true,schema:uuid('资源 ID')});
 if(['registerInstallation','ingestBatch'].includes(operationId)) parameters.push({name:'X-Piora-Capabilities',in:'header',required:false,schema:str('新客户端发送 configurable-sync-interval，声明支持任意正间隔；未声明时下发旧版兼容范围',256)});
 if(['post','patch'].includes(method) && !p.includes('/auth/') && !p.includes('/telemetry/')) parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:str('一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突',128)});
 if(auth==='admin' && ['post','patch'].includes(method)) parameters.push({name:'X-CSRF-Token',in:'header',required:true,schema:str('当前会话 CSRF token',128)});
 const responses={};
 responses[status]={description:status===202?'任务已持久接收':'成功',content:output==='csv'?{'text/csv':{schema:{type:'string',description:'UTF-8 BOM CSV；防止公式注入'}}}:{'application/json':{schema:ref(responseName)}}};
 for(const code of [400,401,403,404,409,413,422,429,503]) responses[code]={description:({400:'参数或协议格式错误',401:'身份失效',403:'权限不足或安装已撤销',404:'资源不存在',409:'版本/幂等/有效期冲突',413:'请求体过大',422:'业务规则或查询保留范围不满足',429:'限流；遵守 Retry-After',503:'依赖不可用；不得确认未持久事件'})[code],content:{'application/json':{schema:ref('ErrorResponse')}}};
 const op={operationId,summary,tags:[p.split('/')[2]||'health'],parameters,security:auth==='public'?[]:[{[auth==='device'?'InstallationToken':auth==='enrollment'?'EnrollmentToken':'AdminSession']:[]}],responses,'x-required-role':auth==='admin'?(method==='get'||p.includes('/exports')?'viewer':'admin'):auth,'x-business-rules':'见 docs/api-behavior.md；安装/组织归属来自认证上下文，不接受客户端 employee_id'};
 if(input) op.requestBody={required:true,content:{'application/json':{schema:ref(input)}}};
 routes.push({method,path:p,op,input,output,responseName,status});
}
route('post','/v1/admin/auth/login','login','后台登录','LoginInput','Session','public');
route('post','/v1/admin/auth/logout','logout','退出后台',null,'Ok');
route('get','/v1/admin/auth/session','session','读取会话',null,'Session');
route('post','/v1/admin/auth/change-password','changePassword','修改密码','PasswordInput','Ok');
route('get','/v1/capabilities','serverCapabilities','客户端能力发现',null,'ServerCapabilities','public');
route('post','/v1/installations/identity','updateIdentity','补报当前安装域身份','IdentityUpdate','IdentityResult','device');
route('get','/v1/admin/settings/identity','getIdentityPolicy','固定账号自动关联行为（兼容接口）',null,'IdentityPolicy');
route('patch','/v1/admin/settings/identity','updateIdentityPolicy','兼容旧版保存请求；返回固定自动关联策略','IdentityPolicyUpdate','IdentityPolicy');
route('post','/v1/installations/register','registerInstallation','安装注册','RegisterInput','RegisterResult','enrollment',[],201);
route('post','/v1/installations/credentials/recover','recoverCredential','恢复自然过期的设备凭证','RecoverInput','RecoverResult','enrollment');
route('post','/v1/installations/credentials/rotate','rotateCredential','轮换安装凭证','RotateInput','RotateResult','device');
route('post','/v1/telemetry/batches','ingestBatch','批量上报并逐事件确认','BatchInput','BatchResult','device');
for(const [p,n,s] of [['overview','Overview','总览'],['trends','TrendPointList','趋势'],['employees/daily','DailyRowPage','员工每日明细'],['employees/{id}','EmployeeDetail','员工详情'],['queries','QueryPage','请求列表'],['queries/{id}','QueryDetail','请求详情'],['queries/{id}/calls','ModelCallPage','请求调用分页'],['queries/{id}/file-changes','FileChangePage','请求文件操作分页'],['models','ModelRowList','模型统计'],['code','CodeRowList','代码统计'],['health','HealthSummary','采集健康']])
 route('get','/v1/admin/analytics/'+p,'report'+p.replace(/[^a-z]/gi,''),s,null,n,'admin',['range','filters',...(n.endsWith('Page')?['pagination']:[])]);
route('get','/v1/admin/analytics/catalog','catalog','筛选选项',null,'Catalog');
for(const [p,n,input,update] of [['employees','Employee','EmployeeInput','EmployeeUpdate'],['departments','Department','DepartmentInput','DepartmentUpdate'],['accounts','AdminUser','AdminCreate','AdminUpdate']]){
 route('get','/v1/admin/'+p,'list'+n,'列表',null,n+'Page','admin',['pagination','search']);
 route('post','/v1/admin/'+p,'create'+n,'创建',input,n,'admin',[],201);
 route('patch','/v1/admin/'+p+'/{id}','update'+n,'修改',update,n);
 route('post','/v1/admin/'+p+'/{id}/archive','archive'+n,'归档/停用','RevisionInput','Ok');
}
route('post','/v1/admin/accounts/{id}/revoke-sessions','revokeSessions','撤销后台会话','RevisionInput','Ok');
route('get','/v1/admin/installations','listInstallations','安装列表',null,'InstallationPage','admin',['pagination','search']);
route('get','/v1/admin/installations/{id}','getInstallation','安装详情',null,'Installation');
route('get','/v1/admin/installations/{id}/bindings','listBindings','绑定历史',null,'BindingPage','admin',['pagination']);
route('post','/v1/admin/installations/{id}/bindings','createBinding','绑定员工','BindingInput','Binding','admin',[],201);
route('patch','/v1/admin/bindings/{id}','correctBinding','纠正绑定','BindingInput','Binding');
route('post','/v1/admin/installations/{id}/revoke','revokeInstallation','撤销安装上报权限','RevisionInput','Ok');
route('get','/v1/admin/enrollment-keys','listEnrollment','注册凭证列表',null,'EnrollmentKeyPage','admin',['pagination','enrollmentSearch']);
route('post','/v1/admin/enrollment-keys','createEnrollment','创建注册凭证','EnrollmentInput','EnrollmentCreated','admin',[],201);
route('post','/v1/admin/enrollment-keys/{id}/revoke','revokeEnrollment','撤销注册凭证','RevisionInput','Ok');
route('get','/v1/admin/settings/sync','getSync','同步策略',null,'SyncPolicy');
route('patch','/v1/admin/settings/sync','updateSync','更新同步策略','PolicyUpdate','SyncPolicy');
route('get','/v1/admin/settings/retention','getRetention','保留策略',null,'RetentionPolicy');
route('patch','/v1/admin/settings/retention','updateRetention','更新保留策略','RetentionUpdate','RetentionPolicy');
route('get','/v1/admin/audit-logs','listAudit','审计日志',null,'AuditRowPage','admin',['range','pagination']);
route('post','/v1/admin/exports','createExport','创建导出任务','ExportInput','ExportJob','admin',[],202);
route('get','/v1/admin/exports/{id}','getExport','导出状态',null,'ExportJob');
route('get','/v1/admin/exports/{id}/download','downloadExport','下载 CSV',null,'csv');
route('get','/health/live','liveness','进程存活',null,'ServiceHealth','public');
route('get','/health/ready','readiness','数据库初始化就绪',null,'ServiceHealth','public');

// 读操作不都属于 viewer；配置、账号、注册凭证、审计仅管理员可读。
for (const r of routes) {
 if (/\/(accounts|enrollment-keys|settings|audit-logs)(\/|$)/.test(r.path) || r.path.includes('/bindings')) r.op['x-required-role']='admin';
 if (r.path.includes('/auth/') && !r.path.endsWith('/login')) r.op['x-required-role']='viewer';
 if (r.path.endsWith('/trends')) r.op.parameters.push({name:'granularity',in:'query',required:false,schema:en(['day'],'v1 仅自然日趋势；默认 day')});
 if (r.output==='DailyRowPage') {
  r.op.parameters.push({name:'sort',in:'query',required:false,schema:{...en(['date','employee_name','queries','active_ms','total_tokens','added_lines'],'稳定排序；同值按 employee_id 和 date 排序'),default:'date'}});
  r.op.parameters.push({name:'direction',in:'query',required:false,schema:{...en(['asc','desc'],'方向'),default:'desc'}});
 }
 if (r.output==='QueryPage') r.op.parameters.push({name:'status',in:'query',required:false,schema:schemas.Query.properties.status});
 for (const code of [429,503]) r.op.responses[code].headers={'Retry-After':{description:'整数秒；存在时优先于本地退避',schema:{type:'integer',minimum:1,maximum:7200}}};
}

function example(s,depth=0){
 if(depth>14) throw new Error('Recursive schema');
 if(s.$ref) return example(schemas[s.$ref.split('/').at(-1)],depth+1);
 if(s.example!==undefined) return s.example;
 if(s.default!==undefined) return s.default;
 if(s.const!==undefined) return s.const;
 if(s.enum) return s.enum[0];
 if(s.anyOf) return s.anyOf.some(x=>x.type==='null')?null:example(s.anyOf[0],depth+1);
 if(s.oneOf) return example(s.oneOf[0],depth+1);
 if(s.type==='object') return Object.fromEntries(Object.entries(s.properties).filter(([k])=>s.required.includes(k)).map(([k,v])=>[k,example(v,depth+1)]));
 if(s.type==='array') return s.minItems?[example(s.items,depth+1)]:[];
 if(s.type==='boolean') return false;
 if(s.type==='integer'||s.type==='number') return s.minimum??0;
 if(s.format==='uuid') return '10000000-0000-4000-8000-000000000001';
 if(s.format==='date-time') return '2026-11-13T02:00:00.000Z';
 if(s.format==='date') return '2026-11-13';
 if(s.pattern?.includes('0|[1-9]')) return '0';
 if(s.pattern?.includes('a-f0-9')) return 'a'.repeat(64);
 if(s.minLength===43) return 'A'.repeat(43);
 return '示例值'.repeat(Math.ceil((s.minLength??1)/3)).slice(0,s.maxLength??100);
}
const spec={openapi:'3.1.1',info:{title:'Piora Analytics API',version:'1.0.0',description:'已实现的 v1 API 契约；部署和验证边界见 docs/implementation-status.md。'},servers:[{url:'https://analytics.example.invalid',description:'示例域名，部署时替换'}],paths:{},components:{securitySchemes:{AdminSession:{type:'apiKey',in:'cookie',name:'__Host-piora_analytics'},InstallationToken:{type:'http',scheme:'bearer',description:'pa1.<credential_id>.<secret>'},EnrollmentToken:{type:'http',scheme:'bearer',description:'enroll.<key_id>.<secret>；仅可注册'}},schemas}};
const examples=[];
for(const r of routes){
 spec.paths[r.path]??={};spec.paths[r.path][r.method]=r.op;
 if(r.input){const v=example(ref(r.input));r.op.requestBody.content['application/json'].example=v;examples.push({name:r.op.operationId+' request',schema:r.input,value:v});}
 if(r.output!=='csv'){const v=example(ref(r.responseName));r.op.responses[r.status].content['application/json'].example=v;examples.push({name:r.op.operationId+' response',schema:r.responseName,value:v});}
}
for(const [type,p] of Object.entries(payloads)) examples.push({name:type,schema:type.split('.').map(x=>x[0].toUpperCase()+x.slice(1)).join('')+'Event',value:example(variants[Object.keys(payloads).indexOf(type)])});
const write=(p,t)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),t);};
write('contracts/openapi.yaml',YAML.stringify(spec,{lineWidth:0}));
write('contracts/examples.json',JSON.stringify(examples,null,2)+'\n');
write('contracts/events.schema.json',JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',$ref:'#/$defs/TelemetryEvent',$defs:JSON.parse(JSON.stringify(schemas).replaceAll('#/components/schemas/','#/$defs/'))},null,2)+'\n');
const describe=s=>s.$ref?s.$ref.split('/').at(-1):s.anyOf?s.anyOf.map(describe).join(' | '):s.oneOf?s.oneOf.map(describe).join(' | '):s.type==='array'?'array<'+describe(s.items)+'>':s.type;
let md='# API 字段级参考（自动生成）\n\n协议 1.0.0；接口前缀 /v1。字段及示例从 OpenAPI 生成。业务约束、状态码条件和同步流程见 [接口行为](api-behavior.md) 与 [同步协议](sync-protocol.md)。\n\n';
for(const r of routes){
 md+='## '+r.method.toUpperCase()+' '+r.path+'\n\n'+r.op.summary+'。operationId: '+r.op.operationId+'；最低角色：'+r.op['x-required-role']+'。\n\n';
 md+='| 参数 | 位置 | 类型 | 必填 | 说明 |\n|---|---|---|---|---|\n'+r.op.parameters.map(p=>'| '+p.name+' | '+p.in+' | '+describe(p.schema)+' | '+p.required+' | '+(p.schema.description??'')+' |').join('\n')+'\n\n';
 if(r.input) md+='请求体：'+r.input+'\n\n~~~json\n'+JSON.stringify(example(ref(r.input)),null,2)+'\n~~~\n\n';
 md+='成功：HTTP '+r.status+'，'+(r.output==='csv'?'UTF-8 BOM CSV':r.responseName)+'。\n\n';
 if(r.output!=='csv') md+='~~~json\n'+JSON.stringify(example(ref(r.responseName)),null,2)+'\n~~~\n\n';
 md+='错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。\n\n';
}
md+='# 数据对象字段字典\n\n所有对象禁止额外字段。引用对象在本节完整展开；响应不回传 writeOnly 字段。\n\n';
for(const [name,s] of Object.entries(schemas)){
 md+='## '+name+'\n\n';
 if(!s.properties){md+=describe(s)+'\n\n';continue;}
 md+='| 字段 | 类型 | 必填 | 约束 | 说明 |\n|---|---|---|---|---|\n';
 for(const [k,v] of Object.entries(s.properties)) md+='| '+k+' | '+describe(v).replaceAll('|','/')+' | '+s.required.includes(k)+' | '+JSON.stringify(Object.fromEntries(['format','enum','const','minimum','maximum','minLength','maxLength','maxItems','pattern','default','writeOnly'].filter(a=>v[a]!==undefined).map(a=>[a,v[a]]))).replaceAll('|','/')+' | '+(v.description??v.anyOf?.[0]?.description??'见引用对象')+' |\n';
 md+='\n';
}
write('docs/api-reference.md',md.trimEnd()+'\n');
write('contracts/manifest.json',JSON.stringify({version:'1.0.0',operations:routes.length,schemas:Object.keys(schemas).length,event_types:Object.keys(payloads)},null,2)+'\n');
console.log('Generated '+routes.length+' operations, '+Object.keys(schemas).length+' schemas.');
