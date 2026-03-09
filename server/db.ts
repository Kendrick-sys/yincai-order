import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser, users,
  orders, orderModels, InsertOrder, InsertOrderModel,
  customers, InsertCustomer,
  documentDrafts,
  yifengCostItems, InsertYifengCostItem, YifengCostItem,
  costSnapshots, InsertCostSnapshot, CostSnapshot,
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

/** 根据 ID 获取客户 */
export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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

/** 批量转移客户归属（离职业务员客户转移）。toUserId=null 表示设为公共 */
export async function transferCustomers(fromUserId: number, toUserId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers)
    .set({ createdBy: toUserId })
    .where(eq(customers.createdBy, fromUserId));
}

/** 批量转移订单归属（离职业务员订单转移）。toUserId=null 表示设为公共 */
export async function transferOrders(fromUserId: number, toUserId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders)
    .set({ createdBy: toUserId })
    .where(eq(orders.createdBy, fromUserId));
}

/** 获取客户列表（含订单统计：数量 + 最近下单日期 + 创建者信息） */
export async function listCustomersWithStats(userId?: number) {
  const db = await getDb();
  if (!db) return [];

  // alias users 表为 creatorUser 避免与主表冲突
  const creatorUser = users;

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
      // 创建者信息（用 MAX 聚合避免 ONLY_FULL_GROUP_BY 限制）
      creatorName: sql<string | null>`MAX(${creatorUser.displayName})`,
      creatorIsActive: sql<boolean | null>`MAX(CAST(${creatorUser.isActive} AS UNSIGNED))`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customer, customers.name))
    .leftJoin(creatorUser, eq(customers.createdBy, creatorUser.id))
    .where(userId !== undefined ? eq(customers.createdBy, userId) : undefined)
    .groupBy(customers.id)
    .orderBy(customers.sortOrder, customers.createdAt);

  return query;
}

// ─── 订单相关 ─────────────────────────────────────────────────────────────────

//** 获取正常订单列表（未删除），含创建者姓名和停用状态 */
export async function listOrders(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = userId !== undefined
    ? and(isNull(orders.deletedAt), eq(orders.createdBy, userId))
    : isNull(orders.deletedAt);
  return db
    .select({
      // 所有 orders 字段
      id: orders.id,
      orderNo: orders.orderNo,
      orderDescription: orders.orderDescription,
      customer: orders.customer,
      maker: orders.maker,
      salesperson: orders.salesperson,
      orderDate: orders.orderDate,
      deliveryDate: orders.deliveryDate,
      remarks: orders.remarks,
      isNewCustomer: orders.isNewCustomer,
      customerType: orders.customerType,
      customsDeclared: orders.customsDeclared,
      isAlibaba: orders.isAlibaba,
      alibabaOrderNo: orders.alibabaOrderNo,
      is1688: orders.is1688,
      alibaba1688OrderNo: orders.alibaba1688OrderNo,
      isAmazon: orders.isAmazon,
      amazonOrderNo: orders.amazonOrderNo,
      recipientName: orders.recipientName,
      recipientPhone: orders.recipientPhone,
      recipientAddress: orders.recipientAddress,
      factoryShipNo: orders.factoryShipNo,
      status: orders.status,
      purchaseContractStatus: orders.purchaseContractStatus,
      deletedAt: orders.deletedAt,
      createdBy: orders.createdBy,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      // 创建者信息
      creatorName: users.displayName,
      creatorIsActive: users.isActive,
    })
    .from(orders)
    .leftJoin(users, eq(orders.createdBy, users.id))
    .where(condition)
    .orderBy(desc(orders.createdAt));
}
/** 获取回收站订单列表（已软删除），含创建者姓名和停用状态 */
export async function listTrashedOrders(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const condition = userId !== undefined
    ? and(isNotNull(orders.deletedAt), eq(orders.createdBy, userId))
    : isNotNull(orders.deletedAt);
  return db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      orderDescription: orders.orderDescription,
      customer: orders.customer,
      maker: orders.maker,
      salesperson: orders.salesperson,
      orderDate: orders.orderDate,
      deliveryDate: orders.deliveryDate,
      remarks: orders.remarks,
      isNewCustomer: orders.isNewCustomer,
      customerType: orders.customerType,
      customsDeclared: orders.customsDeclared,
      isAlibaba: orders.isAlibaba,
      alibabaOrderNo: orders.alibabaOrderNo,
      is1688: orders.is1688,
      alibaba1688OrderNo: orders.alibaba1688OrderNo,
      isAmazon: orders.isAmazon,
      amazonOrderNo: orders.amazonOrderNo,
      recipientName: orders.recipientName,
      recipientPhone: orders.recipientPhone,
      recipientAddress: orders.recipientAddress,
      factoryShipNo: orders.factoryShipNo,
      status: orders.status,
      purchaseContractStatus: orders.purchaseContractStatus,
      deletedAt: orders.deletedAt,
      createdBy: orders.createdBy,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      creatorName: users.displayName,
      creatorIsActive: users.isActive,
    })
    .from(orders)
    .leftJoin(users, eq(orders.createdBy, users.id))
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

/** 更新订单（含型号，先删后插，使用事务确保一致性） */
export async function updateOrder(
  id: number,
  orderData: Partial<Omit<InsertOrder, 'id' | 'createdAt' | 'updatedAt'>>,
  modelsData?: Omit<InsertOrderModel, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.update(orders).set(orderData).where(eq(orders.id, id));
    if (modelsData !== undefined) {
      await tx.delete(orderModels).where(eq(orderModels.orderId, id));
      if (modelsData.length > 0) {
        await tx.insert(orderModels).values(
          modelsData.map((m, i) => ({ ...m, orderId: id, sortOrder: i }))
        );
      }
    }
  });
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

/** 彻底删除订单（含型号，不可恢复，使用事务确保一致性） */
export async function hardDeleteOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.delete(orderModels).where(eq(orderModels.orderId, id));
    await tx.delete(orders).where(eq(orders.id, id));
  });
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

export async function updatePurchaseContractStatus(
  id: number,
  status: "unsigned" | "signed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ purchaseContractStatus: status }).where(eq(orders.id, id));
}

// ─── 单据草稿（跨设备共享） ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** 获取单据草稿 */
export async function getDocumentDraft(orderId: number, draftType: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(documentDrafts)
    .where(and(eq(documentDrafts.orderId, orderId), eq(documentDrafts.draftType, draftType)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/** 保存单据草稿（upsert） */
export async function upsertDocumentDraft(orderId: number, draftType: string, data: string, updatedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getDocumentDraft(orderId, draftType);
  if (existing) {
    await db.update(documentDrafts)
      .set({ data, updatedBy: updatedBy ?? null })
      .where(and(eq(documentDrafts.orderId, orderId), eq(documentDrafts.draftType, draftType)));
  } else {
    await db.insert(documentDrafts).values({ orderId, draftType, data, updatedBy: updatedBy ?? null });
  }
}

/** 删除单据草稿 */
export async function deleteDocumentDraft(orderId: number, draftType: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documentDrafts)
    .where(and(eq(documentDrafts.orderId, orderId), eq(documentDrafts.draftType, draftType)));
}

// ─── 亿丰成本表 CRUD ───────────────────────────────────────────────────────────

/** 查询所有亿丰成本条目（按 sortOrder 升序） */
export async function listYifengCostItems(): Promise<YifengCostItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(yifengCostItems).orderBy(yifengCostItems.sortOrder, yifengCostItems.id);
}

/** 创建单条成本条目 */
export async function createYifengCostItem(data: InsertYifengCostItem): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(yifengCostItems).values(data);
  return (result as any).insertId as number;
}

/** 更新单条成本条目 */
export async function updateYifengCostItem(id: number, data: Partial<InsertYifengCostItem>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(yifengCostItems).set(data).where(eq(yifengCostItems.id, id));
}

/** 删除单条成本条目 */
export async function deleteYifengCostItem(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(yifengCostItems).where(eq(yifengCostItems.id, id));
}

/** 批量替换成本表（先清空再插入，用于 Excel 导入） */
export async function replaceAllYifengCostItems(items: InsertYifengCostItem[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 使用原生 mysql2 连接执行 TRUNCATE TABLE，绕过 drizzle sql 模板参数限制
  // TRUNCATE 不受 sql_safe_updates 模式影响（NAS MySQL 兼容）
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    await conn.execute('TRUNCATE TABLE yifeng_cost_items');
  } finally {
    await conn.end();
  }
  if (items.length > 0) {
    // 分批插入，每批 50 条
    for (let i = 0; i < items.length; i += 50) {
      await db.insert(yifengCostItems).values(items.slice(i, i + 50));
    }
  }
}

// ─── 成本表版本快照 ──────────────────────────────────────────────────────────────

/** 获取快照列表（不含 data 字段，减少传输量） */
export async function listCostSnapshots(): Promise<Omit<CostSnapshot, 'data'>[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: costSnapshots.id,
    snapshotName: costSnapshots.snapshotName,
    createdBy: costSnapshots.createdBy,
    createdByName: costSnapshots.createdByName,
    itemCount: costSnapshots.itemCount,
    createdAt: costSnapshots.createdAt,
  }).from(costSnapshots).orderBy(desc(costSnapshots.createdAt)).limit(50);
}

/** 获取单个快照详情（含 data） */
export async function getCostSnapshotById(id: number): Promise<CostSnapshot | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(costSnapshots).where(eq(costSnapshots.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 创建快照 */
export async function createCostSnapshot(data: Omit<InsertCostSnapshot, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(costSnapshots).values(data).$returningId();
  return result.id;
}

/** 回滚到指定快照（替换全部成本表数据） */
export async function rollbackCostSnapshot(items: InsertYifengCostItem[]): Promise<void> {
  return replaceAllYifengCostItems(items);
}
