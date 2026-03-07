import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCtx(): TrpcContext {
  return {
    user: null,
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

  it("create and delete an order", async () => {
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

    // 删除
    await caller.orders.delete({ id });
    const deleted = await caller.orders.get({ id });
    expect(deleted).toBeNull();
  });
});
