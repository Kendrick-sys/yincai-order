import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS, THIRTY_DAYS_MS, EIGHT_HOURS_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createOrder, updateOrder, listOrders, getOrderById,
  softDeleteOrder, restoreOrder, hardDeleteOrder, listTrashedOrders,
  updateOrderStatus,
  listCustomers, listCustomersWithStats, createCustomer, updateCustomer, deleteCustomer, getCustomerById,
  transferCustomers, transferOrders,
  getDocumentDraft, upsertDocumentDraft,
  getUserById,
} from "./db";
import {
  generateDocNo, createDocument, updateDocumentPdf,
  getDocumentsByOrderId, getDocumentById, voidDocument,
  getActivePiByOrderId, getDocPrefixes, saveDocPrefixes,
  incrementDocumentVersion, markDocumentSent, unmarkDocumentSent,
} from "./db.documents";
import { generateContractCnPdf, generatePiCiPdf } from "./generatePdf";
import { storagePut } from "./storage";
import {
  getUserByUsername, verifyPassword,
  createAppUser, updateAppUser, deactivateAppUser, listAppUsers,
} from "./auth";
import { sdk } from "./_core/sdk";

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
  needLiner:           z.boolean().default(true),
  topLiner:            z.string().optional(),
  bottomLiner:         z.string().optional(),
  linerImages:         z.string().optional(),          // 已废弃，保留向下兼容
  topLinerImages:      z.string().optional(),          // JSON 数组字符串，上盖内衬图片
  bottomLinerImages:   z.string().optional(),          // JSON 数组字符串，下盖内衬图片
  // 纸箱
  needCarton:          z.boolean().default(true),
  innerBox:            z.string().optional(),
  outerBox:            z.string().optional(),
  boxImages:           z.string().optional(),          // 已废弃，保留向下兼容
  innerBoxImages:      z.string().optional(),          // JSON 数组字符串，内箱图片
  outerBoxImages:      z.string().optional(),          // JSON 数组字符串，外箱图片
  // 备注
  modelRemarks:    z.string().optional(),
});

const orderHeaderSchemaBase = z.object({
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
});
const orderHeaderSchema = orderHeaderSchemaBase.superRefine((data, ctx) => {
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

const customerSchemaBase = z.object({
  name:      z.string().min(1, "客户名称不能为空"),
  code:      z.string().optional(),      // 客户地址（兼容旧字段）
  address:   z.string().optional(),      // 客户地址（新字段）
  country:   z.enum(["domestic", "overseas"]).default("domestic"),  // 国内/国外
  company:   z.string().optional(),      // 公司名（英文，用于 PI/CI）
  attn:      z.string().optional(),      // 联系人（Attn，英文，用于 PI/CI）
  enAddress: z.string().optional(),      // 英文地址（用于 PI/CI Buyer 区块）
  email:     z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  contact:   z.string().min(1, "联系人不能为空"),
  phone:     z.string().min(1, "联系电话不能为空"),
  // 国内客户专用字段
  cnCompany:   z.string().optional(),     // 公司全称
  taxNo:       z.string().optional(),     // 统一社会信用代码（税号）
  bankAccount: z.string().optional(),     // 对公账号
  bankName:    z.string().optional(),     // 对公开户行
  remarks:   z.string().optional(),
  sortOrder: z.number().optional(),
});
const customerSchema = customerSchemaBase.superRefine((data, ctx) => {
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
    // 获取当前登录用户
    me: publicProcedure.query(opts => opts.ctx.user),

    // 自建账号登录
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1, "用户名不能为空"),
        password: z.string().min(1, "密码不能为空"),
        rememberMe: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByUsername(input.username);
        if (!user || !user.passwordHash) {
          throw new Error("用户名或密码错误");
        }
        if (!user.isActive) {
          throw new Error("该账号已被停用，请联系管理员");
        }
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) {
          throw new Error("用户名或密码错误");
        }
        // 记住我：30 天；不记住：8 小时
        const expiresInMs = input.rememberMe ? THIRTY_DAYS_MS : EIGHT_HOURS_MS;
        // 签发 JWT Session
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.displayName ?? user.name ?? user.username ?? "",
          expiresInMs,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: expiresInMs });
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? user.name,
            role: user.role,
          },
        };
      }),

    // 登出
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      // 使用 expires: new Date(0) 代替 clearCookie，避免 Express v5 废弃警告
      ctx.res.cookie(COOKIE_NAME, "", { ...cookieOptions, expires: new Date(0) });
      return { success: true } as const;
    }),
  }),

  // ─── 账号管理（管理员专属）───────────────────────────────────────────────
  userManagement: router({
    // 获取所有账号列表
    list: adminProcedure.query(async () => listAppUsers()),

    // 创建新账号
    create: adminProcedure
      .input(z.object({
        username: z.string().min(2, "用户名至少2个字符").max(32),
        password: z.string().min(6, "密码至少6个字符"),
        displayName: z.string().min(1, "姓名不能为空").max(32),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ input }) => {
        const id = await createAppUser(input);
        return { id };
      }),

    // 更新账号（修改姓名/角色/状态/密码）
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        displayName: z.string().min(1).max(32).optional(),
        role: z.enum(["user", "admin"]).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(6).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateAppUser(id, data);
        // 停用账号时，自动将其客户转为公共（createdBy = null）
        if (data.isActive === false) {
          await transferCustomers(id, null);
        }
        return { success: true };
      }),

    // 停用账号（移除登录权限）
    deactivate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deactivateAppUser(input.id);
        return { success: true };
      }),

    // 重置密码（管理员重置业务员密码）
    resetPassword: adminProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(6, "密码至少6个字符"),
      }))
      .mutation(async ({ input }) => {
        await updateAppUser(input.id, { password: input.newPassword });
        return { success: true };
      }),

    // 批量转移客户和订单归属（离职业务员操作）
    transferData: adminProcedure
      .input(z.object({
        fromUserId: z.number(),
        toUserId: z.number().nullable(), // null = 设为公共
      }))
      .mutation(async ({ input }) => {
        await transferCustomers(input.fromUserId, input.toUserId);
        await transferOrders(input.fromUserId, input.toUserId);
        return { success: true };
      }),
    // 业务员修改自己的密码
    changeMyPassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6, "新密码至少6个字符"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByUsername(ctx.user.username ?? "");
        if (!user || !user.passwordHash) throw new Error("账号不存在");
        const valid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) throw new Error("当前密码错误");
        await updateAppUser(user.id, { password: input.newPassword });
        return { success: true };
      }),
  }),

  // ─── 客户管理 ───────────────────────────────────────────────────────────────
  customers: router({
    // 管理员看全部，业务员只看自己创建的
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.role === "admin" ? undefined : ctx.user.id;
      return listCustomersWithStats(userId);
    }),

    create: protectedProcedure
      .input(customerSchema)
      .mutation(async ({ input, ctx }) => {
        const id = await createCustomer({ ...input, createdBy: ctx.user.id });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: customerSchemaBase.partial() }))
      .mutation(async ({ input, ctx }) => {
        // 业务员只能修改自己的客户
        if (ctx.user.role !== "admin") {
          const existing = await getCustomerById(input.id);
          if (!existing || existing.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "无权修改该客户" });
          }
        }
        await updateCustomer(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // 业务员只能删除自己的客户
        if (ctx.user.role !== "admin") {
          const existing = await getCustomerById(input.id);
          if (!existing || existing.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "无权删除该客户" });
          }
        }
        await deleteCustomer(input.id);
        return { success: true };
      }),

    // 分配业务员（管理员专属）——将客户指派给某个在职业务员，或设为公共（null）
    assignSalesperson: adminProcedure
      .input(z.object({
        id: z.number(),
        userId: z.number().nullable(),   // null 表示设为公共客户
      }))
      .mutation(async ({ input }) => {
        await updateCustomer(input.id, { createdBy: input.userId });
        return { success: true };
      }),
  }),

  // ─── 单据管理（合同/PI/CI）────────────────────────────────────────────────
  documents: router({
    // 获取订单下的所有单据
    listByOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => getDocumentsByOrderId(input.orderId)),

    // 获取单个单据
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getDocumentById(input.id)),

    // 生成国内采购合同
    generateContractCn: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        counterpartyName: z.string().min(1, "甲方名称不能为空"),
        counterpartyAddress: z.string().optional(),
        buyerCnCompany: z.string().optional(),
        buyerTaxNo: z.string().optional(),
        buyerBankAccount: z.string().optional(),
        buyerBankName: z.string().optional(),
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
        needInvoice: z.boolean().optional(),
        orderDate: z.string().optional(),
        deliveryDate: z.string().optional(),
        extras: z.object({
          hasLiner: z.boolean(),
          linerMaterial: z.string().optional(),
          linerDescription: z.string().optional(),
          linerQuantity: z.number(),
          linerUnitPrice: z.number(),
          linerAmount: z.number(),
          hasLinerTemplate: z.boolean(),
          linerTemplateQuantity: z.number(),
          linerTemplateUnitPrice: z.number(),
          linerTemplateAmount: z.number(),
          hasLogo: z.boolean(),
          logoMaterial: z.string().optional(),
          logoDescription: z.string().optional(),
          logoQuantity: z.number(),
          logoUnitPrice: z.number(),
          logoAmount: z.number(),
          hasSilkPrint: z.boolean(),
          silkPrintDescription: z.string().optional(),
          silkPrintQuantity: z.number(),
          silkPrintUnitPrice: z.number(),
          silkPrintAmount: z.number(),
          hasSilkPrintTemplate: z.boolean(),
          silkPrintTemplateQuantity: z.number(),
          silkPrintTemplateUnitPrice: z.number(),
          silkPrintTemplateAmount: z.number(),
          hasCustomColor: z.boolean(),
          customColorQuantity: z.number(),
          customColorUnitPrice: z.number(),
          customColorAmount: z.number(),
          shippingFee: z.number(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const docNo = await generateDocNo("contract_cn");
        const today = new Date().toISOString().slice(0, 10);

        // 生成 PDF
        const pdfBuffer = await generateContractCnPdf({
          docNo,
          orderDate: input.orderDate ?? today,
          counterpartyName: input.counterpartyName,
          counterpartyAddress: input.counterpartyAddress,
          buyerCnCompany: input.buyerCnCompany,
          buyerTaxNo: input.buyerTaxNo,
          buyerBankAccount: input.buyerBankAccount,
          buyerBankName: input.buyerBankName,
          lineItems: input.lineItems,
          totalAmount: input.totalAmount,
          depositPct: input.depositPct,
          balancePct: input.balancePct,
          needInvoice: input.needInvoice ?? false,
          extras: input.extras,
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
    void: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await voidDocument(input.id);
        return { success: true };
      }),
    // 标记单据为已发送
    markSent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await markDocumentSent(input.id);
        return { success: true };
      }),
    // 取消已发送标记
    unmarkSent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await unmarkDocumentSent(input.id);
        return { success: true };
      }),

    // 重新生成单据 PDF（版本号+1）
    regenerate: protectedProcedure
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
    getActivePi: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => getActivePiByOrderId(input.orderId)),

    // 生成 PI / CI
    generatePiCi: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        docType: z.enum(["pi", "ci"]),
        buyerName: z.string().min(1, "买方名称不能为空"),
        buyerAttn: z.string().optional(),
        buyerCompany: z.string().optional(),
        buyerAddress: z.string().optional(),
        buyerTel: z.string().optional(),
        buyerEmail: z.string().optional(),
        transitDays: z.string().optional(),
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
        piExtras: z.object({
          hasLiner: z.boolean(),
          linerMaterial: z.string().optional(),
          linerDescription: z.string().optional(),
          linerQuantity: z.number(),
          linerUnitPrice: z.number(),
          linerAmount: z.number(),
          hasLinerTemplate: z.boolean(),
          linerTemplateQuantity: z.number(),
          linerTemplateUnitPrice: z.number(),
          linerTemplateAmount: z.number(),
          hasLogo: z.boolean(),
          logoMaterial: z.string().optional(),
          logoDescription: z.string().optional(),
          logoQuantity: z.number(),
          logoUnitPrice: z.number(),
          logoAmount: z.number(),
          hasSilkPrint: z.boolean(),
          silkPrintDescription: z.string().optional(),
          silkPrintQuantity: z.number(),
          silkPrintUnitPrice: z.number(),
          silkPrintAmount: z.number(),
          hasSilkPrintTemplate: z.boolean(),
          silkPrintTemplateQuantity: z.number(),
          silkPrintTemplateUnitPrice: z.number(),
          silkPrintTemplateAmount: z.number(),
          hasCustomColor: z.boolean(),
          customColorQuantity: z.number(),
          customColorUnitPrice: z.number(),
          customColorAmount: z.number(),
          domesticFreight: z.number().default(0),
          internationalFreightType: z.string().optional(),
          internationalFreight: z.number().default(0),
          freightDescription: z.string().optional(),
        }).optional(),
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
          buyerAttn: input.buyerAttn,
          buyerCompany: input.buyerCompany,
          buyerAddress: input.buyerAddress,
          buyerTel: input.buyerTel,
          buyerEmail: input.buyerEmail,
          transitDays: input.transitDays,
          lineItems: input.lineItems,
          totalAmount: input.totalAmount,
          currency: input.currency,
          depositPct: input.depositPct,
          balancePct: input.balancePct,
          incoterms: input.incoterms,
          portOfLoading: input.portOfLoading,
          bankChoice: input.bankChoice,
          extras: input.piExtras ? {
            ...input.piExtras,
            domesticFreight: input.piExtras.domesticFreight ?? 0,
            internationalFreight: input.piExtras.internationalFreight ?? 0,
          } : undefined,
        });

        const fileKey = `documents/${docNo}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

        await createDocument({
          orderId: input.orderId,
          docType: input.docType,
          docNo,
          counterpartyName: input.buyerName,
          counterpartyAddress: input.buyerAddress,
          buyerAttn: input.buyerAttn,
          buyerCompany: input.buyerCompany,
          buyerTel: input.buyerTel,
          buyerEmail: input.buyerEmail,
          transitDays: input.transitDays,
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

  // ─── 系统设置 ────────  // ─── 单据草稿（跨设备共享） ───────────────────────────────────────────────
  documentDrafts: router({
    // 获取单据草稿
    get: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        draftType: z.enum(["contract_cn", "pi"]),
      }))
      .query(async ({ input }) => {
        const draft = await getDocumentDraft(input.orderId, input.draftType);
        if (!draft) return null;
        // 查询修改人名称
        let updatedByName: string | null = null;
        if (draft.updatedBy) {
          const user = await getUserById(draft.updatedBy);
          updatedByName = user?.displayName || user?.name || null;
        }
        return { data: draft.data, updatedAt: draft.updatedAt, updatedBy: draft.updatedBy, updatedByName };
      }),

    // 保存单据草稿
    save: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        draftType: z.enum(["contract_cn", "pi"]),
        data: z.string(), // JSON 字符串
      }))
      .mutation(async ({ input, ctx }) => {
        await upsertDocumentDraft(input.orderId, input.draftType, input.data, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── 系统设置 ───────────────────────────────────────────────
  settings: router({
    // 获取单据编号前缀
    getDocPrefixes: protectedProcedure
      .query(async () => getDocPrefixes()),

    // 保存单据编号前缀
    saveDocPrefixes: adminProcedure
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
    // 正常订单列表（管理员看全部，业务员只看自己的）
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.role === "admin" ? undefined : ctx.user.id;
      return listOrders(userId);
    }),

    // 回收站列表
    listTrashed: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.role === "admin" ? undefined : ctx.user.id;
      return listTrashedOrders(userId);
    }),

    // 获取单个订单
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await getOrderById(input.id);
        if (!order) return null;
        if (ctx.user.role !== "admin" && order.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权查看该订单" });
        }
        return order;
      }),

    // 创建订单（自动设置 createdBy）
    create: protectedProcedure
      .input(z.object({ order: orderHeaderSchema, models: z.array(modelSchema) }))
      .mutation(async ({ input, ctx }) => {
        const id = await createOrder(
          { ...input.order, status: input.order.status ?? "draft", createdBy: ctx.user.id },
          input.models
        );
        return { id };
      }),

    // 更新订单
    update: protectedProcedure
      .input(z.object({ id: z.number(), order: orderHeaderSchema, models: z.array(modelSchema) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          const existing = await getOrderById(input.id);
          if (!existing || existing.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "无权修改该订单" });
          }
        }
        await updateOrder(input.id, input.order, input.models);
        return { success: true };
      }),

    // 仅更新状态
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "submitted", "in_production", "completed", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          const existing = await getOrderById(input.id);
          if (!existing || existing.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "无权更新该订单状态" });
          }
        }
        await updateOrderStatus(input.id, input.status);
        return { success: true };
      }),

    // 软删除（移入回收站）
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          const existing = await getOrderById(input.id);
          if (!existing || existing.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "无权删除该订单" });
          }
        }
        await softDeleteOrder(input.id);
        return { success: true };
      }),

    // 从回收站恢复
    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          const existing = await getOrderById(input.id);
          if (!existing || existing.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "无权恢复该订单" });
          }
        }
        await restoreOrder(input.id);
        return { success: true };
      }),

    // 彻底删除（不可恢复）
    hardDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          const existing = await getOrderById(input.id);
          if (!existing || existing.createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "无权彻底删除该订单" });
          }
        }
        await hardDeleteOrder(input.id);
        return { success: true };
      }),

    // 复制订单
    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
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
            createdBy: ctx.user.id,
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
