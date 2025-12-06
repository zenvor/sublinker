# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（包括 devDependencies 以便编译）
RUN npm ci

# 复制源码
COPY . .

# 运行阶段
FROM node:18-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --omit=dev

# 从构建阶段复制源码
COPY --from=builder /app/src ./src

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=9007

# 暴露端口
EXPOSE 9007

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9007/health || exit 1

# 启动命令
CMD ["node", "src/app.js"]
