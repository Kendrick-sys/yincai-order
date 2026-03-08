import ExcelJS from "exceljs";
import { listCustomersWithStats } from "./db";

/** 生成客户档案 Excel */
export async function generateCustomersExcel(): Promise<Buffer> {
  const customers = await listCustomersWithStats();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("客户档案");

  // ─── 标题行 ───────────────────────────────────────────────────────────────────
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "吟彩客户档案";
  titleCell.font = { name: "微软雅黑", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3C5E" } };
  sheet.getRow(1).height = 40;

  // ─── 导出时间行 ────────────────────────────────────────────────────────────────
  sheet.mergeCells("A2:I2");
  const dateCell = sheet.getCell("A2");
  dateCell.value = `导出时间：${new Date().toLocaleString("zh-CN")}　　共 ${customers.length} 个客户`;
  dateCell.font = { name: "微软雅黑", size: 10, color: { argb: "FF666666" } };
  dateCell.alignment = { horizontal: "right", vertical: "middle" };
  dateCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FA" } };
  sheet.getRow(2).height = 22;

  // ─── 表头 ─────────────────────────────────────────────────────────────────────
  const headers = [
    { key: "no",        header: "序号",         width: 6  },
    { key: "name",      header: "客户名称",     width: 20 },
    { key: "country",   header: "国内/国外",    width: 10 },
    { key: "address",   header: "客户地址",     width: 28 },
    { key: "enAddress", header: "英文地址",     width: 32 },
    { key: "contact",   header: "联系人",       width: 12 },
    { key: "phone",     header: "联系电话",     width: 16 },
    { key: "email",     header: "邮箱",         width: 28 },
    { key: "remarks",   header: "备注",         width: 24 },
  ];

  sheet.columns = headers.map(h => ({ key: h.key, width: h.width }));

  const headerRow = sheet.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.header;
    cell.font = { name: "微软雅黑", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C5F8A" } };
    cell.border = {
      top:    { style: "thin", color: { argb: "FFB0C4D8" } },
      left:   { style: "thin", color: { argb: "FFB0C4D8" } },
      bottom: { style: "thin", color: { argb: "FFB0C4D8" } },
      right:  { style: "thin", color: { argb: "FFB0C4D8" } },
    };
  });
  headerRow.height = 28;

  // ─── 数据行 ───────────────────────────────────────────────────────────────────
  customers.forEach((c: any, idx: number) => {
    const isOverseas = c.country === "overseas";
    const countryLabel = isOverseas ? "国外" : "国内";

    const row = sheet.addRow({
      no:        idx + 1,
      name:      c.name      ?? "",
      country:   countryLabel,
      address:   c.address   ?? c.code ?? "",
      enAddress: c.enAddress ?? "",
      contact:   c.contact   ?? "",
      phone:     c.phone     ?? "",
      email:     c.email     ?? "",
      remarks:   c.remarks   ?? "",
    });

    const isEven = idx % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "微软雅黑", size: 10 };
      cell.alignment = {
        horizontal: colNumber === 1 ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: isEven ? "FFF0F4F8" : "FFFFFFFF" },
      };
      cell.border = {
        top:    { style: "thin", color: { argb: "FFD8E4EE" } },
        left:   { style: "thin", color: { argb: "FFD8E4EE" } },
        bottom: { style: "thin", color: { argb: "FFD8E4EE" } },
        right:  { style: "thin", color: { argb: "FFD8E4EE" } },
      };
    });

    // 「国内/国外」列（第3列）用不同背景色区分：国外=浅蓝，国内=浅灰
    const countryCell = row.getCell(3);
    countryCell.alignment = { horizontal: "center", vertical: "middle" };
    if (isOverseas) {
      countryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6EAF8" } }; // 浅蓝
      countryCell.font = { name: "微软雅黑", size: 10, bold: true, color: { argb: "FF1A5276" } };
    } else {
      countryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F3F4" } }; // 浅灰
      countryCell.font = { name: "微软雅黑", size: 10, color: { argb: "FF555555" } };
    }

    row.height = 22;
  });

  // ─── 冻结表头 ─────────────────────────────────────────────────────────────────
  sheet.views = [{ state: "frozen", ySplit: 3 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** 生成客户批量导入模板（空白，含表头和示例行） */
export async function generateCustomersTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("客户导入模板");

  // 标题行
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "吟彩客户批量导入模板 — 请勿修改表头，删除示例行后填写数据";
  titleCell.font = { name: "微软雅黑", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3C5E" } };
  sheet.getRow(1).height = 32;

  // 表头（第2行）
  const headers = [
    { key: "name",      header: "客户名称*",   width: 20 },
    { key: "country",   header: "国内/国外*",   width: 12 },
    { key: "address",   header: "客户地址",     width: 28 },
    { key: "enAddress", header: "英文地址",     width: 32 },
    { key: "contact",   header: "联系人*",      width: 14 },
    { key: "phone",     header: "联系电话*",    width: 18 },
    { key: "email",     header: "邮箱",         width: 28 },
    { key: "company",   header: "英文公司名",   width: 28 },
    { key: "remarks",   header: "备注",         width: 24 },
  ];
  sheet.columns = headers.map(h => ({ key: h.key, width: h.width }));
  const headerRow = sheet.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.header;
    cell.font = { name: "微软雅黑", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C5F8A" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF4A7FA5" } },
      bottom: { style: "thin", color: { argb: "FF4A7FA5" } },
      left: { style: "thin", color: { argb: "FF4A7FA5" } },
      right: { style: "thin", color: { argb: "FF4A7FA5" } },
    };
  });
  headerRow.height = 24;

  // 说明行（第3行）
  sheet.mergeCells("A3:I3");
  const noteCell = sheet.getCell("A3");
  noteCell.value = "说明：* 为必填项；国内/国外 填写「国内」或「国外」；英文地址用于生成 PI/CI 单据";
  noteCell.font = { name: "微软雅黑", size: 9, italic: true, color: { argb: "FF888888" } };
  noteCell.alignment = { horizontal: "left", vertical: "middle" };
  noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
  sheet.getRow(3).height = 20;

  // 示例行（第4-5行，黄色背景提示用户删除）
  const exampleRows = [
    ["张三贸易有限公司", "国内", "广东省深圳市南山区科技园", "", "张三", "13800138000", "zhangsan@example.com", "", "示例行，请删除后填写真实数据"],
    ["ABC Trading Co.", "国外", "USA, New York", "123 Main St, New York, NY 10001, USA", "John", "+1-212-555-0100", "john@abc.com", "ABC Trading Co., Ltd.", "示例行，请删除后填写真实数据"],
  ];
  exampleRows.forEach((rowData, ri) => {
    const dataRow = sheet.getRow(4 + ri);
    rowData.forEach((v, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: "微软雅黑", size: 10, color: { argb: "FF888888" }, italic: true };
      cell.alignment = { vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
    });
    dataRow.height = 20;
  });

  // 冻结表头
  sheet.views = [{ state: "frozen", ySplit: 3 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** 异步解析客户导入 Excel，返回待导入的客户数据数组 */
export async function parseCustomersImportBufferAsync(buffer: Buffer): Promise<Array<{
  name: string; country: "domestic" | "overseas"; address?: string; enAddress?: string;
  contact: string; phone: string; email?: string; company?: string; remarks?: string;
}>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel 文件中没有工作表");

  // 找到表头行（含"客户名称"的行）
  let dataStartRow = 3;
  sheet.eachRow((row, rowNumber) => {
    const firstCell = String(row.getCell(1).value ?? "");
    if (firstCell.includes("客户名称")) {
      dataStartRow = rowNumber + 1;
    }
  });

  const results: Array<{
    name: string; country: "domestic" | "overseas"; address?: string; enAddress?: string;
    contact: string; phone: string; email?: string; company?: string; remarks?: string;
  }> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;
    const name       = String(row.getCell(1).value ?? "").trim();
    const countryRaw = String(row.getCell(2).value ?? "").trim();
    const address    = String(row.getCell(3).value ?? "").trim() || undefined;
    const enAddress  = String(row.getCell(4).value ?? "").trim() || undefined;
    const contact    = String(row.getCell(5).value ?? "").trim();
    const phone      = String(row.getCell(6).value ?? "").trim();
    const email      = String(row.getCell(7).value ?? "").trim() || undefined;
    const company    = String(row.getCell(8).value ?? "").trim() || undefined;
    const remarks    = String(row.getCell(9).value ?? "").trim() || undefined;

    // 跳过空行、表头行和示例行
    if (!name || !contact || !phone) return;
    if (remarks?.includes("示例行")) return;

    const country: "domestic" | "overseas" = countryRaw === "国外" ? "overseas" : "domestic";
    results.push({ name, country, address, enAddress, contact, phone, email, company, remarks });
  });

  return results;
}
