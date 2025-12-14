# 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 安装构建依赖 (better-sqlite3 需要 python3, make, g++)
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY packages/javascript-package/package*.json ./

# 安装依赖
RUN npm ci

# 复制源码
COPY packages/javascript-package/ .

# 清理开发依赖，只保留生产依赖 (因为后面是直接复制 node_modules)
RUN npm prune --production

# 运行阶段
FROM node:22-alpine

WORKDIR /app

# 复制 package 文件
COPY packages/javascript-package/package*.json ./

# 从构建阶段复制 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 从构建阶段复制源码
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "src/app.js"]
