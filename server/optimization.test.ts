import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

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

/** 模拟普通业务员用户 */
function createSalesCtx(userId: number = 2): TrpcContext {
  const mockUser: User = {
    id: userId,
    openId: `local:sales${userId}`,
    username: `sales${userId}`,
    displayName: "测试业务员",
    name: "测试业务员",
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

describe("权限检查优化 (ensureOrderOwnership)", () => {
  it("管理员可以操作任何订单", async () => {
    const adminCaller = appRouter.createCaller(createAdminCtx());
    const salesCaller = appRouter.createCaller(createSalesCtx(99));

    // 业务员创建订单
    const { id } = await salesCaller.orders.create({
      order: {
        orderDescription: "权限测试订单",
        customer: "权限测试客户",
        status: "draft",
      },
      models: [],
    });

    // 管理员可以查看、更新、删除
    const order = await adminCaller.orders.get({ id });
    expect(order).not.toBeNull();

    await adminCaller.orders.updateStatus({ id, status: "submitted" });
    const updated = await adminCaller.orders.get({ id });
    expect(updated?.status).toBe("submitted");

    // 清理
    await adminCaller.orders.hardDelete({ id });
  });

  it("业务员不能操作他人的订单", async () => {
    const adminCaller = appRouter.createCaller(createAdminCtx());
    const salesCaller = appRouter.createCaller(createSalesCtx(88));

    // 管理员创建订单（createdBy = 1）
    const { id } = await adminCaller.orders.create({
      order: {
        orderDescription: "管理员的订单",
        customer: "管理员客户",
        status: "draft",
      },
      models: [],
    });

    // 业务员（id=88）尝试更新 → 应被拒绝
    try {
      await salesCaller.orders.update({
        id,
        order: { orderDescription: "篡改" },
        models: [],
      });
      expect.fail("应该抛出 FORBIDDEN 错误");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }

    // 业务员尝试删除 → 应被拒绝
    try {
      await salesCaller.orders.delete({ id });
      expect.fail("应该抛出 FORBIDDEN 错误");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }

    // 清理
    await adminCaller.orders.hardDelete({ id });
  });

  it("业务员可以操作自己创建的订单", async () => {
    const salesCaller = appRouter.createCaller(createSalesCtx(77));
    const adminCaller = appRouter.createCaller(createAdminCtx());

    // 业务员创建订单
    const { id } = await salesCaller.orders.create({
      order: {
        orderDescription: "我的订单",
        customer: "我的客户",
        status: "draft",
      },
      models: [{ modelName: "型号A", quantity: "50" }],
    });

    // 业务员可以更新自己的订单
    await salesCaller.orders.update({
      id,
      order: { orderDescription: "我的订单（已修改）" },
      models: [{ modelName: "型号B", quantity: "100" }],
    });

    const updated = await salesCaller.orders.get({ id });
    expect(updated?.orderDescription).toBe("我的订单（已修改）");
    expect(updated?.models?.length).toBe(1);
    expect(updated?.models?.[0]?.modelName).toBe("型号B");

    // 清理
    await adminCaller.orders.hardDelete({ id });
  });
});

describe("事务安全 (updateOrder / hardDeleteOrder)", () => {
  it("updateOrder 中型号更新是原子操作", async () => {
    const caller = appRouter.createCaller(createAdminCtx());

    // 创建订单含2个型号
    const { id } = await caller.orders.create({
      order: {
        orderDescription: "事务测试",
        customer: "事务客户",
        status: "draft",
      },
      models: [
        { modelName: "型号1", quantity: "10" },
        { modelName: "型号2", quantity: "20" },
      ],
    });

    // 更新为3个型号
    await caller.orders.update({
      id,
      order: { orderDescription: "事务测试（更新后）" },
      models: [
        { modelName: "新型号A", quantity: "30" },
        { modelName: "新型号B", quantity: "40" },
        { modelName: "新型号C", quantity: "50" },
      ],
    });

    const updated = await caller.orders.get({ id });
    expect(updated?.orderDescription).toBe("事务测试（更新后）");
    expect(updated?.models?.length).toBe(3);
    expect(updated?.models?.[0]?.modelName).toBe("新型号A");
    expect(updated?.models?.[2]?.modelName).toBe("新型号C");

    // 清理
    await caller.orders.hardDelete({ id });
    const deleted = await caller.orders.get({ id });
    expect(deleted).toBeNull();
  });

  it("hardDeleteOrder 彻底删除订单和型号", async () => {
    const caller = appRouter.createCaller(createAdminCtx());

    const { id } = await caller.orders.create({
      order: {
        orderDescription: "即将删除",
        customer: "删除客户",
        status: "draft",
      },
      models: [{ modelName: "删除型号", quantity: "5" }],
    });

    // 确认存在
    const before = await caller.orders.get({ id });
    expect(before).not.toBeNull();

    // 彻底删除
    await caller.orders.hardDelete({ id });

    // 确认不存在
    const after = await caller.orders.get({ id });
    expect(after).toBeNull();
  });
});

describe("登录错误处理 (TRPCError)", () => {
  it("不存在的用户名返回 UNAUTHORIZED", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: () => {},
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.login({
        username: "nonexistent_user_xyz",
        password: "anypassword",
      });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("UNAUTHORIZED");
      expect((err as TRPCError).message).toBe("用户名或密码错误");
    }
  });
});
