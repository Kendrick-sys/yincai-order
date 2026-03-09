# 吟彩销售订单系统 - NAS 部署指南

## 目录结构（NAS 上）

```
/volume1/docker/yincai-order/
├── yincai-order/          ← git clone 的代码（含 Dockerfile）
├── docker-compose.yml     ← 从代码中复制过来
├── .env                   ← 根据 env.template 填写
├── mysql-data/            ← MySQL 数据（自动创建）
└── minio-data/            ← MinIO 数据（自动创建）
```

---

## 部署步骤

### 第一步：克隆代码

```bash
cd /volume1/docker/yincai-order
git clone https://github.com/你的账号/yincai-order.git
```

### 第二步：复制配置文件

```bash
# 复制 docker-compose.yml 到部署目录
cp yincai-order/docker-compose.yml ./docker-compose.yml

# 复制 env 模板并编辑
cp yincai-order/nas-deploy/env.template ./.env
vi .env
```

### 第三步：编辑 .env

必须修改的字段：

| 字段 | 说明 |
|------|------|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码（自定义） |
| `MYSQL_PASSWORD` | MySQL 应用账号密码（自定义） |
| `JWT_SECRET` | 运行 `openssl rand -hex 32` 生成 |
| `MINIO_ROOT_PASSWORD` | MinIO 管理密码（自定义） |
| `MINIO_PUBLIC_ENDPOINT` | 改为你的 NAS IP，如 `http://192.168.2.97:9000` |

### 第四步：启动服务

```bash
cd /volume1/docker/yincai-order

# 首次启动（构建镜像约需 5-10 分钟）
docker-compose up -d

# 查看启动日志
docker-compose logs -f app
```

### 第五步：配置 MinIO 存储桶

1. 访问 `http://192.168.2.97:9001`（MinIO 控制台）
2. 用 `.env` 中的 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` 登录
3. 创建存储桶，名称填 `yincai-files`
4. 将存储桶 Access Policy 设为 **Public**
5. 重启应用：`docker-compose restart app`

### 第六步：创建管理员账号

```bash
# 生成密码哈希（将 YOUR_PASSWORD 替换为实际密码）
docker exec -it yincai-app node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('YOUR_PASSWORD', 10).then(h => console.log(h));
"

# 将上一步输出的哈希值填入下面的 HASH_VALUE
docker exec -it yincai-mysql mysql -u yincai -p yincai_order -e "
INSERT INTO users (openId, name, username, passwordHash, role, isActive, loginMethod, lastSignedIn, createdAt, updatedAt)
VALUES ('local:1', '管理员', 'admin', 'HASH_VALUE', 'admin', 1, 'password', NOW(), NOW(), NOW());
"
```

### 第七步：访问系统

浏览器打开 `http://192.168.2.97:3000`，用 `admin` 账号登录。

---

## 日常更新流程

每次 Manus 开发完成后，在 NAS SSH 中执行：

```bash
cd /volume1/docker/yincai-order/yincai-order
git pull

cd /volume1/docker/yincai-order
docker-compose build app
docker-compose up -d app
```

MySQL 数据存储在 `./mysql-data/`，重新构建不影响数据。

---

## 常见问题

**浏览器空白页**：检查 `docker-compose logs app` 是否有构建错误。

**图片不显示**：确认 `.env` 中 `MINIO_PUBLIC_ENDPOINT` 填的是 NAS 的 IP（不是 `minio:9000`）。

**数据库连接失败**：等待 MySQL 容器完全启动（约 30 秒），再运行 `docker-compose restart app`。

**PDF 生成失败**：确认 Dockerfile 中 Chromium 安装成功，运行 `docker exec yincai-app chromium --version` 验证。
