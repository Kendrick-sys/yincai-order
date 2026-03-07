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
import {
  generateDocNo, createDocument, updateDocumentPdf,
  getDocumentsByOrderId, getDocumentById, voidDocument,
  getActivePiByOrderId, getDocPrefixes, saveDocPrefixes,
  incrementDocumentVersion,
} from "./db.documents";
import { generateContractCnPdf, generatePiCiPdf } from "./generatePdf";
import { storagePut } from "./storage";

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
  boxImages:       z.string().optional(),   // JSON 数组字符串
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
  // 国内/国外及报关
  customerType:     z.enum(["domestic", "overseas"]).optional(),
  customsDeclared:  z.boolean().optional(),
  // 阿里巴巴订单
  isAlibaba:        z.boolean().optional(),
  alibabaOrderNo:   z.string().optional(),
  // 1688订单
  is1688:           z.boolean().optional(),
  alibaba1688OrderNo: z.string().optional(),
  // 亚马逊订单
  isAmazon:         z.boolean().optional(),
  amazonOrderNo:    z.string().optional(),
  // 收件人信息
  recipientName:    z.string().optional(),
  recipientPhone:   z.string().optional(),
  recipientAddress: z.string().optional(),
  factoryShipNo:    z.string().optional(),
  status:           z.enum(["draft", "submitted", "in_production", "completed", "cancelled"]).optional(),
}).superRefine((data, ctx) => {
  // 阿里巴巴订单时，订单号必填
  if (data.isAlibaba && !data.alibabaOrderNo?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "阿里巴巴订单号不能为空",
      path: ["alibabaOrderNo"],
    });
  }
  // 1688订单时，订单号必填
  if (data.is1688 && !data.alibaba1688OrderNo?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "1688订单号不能为空",
      path: ["alibaba1688OrderNo"],
    });
  }
  // 亚马逊订单：订单号为可选，无需必填验证
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
}).superRefine((data, ctx) => {
  // 国外客户地址必填
  if (data.country === "overseas" && !data.address?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "国外客户必须填写国家地址",
      path: ["address"],
    });
  }
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

  // ─── 单据管理（合同/PI/CI）──────────────────────────────────────────────────
  documents: router({
    // 获取订单下的所有单据
    listByOrder: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => getDocumentsByOrderId(input.orderId)),

    // 获取单个单据
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getDocumentById(input.id)),

    // 生成国内采购合同
    generateContractCn: publicProcedure
      .input(z.object({
        orderId: z.number(),
        counterpartyName: z.string().min(1, "供货单位不能为空"),
        counterpartyAddress: z.string().optional(),
        lineItems: z.array(z.object({
          modelName: z.string(),
          material: z.string().optional(),
          spec: z.string().optional(),
          quantity: z.number(),
          unitPrice: z.number(),
          amount: z.number(),
        })),
        totalAmount: z.number().min(0.01, "总金额必须大于0"),
        depositPct: z.number().min(1).max(99),
        balancePct: z.number().min(1).max(99),
        orderDate: z.string().optional(),
        deliveryDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const docNo = await generateDocNo("contract_cn");
        const today = new Date().toISOString().slice(0, 10);

        // 生成 PDF
        const pdfBuffer = await generateContractCnPdf({
          docNo,
          orderDate: input.orderDate ?? today,
          deliveryDate: input.deliveryDate ?? "",
          counterpartyName: input.counterpartyName,
          counterpartyAddress: input.counterpartyAddress,
          lineItems: input.lineItems,
          totalAmount: input.totalAmount,
          depositPct: input.depositPct,
          balancePct: input.balancePct,
        });

        // 上传到 S3
        const fileKey = `documents/${docNo}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

        // 保存记录
        await createDocument({
          orderId: input.orderId,
          docType: "contract_cn",
          docNo,
          counterpartyName: input.counterpartyName,
          counterpartyAddress: input.counterpartyAddress,
          lineItems: JSON.stringify(input.lineItems),
          totalAmount: String(input.totalAmount),
          currency: "CNY",
          depositPct: input.depositPct,
          balancePct: input.balancePct,
          pdfUrl: url,
          pdfKey: fileKey,
        });

        return { docNo, pdfUrl: url };
      }),

    // 作废单据
    void: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await voidDocument(input.id);
        return { success: true };
      }),

    // 重新生成单据 PDF（版本号+1）
    regenerate: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const doc = await getDocumentById(input.id);
        if (!doc) throw new Error("单据不存在");
        if (doc.status === "voided") throw new Error("已作废的单据不能重新生成");

        const lineItems = JSON.parse(doc.lineItems ?? "[]");

        let pdfBuffer: Buffer;
        if (doc.docType === "contract_cn") {
          pdfBuffer = await generateContractCnPdf({
            docNo: doc.docNo,
            orderDate: new Date(doc.createdAt).toISOString().slice(0, 10),
            deliveryDate: "",
            counterpartyName: doc.counterpartyName ?? "",
            counterpartyAddress: doc.counterpartyAddress ?? undefined,
            lineItems,
            totalAmount: parseFloat(doc.totalAmount ?? "0"),
            depositPct: doc.depositPct ?? 30,
            balancePct: doc.balancePct ?? 70,
          });
        } else {
          pdfBuffer = await generatePiCiPdf({
            docType: doc.docType as "pi" | "ci",
            docNo: doc.docNo,
            docDate: new Date(doc.createdAt).toISOString().slice(0, 10),
            deliveryDate: "",
            buyerName: doc.counterpartyName ?? "",
            buyerAddress: doc.counterpartyAddress ?? undefined,
            lineItems,
            totalAmount: parseFloat(doc.totalAmount ?? "0"),
            currency: (doc.currency ?? "USD") as "USD" | "EUR",
            depositPct: doc.depositPct ?? 30,
            balancePct: doc.balancePct ?? 70,
            incoterms: doc.incoterms ?? undefined,
            portOfLoading: doc.portOfLoading ?? undefined,
            bankChoice: (doc.bankChoice ?? "icbc") as "icbc" | "citi",
          });
        }

        // 上传新 PDF
        const newVersion = (doc.version ?? 1) + 1;
        const fileKey = `documents/${doc.docNo}-v${newVersion}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

        // 版本号+1
        await incrementDocumentVersion(input.id, url, fileKey);

        return { pdfUrl: url, version: newVersion };
      }),

    // 获取订单下的有效 PI 列表（供 CI 选择）
    getActivePi: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => getActivePiByOrderId(input.orderId)),

    // 生成 PI / CI
    generatePiCi: publicProcedure
      .input(z.object({
        orderId: z.number(),
        docType: z.enum(["pi", "ci"]),
        buyerName: z.string().min(1, "买方名称不能为空"),
        buyerAddress: z.string().optional(),
        lineItems: z.array(z.object({
          modelName: z.string(),
          spec: z.string().optional(),
          quantity: z.number(),
          unitPrice: z.number(),
          amount: z.number(),
        })),
        totalAmount: z.number().min(0.01),
        currency: z.enum(["USD", "EUR"]).default("USD"),
        depositPct: z.number().min(1).max(99),
        balancePct: z.number().min(1).max(99),
        incoterms: z.string().optional(),
        portOfLoading: z.string().optional(),
        bankChoice: z.enum(["icbc", "citi"]).default("icbc"),
        deliveryDate: z.string().optional(),
        piDocId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const docNo = await generateDocNo(input.docType);
        const today = new Date().toISOString().slice(0, 10);

        const pdfBuffer = await generatePiCiPdf({
          docType: input.docType,
          docNo,
          docDate: today,
          deliveryDate: input.deliveryDate ?? "",
          buyerName: input.buyerName,
          buyerAddress: input.buyerAddress,
          lineItems: input.lineItems,
          totalAmount: input.totalAmount,
          currency: input.currency,
          depositPct: input.depositPct,
          balancePct: input.balancePct,
          incoterms: input.incoterms,
          portOfLoading: input.portOfLoading,
          bankChoice: input.bankChoice,
        });

        const fileKey = `documents/${docNo}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

        await createDocument({
          orderId: input.orderId,
          docType: input.docType,
          docNo,
          counterpartyName: input.buyerName,
          counterpartyAddress: input.buyerAddress,
          lineItems: JSON.stringify(input.lineItems),
          totalAmount: String(input.totalAmount),
          currency: input.currency,
          depositPct: input.depositPct,
          balancePct: input.balancePct,
          incoterms: input.incoterms,
          portOfLoading: input.portOfLoading,
          bankChoice: input.bankChoice,
          piDocId: input.piDocId,
          pdfUrl: url,
          pdfKey: fileKey,
        });

        return { docNo, pdfUrl: url };
      }),
  }),

  // ─── 系统设置 ───────────────────────────────────────────────────────────────
  settings: router({
    // 获取单据编号前缀
    getDocPrefixes: publicProcedure
      .query(async () => getDocPrefixes()),

    // 保存单据编号前缀
    saveDocPrefixes: publicProcedure
      .input(z.object({
        contract_cn: z.string().min(1).max(16),
        pi: z.string().min(1).max(16),
        ci: z.string().min(1).max(16),
      }))
      .mutation(async ({ input }) => {
        await saveDocPrefixes(input);
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
            boxImages:       m.boxImages ?? undefined,
            modelRemarks:    m.modelRemarks ?? undefined,
          }))
        );
        return { id: newId };
      }),
  }),
});

export type AppRouter = typeof appRouter;
