# CloakGate 部署指南

本指南将帮助你将 CloakGate 服务（包含后端 API 和静态前端）部署到 VPS 上。

## 前置要求

- 一台 Linux VPS (Ubuntu/Debian/CentOS)
- 本地可以通过 SSH 连接到 VPS
- VPS 上安装了 Docker 和 Docker Compose

## 部署步骤

### 1. 本地准备

首先确保你已经完成了前端的构建（如果在另一个项目中），并将构建产物（`dist` 目录下的内容）复制到本项目的 `public` 目录下。

```bash
# 示例：假设前端项目在 ../CloakGateWeb
# 在 CloakGateWeb 下运行：
# npm run build
# cp -r dist/* ../CloakGate/public/
```

确保 `public` 目录下有 `index.html` 和其他静态资源。

### 2. 打包与上传

你可以选择在本地构建镜像并推送，或者直接将代码上传到 VPS 在线构建。这里推荐**直接上传代码在线构建**，操作更简单。

将项目文件上传到 VPS（排除 `node_modules` 等）：

```bash
# 使用 rsync 上传 (假设 VPS IP 为 1.2.3.4，用户为 root)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'data' . root@1.2.3.4:/opt/cloakgate
```

或者使用 SCP：

```bash
scp -r . root@1.2.3.4:/opt/cloakgate
```

### 3. 服务器配置与启动

SSH 登录到 VPS：

```bash
ssh root@1.2.3.4
cd /opt/cloakgate
```

首次运行前，确保 data 目录存在（Docker 会自动创建，但手动创建更保险）：

```bash
mkdir -p data
```

使用 Docker Compose 启动服务：

```bash
docker compose up -d --build
```

### 4. 验证部署

查看容器状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

访问你的 VPS IP 或域名（默认端口 3000）：
- 前端页面: `http://<VPS_IP>:3000`
- 健康检查: `http://<VPS_IP>:3000/health`

### 5. 常见维护命令

- **停止服务**: `docker compose down`
- **重启服务**: `docker compose restart`
- **更新代码后重新部署**:
  1. 重新上传代码
  2. 运行 `docker compose up -d --build`

## 高级配置 (Nginx 反向代理)

建议在 Docker 前面加一层 Nginx 做反向代理和 HTTPS，配置示例：

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

> **重要**: 必须配置 `X-Forwarded-For` 或 `X-Real-IP` 头，否则后端只能获取到 Docker 内网 IP。

## 高级配置 (Caddy 反向代理)

Caddy 会自动处理 HTTPS 证书和代理头，配置更简洁：

```caddyfile
your-domain.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy 默认会自动设置 `X-Forwarded-For`、`X-Real-IP` 等头，无需额外配置。
