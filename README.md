# PM2 Web Manager

轻量级 PM2 进程管理 Web 工具，支持本机和远程机器管理，手机端友好。

## 功能

- **进程管理** — 启动、停止、重启、删除、日志查看
- **远程机器** — 通过 SSH 管理多台服务器上的 PM2 进程
- **系统监控** — CPU/内存使用率实时曲线图，24h 历史数据
- **用户认证** — JWT 登录，支持修改用户名和密码
- **响应式 UI** — HeroUI 现代化界面，手机端优先设计
- **暗色主题** — 支持亮色/暗色切换

## 快速启动

### 本地开发

```bash
yarn install
yarn dev
```

访问 http://localhost:3000，默认账户：`admin` / `admin`

### Docker 部署

```bash
docker-compose up -d
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 监听端口 | `3000` |
| `DB_PATH` | SQLite 数据库路径 | `./data/pm2manager.db` |
| `JWT_SECRET` | JWT 签名密钥 | 自动生成 |
| `ENCRYPTION_KEY` | SSH 凭据加密密钥（≥32字符） | 自动生成 |

## 技术栈

- **前端**: Next.js 15 + HeroUI + TailwindCSS + Recharts
- **后端**: Next.js API Routes + better-sqlite3
- **认证**: JWT + bcrypt
- **远程**: SSH2
- **部署**: Docker + standalone output
