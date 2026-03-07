/**
 * db.documents.ts
 * 单据（合同/PI/CI）的数据库操作函数
 */

import { getDb } from "./db";
import { documents } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── 生成单据编号 ──────────────────────────────────────────────────────────────

export async function generateDocNo(docType: "contract_cn" | "pi" | "ci"): Promise<string> {
  const prefix = docType === "contract_cn" ? "HT" : docType === "pi" ? "PI" : "CI";
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  // 查询今天已有的同类单据数量
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select({ docNo: documents.docNo })
    .from(documents)
    .where(eq(documents.docType, docType));

  const todayDocs = existing.filter((d: { docNo: string }) => d.docNo.includes(dateStr));
  const seq = String(todayDocs.length + 1).padStart(3, "0");
  return `${prefix}-${dateStr}-${seq}`;
}

// ─── 创建单据 ──────────────────────────────────────────────────────────────────

export async function createDocument(data: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderId: number;
  docType: "contract_cn" | "pi" | "ci";
  docNo: string;
  counterpartyName?: string;
  counterpartyAddress?: string;
  lineItems: string;       // JSON string
  totalAmount: string;
  currency: string;
  depositPct: number;
  balancePct: number;
  incoterms?: string;
  portOfLoading?: string;
  bankChoice?: "icbc" | "citi";
  piDocId?: number;
  pdfUrl?: string;
  pdfKey?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await db.insert(documents).values(data as any);
  return result;
}

// ─── 更新单据 PDF URL ──────────────────────────────────────────────────────────

export async function updateDocumentPdf(id: number, pdfUrl: string, pdfKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents)
    .set({ pdfUrl, pdfKey })
    .where(eq(documents.id, id));
}

// ─── 查询订单下的所有单据 ──────────────────────────────────────────────────────

export async function getDocumentsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(eq(documents.orderId, orderId))
    .orderBy(desc(documents.createdAt));
}

// ─── 查询单个单据 ──────────────────────────────────────────────────────────────

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));
  return rows[0] ?? null;
}
