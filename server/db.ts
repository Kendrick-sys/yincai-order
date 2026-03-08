import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  orders, orderModels, InsertOrder, InsertOrderModel,
  customers, InsertCustomer,
} from "../drizzle/schema";
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── 客户相关 ─────────────────────────────────────────────────────────────────

/** 获取所有客户（按 sortOrder 排序） */
export async function listCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customers).orderBy(customers.sortOrder, customers.createdAt);
}

/** 创建客户 */
export async function createCustomer(data: Omit<InsertCustomer, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(customers).values(data).$returningId();
  return result.id;
}

/** 更新客户 */
export async function updateCustomer(id: number, data: Partial<Omit<InsertCustomer, 'id' | 'createdAt' | 'updatedAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

/** 删除客户 */
export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customers).where(eq(customers.id, id));
}

/** 获取客户列表（含订单统计：数量 + 最近下单日期） */
export async function listCustomersWithStats(userId?: number) {
  const db = await getDb();
  if (!db) return [];

  // 左连接 orders 表，按客户名称分组统计
  const query = db
    .select({
      id: customers.id,
      name: customers.name,
      country: customers.country,
      address: customers.address,
      code: customers.code,
      company: customers.company,
      attn: customers.attn,
      enAddress: customers.enAddress,
      contact: customers.contact,
      phone: customers.phone,
      email: customers.email,
      cnCompany: customers.cnCompany,
      taxNo: customers.taxNo,
      bankAccount: customers.bankAccount,
      bankName: customers.bankName,
      remarks: customers.remarks,
      sortOrder: customers.sortOrder,
      createdAt: customers.createdAt,
      createdBy: customers.createdBy,
      orderCount: sql<number>`COUNT(CASE WHEN ${orders.deletedAt} IS NULL THEN 1 END)`,
      lastOrderDate: sql<string | null>`MAX(CASE WHEN ${orders.deletedAt} IS NULL THEN ${orders.orderDate} END)`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customer, customers.name))
    .where(userId !== undefined ? eq(customers.createdBy, userId) : undefined)
    .groupBy(customers.id)
    .orderBy(customers.sortOrder, customers.createdAt);

  return query;
}

// ─── 订单相关 ─────────────────────────────────────────────────────────────────

/** 获取正常订单列表（未删除） */
export async function listOrders(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = userId !== undefined
    ? and(isNull(orders.deletedAt), eq(orders.createdBy, userId))
    : isNull(orders.deletedAt);
  return db.select().from(orders)
    .where(condition)
    .orderBy(desc(orders.createdAt));
}

/** 获取回收站订单列表（已软删除） */
export async function listTrashedOrders(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = userId !== undefined
    ? and(isNotNull(orders.deletedAt), eq(orders.createdBy, userId))
    : isNotNull(orders.deletedAt);
  return db.select().from(orders)
    .where(condition)
    .orderBy(desc(orders.deletedAt));
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

/** 软删除订单（移入回收站） */
export async function softDeleteOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ deletedAt: new Date() }).where(eq(orders.id, id));
}

/** 恢复订单（从回收站还原） */
export async function restoreOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ deletedAt: null }).where(eq(orders.id, id));
}

/** 彻底删除订单（含型号，不可恢复） */
export async function hardDeleteOrder(id: number) {
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
