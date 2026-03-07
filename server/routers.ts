import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  createOrder,
  updateOrder,
  listOrders,
  getOrderById,
  deleteOrder,
  updateOrderStatus,
} from "./db";

// 型号明细的 schema
const modelSchema = z.object({
  modelName:     z.string().optional(),
  modelCode:     z.string().optional(),
  quantity:      z.string().optional(),
  // 箱体
  topCover:      z.string().optional(),
  bottomCover:   z.string().optional(),
  accessories:   z.string().optional(),
  // 贴纸
  needSticker:   z.boolean().default(true),
  stickerSource: z.string().optional(),
  stickerDesc:   z.string().optional(),
  // 丝印
  needSilkPrint: z.boolean().default(true),
  silkPrintDesc: z.string().optional(),
  // 内衬
  needLiner:     z.boolean().default(true),
  topLiner:      z.string().optional(),
  bottomLiner:   z.string().optional(),
  // 纸箱
  needCarton:    z.boolean().default(true),
  innerBox:      z.string().optional(),
  outerBox:      z.string().optional(),
  // 备注
  modelRemarks:  z.string().optional(),
});

// 订单主表的 schema
const orderHeaderSchema = z.object({
  orderNo:          z.string().optional(),
  orderDescription: z.string().optional(),
  customer:         z.string().optional(),
  maker:            z.string().optional(),
  salesperson:      z.string().optional(),
  orderDate:        z.string().optional(),
  deliveryDate:     z.string().optional(),
  remarks:          z.string().optional(),
  status:           z.enum(["draft", "submitted", "in_production", "completed", "cancelled"]).optional(),
});

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

  orders: router({
    // 获取所有订单列表
    list: publicProcedure.query(async () => listOrders()),

    // 获取单个订单（含型号）
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getOrderById(input.id)),

    // 创建订单（含型号）
    create: publicProcedure
      .input(z.object({
        order: orderHeaderSchema,
        models: z.array(modelSchema),
      }))
      .mutation(async ({ input }) => {
        const id = await createOrder(
          { ...input.order, status: input.order.status ?? "draft" },
          input.models
        );
        return { id };
      }),

    // 更新订单（含型号）
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        order: orderHeaderSchema,
        models: z.array(modelSchema),
      }))
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

    // 删除订单
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteOrder(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
