# ==========================================
# 统计服务 Dockerfile
# ==========================================

# ==========================================
# 构建阶段
# ==========================================
FROM node:18 AS builder

WORKDIR /build

# 复制 package.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源码
COPY . .

# ==========================================
# 生产阶段
# ==========================================
FROM node:18-slim AS production

WORKDIR /app

# 安装运行时必需的依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 创建应用目录
RUN mkdir -p /app/logs /app/public

# 从构建阶段复制依赖
COPY --from=builder /build/node_modules /app/node_modules

# 复制源码
COPY --from=builder /build/*.js /app/
COPY --from=builder /build/config /app/config
COPY --from=builder /build/models /app/models
COPY --from=builder /build/services /app/services
COPY --from=builder /build/public /app/public

# 复制入口脚本
COPY docker/stats/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 复制 .env 文件
COPY .env /app/.env

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# 暴露端口
EXPOSE 4000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# 环境变量
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"

# 启动脚本
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]

# ==========================================
# 开发阶段
# ==========================================
FROM production AS development

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    nodemon \
    && rm -rf /var/lib/apt/lists/*

USER appuser

ENV NODE_ENV=development

CMD ["nodemon", "server.js"]
