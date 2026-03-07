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
  code:     varchar("code", { length: 64 }),                      // 客户地址（沿用旧字段名兼容）
  address:  text("address"),                                      // 客户地址（新字段）
  country:  mysqlEnum("country", ["domestic", "overseas"]).default("domestic").notNull(), // 国家：国内/国外
  email:    varchar("email", { length: 320 }),                    // 邮箱
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

  isNewCustomer: boolean("isNewCustomer").default(false).notNull(), // 新客户/老客户
  customerType:   mysqlEnum("customerType", ["domestic", "overseas"]).default("domestic").notNull(), // 国内/国外
  customsDeclared: boolean("customsDeclared").default(false).notNull(), // 是否报关（国外客户时有效）

  // 阿里巴巴订单
  isAlibaba:       boolean("isAlibaba").default(false).notNull(),       // 是否为阿里巴巴订单
  alibabaOrderNo:  varchar("alibabaOrderNo", { length: 128 }),          // 阿里巴巴订单号

  // 1688订单
  is1688:          boolean("is1688").default(false).notNull(),           // 是否为1688订单
  alibaba1688OrderNo: varchar("alibaba1688OrderNo", { length: 128 }),   // 1688订单号

  // 亚马逊订单
  isAmazon:        boolean("isAmazon").default(false).notNull(),         // 是否为亚马逊订单
  amazonOrderNo:   varchar("amazonOrderNo", { length: 128 }),            // 亚马逊订单号

  // 收件人信息
  recipientName:    varchar("recipientName", { length: 64 }),       // 收件人姓名
  recipientPhone:   varchar("recipientPhone", { length: 32 }),      // 收件人电话
  recipientAddress: text("recipientAddress"),                       // 收件地址
  factoryShipNo:    varchar("factoryShipNo", { length: 100 }),      // 工厂发货单号

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

// ─── 单据表（合同/PI/CI）────────────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),                                 // 关联订单ID

  docType: mysqlEnum("docType", ["contract_cn", "pi", "ci"]).notNull(), // 单据类型
  docNo:   varchar("docNo", { length: 64 }).notNull(),              // 单据编号（自动生成）

  // 乙方/买方信息（供货单位/客户）
  counterpartyName:    varchar("counterpartyName", { length: 256 }), // 供货单位/客户名称
  counterpartyAddress: text("counterpartyAddress"),                  // 地址

  // 产品明细（JSON数组）
  // 格式：[{ modelName, material, spec, quantity, unitPrice, amount }]
  lineItems: text("lineItems").notNull(),

  // 金额
  totalAmount:    varchar("totalAmount", { length: 64 }),            // 总金额（字符串保留精度）
  currency:       varchar("currency", { length: 8 }).default("CNY").notNull(), // CNY / USD / EUR
  depositPct:     int("depositPct").default(30),                     // 定金比例（%）
  balancePct:     int("balancePct").default(70),                     // 尾款比例（%）

  // PI/CI 专属字段
  incoterms:      varchar("incoterms", { length: 32 }),              // FOB / CIF / EXW
  portOfLoading:  varchar("portOfLoading", { length: 128 }),         // 装运港
  bankChoice:     mysqlEnum("bankChoice", ["icbc", "citi"]),         // 银行选择

  // CI 专属字段
  piDocId:        int("piDocId"),                                    // 关联的PI单据ID

  // 存储
  pdfUrl:         text("pdfUrl"),                                    // 生成的PDF下载URL
  pdfKey:         varchar("pdfKey", { length: 512 }),                // S3 key

  // 状态
  status: mysqlEnum("status", ["active", "voided"]).default("active").notNull(), // active=有效, voided=已作废

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── 系统设置表 ────────────────────────────────────────────────────────────────
export const settings = mysqlTable("settings", {
  id:    int("id").autoincrement().primaryKey(),
  key:   varchar("key", { length: 128 }).notNull().unique(),  // 设置键名
  value: text("value").notNull(),                             // 设置值（JSON字符串）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
