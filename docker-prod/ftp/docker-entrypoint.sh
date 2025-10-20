#!/bin/bash
set -e

echo "========================================="
echo "Pure-FTPd Server"
echo "========================================="

# 创建FTP用户（如果不存在）
if [ ! -f "/etc/pure-ftpd/passwd/pureftpd.passwd" ]; then
    echo "创建FTP用户..."

    # 创建用户目录
    mkdir -p /home/ftpusers/chatify

    # 创建 pure-ftpd 用户 (用户名: chatify, 密码: chatify123)
    # -u 1000:1000 = UID:GID (与node用户一致)
    # -d /home/ftpusers/chatify = 主目录
    (echo "chatify123"; echo "chatify123") | \
    pure-pw useradd chatify -u 1000 -g 1000 -d /home/ftpusers/chatify

    # 更新数据库
    pure-pw mkdb

    echo "✅ FTP用户创建完成: chatify / chatify123"
fi

# 设置权限
chown -R 1000:1000 /home/ftpusers/chatify
chmod -R 755 /home/ftpusers/chatify

echo ""
echo "========================================="
echo "FTP配置:"
echo "========================================="
echo "用户: chatify"
echo "密码: chatify123"
echo "上传目录: /home/ftpusers/chatify/vip"
echo "端口: 21"
echo "被动端口: 30000-30009"
echo "========================================="
echo ""

echo "🚀 启动FTP服务器..."

# 启动 pure-ftpd
# -c 50 = 最多50个并发连接
# -C 10 = 每个IP最多10个连接
# -l puredb:/etc/pure-ftpd/passwd/pureftpd.pdb = 使用虚拟用户
# -E = 禁止匿名登录
# -j = 创建主目录如果不存在
# -R = 禁用 CHMOD
# -P = 被动模式公网IP (容器内部)
# -p 30000:30009 = 被动模式端口范围
exec /usr/sbin/pure-ftpd \
    -c 50 \
    -C 10 \
    -l puredb:/etc/pure-ftpd/passwd/pureftpd.pdb \
    -E \
    -j \
    -R \
    -p 30000:30009 \
    -P $(hostname -i)
