# 本地运行与部署

## 开发环境

Node.js 24、npm、PostgreSQL 18。先 npm ci，再将 .env.example 复制为 .env，填写数据库连接、至少 32 字符随机 ANALYTICS_PEPPER 和同源 ANALYTICS_ORIGIN。开发默认看板 http://127.0.0.1:4318，API 4319；生产必须 HTTPS。

数据库为空时执行一次初始化。首位管理员密码只通过临时环境传递，不使用固定默认值，也不通过命令行参数传递：

~~~powershell
$initialPassword = Read-Host "临时管理员密码，至少 12 位" -AsSecureString
$env:INIT_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $initialPassword).Password
npm run setup
Remove-Item Env:INIT_ADMIN_PASSWORD
~~~

CLI 询问组织名称和管理员账号。完成后在三个终端分别运行：

~~~powershell
npm run dev:api
npm run dev:worker
npm run dev
~~~

访问 /，使用刚创建的账号，首次登录强制修改临时密码。/?demo=1 是独立合成演示，不能用它验证真实入库。API 的 /health/live 和 /health/ready 不返回秘密。

## 容器部署

[Compose](../compose.yaml) 提供 PostgreSQL 18、API（含静态看板）、Worker 和私有导出卷。先在 .env 设置 POSTGRES_PASSWORD（使用 URL 安全的随机字符串）、ANALYTICS_PEPPER、真实 HTTPS 的 ANALYTICS_ORIGIN。

~~~sh
docker compose up -d database
docker compose build
docker compose run --rm -e INIT_ORG_NAME -e INIT_ADMIN_USERNAME -e INIT_ADMIN_PASSWORD api npm run setup
docker compose up -d api worker
~~~

三个 INIT_* 值通过宿主机安全环境提供；密码不放入仓库或 Compose 文件。构建是后台 Web 服务容器，不涉及 Piora 安装包。Compose 将 API 仅映射宿主机 127.0.0.1:4319；参考 [Caddy 配置](../deploy/Caddyfile.example) 提供 TLS，域名替换为企业真实域名。防火墙不对公网开放 PostgreSQL。

基础 Compose 为便于首次初始化，API/Worker 与迁移使用同一专用数据库账号。正式运维应按职责拆分：API 仅 DML，Worker 需要分区维护权限，迁移使用受控 owner；不要将示例账号提升为企业数据库集群管理员。当前没有自动配置云资源、证书、备份目标或告警通知。

API 禁止记录请求体、Cookie 和 Authorization。设备明文批次最多 262144 字节；v1 不接收压缩请求（反向代理可压缩响应）。导出仅认证后下载，文件 24 小时后由 Worker 删除。同步和保留设置均通过 /v1/admin/settings/* 管理。

## 给 Windows Piora 分发配置

1. 管理员创建部门/员工，生成有限次数、有限期限的 enrollment key。
2. 企业配置工具写入每名用户的 %LOCALAPPDATA%\Piora\telemetry\config.json：

~~~json
{
  "enabled": true,
  "backend_url": "https://analytics.example.com",
  "enrollment_key": "通过企业安全分发替换，不能提交到 Git"
}
~~~

3. Piora 重启后生成本安装 UUID，注册前先以 Windows DPAPI 加密持久保存随机设备秘密；普通升级保留身份。不要向其他用户复制 outbox.sqlite 或 credentials.dpapi。
4. 注册成功后管理员可从分发配置移除 enrollment_key；后续凭证自动轮换。后台“采集健康”确认安装与员工归属，同名 Windows 用户不自动合并。
5. 设置 > 数据 > 组织使用统计显示字段范围、队列、错误码与同步计划。认证失效会暂停上传；恢复接入由管理员检查撤销/密钥状态，客户端不会偷偷重新注册绕过撤销。

若更换后端或转移员工设备，先导出并核对旧统计，使用安装绑定生效日期管理归属。不要为解决认证问题直接删除员工本地历史或重置所有安装 ID。

## 发布与回退

先更新后端，再以独立 Piora PR 发布支持协议 1.0 的 Windows 版本。五台试点至少三个工作日，核对每日 Query、重试 Token、睡眠与托盘时长、代码计量覆盖、离线补传；随后扩到 50 台和全员。Piora 安装包只由 GitHub Actions 构建，本次未发布。

组织 enabled=false 随下一轮上报下发；客户端继续低频健康上报以接收恢复策略。紧急停用可以由配置分发设置 enabled=false 后重启 Piora。数据清理由保留策略执行，不把停用等同删除历史。备份/WAL/恢复演练由企业运维配置，目标见 [运维说明](security-operations.md)。
