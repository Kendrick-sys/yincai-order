import ExcelJS from "exceljs";
import { getOrderById, getDb } from "./db";
import { orders as ordersTable, orderModels as orderModelsTable } from "../drizzle/schema";
import { and, isNull, like, eq } from "drizzle-orm";
import https from "https";
import http from "http";

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
  imgBg:      "FFFDE7",
  overseas:   "D6E4F7",
  domestic:   "F0F0F0",
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

/** 从 URL 下载图片数据，返回 Buffer */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith("https") ? https : http;
      const req = protocol.get(url, { timeout: 8000 }, (res) => {
        if (res.statusCode !== 200) { resolve(null); return; }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => resolve(null));
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

/** 猜测图片扩展名 */
function guessExt(url: string): "jpeg" | "png" | "gif" {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "png";
  if (lower.includes(".gif")) return "gif";
  return "jpeg";
}

/** 安全解析 JSON 数组字符串 */
function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 在指定行、指定列嵌入多张图片（多张图片纵向堆叠，每张占一行）
 * 返回实际使用的行数
 */
async function embedImagesInColumn(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  startRow: number,
  col: number,
  urls: string[],
  bgHex: string,
  labelText: string,
  imgHeightPt = 80
): Promise<number> {
  if (urls.length === 0) return 0;

  let rowsUsed = 0;
  for (const url of urls) {
    try {
      const buf = await fetchImageBuffer(url);
      if (!buf) continue;
      const ext = guessExt(url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgId = wb.addImage({ buffer: buf as any, extension: ext });
      const r = startRow + rowsUsed;
      ws.getRow(r).height = imgHeightPt;
      const cell = ws.getCell(r, col);
      cell.fill = fill(bgHex);
      cell.border = border();
      cell.alignment = { horizontal: "center", vertical: "bottom", wrapText: true };
      cell.font = font("888888", false, 7);
      cell.value = rowsUsed === 0 ? labelText : "";
      ws.addImage(imgId, {
        tl: { col: col - 1, row: r - 1 } as any,
        br: { col: col,     row: r     } as any,
        editAs: "oneCell",
      } as any);
      rowsUsed++;
    } catch {
      // 忽略单张图片错误
    }
  }
  return rowsUsed;
}

/**
 * 生成单张订单的 Excel（只有「吟彩销售订单记录表」一个工作表）
 */
export async function generateOrderExcel(orderId: number): Promise<Buffer> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("订单不存在");

  const wb = new ExcelJS.Workbook();
  wb.creator = "吟彩销售订单系统";
  wb.created = new Date();

  const ws = wb.addWorksheet("吟彩销售订单记录表", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // 列宽：描述项目|型号名称|数量|上盖|下盖|配件|贴纸来源|贴纸描述|丝印描述|上盖内衬|下盖内衬|内箱|外箱|备注
  const colWidths = [18, 16, 8, 14, 14, 12, 12, 18, 18, 16, 16, 14, 14, 14];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const totalCols = colWidths.length;

  // 列索引（1-indexed）
  const COL_STICKER_DESC = 8;
  const COL_SILK_DESC    = 9;
  const COL_TOP_LINER    = 10;
  const COL_BOT_LINER    = 11;

  // ── 第1行：大标题
  ws.getRow(1).height = 36;
  mergeSet(ws, 1, 1, 1, totalCols, "吟彩销售订单记录表", COLORS.headerBg, COLORS.headerFg, true, 14);

  // ── 第2行：订单基本信息行1（订单描述 / 客户 / 订单号）
  ws.getRow(2).height = 20;
  const isOverseas = (order as any).customerType === "overseas";
  const customerTypeLabel = isOverseas ? "国外" : "国内";
  const customsDeclared: boolean | null = (order as any).customsDeclared ?? null;

  // 行2：订单描述 | 客户（国内/国外）| 订单号
  const row2Span = Math.floor(totalCols / 3);
  mergeSet(ws, 2, 1, 2, row2Span,
    `订单描述：${order.orderDescription ?? ""}`,
    COLORS.labelBg, COLORS.labelFg, false, 9);
  mergeSet(ws, 2, row2Span + 1, 2, row2Span * 2,
    `客户：${order.customer ?? ""}  [「${customerTypeLabel}」]`,
    isOverseas ? COLORS.overseas : COLORS.labelBg,
    isOverseas ? "1A3C5E" : COLORS.labelFg, isOverseas, 9);
  mergeSet(ws, 2, row2Span * 2 + 1, 2, totalCols,
    `订单号：${order.orderNo ?? ""}`,
    COLORS.labelBg, COLORS.labelFg, false, 9);

  // 行3：是否报关（国外客户显示报关信息，国内客户显示下单日期+交货日期+制单员）
  ws.getRow(3).height = 20;
  if (isOverseas) {
    const customsBg  = customsDeclared ? "FFF3CD" : "F0F0F0";
    const customsFg  = customsDeclared ? "7B5800" : "555555";
    const customsVal = customsDeclared === null ? "报关未标注" :
                       customsDeclared ? "☑ 需要报关" : "☐ 无需报关";
    mergeSet(ws, 3, 1, 3, 3, `报关状态：${customsVal}`, customsBg, customsFg, true, 10);
    mergeSet(ws, 3, 4, 3, Math.floor(totalCols / 2),
      `下单日期：${order.orderDate ?? ""}   交货日期：${order.deliveryDate ?? ""}`,
      COLORS.labelBg, COLORS.labelFg, false, 9);
    mergeSet(ws, 3, Math.floor(totalCols / 2) + 1, 3, totalCols,
      `制单员：${order.maker ?? ""}   销售员：${order.salesperson ?? ""}`,
      COLORS.labelBg, COLORS.labelFg, false, 9);
  } else {
    mergeSet(ws, 3, 1, 3, Math.floor(totalCols / 3),
      `下单日期：${order.orderDate ?? ""}`,
      COLORS.labelBg, COLORS.labelFg, false, 9);
    mergeSet(ws, 3, Math.floor(totalCols / 3) + 1, 3, Math.floor(totalCols * 2 / 3),
      `交货日期：${order.deliveryDate ?? ""}`,
      COLORS.labelBg, COLORS.labelFg, false, 9);
    mergeSet(ws, 3, Math.floor(totalCols * 2 / 3) + 1, 3, totalCols,
      `制单员：${order.maker ?? ""}   销售员：${order.salesperson ?? ""}`,
      COLORS.labelBg, COLORS.labelFg, false, 9);
  }

  // ── 第4行：列标题
  ws.getRow(4).height = 24;
  const headers = ["描述项目", "型号名称", "数量", "上盖材质", "下盖材质", "配件", "贴纸来源", "贴纸描述", "丝印描述", "上盖内衬", "下盖内衬", "内筱规格", "外筱规格", "备注"];
  headers.forEach((h, i) => {
    setCell(ws, 4, i + 1, h, COLORS.sectionBox, COLORS.sectionFg, true, 10, "center");
  });

  // ── 数据行（每个型号：文字行 + 图片行）
  const models = order.models ?? [];
  let currentRow = 5;

  for (let idx = 0; idx < models.length; idx++) {
    const m = models[idx];
    const dataRow = currentRow;
    ws.getRow(dataRow).height = 40;
    const rowBg = idx % 2 === 0 ? COLORS.valueBg : "FAFBFC";

    setCell(ws, dataRow, 1, `型号 ${idx + 1}`, COLORS.sectionBox, COLORS.sectionFg, true, 9, "center");
    setCell(ws, dataRow, 2, m.modelName ?? "", rowBg, COLORS.valueFg);
    setCell(ws, dataRow, 3, m.quantity ?? "", rowBg, COLORS.valueFg, false, 10, "center");
    setCell(ws, dataRow, 4, m.topCover ?? "", rowBg, COLORS.valueFg);
    setCell(ws, dataRow, 5, m.bottomCover ?? "", rowBg, COLORS.valueFg);
    setCell(ws, dataRow, 6, m.accessories ?? "", rowBg, COLORS.valueFg);

    const stickerBg = m.needSticker ? rowBg : COLORS.disabled;
    const stickerFg = m.needSticker ? COLORS.valueFg : COLORS.disabledFg;
    setCell(ws, dataRow, 7, m.needSticker ? (m.stickerSource ?? "") : "不需要", stickerBg, stickerFg);
    setCell(ws, dataRow, COL_STICKER_DESC, m.needSticker ? (m.stickerDesc ?? "") : "—", stickerBg, stickerFg);

    const silkBg = m.needSilkPrint ? rowBg : COLORS.disabled;
    const silkFg = m.needSilkPrint ? COLORS.valueFg : COLORS.disabledFg;
    setCell(ws, dataRow, COL_SILK_DESC, m.needSilkPrint ? (m.silkPrintDesc ?? "") : "不需要", silkBg, silkFg);

    const linerBg = m.needLiner ? rowBg : COLORS.disabled;
    const linerFg = m.needLiner ? COLORS.valueFg : COLORS.disabledFg;
    setCell(ws, dataRow, COL_TOP_LINER, m.needLiner ? (m.topLiner ?? "") : "不需要", linerBg, linerFg);
    setCell(ws, dataRow, COL_BOT_LINER, m.needLiner ? (m.bottomLiner ?? "") : "—", linerBg, linerFg);

    const cartonBg = m.needCarton ? rowBg : COLORS.disabled;
    const cartonFg = m.needCarton ? COLORS.valueFg : COLORS.disabledFg;
    setCell(ws, dataRow, 12, m.needCarton ? (m.innerBox ?? "") : "不需要", cartonBg, cartonFg);
    setCell(ws, dataRow, 13, m.needCarton ? (m.outerBox ?? "") : "—", cartonBg, cartonFg);
    setCell(ws, dataRow, totalCols, m.modelRemarks ?? "", rowBg, COLORS.valueFg);

    currentRow++;

    // 图片行
    const stickerUrls: string[] = m.needSticker ? parseJsonArray(m.stickerImages) : [];
    const silkUrls: string[]    = m.needSilkPrint ? parseJsonArray(m.silkPrintImages) : [];
    const linerUrls: string[]   = m.needLiner ? parseJsonArray(m.linerImages) : [];
    const hasImages = stickerUrls.length > 0 || silkUrls.length > 0 || linerUrls.length > 0;

    if (hasImages) {
      const IMG_HEIGHT_PT = 80;
      const imgStartRow = currentRow;
      const maxRows = Math.max(stickerUrls.length, silkUrls.length, linerUrls.length);

      for (let r = imgStartRow; r < imgStartRow + maxRows; r++) {
        ws.getRow(r).height = IMG_HEIGHT_PT;
        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getCell(r, c);
          cell.fill = fill(COLORS.imgBg);
          cell.border = border();
        }
      }

      if (maxRows === 1) {
        setCell(ws, imgStartRow, 1, "附件图片", COLORS.labelBg, COLORS.labelFg, true, 8, "center");
      } else {
        mergeSet(ws, imgStartRow, 1, imgStartRow + maxRows - 1, 1, "附件图片", COLORS.labelBg, COLORS.labelFg, true, 8);
      }

      if (stickerUrls.length > 0) {
        await embedImagesInColumn(wb, ws, imgStartRow, COL_STICKER_DESC, stickerUrls, COLORS.sticker, "贴纸", IMG_HEIGHT_PT);
      }
      if (silkUrls.length > 0) {
        await embedImagesInColumn(wb, ws, imgStartRow, COL_SILK_DESC, silkUrls, COLORS.silk, "丝印", IMG_HEIGHT_PT);
      }
      if (linerUrls.length > 0) {
        await embedImagesInColumn(wb, ws, imgStartRow, COL_TOP_LINER, linerUrls, COLORS.liner, "内衬", IMG_HEIGHT_PT);
      }

      currentRow += maxRows;
    }
  }

  if (models.length === 0) {
    ws.getRow(currentRow).height = 30;
    mergeSet(ws, currentRow, 1, currentRow, totalCols, "（暂无型号数据）", COLORS.disabled, COLORS.disabledFg);
    currentRow++;
  }

  // 备注行
  const remarkRow = currentRow + 1;
  ws.getRow(remarkRow).height = 18;
  mergeSet(ws, remarkRow, 1, remarkRow, 2, "订单备注", COLORS.labelBg, COLORS.labelFg, true, 9);
  mergeSet(ws, remarkRow, 3, remarkRow, totalCols, order.remarks ?? "", COLORS.valueBg, COLORS.valueFg);

  // 收件人信息行
  const recipientRow = remarkRow + 1;
  ws.getRow(recipientRow).height = 18;
  const recipientInfo = [
    order.recipientName    ? `收件人：${order.recipientName}` : "",
    order.recipientPhone   ? `电话：${order.recipientPhone}` : "",
    order.recipientAddress ? `地址：${order.recipientAddress}` : "",
    order.factoryShipNo    ? `工厂发货单号：${order.factoryShipNo}` : "",
  ].filter(Boolean).join("   ");

  if (recipientInfo) {
    mergeSet(ws, recipientRow, 1, recipientRow, 2, "收件信息", COLORS.labelBg, COLORS.labelFg, true, 9);
    mergeSet(ws, recipientRow, 3, recipientRow, totalCols, recipientInfo, COLORS.valueBg, COLORS.valueFg);
  } else {
    mergeSet(ws, recipientRow, 1, recipientRow, totalCols, "", COLORS.valueBg, COLORS.valueFg);
  }

  // 签名行
  const signRow = recipientRow + 1;
  ws.getRow(signRow).height = 28;
  const depts = ["计划部", "仓库", "质检部", "生产部"];
  const signSpan = Math.floor(totalCols / depts.length);
  depts.forEach((dept, i) => {
    const c1 = i * signSpan + 1;
    const c2 = i === depts.length - 1 ? totalCols : (i + 1) * signSpan;
    mergeSet(ws, signRow, c1, signRow, c2, `${dept}签名：`, COLORS.labelBg, COLORS.labelFg, false, 9);
  });

  ws.pageSetup.printArea = `A1:${String.fromCharCode(64 + totalCols)}${signRow}`;
  ws.pageSetup.firstPageNumber = 1;
  // 启用列标题行的 AutoFilter
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to:   { row: signRow - 1, column: totalCols },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ──────────────────────────────────────────────────────────────────────────────
// 按月汇总导出辅助类型
// ──────────────────────────────────────────────────────────────────────────────

type OrderStatus = "draft" | "submitted" | "in_production" | "completed" | "cancelled";

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  in_production: "生产中",
  completed: "已完成",
  cancelled: "已取消",
};

const STATUS_DISPLAY: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  in_production: "生产中",
  completed: "已完成",
  cancelled: "已取消",
};

/**
 * 在汇总工作表中写入一批订单的汇总行
 * 列：序号 | 订单描述 | 客户 | 国内/国外 | 是否报关 | 订单号 | 下单日期 | 交货日期 | 制单员 | 销售员 | 状态 | 型号数 | 备注
 * 底部增加总计行（总订单数 + 总型号数）
 * 第2行列标题启用 AutoFilter 筛选
 */
function buildSummarySheet(
  ws: ExcelJS.Worksheet,
  sheetTitle: string,
  ordersData: Array<{
    id: number;
    orderDescription: string | null;
    customer: string | null;
    customerType: string | null;
    customsDeclared: boolean | null;
    orderNo: string | null;
    orderDate: string | null;
    deliveryDate: string | null;
    maker: string | null;
    salesperson: string | null;
    status: string | null;
    remarks: string | null;
    modelCount: number;
  }>
) {
  const COL_WIDTHS = [6, 22, 18, 10, 10, 16, 12, 12, 10, 10, 10, 8, 28];
  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const totalCols = COL_WIDTHS.length;

  // 第1行：大标题
  ws.getRow(1).height = 34;
  mergeSet(ws, 1, 1, 1, totalCols, sheetTitle, COLORS.headerBg, COLORS.headerFg, true, 13);

  // 第2行：列标题（启用 AutoFilter）
  ws.getRow(2).height = 22;
  const headers = ["序号", "订单描述", "客户", "国内/国外", "是否报关", "订单号", "下单日期", "交货日期", "制单员", "销售员", "状态", "型号数", "备注"];
  headers.forEach((h, i) => {
    setCell(ws, 2, i + 1, h, COLORS.sectionBox, COLORS.sectionFg, true, 10, "center");
  });

  if (ordersData.length === 0) {
    ws.getRow(3).height = 28;
    mergeSet(ws, 3, 1, 3, totalCols, "（本月暂无此类订单）", COLORS.disabled, COLORS.disabledFg);
    return;
  }

  // 数据行（从第3行开始）
  ordersData.forEach((order, idx) => {
    const row = idx + 3;
    ws.getRow(row).height = 32;
    const rowBg = idx % 2 === 0 ? COLORS.valueBg : "FAFBFC";
    const isOverseas = order.customerType === "overseas";
    const customerTypeTxt = isOverseas ? "国外" : "国内";
    const customsTxt = isOverseas
      ? (order.customsDeclared ? "需要报关" : "无需报关")
      : "—";
    const statusTxt = STATUS_DISPLAY[order.status ?? ""] ?? (order.status ?? "");

    // 国外行用浅蓝背景，国内用默认背景
    const rowActualBg = isOverseas ? (idx % 2 === 0 ? "EBF4FF" : "D6EAFF") : rowBg;

    const values = [
      String(idx + 1),
      order.orderDescription ?? "",
      order.customer ?? "",
      customerTypeTxt,
      customsTxt,
      order.orderNo ?? "",
      order.orderDate ?? "",
      order.deliveryDate ?? "",
      order.maker ?? "",
      order.salesperson ?? "",
      statusTxt,
      String(order.modelCount),
      order.remarks ?? "",
    ];

    values.forEach((val, ci) => {
      const align: ExcelJS.Alignment["horizontal"] = (ci === 0 || ci === 11) ? "center" : "left";
      let cellBg = rowActualBg;
      let cellFg = COLORS.valueFg;
      if (ci === 3) {
        cellBg = isOverseas ? COLORS.overseas : COLORS.domestic;
        cellFg = isOverseas ? "1A3C5E" : "555555";
      } else if (ci === 4 && isOverseas) {
        cellBg = order.customsDeclared ? "FFF3CD" : "F0F0F0";
        cellFg = order.customsDeclared ? "7B5800" : "555555";
      }
      setCell(ws, row, ci + 1, val, cellBg, cellFg, false, 9, align);
    });
  });

  // ── 启用 AutoFilter（第2行列标题行）
  const lastDataRow = ordersData.length + 2;
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to:   { row: lastDataRow, column: totalCols },
  };

  // ── 总计行（紧接数据行之后）
  const totalRow = lastDataRow + 1;
  ws.getRow(totalRow).height = 26;
  const totalModelCount = ordersData.reduce((sum, o) => sum + o.modelCount, 0);
  const totalOverseas = ordersData.filter(o => o.customerType === "overseas").length;
  const totalDomestic = ordersData.length - totalOverseas;
  const totalCustoms  = ordersData.filter(o => o.customerType === "overseas" && o.customsDeclared).length;

  // 合并前几列写总计标签
  mergeSet(ws, totalRow, 1, totalRow, 2, "合计", "1A3C5E", "FFFFFF", true, 10);
  setCell(ws, totalRow, 3, `共 ${ordersData.length} 张订单`, "E8F0F8", "1A3C5E", true, 9, "center");
  setCell(ws, totalRow, 4, `国内 ${totalDomestic} / 国外 ${totalOverseas}`, "E8F0F8", "1A3C5E", false, 9, "center");
  setCell(ws, totalRow, 5, totalOverseas > 0 ? `报关 ${totalCustoms} 张` : "—", "E8F0F8", "7B5800", false, 9, "center");
  // 中间列留空
  for (let c = 6; c <= totalCols - 1; c++) {
    setCell(ws, totalRow, c, "", "E8F0F8", COLORS.valueFg);
  }
  // 型号数列写总型号数
  setCell(ws, totalRow, 12, `共 ${totalModelCount} 个型号`, "E8F0F8", "1A3C5E", true, 9, "center");
  setCell(ws, totalRow, 13, "", "E8F0F8", COLORS.valueFg);
}

/**
 * 按年月批量导出该月所有订单 Excel
 * 共3个工作表：
 *   1. 「吟彩X月所有销售」 - 全部订单汇总
 *   2. 「国内」 - 国内客户订单
 *   3. 「国外」 - 国外客户订单（含报关信息）
 */
export async function generateMonthlyOrdersExcel(
  year: number,
  month: number,
  status?: OrderStatus
): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const conditions = [
    isNull(ordersTable.deletedAt),
    like(ordersTable.orderDate, `${prefix}%`),
    ...(status ? [eq(ordersTable.status, status)] : []),
  ];

  const monthOrders = await db.select().from(ordersTable)
    .where(and(...conditions))
    .orderBy(ordersTable.orderDate);

  const statusLabel = status ? `「${STATUS_LABEL[status] ?? status}」` : "全部";

  if (monthOrders.length === 0) {
    throw new Error(`${year}年${month}月${statusLabel}订单暂无数据`);
  }

  // 加载每个订单的型号数量
  const ordersWithModelCount = await Promise.all(
    monthOrders.map(async (order) => {
      const models = await db!.select().from(orderModelsTable)
        .where(eq(orderModelsTable.orderId, order.id));
      return {
        id: order.id,
        orderDescription: order.orderDescription,
        customer: order.customer,
        customerType: (order as any).customerType as string | null,
        customsDeclared: (order as any).customsDeclared as boolean | null,
        orderNo: order.orderNo,
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate,
        maker: order.maker,
        salesperson: order.salesperson,
        status: order.status,
        remarks: order.remarks,
        modelCount: models.length,
      };
    })
  );

  const domesticOrders = ordersWithModelCount.filter(o => o.customerType !== "overseas");
  const overseasOrders = ordersWithModelCount.filter(o => o.customerType === "overseas");

  const wb = new ExcelJS.Workbook();
  wb.creator = "吟彩销售订单系统";
  wb.created = new Date();

  const monthStr = `${year}年${month}月`;
  const statusSuffix = status ? `（${STATUS_LABEL[status]}）` : "";

  // ── 工作表1：全部订单汇总
  const wsAll = wb.addWorksheet(`吟彩${monthStr}所有销售${statusSuffix}`);
  buildSummarySheet(
    wsAll,
    `吟彩 ${monthStr} 销售订单汇总${statusSuffix}  共 ${ordersWithModelCount.length} 张`,
    ordersWithModelCount
  );

  // ── 工作表2：国内订单
  const wsDomestic = wb.addWorksheet(`国内${statusSuffix}`);
  buildSummarySheet(
    wsDomestic,
    `吟彩 ${monthStr} 国内销售订单${statusSuffix}  共 ${domesticOrders.length} 张`,
    domesticOrders
  );

  // ── 工作表3：国外订单
  const wsOverseas = wb.addWorksheet(`国外${statusSuffix}`);
  buildSummarySheet(
    wsOverseas,
    `吟彩 ${monthStr} 国外销售订单${statusSuffix}  共 ${overseasOrders.length} 张`,
    overseasOrders
  );

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
