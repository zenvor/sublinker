# CloakGate 部署指南

本指南将帮助你将 CloakGate 服务（包含后端 API 和静态前端）部署到 VPS 上。

## 前置要求

- 一台 Linux VPS (Ubuntu/Debian/CentOS)
- 本地可以通过 SSH 连接到 VPS
- Node.js >= 24.0.0
- PM2 进程管理器

## 部署步骤

### 1. 安装依赖环境

#### 安装 Node.js 24

```bash
# 使用 NodeSource 安装 Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证版本
node -v  # 应显示 v24.x.x
```

#### 安装 PM2

```bash
sudo npm install -g pm2
```

### 2. 本地准备

首先确保你已经完成了前端的构建（如果在另一个项目中），并将构建产物（`dist` 目录下的内容）复制到本项目的 `public` 目录下。

```bash
# 示例：假设前端项目在 ../CloakGateWeb
# 在 CloakGateWeb 下运行：
# npm run build
# cp -r dist/* ../CloakGate/packages/javascript-package/src/public/
```

确保 `public` 目录下有 `index.html` 和其他静态资源。

### 3. 上传代码到服务器

将项目文件上传到 VPS（排除 `node_modules` 等）：

```bash
# 使用 rsync 上传 (假设 VPS IP 为 1.2.3.4，用户为 root)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'data' --exclude 'logs' . root@1.2.3.4:/opt/cloakgate
```

或者使用 SCP：

```bash
scp -r . root@1.2.3.4:/opt/cloakgate
```

### 4. 服务器配置与启动

SSH 登录到 VPS：

```bash
ssh root@1.2.3.4
cd /opt/cloakgate
```

#### 4.1 安装项目依赖

```bash
npm install
```

#### 4.2 创建必要目录

```bash
mkdir -p data logs
```

#### 4.3 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
nano .env
# 编辑配置...
```

主要配置项：
- `PORT`: 服务端口（默认 3000）
- `API_DOMAIN`: API 域名
- `XUI_*`: 3X-UI 面板配置
- `IP_BLOCKER_*`: IP 阻断功能配置

#### 4.4 使用 PM2 启动服务

```bash
# 启动服务
pm2 start ecosystem.config.cjs

# 保存 PM2 进程列表（开机自启）
pm2 save
pm2 startup
```

### 5. 验证部署

查看服务状态：

```bash
pm2 status
```

查看日志：

```bash
# 实时查看日志
pm2 logs cloakgate

# 或查看日志文件
tail -f logs/cloakgate-out.log
tail -f logs/cloakgate-error.log
```

访问你的 VPS IP 或域名（默认端口 3000）：
- 前端页面: `http://<VPS_IP>:3000`
- 健康检查: `http://<VPS_IP>:3000/health`

### 6. 常用 PM2 命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs cloakgate

# 重启服务
pm2 restart cloakgate

# 停止服务
pm2 stop cloakgate

# 删除服务
pm2 delete cloakgate

# 监控面板
pm2 monit
```

### 7. 更新部署

```bash
cd /opt/cloakgate

# 拉取最新代码
git pull

# 如有新依赖，重新安装
npm install

# 重启服务
pm2 restart cloakgate
```

> **Tip**: 如果在 VPS 上拉取代码 (git pull) 每次都要输入密码，可以配置凭证存储：
> ```bash
> git config --global credential.helper store
> ```
> 第一次输入后就会保存下来。或者推荐配置 SSH Key 访问。
>
> **Git 警告解决**: 如果 `git pull` 出现 "Need to specify how to reconcile divergent branches" 警告，请运行以下命令配置默认行为：
> ```bash
> git config pull.rebase false
> ```

## 高级配置 (Nginx 反向代理)

建议在服务前面加一层 Nginx 做反向代理和 HTTPS，配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **重要**: 必须配置 `X-Forwarded-For` 或 `X-Real-IP` 头，否则后端无法获取真实客户端 IP。

## 高级配置 (Caddy 反向代理)

Caddy 会自动处理 HTTPS 证书和代理头，配置更简洁：

```caddyfile
your-domain.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy 默认会自动设置 `X-Forwarded-For`、`X-Real-IP` 等头，无需额外配置。

## IP 阻断功能配置（可选）

如需启用 IP 阻断功能，在 `.env` 文件中配置：

```bash
# X-UI 面板配置
XUI_HOST=127.0.0.1
XUI_PORT=54321
XUI_WEB_BASE_PATH=/your-web-base-path
XUI_USERNAME=your-username
XUI_PASSWORD=your-password

# IP 阻断配置
IP_BLOCKER_ENABLED=true
IP_BLOCKER_POLL_INTERVAL=30000
IP_BLOCKER_LOG_COUNT=50
IP_BLOCKER_JAIL_NAME=3x-ipl
IP_BLOCKER_DRY_RUN=false
```

> **注意**: IP 阻断功能需要调用 Fail2Ban，请确保 Fail2Ban 已安装并配置好相应的 jail。使用 PM2 部署可以直接访问宿主机的 Fail2Ban。
