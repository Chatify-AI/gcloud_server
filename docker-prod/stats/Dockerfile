# ==========================================
# 统计服务 Dockerfile
# ==========================================

FROM node:18-alpine AS builder

WORKDIR /tmp/stats
COPY channel-stats-service/package*.json ./
RUN npm ci
COPY channel-stats-service/ .

# 运行时
FROM node:18-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /tmp/stats/node_modules /app/node_modules
COPY --from=builder /tmp/stats/ /app/

COPY docker-prod/stats/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN mkdir -p /app/logs && \
    chown -R node:node /app

USER node

EXPOSE 4000

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
