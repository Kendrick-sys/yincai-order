/**
 * 自建账号密码认证模块
 * 提供：密码哈希/验证、账号 CRUD、JWT Session 签发
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

const SALT_ROUNDS = 10;

// ─── 密码工具 ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── 用户查询 ─────────────────────────────────────────────────────────────────

/** 按用户名查找（用于登录验证） */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0] ?? null;
}

/** 按 ID 查找 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? null;
}

/** 获取所有账号列表（管理员用，不返回 passwordHash） */
export async function listAppUsers() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.createdAt);
  return result;
}

// ─── 账号管理 ─────────────────────────────────────────────────────────────────

export interface CreateAppUserInput {
  username: string;
  password: string;
  displayName: string;
  role: "user" | "admin";
}

/** 创建新账号（管理员操作） */
export async function createAppUser(input: CreateAppUserInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 检查用户名是否已存在
  const existing = await getUserByUsername(input.username);
  if (existing) throw new Error("用户名已存在");

  const passwordHash = await hashPassword(input.password);
  // openId 用于兼容现有 unique 约束，自建账号用 "local:" 前缀
  const openId = `local:${input.username}`;

  const [result] = await db.insert(users).values({
    openId,
    username: input.username,
    passwordHash,
    displayName: input.displayName,
    name: input.displayName,
    role: input.role,
    isActive: true,
    loginMethod: "password",
    lastSignedIn: new Date(),
  }).$returningId();

  return result.id;
}

/** 更新账号信息（管理员操作） */
export async function updateAppUser(
  id: number,
  data: {
    displayName?: string;
    role?: "user" | "admin";
    isActive?: boolean;
    password?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) {
    updateData.displayName = data.displayName;
    updateData.name = data.displayName;
  }
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password !== undefined) {
    updateData.passwordHash = await hashPassword(data.password);
  }

  if (Object.keys(updateData).length === 0) return;
  await db.update(users).set(updateData).where(eq(users.id, id));
}

/** 删除账号（管理员操作，软删除：设置 isActive=false） */
export async function deactivateAppUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isActive: false }).where(eq(users.id, id));
}
