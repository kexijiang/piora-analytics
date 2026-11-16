# 本地运行与部署

## 开发环境

Node.js 24、npm、PostgreSQL 18。先 npm ci，再将 .env.example 复制为 .env，填写数据库连接、至少 32 字符随机 ANALYTICS_PEPPER 和同源 ANALYTICS_ORIGIN。开发默认看板 http://127.0.0.1:4318，API 4319；默认生产使用 HTTPS；受信任内网可按下文显式启用 HTTP。

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

公司受信任内网可显式启用 HTTP：复制 `.env.docker.example` 为 `.env`，填写 URL 安全的随机 POSTGRES_PASSWORD、至少 32 字符随机 ANALYTICS_PEPPER、INIT_ADMIN_PASSWORD（12–256 位），并将 ANALYTICS_ORIGIN 改为浏览器实际访问的地址，例如 `http://analytics.internal:4319`，不要带末尾斜线。HTTP 下密码和统计请求明文传输，适用于本次内网部署范围。公网使用 HTTPS，并关闭 ALLOW_HTTP。

~~~sh
cp .env.docker.example .env
# 编辑 .env 后，本地源码构建并启动：
bash scripts/start.sh local
# 等价：docker compose build && docker compose up -d --no-build --wait
~~~

Compose 自动等待数据库健康，init 服务执行迁移并仅在空库创建组织/管理员，随后启动 API（含看板）和 Worker。首次登录强制修改密码；初始化后可从 .env 移除 INIT_ADMIN_PASSWORD。后续 init 只迁移，不重置已有账号。不要运行两个不同版本的部署同时迁移同一数据库。

API 默认映射 127.0.0.1；内网示例使用 BIND_ADDRESS=0.0.0.0，APP_PORT=4319。数据库不对宿主机暴露端口。健康检查为 `/health/ready`。Worker 没有独立健康检查，运行状态不代表已完成聚合。

### 版本镜像与离线部署

`bash scripts/build.sh` 构建当前工作区；`bash scripts/build.sh v1.2.0` 从已有 Git tag 构建，包含该 tag 的代码。IMAGE_NAME 可覆盖镜像名。指定版本镜像时，在 .env 中填写相同 IMAGE_NAME 与 APP_VERSION。

推送 `v*` tag 会触发 Release Image：质量检查、linux/amd64 镜像构建、隔离 Compose 启动检查通过后，发布 `ghcr.io/<仓库所有者>/piora-analytics:<tag>`。非预发布版本还更新 latest；GitHub Release 提供镜像 tar、SHA256SUMS、Compose 和配置示例。此流程参考 ai-code-tracker-server，但发布的是本仓库镜像。工作流文件存在不代表镜像已发布。

~~~sh
# .env 设置 IMAGE_NAME=ghcr.io/<仓库所有者>/piora-analytics、APP_VERSION=v1.2.0
bash scripts/start.sh image
# 或：docker compose pull && docker compose up -d --no-build --wait
~~~

私有 GHCR 包需要先 docker login ghcr.io。离线服务器下载 Release tar 后 `docker load -i <镜像文件.tar>`，还必须从联网机器预先导出并加载 `postgres:18` 镜像（应用 tar 不包含 PostgreSQL）。复制 compose.yaml 和配置文件后，运行 `docker compose up -d --no-build --pull never --wait`；有源码目录也可用 `bash scripts/start.sh offline`。镜像仅适用于 linux/amd64。

数据保存在 pgdata、exports 命名卷中，更新时保持同一 Compose 项目名/目录。`docker compose down` 保留数据，`down -v` 会删除数据。升级前备份数据库；PEPPER 必须保持不变。生产备份、告警和权限拆分仍由运维配置，默认单 API、单 Worker。

HTTPS 部署可参考 [Caddy 配置](../deploy/Caddyfile.example)，并将 ANALYTICS_ORIGIN 设置为 HTTPS 地址、ALLOW_HTTP=false。HTTP 与 HTTPS 使用不同会话 Cookie，切换后重新登录。

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
