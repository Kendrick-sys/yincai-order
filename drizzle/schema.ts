import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── 客户表 ────────────────────────────────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name:     varchar("name", { length: 128 }).notNull(),           // 客户名称
  code:     varchar("code", { length: 64 }),                      // 客户编码（可选）
  contact:  varchar("contact", { length: 64 }),                   // 联系人
  phone:    varchar("phone", { length: 32 }),                     // 联系电话
  remarks:  text("remarks"),                                      // 备注
  sortOrder: int("sortOrder").default(0).notNull(),               // 排序
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── 销售订单主表 ───────────────────────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),

  orderNo:          varchar("orderNo", { length: 100 }),          // 订单号
  orderDescription: text("orderDescription"),                     // 订单描述
  customer:         varchar("customer", { length: 128 }),         // 客户名称
  maker:            varchar("maker", { length: 64 }),             // 制单员
  salesperson:      varchar("salesperson", { length: 64 }),       // 销售员
  orderDate:        varchar("orderDate", { length: 20 }),         // 下单日期
  deliveryDate:     varchar("deliveryDate", { length: 20 }),      // 预计交货日期
  remarks:          text("remarks"),                              // 备注

  status: mysqlEnum("status", ["draft", "submitted", "in_production", "completed", "cancelled"])
    .default("draft")
    .notNull(),

  // 软删除：deletedAt 不为 null 表示已删除（进入回收站）
  deletedAt: timestamp("deletedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── 型号明细表 ─────────────────────────────────────────────────────────────────
export const orderModels = mysqlTable("orderModels", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),

  sortOrder: int("sortOrder").default(0).notNull(),

  modelName:  varchar("modelName", { length: 128 }),
  modelCode:  varchar("modelCode", { length: 64 }),
  quantity:   varchar("quantity", { length: 64 }),

  // 一、箱体描述
  topCover:     text("topCover"),
  bottomCover:  text("bottomCover"),
  accessories:  text("accessories"),

  // 二、贴纸描述
  needSticker:    boolean("needSticker").default(true).notNull(),
  stickerSource:  varchar("stickerSource", { length: 64 }),
  stickerDesc:    text("stickerDesc"),
  stickerImages:  text("stickerImages"),   // JSON 数组，存贴纸图片 URL 列表

  // 三、丝印描述
  needSilkPrint:  boolean("needSilkPrint").default(true).notNull(),
  silkPrintDesc:  text("silkPrintDesc"),
  silkPrintImages: text("silkPrintImages"), // JSON 数组，存丝印图片 URL 列表

  // 四、内衬描述
  needLiner:      boolean("needLiner").default(true).notNull(),
  topLiner:       text("topLiner"),
  bottomLiner:    text("bottomLiner"),
  linerImages:    text("linerImages"),     // JSON 数组，存内衬CAD图片 URL 列表

  // 五、纸箱描述
  needCarton:     boolean("needCarton").default(true).notNull(),
  innerBox:       text("innerBox"),
  outerBox:       text("outerBox"),

  modelRemarks:   text("modelRemarks"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderModel = typeof orderModels.$inferSelect;
export type InsertOrderModel = typeof orderModels.$inferInsert;
