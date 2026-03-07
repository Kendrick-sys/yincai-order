import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  createOrder, updateOrder, listOrders, getOrderById,
  softDeleteOrder, restoreOrder, hardDeleteOrder, listTrashedOrders,
  updateOrderStatus,
  listCustomers, listCustomersWithStats, createCustomer, updateCustomer, deleteCustomer,
} from "./db";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const modelSchema = z.object({
  modelName:       z.string().optional(),
  modelCode:       z.string().optional(),
  quantity:        z.string().optional(),
  // 箱体
  topCover:        z.string().optional(),
  bottomCover:     z.string().optional(),
  accessories:     z.string().optional(),
  // 贴纸
  needSticker:     z.boolean().default(true),
  stickerSource:   z.string().optional(),
  stickerDesc:     z.string().optional(),
  stickerImages:   z.string().optional(),   // JSON 数组字符串
  // 丝印
  needSilkPrint:   z.boolean().default(true),
  silkPrintDesc:   z.string().optional(),
  silkPrintImages: z.string().optional(),   // JSON 数组字符串
  // 内衬
  needLiner:       z.boolean().default(true),
  topLiner:        z.string().optional(),
  bottomLiner:     z.string().optional(),
  linerImages:     z.string().optional(),   // JSON 数组字符串
  // 纸箱
  needCarton:      z.boolean().default(true),
  innerBox:        z.string().optional(),
  outerBox:        z.string().optional(),
  // 备注
  modelRemarks:    z.string().optional(),
});

const orderHeaderSchema = z.object({
  orderNo:          z.string().optional(),
  orderDescription: z.string().optional(),
  customer:         z.string().optional(),
  maker:            z.string().optional(),
  salesperson:      z.string().optional(),
  orderDate:        z.string().optional(),
  deliveryDate:     z.string().optional(),
  remarks:          z.string().optional(),
  // 新老客户
  isNewCustomer:    z.boolean().optional(),
  // 收件人信息
  recipientName:    z.string().optional(),
  recipientPhone:   z.string().optional(),
  recipientAddress: z.string().optional(),
  factoryShipNo:    z.string().optional(),
  status:           z.enum(["draft", "submitted", "in_production", "completed", "cancelled"]).optional(),
});

const customerSchema = z.object({
  name:      z.string().min(1, "客户名称不能为空"),
  code:      z.string().optional(),      // 客户地址（兼容旧字段）
  address:   z.string().optional(),      // 客户地址（新字段）
  country:   z.enum(["domestic", "overseas"]).default("domestic"),  // 国内/国外
  email:     z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  contact:   z.string().min(1, "联系人不能为空"),
  phone:     z.string().min(1, "联系电话不能为空"),
  remarks:   z.string().optional(),
  sortOrder: z.number().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── 客户管理 ───────────────────────────────────────────────────────────────
  customers: router({
    list: publicProcedure.query(async () => listCustomersWithStats()),

    create: publicProcedure
      .input(customerSchema)
      .mutation(async ({ input }) => {
        const id = await createCustomer(input);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: customerSchema.partial() }))
      .mutation(async ({ input }) => {
        await updateCustomer(input.id, input.data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomer(input.id);
        return { success: true };
      }),
  }),

  // ─── 订单管理 ───────────────────────────────────────────────────────────────
  orders: router({
    // 正常订单列表
    list: publicProcedure.query(async () => listOrders()),

    // 回收站列表
    listTrashed: publicProcedure.query(async () => listTrashedOrders()),

    // 获取单个订单
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getOrderById(input.id)),

    // 创建订单
    create: publicProcedure
      .input(z.object({ order: orderHeaderSchema, models: z.array(modelSchema) }))
      .mutation(async ({ input }) => {
        const id = await createOrder(
          { ...input.order, status: input.order.status ?? "draft" },
          input.models
        );
        return { id };
      }),

    // 更新订单
    update: publicProcedure
      .input(z.object({ id: z.number(), order: orderHeaderSchema, models: z.array(modelSchema) }))
      .mutation(async ({ input }) => {
        await updateOrder(input.id, input.order, input.models);
        return { success: true };
      }),

    // 仅更新状态
    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "submitted", "in_production", "completed", "cancelled"]),
      }))
      .mutation(async ({ input }) => {
        await updateOrderStatus(input.id, input.status);
        return { success: true };
      }),

    // 软删除（移入回收站）
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await softDeleteOrder(input.id);
        return { success: true };
      }),

    // 从回收站恢复
    restore: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await restoreOrder(input.id);
        return { success: true };
      }),

    // 彻底删除（不可恢复）
    hardDelete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await hardDeleteOrder(input.id);
        return { success: true };
      }),

    // 复制订单
    duplicate: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const original = await getOrderById(input.id);
        if (!original) throw new Error("订单不存在");
        const today = new Date().toISOString().slice(0, 10);
        const newId = await createOrder(
          {
            orderNo: undefined,
            orderDescription: original.orderDescription ? `${original.orderDescription}（复制）` : "（复制）",
            customer: original.customer ?? undefined,
            maker: original.maker ?? undefined,
            salesperson: original.salesperson ?? undefined,
            orderDate: today,
            deliveryDate: original.deliveryDate ?? undefined,
            remarks: original.remarks ?? undefined,
            status: "draft",
          },
          (original.models ?? []).map((m: any) => ({
            modelName:       m.modelName ?? undefined,
            modelCode:       m.modelCode ?? undefined,
            quantity:        m.quantity ?? undefined,
            topCover:        m.topCover ?? undefined,
            bottomCover:     m.bottomCover ?? undefined,
            accessories:     m.accessories ?? undefined,
            needSticker:     m.needSticker ?? true,
            stickerSource:   m.stickerSource ?? undefined,
            stickerDesc:     m.stickerDesc ?? undefined,
            stickerImages:   m.stickerImages ?? undefined,
            needSilkPrint:   m.needSilkPrint ?? true,
            silkPrintDesc:   m.silkPrintDesc ?? undefined,
            silkPrintImages: m.silkPrintImages ?? undefined,
            needLiner:       m.needLiner ?? true,
            topLiner:        m.topLiner ?? undefined,
            bottomLiner:     m.bottomLiner ?? undefined,
            linerImages:     m.linerImages ?? undefined,
            needCarton:      m.needCarton ?? true,
            innerBox:        m.innerBox ?? undefined,
            outerBox:        m.outerBox ?? undefined,
            modelRemarks:    m.modelRemarks ?? undefined,
          }))
        );
        return { id: newId };
      }),
  }),
});

export type AppRouter = typeof appRouter;
