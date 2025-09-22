# 远程服务器配置指南

## 配置完成！

服务器已配置为可远程访问。所有localhost引用已替换为支持外部访问的配置。

## 快速启动

```bash
# 启动开发服务器（前端+后端）
./scripts/remote-start.sh

# 或者分别启动
npm run dev           # 后端 (端口 3000)
cd frontend && npm run dev  # 前端 (端口 5173)
```

## 访问地址

检测到的服务器IP: `2a02:4780:10:2410::1` (IPv6)

如果你的服务器有IPv4地址，可以使用：
```bash
curl ifconfig.me  # 获取公网IPv4
```

- **后端API**: http://[你的IP]:3000
- **前端界面**: http://[你的IP]:5173

## Google OAuth配置

**重要**: 在Google Cloud Console中更新OAuth设置：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 选择你的OAuth 2.0客户端ID
3. 更新以下设置：

**授权重定向URI**:
```
http://[你的IP]:3000/api/auth/google/callback
```

**授权的JavaScript来源**:
```
http://[你的IP]:3000
http://[你的IP]:5173
```

## 防火墙配置

确保以下端口已开放：

### 云服务商防火墙

**Google Cloud Platform:**
```bash
gcloud compute firewall-rules create gcloud-manager \
  --allow tcp:3000,tcp:5173 \
  --source-ranges 0.0.0.0/0
```

**AWS EC2:**
- 在安全组中添加入站规则
- 端口 3000 (TCP) - 自定义TCP
- 端口 5173 (TCP) - 自定义TCP
- 来源: 0.0.0.0/0

**阿里云/腾讯云:**
- 在安全组规则中添加
- 端口范围: 3000, 5173
- 协议: TCP
- 授权对象: 0.0.0.0/0

### 系统防火墙

**Ubuntu/Debian (ufw):**
```bash
sudo ufw allow 3000
sudo ufw allow 5173
sudo ufw status
```

**CentOS/RHEL (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --reload
```

## 环境变量说明

`.env`文件已自动配置，主要设置：

- `HOST=0.0.0.0` - 监听所有网络接口
- `CORS_ORIGIN=*` - 开发环境允许所有来源（生产环境需要限制）
- `FRONTEND_URL` - 前端URL，用于CORS配置
- `GOOGLE_REDIRECT_URI` - OAuth回调地址

## 故障排查

### 1. 无法访问服务器

检查防火墙：
```bash
# 检查端口监听
netstat -tlnp | grep -E "3000|5173"

# 测试端口连通性
telnet [你的IP] 3000
```

### 2. OAuth认证失败

- 确认Google Console中的重定向URI完全匹配
- 检查.env中的CLIENT_ID和CLIENT_SECRET
- 查看服务器日志: `tail -f logs/combined.log`

### 3. 数据库错误

如果遇到数据库错误，清理并重建：
```bash
rm -f database/gcloud_manager.sqlite
npm run dev  # 会自动创建新数据库
```

### 4. IPv6访问问题

如果客户端不支持IPv6，获取IPv4地址：
```bash
curl -4 ifconfig.me
```

然后更新.env和frontend/.env中的IP地址。

## 生产部署

```bash
# 使用PM2管理进程（推荐）
npm install -g pm2
./scripts/start-prod.sh

# 或使用systemd服务
sudo nano /etc/systemd/system/gcloud-manager.service
# 添加服务配置...
sudo systemctl enable gcloud-manager
sudo systemctl start gcloud-manager
```

## 安全建议

1. **生产环境**：
   - 修改`CORS_ORIGIN`为具体域名
   - 使用HTTPS（配置nginx反向代理）
   - 使用强密码的JWT_SECRET
   - 限制数据库文件权限

2. **使用nginx反向代理**：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 支持的功能

✅ 远程访问配置完成
✅ 数据库自动初始化
✅ CORS跨域支持
✅ WebSocket实时通信
✅ Google OAuth集成
✅ 多账号管理
✅ 命令执行与历史记录

现在你可以从任何浏览器访问你的GCloud Manager了！