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

统一使用 `compose.yaml`，不再提供 compose.config.yaml。唯一的部署配置文件是宿主机 `<配置目录>/.env`；默认 `config/.env`。API、Worker、init 只读挂载这个目录到 `/config`，Node 启动时读取 `/config/.env`；Compose 同时通过 `--env-file` 读取同一文件。

### 准备目录与配置

安装 Docker Engine 和 Compose 插件。源码构建获取仓库；镜像部署只需 Release 中的 `compose.yaml`、`scripts/start.sh` 和 `.env.docker.example`，无需安装 Node.js。Release 下载的脚本文件名为 `start.sh`，请放入部署目录的 `scripts/start.sh`（先执行 `mkdir -p scripts`），保持与 Compose 文件的相对位置。

以下以 Linux 大容量盘挂载点 `/data` 为例。先确认磁盘实际挂载，再创建三个互不重叠的目录：

```sh
findmnt -T /data
df -hT /data
sudo mkdir -p /data/piora/config /data/piora/postgres /data/piora/exports
sudo cp .env.docker.example /data/piora/config/.env
# 编辑 /data/piora/config/.env 后设置权限：
sudo chown -R 1000:1000 /data/piora/config /data/piora/exports
sudo chmod 700 /data/piora/config /data/piora/exports
sudo chmod 600 /data/piora/config/.env
```

启动命令需要由可读取该文件的账户执行。容器应用用户 UID 1000 必须可读配置、可写 exports；PostgreSQL 数据目录权限由官方镜像初始化。宿主机运维账户也需相应权限。

配置中填写：

```dotenv
CONFIG_DIR=/data/piora/config
POSTGRES_DATA_DIR=/data/piora/postgres
EXPORT_DATA_DIR=/data/piora/exports
IMAGE_NAME=ghcr.io/kexijiang/piora-analytics
APP_VERSION=v0.1.2
ANALYTICS_ORIGIN=http://analytics.internal:4319
ALLOW_HTTP=true
BIND_ADDRESS=0.0.0.0
APP_PORT=4319
INIT_ORG_NAME=公司名称
INIT_ADMIN_USERNAME=admin
```

另外必须填写 URL 安全的随机 `POSTGRES_PASSWORD`、至少 32 字符随机 `ANALYTICS_PEPPER`、12–256 位 `INIT_ADMIN_PASSWORD`。可分别用 `openssl rand -hex 32` 生成秘密，不要提交或分享实际配置。浏览器访问地址必须与 ANALYTICS_ORIGIN 一致，不带末尾斜线。HTTP 适用于受信任内网；公网应使用 HTTPS 和 ALLOW_HTTP=false。

POSTGRES_DATA_DIR、EXPORT_DATA_DIR 必填且必须事先存在，无系统盘回退、不自动建目录。分别挂载到 PostgreSQL 18 的 `/var/lib/postgresql` 和 API/Worker 共享的 `/exports`。配置目录只读，数据目录可读写。Linux 应配置磁盘开机挂载；目录存在不能证明数据盘已挂载。Windows Docker Desktop 可填写 `D:/piora/config`、`D:/piora/postgres` 和 `D:/piora/exports`，用 Git Bash 运行启动脚本。

### 启动与验收

```sh
# 拉取已发布镜像并启动：
bash scripts/start.sh image /data/piora/config
# 源码构建：配置 IMAGE_NAME=piora-analytics、APP_VERSION=latest 后执行
bash scripts/start.sh local /data/piora/config
# 离线模式：预先 docker load 应用镜像和 postgres:18 镜像
bash scripts/start.sh offline /data/piora/config
```

省略最后一个参数时使用环境变量 CONFIG_DIR，未设置则用部署目录的 `./config`。脚本将选定目录同时用于挂载和读取配置，避免读取两份不同文件。所有模式都会校验 Compose 并等待服务就绪；offline 不构建、不拉取镜像。

日常运维使用同一配置目录和 Compose 项目名：

```sh
export CONFIG_DIR=/data/piora/config
docker compose --env-file "$CONFIG_DIR/.env" ps -a
docker compose --env-file "$CONFIG_DIR/.env" logs --tail=100 init api worker
curl -f http://127.0.0.1:4319/health/ready
# 停止并保留宿主机数据：
docker compose --env-file "$CONFIG_DIR/.env" down
# 恢复：
bash scripts/start.sh offline
```

数据库和 API 应为 healthy，init 应为 Exited (0)，Worker 应为 Up 且日志无持续错误。调整端口或绑定 IP 后同步调整 curl 地址。健康检查和看板可访问不代表真实设备已上报，仍需进行设备上传和聚合验收。

init 从 database/schema.sql 初始化空库；重复启动保留已有账号和数据，不执行升级迁移，结构不完整时拒绝初始化。首次登录必须修改临时密码；完成后可从配置文件移除 INIT_ADMIN_PASSWORD。数据库不对宿主机开放端口。

### 配置修改、备份与升级

配置在进程启动时读取，没有热加载。修改应用配置后重建：

```sh
export CONFIG_DIR=/data/piora/config
docker compose --env-file "$CONFIG_DIR/.env" up -d --no-build --force-recreate --wait init api worker
```

DATABASE_URL 由 Compose 根据数据库密码和内部地址生成，PORT、HOST、EXPORT_DIR 等容器内部参数由 Compose 固定。不要直接修改已初始化数据库的密码或 ANALYTICS_PEPPER。

升级前备份（Linux/Bash）：

```sh
mkdir -p backups
chmod 700 backups
docker compose --env-file "$CONFIG_DIR/.env" exec -T database pg_dump -U analytics -d piora_analytics -Fc > "backups/piora-$(date +%Y%m%d-%H%M%S).dump"
```

确认退出码为 0，将备份复制到独立存储，并安全备份配置、保持 PEPPER 不变。定期在隔离数据库演练恢复。应用升级时修改 APP_VERSION，再运行 `bash scripts/start.sh image`；当前仅支持空库初始化和相同表结构的重启，不支持旧库自动升级。正式部署后的结构升级需另行设计。

唯一 Compose 使用宿主机绑定目录，不再使用 pgdata/exports 命名卷。`down`（包括 `down -v`）不会删除绑定目录中的文件。旧版命名卷数据不会自动迁入新目录：切换前需要停写、备份并恢复，不能直接指向空目录后认为旧数据仍在。不要同时运行两个项目访问同一 PostgreSQL 目录。

### 版本镜像与离线发布

推送 `v*` tag 触发 Release Image：质量检查、linux/amd64 镜像构建、使用 `scripts/start.sh offline` 的隔离 Compose 检查通过后，发布 `ghcr.io/<仓库所有者>/piora-analytics:<tag>`。非预发布版本更新 latest。Release 附件包含应用镜像 tar、SHA256SUMS、compose.yaml、scripts/start.sh、.env.docker.example。工作流存在不代表该版本已发布。

离线部署先核验 SHA256SUMS，加载应用 tar；另外准备并加载 postgres:18 镜像，应用 tar 不含 PostgreSQL。准备目录及配置后运行 offline 模式。私有 GHCR 包需先 docker login ghcr.io。当前 v0.1.2 应用镜像支持此配置读取方式；新的启动文件随下一次 Release 提供，也可从仓库获取。

`bash scripts/build.sh` 构建工作区，`bash scripts/build.sh v1.2.0` 从已有 tag 构建。HTTPS 可参考 [Caddy 配置](../deploy/Caddyfile.example)，切换协议后需重新登录。备份、告警和权限拆分由运维配置，默认单 API、单 Worker。

## 域账号自动归属

初始化后即默认自动关联：域账号按登录工号，本地及未报告身份的客户端按注册账号匹配或创建员工，无需域规则或开关。人工归属优先保留。具体协议、历史事件归属及验证边界见[账号自动关联](domain-identity.md)。

## 给 Windows Piora 分发配置

1. 管理员生成有限次数、有限期限的 enrollment key。员工在设备接入时自动创建，姓名和部门可后续补充。
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
