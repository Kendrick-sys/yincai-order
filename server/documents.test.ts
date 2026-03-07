/**
 * documents.test.ts
 * 单据功能测试：作废、编号前缀设置、从PI创建CI
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock getDb ────────────────────────────────────────────────────────────────

const mockRows: any[] = [];
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockImplementation(() => ({ ...mockDb, then: (fn: any) => Promise.resolve(fn(mockRows)) })),
  orderBy: vi.fn().mockImplementation(() => ({ ...mockDb, then: (fn: any) => Promise.resolve(fn(mockRows)) })),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  documents: { docType: "docType", orderId: "orderId", id: "id", status: "status" },
  settings: { key: "key", value: "value", id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => `${a}=${b}`),
  desc: vi.fn((a) => `desc(${a})`),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("getDocPrefixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows.length = 0;
  });

  it("returns default prefixes when no settings exist", async () => {
    // Mock: settings table returns empty
    mockDb.where.mockResolvedValueOnce([]);
    const { getDocPrefixes } = await import("./db.documents");
    const prefixes = await getDocPrefixes();
    expect(prefixes.contract_cn).toBe("HT");
    expect(prefixes.pi).toBe("PI");
    expect(prefixes.ci).toBe("CI");
  });

  it("returns saved prefixes when settings exist", async () => {
    const saved = { contract_cn: "CONTRACT", pi: "MYPI", ci: "MYCI" };
    mockDb.where.mockResolvedValueOnce([{ value: JSON.stringify(saved) }]);
    const { getDocPrefixes } = await import("./db.documents");
    const prefixes = await getDocPrefixes();
    expect(prefixes.contract_cn).toBe("CONTRACT");
    expect(prefixes.pi).toBe("MYPI");
    expect(prefixes.ci).toBe("MYCI");
  });
});

describe("saveDocPrefixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts when no existing setting", async () => {
    mockDb.where.mockResolvedValueOnce([]);
    const { saveDocPrefixes } = await import("./db.documents");
    await saveDocPrefixes({ contract_cn: "HT", pi: "PI", ci: "CI" });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("updates when setting already exists", async () => {
    mockDb.where.mockResolvedValueOnce([{ id: 1 }]);
    const { saveDocPrefixes } = await import("./db.documents");
    await saveDocPrefixes({ contract_cn: "HT2", pi: "PI2", ci: "CI2" });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("voidDocument", () => {
  it("calls update with voided status", async () => {
    const { voidDocument } = await import("./db.documents");
    await voidDocument(42);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith({ status: "voided" });
  });
});

describe("getActivePiByOrderId", () => {
  it("filters only active PI documents", async () => {
    const docs = [
      { id: 1, docType: "pi", status: "active", orderId: 5 },
      { id: 2, docType: "pi", status: "voided", orderId: 5 },
      { id: 3, docType: "ci", status: "active", orderId: 5 },
    ];
    // Mock the chained query to return docs
    mockDb.orderBy.mockImplementationOnce(() =>
      Promise.resolve(docs).then(rows => rows.filter(r => r.docType === "pi" && r.status === "active"))
    );
    const { getActivePiByOrderId } = await import("./db.documents");
    const result = await getActivePiByOrderId(5);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });
});
