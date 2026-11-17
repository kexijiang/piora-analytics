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

Compose 自动等待数据库健康，init 服务从 database/schema.sql 初始化空库并创建组织/管理员，随后启动 API（含看板）和 Worker。首次登录强制修改密码；初始化后可从 .env 移除 INIT_ADMIN_PASSWORD。重复启动保留已有账号和数据，不执行版本迁移。结构不完整的库会拒绝初始化，不会自动删库。

API 默认映射 127.0.0.1；内网示例使用 BIND_ADDRESS=0.0.0.0，APP_PORT=4319。数据库不对宿主机暴露端口。健康检查为 `/health/ready`。Worker 没有独立健康检查，运行状态不代表已完成聚合。

### 运维操作步骤（Linux / Bash）

以下命令在同一个部署目录执行。首次准备 Docker Engine 和 Compose 插件，并确认能访问 Docker Hub 与 npm；防火墙只向需要访问的公司内网开放应用端口。源码部署需要 Git，镜像部署不需要 Node.js 或 npm 安装在宿主机。

~~~sh
docker --version
docker compose version
git clone -b codex/intranet-docker https://github.com/kexijiang/piora-analytics.git
cd piora-analytics
cp .env.docker.example .env
chmod 600 .env
~~~

上述分支包含本次部署改造；合并后可使用包含该改造的主分支或已确认版本。编辑 `.env`，配置示例如下（占位内容必须替换）：

~~~dotenv
POSTGRES_PASSWORD=替换为随机十六进制密码
ANALYTICS_PEPPER=替换为至少32字符随机字符串
ANALYTICS_ORIGIN=http://analytics.internal:4319
ALLOW_HTTP=true
BIND_ADDRESS=0.0.0.0
APP_PORT=4319
IMAGE_NAME=piora-analytics
APP_VERSION=latest
INIT_ORG_NAME=公司名称
INIT_ADMIN_USERNAME=admin
INIT_ADMIN_PASSWORD=替换为至少12位初始密码
~~~

可分别运行 `openssl rand -hex 32` 生成数据库密码和 PEPPER。浏览器使用 IP 访问时，ANALYTICS_ORIGIN 也填写该 IP；使用域名时填写域名。端口变化时同步修改 APP_PORT 和 origin。不要提交或分享实际 `.env`。

启动与验收：

~~~sh
bash scripts/start.sh local
docker compose ps -a
docker compose logs --tail=100 init api worker
curl -f http://127.0.0.1:4319/health/ready
~~~

若更改 APP_PORT，调整 curl 端口；若仅绑定指定网卡 IP，使用该地址检查。

| 服务 | 预期状态 |
|---|---|
| database | healthy |
| init | Exited (0)，一次性任务正常完成 |
| api | healthy |
| worker | Up，日志无持续错误；仍需检查实际聚合结果 |

访问配置的 ANALYTICS_ORIGIN，使用初始账号登录并修改密码。刷新页面确认会话保留。初始化完成后删除 `.env` 中的 INIT_ADMIN_PASSWORD，保留数据库密码和 PEPPER。首页或健康接口正常不代表真实设备已上报，采集验收需另外执行。

日常操作：

~~~sh
docker compose ps -a
docker compose logs -f --tail=100 api worker
docker compose restart api worker
# 停机，保留数据：
docker compose down
# 恢复服务：
docker compose up -d --no-build --wait
~~~

不要执行 `docker compose down -v`，它会删除数据卷。不要随意修改部署目录或 Compose 项目名，否则可能启动另一套空数据库。

升级前备份（下面的二进制重定向命令用于 Linux/Bash）：

~~~sh
mkdir -p backups
chmod 700 backups
backup="backups/piora-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T database pg_dump -U analytics -d piora_analytics -Fc > "$backup"
# 必须确认上一条命令退出码为 0，再将备份复制到独立存储。
~~~

同时安全备份 `.env`，保持 PEPPER 不变。备份需要定期在隔离数据库恢复演练；不能仅凭文件存在认定可恢复。此仓库没有自动备份任务。

应用更新：先获取并切换到已确认的新版本，在维护窗口执行以下步骤。当前只支持空库初始化和相同表结构下的应用重启，没有旧库自动升级逻辑。开发阶段若表结构改变，需要先备份并重建可丢弃的测试库；正式部署后的升级另行设计。

~~~sh
docker compose build
docker compose stop api worker
docker compose run --rm init
# 仅在初始化/已有表检查成功后继续：
docker compose up -d --no-build --wait
~~~

每步都检查退出码；init 失败时检查日志，不继续启动新应用。镜像更新对应地先修改 APP_VERSION 并执行 `docker compose pull`，再执行停应用、init 和 up。更改表结构后的应用回退需确认兼容性。

### 将宿主机配置目录挂载到容器

使用独立的 `compose.config.yaml`（无需与 compose.yaml 叠加）。API、Worker 和 init 都将宿主机 `CONFIG_DIR` 只读挂载到 `/config`，Node 启动时读取 `/config/.env`。数据库密码、镜像、端口等 Compose 参数仍由同一份宿主机 `.env` 通过 `--env-file` 提供，避免维护两份配置。容器不会创建或覆盖宿主机配置。

建议目录结构：

```text
部署目录/
  compose.config.yaml
  config/
    .env
  # 数据目录可位于独立的大容量磁盘
```

Linux 示例（先编辑配置，替换所有空密钥及服务器地址）：

```sh
mkdir -p config
cp .env.docker.example config/.env
# 编辑 config/.env，设置真实密钥、ANALYTICS_ORIGIN、ALLOW_HTTP 等
# 必须设置 POSTGRES_DATA_DIR 和 EXPORT_DATA_DIR，并先创建对应目录
# 使用发布镜像：IMAGE_NAME=ghcr.io/kexijiang/piora-analytics
# APP_VERSION=已发布版本，例如 v0.1.2
docker compose -f compose.config.yaml --env-file ./config/.env up -d --no-build --wait
docker compose -f compose.config.yaml --env-file ./config/.env logs --tail=100 init api worker
```

默认 `CONFIG_DIR=./config` 相对于 Compose 文件目录解析。需要自定义路径时，在该配置文件中设置绝对路径，例如 `CONFIG_DIR=/srv/piora/config`，启动时也指定 `--env-file /srv/piora/config/.env`。Windows Docker Desktop 可使用 `CONFIG_DIR=D:/piora-config`，对应 `--env-file D:/piora-config/.env`。宿主机目录必须事先存在，并允许镜像中的 node 用户（UID 1000）读取目录与文件；Linux 可将目录归属 UID 1000、目录权限设为 700、文件设为 600。不要将含密钥的目录共享给无关用户或提交到仓库。

数据库和导出目录同样在配置文件中指定，以下以大容量盘挂载点 `/data` 为例：

```dotenv
CONFIG_DIR=/data/piora/config
POSTGRES_DATA_DIR=/data/piora/postgres
EXPORT_DATA_DIR=/data/piora/exports
```

`POSTGRES_DATA_DIR` 挂载到 PostgreSQL 18 的 `/var/lib/postgresql`，`EXPORT_DATA_DIR` 由 API 和 Worker 共享挂载到 `/exports`，两者可读写；配置目录仍只读。三个目录应相互独立，不要重叠。数据路径为必填项，没有系统盘路径回退，目录不存在时启动失败而不会自动创建。

首次部署先检查磁盘，再创建目录（不是只创建一个叫 `/data` 的文件夹）：

```sh
findmnt -T /data
df -hT /data
sudo mkdir -p /data/piora/config /data/piora/postgres /data/piora/exports
sudo chown 1000:1000 /data/piora/config /data/piora/exports
sudo chmod 700 /data/piora/config /data/piora/exports
# config/.env 也需要 UID 1000 可读；PostgreSQL 目录由官方镜像初始化权限。
```

Windows Docker Desktop 可用 `D:/piora-data/postgres`、`D:/piora-data/exports`，目录同样需要预先创建。Linux 的磁盘挂载应配置为开机自动挂载，启动前确认磁盘就绪；目录存在本身不能证明大容量盘已挂载。不要修改正在使用中的数据路径。绑定目录中的文件不会被 `docker compose down -v` 删除；默认命名卷模式仍会受该命令影响。

配置在进程启动时读取，没有热加载。修改后使用相同参数重建应用容器：

```sh
docker compose -f compose.config.yaml --env-file ./config/.env up -d --no-build --force-recreate init api worker
```

`DATABASE_URL` 由 Compose 根据数据库密码和内部服务地址生成；`PORT`、`HOST`、`EXPORT_DIR` 等容器内部参数由 Compose 固定。其余应用配置从挂载文件读取。不要直接修改已有数据库卷的 POSTGRES_PASSWORD 或 ANALYTICS_PEPPER；它们不是普通热更新配置。

挂载模式直接使用指定的宿主机目录，不使用 pgdata/exports 命名卷。已有命名卷的数据不会自动迁移，切换前需停写、备份并恢复到新目录；即使项目名相同，也不会自动复用命名卷。默认 compose.yaml 的环境变量注入方式仍可用。当前 v0.1.2 镜像已支持 Node 的文件读取参数，可配合这份 Compose 文件使用；新增文件将在下一次 Release 中作为附件提供。

### 版本镜像与离线部署

`bash scripts/build.sh` 构建当前工作区；`bash scripts/build.sh v1.2.0` 从已有 Git tag 构建，包含该 tag 的代码。IMAGE_NAME 可覆盖镜像名。指定版本镜像时，在 .env 中填写相同 IMAGE_NAME 与 APP_VERSION。

推送 `v*` tag 会触发 Release Image：质量检查、linux/amd64 镜像构建、隔离 Compose 启动检查通过后，发布 `ghcr.io/<仓库所有者>/piora-analytics:<tag>`。非预发布版本还更新 latest；GitHub Release 提供镜像 tar、SHA256SUMS、Compose 和配置示例。此流程参考 ai-code-tracker-server，但发布的是本仓库镜像。工作流文件存在不代表镜像已发布。

~~~sh
# .env 设置 IMAGE_NAME=ghcr.io/<仓库所有者>/piora-analytics、APP_VERSION=v1.2.0
bash scripts/start.sh image
# 或：docker compose pull && docker compose up -d --no-build --wait
~~~

私有 GHCR 包需要先 docker login ghcr.io。离线服务器下载 Release tar 后 `docker load -i <镜像文件.tar>`，还必须从联网机器预先导出并加载 `postgres:18` 镜像（应用 tar 不包含 PostgreSQL）。复制 compose.yaml 和配置文件后，运行 `docker compose up -d --no-build --pull never --wait`；有源码目录也可用 `bash scripts/start.sh offline`。镜像仅适用于 linux/amd64。

默认 compose.yaml 使用 pgdata、exports 命名卷，更新时保持同一 Compose 项目名/目录；compose.config.yaml 使用指定宿主机目录。`docker compose down` 保留数据，`down -v` 会删除数据。升级前备份数据库；PEPPER 必须保持不变。生产备份、告警和权限拆分仍由运维配置，默认单 API、单 Worker。

HTTPS 部署可参考 [Caddy 配置](../deploy/Caddyfile.example)，并将 ANALYTICS_ORIGIN 设置为 HTTPS 地址、ALLOW_HTTP=false。HTTP 与 HTTPS 使用不同会话 Cookie，切换后重新登录。

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
