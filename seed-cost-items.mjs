/**
 * 种子脚本：将 yifengCostTable.ts 中的静态数据写入数据库 yifeng_cost_items 表
 * 运行方式：node seed-cost-items.mjs
 */
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { config } from "dotenv";

config();

// 直接从 TS 文件中提取数据（用正则解析，避免 ts-node 依赖）
const tsContent = readFileSync("./client/src/lib/yifengCostTable.ts", "utf-8");

// 提取所有 { model: "...", material: "...", boxPrice: ..., puPrice: ..., evaPrice: ..., linerMoldFee: ... }
const regex = /\{\s*model:\s*"([^"]+)",\s*material:\s*"([^"]+)",\s*boxPrice:\s*([\d.]+),\s*puPrice:\s*([\d.]+),\s*evaPrice:\s*([\d.]+),\s*linerMoldFee:\s*([\d.]+)\s*\}/g;

const entries = [];
let match;
while ((match = regex.exec(tsContent)) !== null) {
  entries.push({
    model: match[1],
    material: match[2],
    boxPrice: parseFloat(match[3]),
    puPrice: parseFloat(match[4]),
    evaPrice: parseFloat(match[5]),
    linerMoldFee: parseFloat(match[6]),
  });
}

console.log(`解析到 ${entries.length} 条数据`);

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 清空旧数据（若有）
const [existing] = await conn.execute("SELECT COUNT(*) as cnt FROM yifeng_cost_items");
if (existing[0].cnt > 0) {
  console.log(`数据库中已有 ${existing[0].cnt} 条数据，跳过导入（避免重复）`);
  await conn.end();
  process.exit(0);
}

// 批量插入
let inserted = 0;
for (const e of entries) {
  await conn.execute(
    "INSERT INTO yifeng_cost_items (model, material, boxPrice, puPrice, evaPrice, linerMoldFee, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [e.model, e.material, e.boxPrice.toString(), e.puPrice.toString(), e.evaPrice.toString(), e.linerMoldFee.toString(), inserted + 1]
  );
  inserted++;
}

console.log(`✅ 成功插入 ${inserted} 条数据`);
await conn.end();
