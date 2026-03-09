/**
 * documentDrafts.test.ts
 * 单据草稿功能集成测试：保存、读取、删除草稿（跨设备共享）
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

/** 模拟管理员用户 */
function createAdminCtx(): TrpcContext {
  const mockAdmin: User = {
    id: 1,
    openId: "local:admin",
    username: "admin",
    displayName: "测试管理员",
    name: "测试管理员",
    email: null,
    role: "admin",
    isActive: true,
    passwordHash: null,
    loginMethod: "password",
    lastSignedIn: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    user: mockAdmin,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

/** 模拟业务员用户 */
function createUserCtx(id = 2): TrpcContext {
  const mockUser: User = {
    id,
    openId: `local:user${id}`,
    username: `user${id}`,
    displayName: `测试业务员${id}`,
    name: `测试业务员${id}`,
    email: null,
    role: "user",
    isActive: true,
    passwordHash: null,
    loginMethod: "password",
    lastSignedIn: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    user: mockUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("documentDrafts router", () => {
  let testOrderId: number;

  it("setup: create a test order", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const { id } = await caller.orders.create({
      order: {
        orderDescription: "草稿测试订单",
        customer: "测试客户",
        status: "draft",
      },
      models: [
        {
          modelName: "测试型号",
          quantity: "100",
          needSticker: false,
          needSilkPrint: false,
          needLiner: false,
          needCarton: false,
        },
      ],
    });
    testOrderId = id;
    expect(typeof id).toBe("number");
  });

  it("get returns null when no draft exists", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.documentDrafts.get({
      orderId: testOrderId,
      draftType: "contract_cn",
    });
    expect(result).toBeNull();
  });

  it("save creates a new draft", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const draftData = JSON.stringify({
      lineItems: [{ desc: "测试产品", qty: "100", unitPrice: "5.00" }],
    });
    await caller.documentDrafts.save({
      orderId: testOrderId,
      draftType: "contract_cn",
      data: draftData,
    });

    // 验证草稿已保存
    const result = await caller.documentDrafts.get({
      orderId: testOrderId,
      draftType: "contract_cn",
    });
    expect(result).not.toBeNull();
    expect(result!.data).toBe(draftData);
    // updatedByName 来自真实数据库中 id=1 的用户
    expect(typeof result!.updatedByName).toBe("string");
  });

  it("save updates existing draft", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const updatedData = JSON.stringify({
      lineItems: [{ desc: "更新产品", qty: "200", unitPrice: "10.00" }],
    });
    await caller.documentDrafts.save({
      orderId: testOrderId,
      draftType: "contract_cn",
      data: updatedData,
    });

    const result = await caller.documentDrafts.get({
      orderId: testOrderId,
      draftType: "contract_cn",
    });
    expect(result).not.toBeNull();
    expect(result!.data).toBe(updatedData);
  });

  it("different draft types are independent", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const piData = JSON.stringify({ piLineItems: [{ desc: "PI Item" }] });
    await caller.documentDrafts.save({
      orderId: testOrderId,
      draftType: "pi",
      data: piData,
    });

    // PI 草稿存在
    const piResult = await caller.documentDrafts.get({
      orderId: testOrderId,
      draftType: "pi",
    });
    expect(piResult).not.toBeNull();
    expect(piResult!.data).toBe(piData);

    // contract_cn 草稿仍然是之前的
    const cnResult = await caller.documentDrafts.get({
      orderId: testOrderId,
      draftType: "contract_cn",
    });
    expect(cnResult).not.toBeNull();
    expect(cnResult!.data).toContain("更新产品");
  });

  it("cleanup: delete test order and drafts", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    // 删除测试订单（会级联删除相关数据）
    await caller.orders.delete({ id: testOrderId });
    await caller.orders.hardDelete({ id: testOrderId });
    const order = await caller.orders.get({ id: testOrderId });
    expect(order).toBeNull();
  });
});
