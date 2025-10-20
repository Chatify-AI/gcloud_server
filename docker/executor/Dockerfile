# ==========================================
# GCloud 执行器服务 Dockerfile
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
FROM node:18 AS production

WORKDIR /app

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
    netcat-openbsd \
    openssh-client \
    jq \
    && rm -rf /var/lib/apt/lists/*

# 安装 Google Cloud SDK
RUN curl https://sdk.cloud.google.com | bash
ENV PATH /root/google-cloud-sdk/bin:$PATH
RUN gcloud config set disable_usage_reporting true

# 创建应用目录
RUN mkdir -p /app/logs

# 从构建阶段复制依赖
COPY --from=builder /build/node_modules /app/node_modules

# 复制源码
COPY --from=builder /build/src /app/src
COPY --from=builder /build/services /app/services
COPY --from=builder /build/*.js /app/

# 复制配置文件 (如果存在)
COPY . /app/

# 复制入口脚本
COPY docker/executor/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 创建非 root 用户 (但需要 sudo 权限执行某些 GCloud 命令)
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /root/.config && \
    mkdir -p /root/.config/gcloud-manager && \
    chown -R appuser:appuser /root/.config/gcloud-manager

USER appuser

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 环境变量
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512"

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
    vim \
    nano \
    && rm -rf /var/lib/apt/lists/*

USER appuser

ENV NODE_ENV=development

CMD ["nodemon", "server.js"]
