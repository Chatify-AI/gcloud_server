# ==========================================
# GCloud 执行器服务 Dockerfile
# ==========================================

FROM node:18 AS builder

WORKDIR /tmp/executor

# 安装 GCloud 依赖
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

# 复制应用
COPY gcloud-executor-service/package*.json ./
RUN npm ci
COPY gcloud-executor-service/ .

# 运行时
FROM node:18

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    gnupg \
    lsb-release \
    ca-certificates \
    python3 \
    openjdk-17-jre-headless \
    netcat-openbsd \
    openssh-client \
    jq \
    && rm -rf /var/lib/apt/lists/*

# 安装 Google Cloud SDK
RUN curl https://sdk.cloud.google.com > /tmp/install-gcloud2.sh && \
    bash /tmp/install-gcloud2.sh --disable-prompts --install-dir=/usr/local && \
    /usr/local/google-cloud-sdk/install.sh --usage-reporting=false --path-update=false --quiet && \
    rm /tmp/install-gcloud2.sh

ENV PATH=/usr/local/google-cloud-sdk/bin:$PATH
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY --from=builder /tmp/executor/node_modules /app/node_modules
COPY --from=builder /tmp/executor/ /app/

COPY docker-prod/executor/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN mkdir -p /app/logs /home/node/.config/gcloud-manager && \
    gcloud config set disable_usage_reporting true && \
    chown -R node:node /app && \
    chown -R node:node /home/node/.config

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "src/app.js"]
