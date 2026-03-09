# 吟彩订单系统 — 群晖 NAS 部署指南

本文档说明如何将吟彩订单系统部署到群晖 NAS（Synology NAS）上，使用 Docker Compose 运行 Node.js 应用 + MySQL 8.0 数据库，并通过 MinIO 替代 Manus 内置 S3 存储。

---

## 目录

1. [前提条件](#1-前提条件)
2. [目录结构](#2-目录结构)
3. [环境变量配置](#3-环境变量配置)
4. [docker-compose.yml](#4-docker-composeyml)
5. [首次部署步骤](#5-首次部署步骤)
6. [代码更新流程](#6-代码更新流程)
7. [MinIO 存储迁移](#7-minio-存储迁移)
8. [常见问题](#8-常见问题)

---

## 1. 前提条件

| 要求 | 说明 |
|------|------|
| 群晖 DSM 7.x | 需开启 Container Manager（Docker）套件 |
| Docker Compose | DSM 7.2+ 的 Container Manager 已内置 |
| Git | 在 NAS 上通过 SSH 执行 `git pull` 更新代码 |
| 至少 2GB RAM | Node.js + MySQL + Chromium（PDF 生成）的最低要求 |
| 至少 10GB 磁盘 | 用于数据库、PDF 文件和 MinIO 存储 |

---

## 2. 目录结构

在 NAS 上建议使用以下目录结构：

```
/volume1/docker/yincai-order/
├── yincai-order/          ← 从 GitHub clone 的代码仓库
│   ├── server/
│   ├── client/
│   ├── drizzle/
│   └── ...
├── .env                   ← 环境变量（不纳入 Git）
├── docker-compose.yml     ← Docker 编排文件
├── mysql-data/            ← MySQL 数据持久化目录（自动创建）
└── minio-data/            ← MinIO 数据持久化目录（自动创建）
```

---

## 3. 环境变量配置

在 `/volume1/docker/yincai-order/.env` 中创建以下文件（**不要提交到 Git**）：

```env
# ─── 数据库 ───────────────────────────────────────────────────────────────────
DATABASE_URL=mysql://yincai:你的数据库密码@mysql:3306/yincai_order
MYSQL_PASSWORD=你的数据库密码

# ─── 认证 ────────────────────────────────────────────────────────────────────
# 随机生成一个长字符串作为 JWT 密钥，例如：openssl rand -hex 32
JWT_SECRET=在此填入随机生成的64位十六进制字符串

# ─── MinIO 文件存储（替代 Manus 内置 S3）────────────────────────────────────
# 系统直接使用 MINIO_ROOT_USER / MINIO_ROOT_PASSWORD 连接 MinIO
# 无需额外创建 Access Key，与 MinIO 容器使用相同凭据即可
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=你的MinIO密码（至少8位）
MINIO_ENDPOINT=http://minio:9000
MINIO_BUCKET=yincai-docs
# 浏览器访问 MinIO 的外部地址（必填！填 NAS 局域网 IP）
MINIO_PUBLIC_ENDPOINT=http://你的NAS局域网IP:9000

# ─── 公司信息（用于合同/PI/CI 自动填充）────────────────────────────────────
COMPANY_CN_NAME=吟彩（深圳）有限公司
COMPANY_CN_ADDRESS=广东省深圳市xxx区xxx路xxx号
COMPANY_CN_BANK_NAME=中国工商银行深圳xxx支行
COMPANY_CN_BANK_ACCOUNT=6222xxxxxxxxxxxx
COMPANY_TAX_NO=91440300xxxxxxxxxx
COMPANY_EN_NAME=YINCAI (SHENZHEN) CO., LTD.
COMPANY_EN_ADDRESS=No.xxx, xxx Road, xxx District, Shenzhen, Guangdong, China
COMPANY_CONTACT_NAME=联系人姓名
COMPANY_CONTACT_PHONE=+86 755 xxxx xxxx
COMPANY_CONTACT_EMAIL=info@yincai.com
# ICBC 美元账户
COMPANY_ICBC_EN_BANK_NAME=Industrial and Commercial Bank of China
COMPANY_ICBC_USD_ACCOUNT=xxxxxxxxxxxxxxxx
COMPANY_ICBC_SWIFT=ICBKCNBJXXX
# Citi 美元账户（如有）
COMPANY_CITI_EN_BANK_NAME=Citibank N.A.
COMPANY_CITI_USD_ACCOUNT=xxxxxxxxxxxxxxxx
COMPANY_CITI_SWIFT=CITIUS33

# ─── Puppeteer（PDF 生成）────────────────────────────────────────────────────
# Docker 镜像中 Chromium 的路径
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ─── 应用端口 ─────────────────────────────────────────────────────────────────
PORT=3000

# ─── Manus OAuth（NAS 部署时留空即可，系统使用本地账号登录）────────────────
VITE_APP_ID=
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=
OWNER_NAME=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
```

> **安全提示**：`.env` 文件包含敏感密钥，务必确保文件权限为 `600`（仅所有者可读写），且不要将其提交到 Git 仓库。

---

## 4. docker-compose.yml

在 `/volume1/docker/yincai-order/docker-compose.yml` 中创建以下内容：

```yaml
version: "3.9"

services:
  # ─── MySQL 8.0 数据库 ─────────────────────────────────────────────────────
  mysql:
    image: mysql:8.0
    container_name: yincai-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root_password_change_me}
      MYSQL_DATABASE: yincai_order
      MYSQL_USER: yincai
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-yincai_password_change_me}
    volumes:
      - ./mysql-data:/var/lib/mysql
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --sql-mode=STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - yincai-net

  # ─── MinIO 对象存储（替代 Manus 内置 S3）────────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: yincai-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minio_admin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minio_password_change_me}
    volumes:
      - ./minio-data:/data
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"   # MinIO API 端口
      - "9001:9001"   # MinIO 控制台端口
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - yincai-net

  # ─── 吟彩订单系统应用 ─────────────────────────────────────────────────────
  app:
    build:
      context: ./yincai-order
      dockerfile: Dockerfile
    container_name: yincai-app
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: mysql://yincai:${MYSQL_PASSWORD:-yincai_password_change_me}@mysql:3306/yincai_order
      NODE_ENV: production
    ports:
      - "${PORT:-3000}:3000"
    depends_on:
      mysql:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - yincai-net

networks:
  yincai-net:
    driver: bridge
```

---

## 5. 首次部署步骤

### 步骤一：在 NAS 上安装 Git（通过 SSH）

```bash
# 通过 SSH 连接到群晖 NAS
ssh admin@你的NAS的IP地址

# 安装 Git（如未安装）
sudo apt-get install git -y
# 或通过群晖套件中心安装 Git Server 套件
```

### 步骤二：克隆代码仓库

```bash
cd /volume1/docker/yincai-order
git clone https://github.com/你的用户名/yincai-order.git
```

### 步骤三：创建 Dockerfile

在 `yincai-order/` 目录中创建 `Dockerfile`：

```dockerfile
FROM node:22-alpine

# 安装 Chromium（用于 Puppeteer PDF 生成）
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk

# 设置 Puppeteer 使用系统 Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# 复制源代码
COPY . .

# 构建前端和后端
RUN pnpm build

# 运行数据库迁移并启动服务
CMD ["sh", "-c", "pnpm db:push && pnpm start"]

EXPOSE 3000
```

### 步骤四：创建 .env 文件

参照第 3 节，在 `/volume1/docker/yincai-order/.env` 中填写所有环境变量。

**重要**：`DATABASE_URL` 中的密码需与 `docker-compose.yml` 中的 `MYSQL_PASSWORD` 一致。

### 步骤五：启动服务

```bash
cd /volume1/docker/yincai-order
docker-compose up -d
```

### 步骤六：配置 MinIO 存储桶

1. 浏览器访问 `http://你的NAS的IP:9001`（MinIO 控制台）
2. 使用 `.env` 中的 `MINIO_ROOT_USER` 和 `MINIO_ROOT_PASSWORD` 登录
3. 创建名为 `yincai-docs` 的存储桶，并设置为**公共读取**（Public）

> **注意**：无需在 MinIO 控制台中额外创建 Access Key，系统直接使用 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` 连接 MinIO。

### 步骤七：修改 storage.ts 以使用 MinIO

MinIO 兼容 AWS S3 API，需要修改 `server/storage.ts` 以使用 MinIO 端点。在代码仓库中修改后重新部署。

详见第 7 节。

### 步骤八：创建管理员账号

```bash
# 进入应用容器
docker exec -it yincai-app sh

# 生成密码哈希
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('你的管理员密码', 10).then(h => console.log(h));
"
```

然后通过 MySQL 插入管理员账号：

```bash
docker exec -it yincai-mysql mysql -u yincai -p yincai_order
```

```sql
INSERT INTO users (openId, name, username, passwordHash, role, isActive, loginMethod, lastSignedIn, createdAt, updatedAt)
VALUES (
  'local:1',
  '管理员',
  'admin',
  '上面生成的哈希值',
  'admin',
  1,
  'password',
  NOW(), NOW(), NOW()
);
```

---

## 6. 代码更新流程

每次在 Manus 上开发完成后，通过以下流程更新 NAS 上的代码：

### Manus → GitHub → NAS 三步更新

**第一步：在 Manus 中导出到 GitHub**

在 Manus 管理界面点击 **Settings → GitHub**，将代码推送到你的 GitHub 仓库。

**第二步：在 NAS 上拉取最新代码**

```bash
ssh admin@你的NAS的IP地址
cd /volume1/docker/yincai-order/yincai-order
git pull origin main
```

**第三步：重新构建并重启服务**

```bash
cd /volume1/docker/yincai-order
docker-compose build app
docker-compose up -d app
```

> **数据安全**：MySQL 数据存储在 `./mysql-data/` 目录中，重新构建应用不会影响数据库数据。

---

## 7. MinIO 存储说明

当前 `server/storage.ts` 已内置双模式自动切换：

- **NAS 部署**：当 `.env` 中配置了 `MINIO_ENDPOINT` + `MINIO_BUCKET` + 凭据时，自动使用 MinIO S3 兼容存储
- **Manus 云端**：未配置 MinIO 时，回退使用 Manus 内置存储代理

**无需手动修改 `storage.ts`**，只需在 `.env` 中正确配置以下变量即可：

| 变量 | 说明 |
|------|------|
| `MINIO_ROOT_USER` | MinIO 用户名（与 MinIO 容器一致） |
| `MINIO_ROOT_PASSWORD` | MinIO 密码（与 MinIO 容器一致，至少 8 位） |
| `MINIO_ENDPOINT` | MinIO API 地址（Docker 内部：`http://minio:9000`） |
| `MINIO_BUCKET` | 存储桶名称（默认 `yincai-docs`） |
| `MINIO_PUBLIC_ENDPOINT` | 浏览器可访问的外部地址（如 `http://192.168.2.97:9000`） |

> **重要**：`MINIO_PUBLIC_ENDPOINT` 必须设置为 NAS 局域网 IP，否则图片上传后浏览器无法显示（因为 Docker 内部地址 `http://minio:9000` 浏览器无法访问）。
>
> **简化配置**：系统直接使用 `MINIO_ROOT_USER` 和 `MINIO_ROOT_PASSWORD` 连接 MinIO，无需在 MinIO 控制台中额外创建 Access Key。

---

## 8. 常见问题

### Q: PDF 生成失败，提示找不到 Chromium

**原因**：Docker 镜像中 Chromium 路径不同。

**解决**：在 `.env` 中设置正确路径：
```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```
或在 Dockerfile 中确认 `chromium` 的安装路径：
```bash
docker exec -it yincai-app which chromium
```

### Q: 数据库连接失败

**检查步骤**：
1. 确认 MySQL 容器已启动：`docker-compose ps`
2. 检查 `DATABASE_URL` 中的密码是否与 `MYSQL_PASSWORD` 一致
3. 查看 MySQL 日志：`docker-compose logs mysql`

### Q: 上传图片后无法显示

**原因**：MinIO 存储桶未设置为公共读取。

**解决**：在 MinIO 控制台将 `yincai-docs` 存储桶的访问策略设置为 `public`。

### Q: 如何备份数据库

```bash
# 备份
docker exec yincai-mysql mysqldump -u yincai -p yincai_order > backup_$(date +%Y%m%d).sql

# 恢复
docker exec -i yincai-mysql mysql -u yincai -p yincai_order < backup_20260101.sql
```

### Q: 如何查看应用日志

```bash
docker-compose logs -f app      # 实时查看应用日志
docker-compose logs -f mysql    # 查看数据库日志
docker-compose logs -f minio    # 查看 MinIO 日志
```

### Q: 群晖 NAS 如何配置反向代理（HTTPS）

在群晖 DSM 中：**控制面板 → 登录门户 → 高级 → 反向代理**，添加规则将 HTTPS 请求转发到 `localhost:3000`。

---

## 附录：快速命令参考

| 操作 | 命令 |
|------|------|
| 启动所有服务 | `docker-compose up -d` |
| 停止所有服务 | `docker-compose down` |
| 重启应用 | `docker-compose restart app` |
| 查看运行状态 | `docker-compose ps` |
| 进入应用容器 | `docker exec -it yincai-app sh` |
| 进入数据库 | `docker exec -it yincai-mysql mysql -u yincai -p yincai_order` |
| 更新代码并重启 | `git pull && docker-compose build app && docker-compose up -d app` |
| 备份数据库 | `docker exec yincai-mysql mysqldump -u yincai -p yincai_order > backup.sql` |
