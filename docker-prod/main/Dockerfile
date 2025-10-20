# ==========================================
# GCloud Manager - 主应用服务 Dockerfile
# ==========================================
# 多阶段构建，优化最终镜像大小

# ========== 阶段 1: 前端构建 ==========
FROM node:18-alpine AS frontend-builder

WORKDIR /tmp/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ .
RUN npm run build || true

# ========== 阶段 2: 后端依赖准备 ==========
FROM node:18 AS backend-builder

WORKDIR /tmp/backend

# 安装 GCloud SDK 所需的系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    gnupg \
    lsb-release \
    ca-certificates \
    python3 \
    openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# 安装 Google Cloud SDK
RUN curl https://sdk.cloud.google.com > /tmp/install-gcloud.sh && \
    bash /tmp/install-gcloud.sh --disable-prompts --install-dir=/usr/local && \
    /usr/local/google-cloud-sdk/install.sh --usage-reporting=false --path-update=false --quiet && \
    rm /tmp/install-gcloud.sh

ENV PATH=/usr/local/google-cloud-sdk/bin:$PATH

# 复制后端代码和依赖
COPY package*.json ./
RUN npm ci

COPY . .

# ========== 阶段 3: 运行时生产镜像 ==========
FROM node:18-slim AS production

WORKDIR /app

# 安装运行时所需的最小依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3 \
    openjdk-17-jre-headless \
    dnsutils \
    net-tools \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# 安装 Google Cloud SDK（轻量版）
RUN curl https://sdk.cloud.google.com > /tmp/install-gcloud2.sh && \
    bash /tmp/install-gcloud2.sh --disable-prompts --install-dir=/usr/local && \
    /usr/local/google-cloud-sdk/install.sh --usage-reporting=false --path-update=false --quiet && \
    rm /tmp/install-gcloud2.sh

ENV PATH=/usr/local/google-cloud-sdk/bin:$PATH
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# 创建应用目录结构
RUN mkdir -p /app/backend /app/frontend/dist /app/logs

# 从前端构建阶段复制已编译的前端
COPY --from=frontend-builder /tmp/frontend/dist /app/frontend/dist

# 从后端构建阶段复制依赖和代码
COPY --from=backend-builder /tmp/backend/node_modules /app/node_modules
COPY --from=backend-builder /tmp/backend/backend /app/backend
COPY --from=backend-builder /tmp/backend/package.json /app/package.json

# 复制启动脚本
COPY docker-prod/main/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 创建 GCloud 配置目录
RUN mkdir -p /home/node/.config/gcloud-manager && \
    gcloud config set disable_usage_reporting true

# 使用 node 用户（安全最佳实践）
RUN chown -R node:node /app && \
    chown -R node:node /home/node/.config

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "backend/src/server.js"]
