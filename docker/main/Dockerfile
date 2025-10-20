# ==========================================
# 主应用 Dockerfile - 多阶段构建
# ==========================================

# ==========================================
# 第一阶段: 前端构建
# ==========================================
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

# 复制前端代码
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ .

# 构建前端 (Vite)
RUN npm run build

# ==========================================
# 第二阶段: 后端依赖安装
# ==========================================
FROM node:18 AS backend-builder

WORKDIR /backend

# 安装系统依赖 (GCloud CLI 所需)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    gnupg \
    lsb-release \
    ca-certificates \
    python3 \
    python3-pip \
    openjdk-11-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# 安装 Google Cloud SDK (GCloud CLI)
RUN curl https://sdk.cloud.google.com | bash
ENV PATH /root/google-cloud-sdk/bin:$PATH
RUN gcloud config set disable_usage_reporting true

# 复制 package.json
COPY package*.json ./

# 安装 Node 依赖
RUN npm ci

# 复制后端源码
COPY backend/ ./backend/
COPY .env ./

# ==========================================
# 第三阶段: 运行时环境 (生产)
# ==========================================
FROM node:18-slim AS production

WORKDIR /app

# 安装运行时必需的依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    gnupg \
    lsb-release \
    dnsutils \
    openssh-client \
    net-tools \
    wget \
    python3 \
    python3-pip \
    openjdk-11-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# 安装 Google Cloud SDK
RUN curl https://sdk.cloud.google.com | bash
ENV PATH /root/google-cloud-sdk/bin:$PATH
RUN gcloud config set disable_usage_reporting true

# 创建应用目录
RUN mkdir -p /app/logs /app/backend /app/frontend/dist

# 从构建阶段复制前端产物
COPY --from=frontend-builder /frontend/dist /app/frontend/dist

# 从构建阶段复制后端文件
COPY --from=backend-builder /backend/node_modules /app/node_modules
COPY --from=backend-builder /backend/backend /app/backend
COPY --from=backend-builder /backend/.env /app/.env

# 复制入口脚本
COPY docker/main/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 创建非 root 用户 (安全最佳实践)
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /root/.config

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 环境变量
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512"

# 启动脚本
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "backend/src/server.js"]

# ==========================================
# 开发阶段 (可选)
# ==========================================
FROM production AS development

USER root

# 安装开发工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodemon \
    vim \
    nano \
    && rm -rf /var/lib/apt/lists/*

# 安装 npm 开发依赖
COPY package*.json ./
RUN npm ci

USER appuser

ENV NODE_ENV=development

CMD ["npm", "run", "dev"]
