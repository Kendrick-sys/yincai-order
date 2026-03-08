import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

/** 模拟管理员用户（用于 protectedProcedure 测试） */
function createCtx(): TrpcContext {
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

describe("orders router", () => {
  it("list returns an array", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.orders.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("get returns null for non-existent order", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.orders.get({ id: 999999 });
    expect(result).toBeNull();
  });

  it("create, soft-delete, restore, and hard-delete an order", async () => {
    const caller = appRouter.createCaller(createCtx());

    // 创建订单
    const { id } = await caller.orders.create({
      order: {
        orderDescription: "测试订单",
        customer: "测试客户",
        status: "draft",
      },
      models: [
        {
          modelName: "测试型号A",
          quantity: "100",
          needSticker: false,
          needSilkPrint: false,
          needLiner: true,
          needCarton: true,
        },
      ],
    });
    expect(typeof id).toBe("number");

    // 查询订单
    const order = await caller.orders.get({ id });
    expect(order).not.toBeNull();
    expect(order?.orderDescription).toBe("测试订单");
    expect(order?.models?.length).toBe(1);
    expect(order?.models?.[0]?.modelName).toBe("测试型号A");

    // 更新状态
    await caller.orders.updateStatus({ id, status: "submitted" });
    const updated = await caller.orders.get({ id });
    expect(updated?.status).toBe("submitted");

    // 软删除（移入回收站）- 正常列表中不可见
    await caller.orders.delete({ id });
    const normalList = await caller.orders.list();
    expect(normalList.find((o: any) => o.id === id)).toBeUndefined();

    // 回收站列表中可见
    const trashedList = await caller.orders.listTrashed();
    expect(trashedList.find((o: any) => o.id === id)).toBeDefined();

    // 恢复订单
    await caller.orders.restore({ id });
    const restoredList = await caller.orders.list();
    expect(restoredList.find((o: any) => o.id === id)).toBeDefined();

    // 彻底删除
    await caller.orders.hardDelete({ id });
    const finalOrder = await caller.orders.get({ id });
    expect(finalOrder).toBeNull();
  });
});
