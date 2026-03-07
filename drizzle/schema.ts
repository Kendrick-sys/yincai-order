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

// ─── 销售订单主表（一张订单对应多个型号） ──────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),

  // 订单基本信息（全局，所有型号共用）
  orderNo:          varchar("orderNo", { length: 100 }),        // 金蝶订单号
  orderDescription: text("orderDescription"),                   // 订单描述
  customer:         varchar("customer", { length: 128 }),       // 客户名称
  maker:            varchar("maker", { length: 64 }),           // 制单员
  salesperson:      varchar("salesperson", { length: 64 }),     // 销售员
  orderDate:        varchar("orderDate", { length: 20 }),       // 下单日期
  deliveryDate:     varchar("deliveryDate", { length: 20 }),    // 预计交货日期
  remarks:          text("remarks"),                            // 备注

  // 状态：草稿/已提交/生产中/已完成/已取消
  status: mysqlEnum("status", ["draft", "submitted", "in_production", "completed", "cancelled"])
    .default("draft")
    .notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── 型号明细表（每个型号一行，关联到订单） ────────────────────────────────────
export const orderModels = mysqlTable("orderModels", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),                            // 关联订单 ID

  sortOrder: int("sortOrder").default(0).notNull(),             // 排序序号

  // 基本信息
  modelName:  varchar("modelName", { length: 128 }),            // 型号名称
  modelCode:  varchar("modelCode", { length: 64 }),             // 型号编码
  quantity:   varchar("quantity", { length: 64 }),              // 数量

  // 一、箱体描述（始终显示）
  topCover:     text("topCover"),                               // 上盖材质
  bottomCover:  text("bottomCover"),                            // 下盖材质
  accessories:  text("accessories"),                            // 配件

  // 二、贴纸描述
  needSticker:    boolean("needSticker").default(true).notNull(),
  stickerSource:  varchar("stickerSource", { length: 64 }),     // 贴纸来源
  stickerDesc:    text("stickerDesc"),                          // 贴纸描述

  // 三、丝印描述（仅吟彩版）
  needSilkPrint:  boolean("needSilkPrint").default(true).notNull(),
  silkPrintDesc:  text("silkPrintDesc"),                        // 丝印描述

  // 四、内衬描述
  needLiner:      boolean("needLiner").default(true).notNull(),
  topLiner:       text("topLiner"),                             // 上盖内衬
  bottomLiner:    text("bottomLiner"),                          // 下盖内衬

  // 五、纸箱描述
  needCarton:     boolean("needCarton").default(true).notNull(),
  innerBox:       text("innerBox"),                             // 内箱规格
  outerBox:       text("outerBox"),                             // 外箱规格

  // 型号备注
  modelRemarks:   text("modelRemarks"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderModel = typeof orderModels.$inferSelect;
export type InsertOrderModel = typeof orderModels.$inferInsert;
