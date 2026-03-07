import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, orders, orderModels, InsertOrder, InsertOrderModel } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── 用户相关 ─────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── 订单相关 ─────────────────────────────────────────────────────────────────

/** 获取所有订单列表 */
export async function listOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

/** 获取单个订单详情（含所有型号） */
export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const models = await db.select().from(orderModels)
    .where(eq(orderModels.orderId, id))
    .orderBy(orderModels.sortOrder);
  return { ...order, models };
}

/** 创建订单（含型号） */
export async function createOrder(
  orderData: Omit<InsertOrder, 'id' | 'createdAt' | 'updatedAt'>,
  modelsData: Omit<InsertOrderModel, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(orders).values(orderData).$returningId();
  const orderId = result.id;
  if (modelsData.length > 0) {
    await db.insert(orderModels).values(
      modelsData.map((m, i) => ({ ...m, orderId, sortOrder: i }))
    );
  }
  return orderId;
}

/** 更新订单（含型号，先删后插） */
export async function updateOrder(
  id: number,
  orderData: Partial<Omit<InsertOrder, 'id' | 'createdAt' | 'updatedAt'>>,
  modelsData?: Omit<InsertOrderModel, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set(orderData).where(eq(orders.id, id));
  if (modelsData !== undefined) {
    await db.delete(orderModels).where(eq(orderModels.orderId, id));
    if (modelsData.length > 0) {
      await db.insert(orderModels).values(
        modelsData.map((m, i) => ({ ...m, orderId: id, sortOrder: i }))
      );
    }
  }
}

/** 删除订单（含型号） */
export async function deleteOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderModels).where(eq(orderModels.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
}

/** 更新订单状态 */
export async function updateOrderStatus(
  id: number,
  status: "draft" | "submitted" | "in_production" | "completed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}
