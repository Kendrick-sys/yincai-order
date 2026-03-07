import ExcelJS from "exceljs";
import { getOrderById } from "./db";

// 颜色配置
const COLORS = {
  headerBg:   "1A3C5E",
  headerFg:   "FFFFFF",
  sectionBox: "EBF2F8",
  sectionFg:  "1A3C5E",
  labelBg:    "F5F7FA",
  labelFg:    "555555",
  valueBg:    "FFFFFF",
  valueFg:    "1A1A1A",
  sticker:    "E8F5E9",
  silk:       "EDE7F6",
  liner:      "F3E5F5",
  carton:     "FFF8E1",
  disabled:   "F0F0F0",
  disabledFg: "AAAAAA",
  border:     "DDDDDD",
};

function fill(hex: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + hex } };
}

function font(hex: string, bold = false, size = 10): Partial<ExcelJS.Font> {
  return { color: { argb: "FF" + hex }, bold, size, name: "微软雅黑" };
}

function border(): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = "thin";
  const c = { argb: "FFDDDDDD" };
  return { top: { style: s, color: c }, bottom: { style: s, color: c }, left: { style: s, color: c }, right: { style: s, color: c } };
}

function setCell(
  ws: ExcelJS.Worksheet, row: number, col: number,
  value: string, bgHex: string, fgHex: string,
  bold = false, size = 10, align: ExcelJS.Alignment["horizontal"] = "left"
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.fill = fill(bgHex);
  cell.font = font(fgHex, bold, size);
  cell.border = border();
  cell.alignment = { horizontal: align, vertical: "middle", wrapText: true };
}

function mergeSet(
  ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number,
  value: string, bgHex: string, fgHex: string, bold = false, size = 10
) {
  ws.mergeCells(r1, c1, r2, c2);
  setCell(ws, r1, c1, value, bgHex, fgHex, bold, size, "center");
}

/**
 * 生成单张订单的 Excel（吟彩版 + 厂部版两个 sheet）
 */
export async function generateOrderExcel(orderId: number): Promise<Buffer> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("订单不存在");

  const wb = new ExcelJS.Workbook();
  wb.creator = "吟彩销售订单系统";
  wb.created = new Date();

  for (const version of ["yincai", "factory"] as const) {
    const isYincai = version === "yincai";
    const sheetName = isYincai ? "吟彩版" : "厂部版";
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      },
    });

    // 列宽定义（A列标签，B~N数据）
    // 列：标签 | 型号名称 | 数量 | 上盖 | 下盖 | 配件 | 贴纸来源 | 贴纸描述 | [丝印] | 上盖内衬 | 下盖内衬 | 内箱 | 外箱 | 备注
    const colWidths = isYincai
      ? [18, 16, 8, 14, 14, 12, 12, 16, 16, 14, 14, 14, 14, 14]
      : [18, 16, 8, 14, 14, 12, 12, 16, 14, 14, 14, 14, 14];
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const totalCols = colWidths.length;

    // ── 第1行：大标题 ──────────────────────────────────────────────────────────
    ws.getRow(1).height = 36;
    mergeSet(ws, 1, 1, 1, totalCols,
      `吟彩销售订单记录表（${isYincai ? "吟彩版" : "厂部版"}）`,
      COLORS.headerBg, COLORS.headerFg, true, 14);

    // ── 第2行：订单基本信息 ────────────────────────────────────────────────────
    ws.getRow(2).height = 20;
    const basicInfo = [
      `订单描述：${order.orderDescription ?? ""}`,
      `客户：${order.customer ?? ""}`,
      `金蝶订单号：${order.orderNo ?? ""}`,
      `下单日期：${order.orderDate ?? ""}`,
      `交货日期：${order.deliveryDate ?? ""}`,
      `制单员：${order.maker ?? ""}  销售员：${order.salesperson ?? ""}`,
    ];
    // 平均分配到几个格子
    const infoPerCell = Math.ceil(basicInfo.length / 3);
    const infoCells = [
      basicInfo.slice(0, 2).join("   "),
      basicInfo.slice(2, 4).join("   "),
      basicInfo.slice(4).join("   "),
    ];
    const infoSpan = Math.floor(totalCols / 3);
    for (let i = 0; i < 3; i++) {
      const c1 = i * infoSpan + 1;
      const c2 = i === 2 ? totalCols : (i + 1) * infoSpan;
      mergeSet(ws, 2, c1, 2, c2, infoCells[i], COLORS.labelBg, COLORS.labelFg, false, 9);
    }

    // ── 第3行：列标题 ──────────────────────────────────────────────────────────
    ws.getRow(3).height = 24;
    const headers = isYincai
      ? ["描述项目", "型号名称", "数量", "上盖材质", "下盖材质", "配件", "贴纸来源", "贴纸描述", "丝印描述", "上盖内衬", "下盖内衬", "内箱规格", "外箱规格", "备注"]
      : ["描述项目", "型号名称", "数量", "上盖材质", "下盖材质", "配件", "贴纸来源", "贴纸描述", "上盖内衬", "下盖内衬", "内箱规格", "外箱规格", "备注"];
    headers.forEach((h, i) => {
      setCell(ws, 3, i + 1, h, COLORS.sectionBox, COLORS.sectionFg, true, 10, "center");
    });

    // ── 数据行（每个型号一行） ────────────────────────────────────────────────
    const models = order.models ?? [];
    const startRow = 4;

    models.forEach((m, idx) => {
      const row = startRow + idx;
      ws.getRow(row).height = 40;

      const rowBg = idx % 2 === 0 ? COLORS.valueBg : "FAFBFC";

      // A列：序号
      setCell(ws, row, 1, `型号 ${idx + 1}`, COLORS.sectionBox, COLORS.sectionFg, true, 9, "center");

      // B: 型号名称
      setCell(ws, row, 2, m.modelName ?? "", rowBg, COLORS.valueFg);
      // C: 数量
      setCell(ws, row, 3, m.quantity ?? "", rowBg, COLORS.valueFg, false, 10, "center");
      // D: 上盖
      setCell(ws, row, 4, m.topCover ?? "", rowBg, COLORS.valueFg);
      // E: 下盖
      setCell(ws, row, 5, m.bottomCover ?? "", rowBg, COLORS.valueFg);
      // F: 配件
      setCell(ws, row, 6, m.accessories ?? "", rowBg, COLORS.valueFg);

      // G: 贴纸来源
      const stickerBg = m.needSticker ? rowBg : COLORS.disabled;
      const stickerFg = m.needSticker ? COLORS.valueFg : COLORS.disabledFg;
      setCell(ws, row, 7, m.needSticker ? (m.stickerSource ?? "") : "不需要", stickerBg, stickerFg);
      // H: 贴纸描述
      setCell(ws, row, 8, m.needSticker ? (m.stickerDesc ?? "") : "—", stickerBg, stickerFg);

      let col = 9;
      if (isYincai) {
        // I: 丝印描述
        const silkBg = m.needSilkPrint ? rowBg : COLORS.disabled;
        const silkFg = m.needSilkPrint ? COLORS.valueFg : COLORS.disabledFg;
        setCell(ws, row, col, m.needSilkPrint ? (m.silkPrintDesc ?? "") : "不需要", silkBg, silkFg);
        col++;
      }

      // 内衬
      const linerBg = m.needLiner ? rowBg : COLORS.disabled;
      const linerFg = m.needLiner ? COLORS.valueFg : COLORS.disabledFg;
      setCell(ws, row, col, m.needLiner ? (m.topLiner ?? "") : "不需要", linerBg, linerFg); col++;
      setCell(ws, row, col, m.needLiner ? (m.bottomLiner ?? "") : "—", linerBg, linerFg); col++;

      // 纸箱
      const cartonBg = m.needCarton ? rowBg : COLORS.disabled;
      const cartonFg = m.needCarton ? COLORS.valueFg : COLORS.disabledFg;
      setCell(ws, row, col, m.needCarton ? (m.innerBox ?? "") : "不需要", cartonBg, cartonFg); col++;
      setCell(ws, row, col, m.needCarton ? (m.outerBox ?? "") : "—", cartonBg, cartonFg); col++;

      // 备注
      setCell(ws, row, col, m.modelRemarks ?? "", rowBg, COLORS.valueFg);
    });

    // 如果没有型号，加一个空行提示
    if (models.length === 0) {
      const row = startRow;
      ws.getRow(row).height = 30;
      mergeSet(ws, row, 1, row, totalCols, "（暂无型号数据）", COLORS.disabled, COLORS.disabledFg);
    }

    // ── 备注行 ────────────────────────────────────────────────────────────────
    const remarkRow = startRow + Math.max(models.length, 1) + 1;
    ws.getRow(remarkRow).height = 18;
    mergeSet(ws, remarkRow, 1, remarkRow, 2, "订单备注", COLORS.labelBg, COLORS.labelFg, true, 9);
    mergeSet(ws, remarkRow, 3, remarkRow, totalCols, order.remarks ?? "", COLORS.valueBg, COLORS.valueFg);

    // ── 签名行 ────────────────────────────────────────────────────────────────
    const signRow = remarkRow + 1;
    ws.getRow(signRow).height = 28;
    const depts = ["计划部", "仓库", "质检部", "生产部"];
    const signSpan = Math.floor(totalCols / depts.length);
    depts.forEach((dept, i) => {
      const c1 = i * signSpan + 1;
      const c2 = i === depts.length - 1 ? totalCols : (i + 1) * signSpan;
      mergeSet(ws, signRow, c1, signRow, c2, `${dept}签名：`, COLORS.labelBg, COLORS.labelFg, false, 9);
    });

    // 打印区域
    ws.pageSetup.printArea = `A1:${String.fromCharCode(64 + totalCols)}${signRow}`;
    // 每页重复列标题行
    ws.pageSetup.firstPageNumber = 1;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
