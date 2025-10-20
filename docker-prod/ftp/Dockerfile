# ==========================================
# Pure-FTPd FTP服务器 Dockerfile
# ==========================================

FROM stilliard/pure-ftpd:latest

# 创建FTP用户目录
RUN mkdir -p /home/ftpusers/chatify/vip && \
    chmod -R 755 /home/ftpusers

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD nc -z localhost 21 || exit 1

# FTP被动模式端口范围
EXPOSE 21 30000-30009
