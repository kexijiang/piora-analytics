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

**部署、启动和升级统一使用 `scripts/start.sh`。** `docker compose` 仅用于后文的状态、日志、停机和备份操作。所有命令都在部署目录执行，配置只维护一份：`<配置目录>/.env`。

### 准备目录与配置

宿主机需要 Docker Engine 和 Compose 插件。镜像部署无需安装 Node.js：从 Release 下载以下文件，按此结构摆放（下载的 `start.sh` 需放入 `scripts/`）：

```text
部署目录/
  compose.yaml
  .env.docker.example
  scripts/
    start.sh
```

以下以 Linux 大容量盘 `/data` 为例。确认磁盘已挂载，创建互不重叠的配置、数据库和导出目录，再复制配置示例：

```sh
findmnt -T /data
df -hT /data
sudo mkdir -p /data/piora/config /data/piora/postgres /data/piora/exports
sudo cp .env.docker.example /data/piora/config/.env
# 编辑 /data/piora/config/.env，按下表填写
sudo chown -R 1000:1000 /data/piora/config /data/piora/exports
sudo chmod 700 /data/piora/config /data/piora/exports
sudo chmod 600 /data/piora/config/.env
```

应用容器 UID 1000 需要读取配置、写入导出目录；执行启动脚本的运维账户也必须可读配置（上述权限适用于 UID 1000 或 root，其他账户需设置受控访问权限）。PostgreSQL 目录权限由官方镜像初始化。目录必须事先存在；应配置磁盘开机挂载，目录存在本身不能证明数据盘已挂载。

### 配置项说明

下表的“示例文件值”指 `.env.docker.example` 中的内容，不表示留空时程序会自动补齐。空白必填项必须填写。

| 配置项 | 示例文件值 | 用途与填写要求 |
|---|---|---|
| `CONFIG_DIR` | `./config` | 宿主机配置目录，只读挂载到 `/config`。建议填写绝对路径，如 `/data/piora/config`，文件放在其中的 `.env`。启动脚本实际使用的目录见下文。 |
| `POSTGRES_DATA_DIR` | 空，必填 | PostgreSQL 数据目录，如 `/data/piora/postgres`，读写挂载到 `/var/lib/postgresql`。选择实际大容量盘上的独立目录，无默认路径。 |
| `EXPORT_DATA_DIR` | 空，必填 | 导出文件目录，如 `/data/piora/exports`，由 API 和 Worker 共享读写挂载到 `/exports`，无默认路径。 |
| `POSTGRES_PASSWORD` | 空，必填 | 数据库密码，同时用于应用连接。使用 URL 安全的随机值，推荐 `openssl rand -hex 32`；初始化后不能仅修改此文件来更改数据库密码。 |
| `ANALYTICS_PEPPER` | 空，必填 | 服务端凭证保护用的随机秘密，至少 32 字符；可另运行一次 `openssl rand -hex 32` 生成。持久保存，升级时保持不变。 |
| `ANALYTICS_ORIGIN` | `http://analytics.internal:4319` | 必须改成用户实际访问的完整地址，包含协议和非默认端口，不带末尾斜线。例如 `http://服务器IP:4319`。 |
| `ALLOW_HTTP` | `true` | 受信任内网使用 HTTP 时填写 `true`；HTTPS 填 `false`。HTTP 会明文传输密码与请求；程序默认不允许 HTTP。 |
| `BIND_ADDRESS` | `0.0.0.0` | 宿主机监听地址。`0.0.0.0` 允许其他机器访问，`127.0.0.1` 仅本机访问；Compose 未设置时默认后者。 |
| `APP_PORT` | `4319` | 宿主机访问端口，Compose 默认 4319；改动时同步修改 ANALYTICS_ORIGIN 和防火墙规则。 |
| `IMAGE_NAME` | `piora-analytics` | 源码构建使用示例值；拉取发布镜像改为 `ghcr.io/kexijiang/piora-analytics`。 |
| `APP_VERSION` | `latest` | 镜像标签，建议填写确定的已发布版本，如 `v0.1.2`；离线模式需与已加载镜像标签一致。 |
| `INIT_ORG_NAME` | `Piora` | 首次初始化的组织名称，部署时填写公司或团队名称；已有库不会因修改此项而改名。 |
| `INIT_ADMIN_USERNAME` | `admin` | 首次初始化的管理员账号；已有库不会因修改此项而更换账号。 |
| `INIT_ADMIN_PASSWORD` | 空，首次必填 | 初始管理员密码，12–256 字符。首次登录强制修改，初始化完成后可从配置文件移除。 |

使用上述目录及发布镜像时，至少将路径和镜像配置改为：

```dotenv
CONFIG_DIR=/data/piora/config
POSTGRES_DATA_DIR=/data/piora/postgres
EXPORT_DATA_DIR=/data/piora/exports
IMAGE_NAME=ghcr.io/kexijiang/piora-analytics
APP_VERSION=v0.1.2
```

然后填写三个秘密、访问地址和组织信息。不要提交或分享真实 `.env`。`DATABASE_URL`、容器内部 `PORT`、`HOST`、`EXPORT_DIR` 等由 Compose 生成或固定，不需要另配。API、Worker 和 init 读取同一个只读挂载文件；数据库和导出文件分别写入上述宿主机目录。

**配置目录的选择顺序：脚本第二个参数 → 宿主机环境变量 CONFIG_DIR → 部署目录下的 ./config。** 脚本会用选定目录同时读取配置和挂载容器；仅在 `.env` 内修改 CONFIG_DIR 不能让脚本自动找到搬迁后的文件。直接执行运维命令时，也要设置同一个 CONFIG_DIR。Windows 可用 `D:/piora/config` 等路径，并通过 Git Bash 执行脚本。

### 启动与升级

首次部署，编辑好配置后执行：

```sh
bash scripts/start.sh image /data/piora/config
```

脚本拉取镜像、初始化空数据库并等待服务就绪。访问 ANALYTICS_ORIGIN，使用初始账号登录并修改密码。已有数据库会保留账号和数据；结构不完整时初始化失败，不会自动删库。

| 模式 | 命令 | 适用场景 |
|---|---|---|
| 发布镜像 | `bash scripts/start.sh image /data/piora/config` | 首次部署或升级；先将 APP_VERSION 改为目标版本。 |
| 离线/恢复 | `bash scripts/start.sh offline /data/piora/config` | 使用本机已有镜像启动，不构建、不拉取。 |
| 源码构建 | `bash scripts/start.sh local /data/piora/config` | 完整源码目录中构建并启动，IMAGE_NAME 使用 `piora-analytics`。 |

升级前按下节备份。当前仅支持空库初始化和相同表结构下的重启，没有旧库自动升级逻辑。配置文件没有热加载；**修改应用配置后，在维护窗口先按下节停机，再用上述脚本启动**，确保进程重新读取配置。这会短暂中断服务。

离线部署先核验 Release 的 SHA256SUMS，再 `docker load -i <应用镜像.tar>`，另外加载 `postgres:18` 镜像（应用 tar 不包含数据库镜像），然后使用 offline 模式。私有 GHCR 包需先 `docker login ghcr.io`。

### 日常运维（不用于替代启动脚本）

以下命令在包含 compose.yaml 的部署目录执行，保持同一 Compose 项目名：

```sh
export CONFIG_DIR=/data/piora/config
# 查看状态：数据库和 API 为 healthy，init 为 Exited (0)，Worker 为 Up
docker compose --env-file "$CONFIG_DIR/.env" ps -a
# 查看日志
docker compose --env-file "$CONFIG_DIR/.env" logs --tail=100 init api worker
# 停机，保留宿主机数据；恢复时执行上节 offline 启动命令
docker compose --env-file "$CONFIG_DIR/.env" down
```

健康接口可用 `curl -f http://127.0.0.1:4319/health/ready` 检查；改过端口或绑定地址时同步调整。健康检查和看板可访问不代表真实设备已上报，仍需验证设备上传和聚合结果。

备份数据库（Linux/Bash，服务运行时执行）：

```sh
export CONFIG_DIR=/data/piora/config
mkdir -p backups
chmod 700 backups
docker compose --env-file "$CONFIG_DIR/.env" exec -T database pg_dump -U analytics -d piora_analytics -Fc > "backups/piora-$(date +%Y%m%d-%H%M%S).dump"
```

确认退出码为 0，将备份复制到独立存储，同时安全备份配置；定期在隔离数据库演练恢复。宿主机绑定目录不会被 `down` 或 `down -v` 删除。旧命名卷数据不会自动迁入新目录，切换前需停写、备份并恢复；不要让两个项目同时访问同一个 PostgreSQL 目录。

推送 `v*` tag 后，Release 工作流执行质量检查、镜像构建和隔离启动验证，再发布镜像及部署附件。当前 v0.1.2 镜像支持此配置读取方式，更新后的部署文件随下一次 Release 提供，也可从仓库获取。HTTPS 可参考 [Caddy 配置](../deploy/Caddyfile.example)，切换协议后需重新登录。

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
