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
