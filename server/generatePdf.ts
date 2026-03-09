/**
 * generatePdf.ts
 * 使用 Puppeteer 将 HTML 渲染为 PDF，支持：
 * - 国内采购合同（中文）
 * - PI（形式发票，英文）
 * - CI（商业发票，英文）
 */

import puppeteer, { type Browser } from "puppeteer-core";
import { ENV } from "./_core/env";

// ── Puppeteer 浏览器单例（避免每次生成 PDF 都冷启动）──────────────────────────────────────
let _browserInstance: Browser | null = null;
let _browserLaunching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  // 如果已有实例，先检测它是否仍在运行
  if (_browserInstance) {
    try {
      await _browserInstance.pages(); // 如果崩溃会抛异常
      return _browserInstance;
    } catch {
      _browserInstance = null;
    }
  }
  // 如果正在启动中，等待完成（避免并发启动多个实例）
  if (_browserLaunching) return _browserLaunching;

  _browserLaunching = puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    headless: true,
  }).then(browser => {
    _browserInstance = browser;
    _browserLaunching = null;
    // 监听崩溃事件，自动清除实例引用
    browser.on("disconnected", () => { _browserInstance = null; });
    return browser;
  }).catch(err => {
    _browserLaunching = null;
    throw err;
  });

  return _browserLaunching;
}

// ─── 材质名称中英文映射（确保 PI/CI PDF 纯英文输出） ─────────────────────────────────────

const LINER_MATERIAL_EN: Record<string, string> = {
  "PU":           "PU",
  "EPE":          "EPE",
  "EPE (珍珠棉)": "EPE",
  "PU（普通棉）":  "PU",
  "EPE（珍珠棉）": "EPE",
  "XPE":          "XPE",
  "XPE (交联聚乙烯)": "XPE",
  "XPE（交联聚乙烯）": "XPE",
  "EVA":          "EVA",
  "其他":         "Other",
};

const LOGO_MATERIAL_EN: Record<string, string> = {
  "PVC":              "PVC",
  "滴胶":             "Epoxy Resin",
  "Epoxy Resin":      "Epoxy Resin",
  "PC":               "PC",
  "鄧射":             "Laser Engraving",  // 鄧射（镑射的异体字，保留兼容）
  "Laser Engraving":  "Laser Engraving",
  "镜面鄧射":         "Mirror Laser",   // 鄧射（镑射的异体字，保留兼容）
  "金属拉丝":         "Metal Brushed",
  "Metal Brushed":    "Metal Brushed",
  "其他":             "Other",
};

/** 将 Liner 材质名称转为英文（如未匹配则保留原字符串） */
function linerMatEn(mat?: string): string {
  if (!mat) return "";
  return LINER_MATERIAL_EN[mat] ?? mat;
}

/** 将 Logo 材质名称转为英文（如未匹配则保留原字符串） */
function logoMatEn(mat?: string): string {
  if (!mat) return "";
  return LOGO_MATERIAL_EN[mat] ?? mat;
}

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface LineItem {
  modelName: string;
  material?: string;
  spec?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface DomesticExtras {
  hasLiner: boolean;
  linerMaterial?: string;
  linerDescription?: string;
  linerQuantity: number;
  linerUnitPrice: number;
  linerAmount: number;
  hasLinerTemplate: boolean;
  linerTemplateQuantity: number;
  linerTemplateUnitPrice: number;
  linerTemplateAmount: number;
  hasLogo: boolean;
  logoMaterial?: string;
  logoDescription?: string;
  logoQuantity: number;
  logoUnitPrice: number;
  logoAmount: number;
  hasSilkPrint: boolean;
  silkPrintDescription?: string;
  silkPrintQuantity: number;
  silkPrintUnitPrice: number;
  silkPrintAmount: number;
  hasSilkPrintTemplate: boolean;
  silkPrintTemplateQuantity: number;
  silkPrintTemplateUnitPrice: number;
  silkPrintTemplateAmount: number;
  hasCustomColor: boolean;
  customColorQuantity: number;
  customColorUnitPrice: number;
  customColorAmount: number;
  shippingFee: number;
}

export interface ContractCnData {
  docNo: string;
  orderDate: string;
  isAmazon?: boolean;              // 亚马逊订单：吟彩为甲方（采购方），供货商为乙方
  counterpartyName: string;       // 对方名称（普通订单为甲方，亚马逊订单为乙方）
  counterpartyAddress?: string;
  buyerCnCompany?: string;         // 甲方公司全称
  buyerTaxNo?: string;             // 甲方税号
  buyerBankAccount?: string;       // 甲方对公账号
  buyerBankName?: string;          // 甲方对公开户行
  lineItems: LineItem[];
  totalAmount: number;
  depositPct: number;
  balancePct: number;
  needInvoice?: boolean;          // 是否需要开票
  extras?: DomesticExtras;        // 附加明细（内衬、LOGO、丝印、颜色、运费）
}

export interface PiCiExtras {
  hasLiner: boolean;
  linerMaterial?: string;
  linerDescription?: string;
  linerQuantity: number;
  linerUnitPrice: number;
  linerAmount: number;
  hasLinerTemplate: boolean;
  linerTemplateQuantity: number;
  linerTemplateUnitPrice: number;
  linerTemplateAmount: number;
  hasLogo: boolean;
  logoMaterial?: string;
  logoDescription?: string;
  logoQuantity: number;
  logoUnitPrice: number;
  logoAmount: number;
  hasSilkPrint: boolean;
  silkPrintDescription?: string;
  silkPrintQuantity: number;
  silkPrintUnitPrice: number;
  silkPrintAmount: number;
  hasSilkPrintTemplate: boolean;
  silkPrintTemplateQuantity: number;
  silkPrintTemplateUnitPrice: number;
  silkPrintTemplateAmount: number;
  hasCustomColor: boolean;
  customColorQuantity: number;
  customColorUnitPrice: number;
  customColorAmount: number;
  // 运费拆分（PI/CI 专用）
  domesticFreight: number;
  internationalFreightType?: string;  // "air" | "sea" | ""
  internationalFreight: number;
  freightDescription?: string;
}

export interface PiCiData {
  docType: "pi" | "ci";
  docNo: string;
  docDate: string;
  deliveryDate: string;
  buyerName: string;          // Contact name (TO)
  buyerAttn?: string;          // Attn
  buyerCompany?: string;       // Company name
  buyerAddress?: string;       // Address
  buyerTel?: string;           // Tel
  buyerEmail?: string;         // Email
  transitDays?: string;        // Estimated transit days
  lineItems: LineItem[];
  totalAmount: number;
  currency: string;
  depositPct: number;
  balancePct: number;
  incoterms?: string;
  portOfLoading?: string;
  bankChoice: "icbc" | "citi";
  extras?: PiCiExtras;
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/** 数字转中文大写金额 */
function numberToChinese(num: number): string {
  if (isNaN(num) || num < 0) return "零元整";
  const digits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const units = ["", "拾", "佰", "仟"];
  const sections = ["", "万", "亿", "万亿"];

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  const jiao = Math.floor(decPart / 10);
  const fen = decPart % 10;

  if (intPart === 0 && jiao === 0 && fen === 0) return "零元整";

  function convertSection(n: number): string {
    if (n === 0) return "";
    let result = "";
    let zeroFlag = false;
    const str = n.toString().padStart(4, "0");
    for (let i = 0; i < 4; i++) {
      const d = parseInt(str[i]);
      if (d === 0) {
        zeroFlag = true;
      } else {
        if (zeroFlag && result.length > 0) result += "零";
        result += digits[d] + units[3 - i];
        zeroFlag = false;
      }
    }
    return result;
  }

  let result = "";
  const sectionArr: number[] = [];
  let tmp = intPart;
  while (tmp > 0) {
    sectionArr.unshift(tmp % 10000);
    tmp = Math.floor(tmp / 10000);
  }
  if (sectionArr.length === 0) sectionArr.push(0);

  for (let i = 0; i < sectionArr.length; i++) {
    const s = convertSection(sectionArr[i]);
    if (s) {
      if (i > 0 && sectionArr[i] < 1000) result += "零";
      result += s + sections[sectionArr.length - 1 - i];
    } else if (i < sectionArr.length - 1 && sectionArr[i + 1] > 0) {
      result += "零";
    }
  }

  result += "元";
  if (jiao === 0 && fen === 0) {
    result += "整";
  } else if (jiao === 0) {
    result += "零" + digits[fen] + "分";
  } else {
    result += digits[jiao] + "角";
    if (fen > 0) result += digits[fen] + "分";
    else result += "整";
  }
  return result;
}

/** 格式化金额显示 */
function formatAmount(amount: number, currency = "CNY"): string {
  if (currency === "CNY") {
    return "¥" + amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── HTML 模板：国内采购合同 ────────────────────────────────────────────────────

function buildContractCnHtml(data: ContractCnData): string {
  const { docNo, orderDate, isAmazon, counterpartyName, counterpartyAddress, buyerCnCompany, buyerTaxNo, buyerBankAccount, buyerBankName, lineItems, totalAmount, depositPct, balancePct, needInvoice, extras } = data;
  const depositAmount = Math.round(totalAmount * depositPct) / 100;
  const balanceAmount = Math.round(totalAmount * balancePct) / 100;
  const totalChinese = numberToChinese(totalAmount);

  // 亚马逊订单：吟彩为甲方（采购方），供货商为乙方
  // 普通订单：客户为甲方（采购方），吟彩为乙方（供货方）
  const partyA = isAmazon
    ? { name: ENV.companyCnName, address: ENV.companyCnAddress || '', taxNo: ENV.companyTaxNo || '', bankName: ENV.companyCnBankName || '', bankAccount: ENV.companyCnBankAccount || '' }
    : { name: buyerCnCompany || counterpartyName, address: counterpartyAddress || '', taxNo: buyerTaxNo || '', bankName: buyerBankName || '', bankAccount: buyerBankAccount || '' };
  const partyB = isAmazon
    ? { name: buyerCnCompany || counterpartyName, address: counterpartyAddress || '', taxNo: buyerTaxNo || '', bankName: buyerBankName || '', bankAccount: buyerBankAccount || '' }
    : { name: ENV.companyCnName, address: ENV.companyCnAddress || '', taxNo: ENV.companyTaxNo || '', bankName: ENV.companyCnBankName || '', bankAccount: ENV.companyCnBankAccount || '' };

  // 列顺序：产品名称 | 型号 | 材质 | 数量 | 单价 | 金额
  const tableRows = lineItems.map(item => `
    <tr>
      <td>${item.modelName || ""}</td>
      <td>${item.spec || ""}</td>
      <td>${item.material || ""}</td>
      <td>${item.quantity || ""}</td>
      <td>${item.unitPrice > 0 ? formatAmount(item.unitPrice) : ""}</td>
      <td>${item.amount > 0 ? formatAmount(item.amount) : ""}</td>
    </tr>
  `).join("");

  // 附加明细行（内衬、LOGO、丝印、定制颜色、运费）
  const extraRows: string[] = [];
  if (extras) {
    if (extras.hasLiner) {
      const linerLabel = extras.linerMaterial
        ? `内衬（${extras.linerMaterial}${extras.linerDescription ? "，" + extras.linerDescription : ""}）`
        : `内衬${extras.linerDescription ? "（" + extras.linerDescription + "）" : ""}`;
      extraRows.push(`
        <tr>
          <td>${linerLabel}</td>
          <td>—</td>
          <td>${extras.linerMaterial || ""}</td>
          <td>${extras.linerQuantity || ""}</td>
          <td>${extras.linerUnitPrice > 0 ? formatAmount(extras.linerUnitPrice) : ""}</td>
          <td>${extras.linerAmount > 0 ? formatAmount(extras.linerAmount) : ""}</td>
        </tr>
      `);
      if (extras.hasLinerTemplate) {
        extraRows.push(`
          <tr>
            <td>内衬定制模板费</td>
            <td>—</td>
            <td>—</td>
            <td>${extras.linerTemplateQuantity || ""}</td>
            <td>${extras.linerTemplateUnitPrice > 0 ? formatAmount(extras.linerTemplateUnitPrice) : ""}</td>
            <td>${extras.linerTemplateAmount > 0 ? formatAmount(extras.linerTemplateAmount) : ""}</td>
          </tr>
        `);
      }
    }
    if (extras.hasLogo) {
      const logoLabel = extras.logoMaterial
        ? `定制LOGO（${extras.logoMaterial}${extras.logoDescription ? "，" + extras.logoDescription : ""}）`
        : `定制LOGO${extras.logoDescription ? "（" + extras.logoDescription + "）" : ""}`;
      extraRows.push(`
        <tr>
          <td>${logoLabel}</td>
          <td>—</td>
          <td>${extras.logoMaterial || ""}</td>
          <td>${extras.logoQuantity || ""}</td>
          <td>${extras.logoUnitPrice > 0 ? formatAmount(extras.logoUnitPrice) : ""}</td>
          <td>${extras.logoAmount > 0 ? formatAmount(extras.logoAmount) : ""}</td>
        </tr>
      `);
    }
    if (extras.hasSilkPrint) {
      const silkLabel = extras.silkPrintDescription
        ? `定制丝印（${extras.silkPrintDescription}）`
        : "定制丝印";
      extraRows.push(`
        <tr>
          <td>${silkLabel}</td>
          <td>—</td>
          <td>—</td>
          <td>${extras.silkPrintQuantity || ""}</td>
          <td>${extras.silkPrintUnitPrice > 0 ? formatAmount(extras.silkPrintUnitPrice) : ""}</td>
          <td>${extras.silkPrintAmount > 0 ? formatAmount(extras.silkPrintAmount) : ""}</td>
        </tr>
      `);
      if (extras.hasSilkPrintTemplate) {
        extraRows.push(`
          <tr>
            <td>丝印定制模板费</td>
            <td>—</td>
            <td>—</td>
            <td>${extras.silkPrintTemplateQuantity || ""}</td>
            <td>${extras.silkPrintTemplateUnitPrice > 0 ? formatAmount(extras.silkPrintTemplateUnitPrice) : ""}</td>
            <td>${extras.silkPrintTemplateAmount > 0 ? formatAmount(extras.silkPrintTemplateAmount) : ""}</td>
          </tr>
        `);
      }
    }
    if (extras.hasCustomColor) {
      extraRows.push(`
        <tr>
          <td>定制颜色费用</td>
          <td>—</td>
          <td>—</td>
          <td>${extras.customColorQuantity || ""}</td>
          <td>${extras.customColorUnitPrice > 0 ? formatAmount(extras.customColorUnitPrice) : ""}</td>
          <td>${extras.customColorAmount > 0 ? formatAmount(extras.customColorAmount) : ""}</td>
        </tr>
      `);
    }
    if (extras.shippingFee > 0) {
      extraRows.push(`
        <tr>
          <td>物流运费</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>${formatAmount(extras.shippingFee)}</td>
        </tr>
      `);
    }
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    padding: 40px 50px;
    line-height: 1.7;
  }
  .header { position: relative; display: flex; align-items: flex-start; margin-bottom: 20px; min-height: 50px; }
  .logo-area { flex: 0 0 auto; position: relative; z-index: 1; }
  .logo-img { height: 45px; width: auto; }
  .title-area { position: absolute; left: 0; right: 0; top: 0; text-align: center; pointer-events: none; }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: 6px; margin-top: 8px; }
  .meta-row { display: flex; justify-content: space-between; margin: 16px 0 8px; font-size: 12px; }
  .party-section { display: flex; gap: 16px; margin: 16px 0 12px; }
  .party-card { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 10px 14px; background: #fafafa; }
  .party-card-title { font-weight: 700; font-size: 12px; color: #555; margin-bottom: 6px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
  .party-card-name { font-weight: 700; font-size: 13px; color: #1a1a1a; margin-bottom: 4px; }
  .party-card-row { font-size: 11px; color: #444; margin: 2px 0; line-height: 1.6; }
  .party-card-row span { color: #888; margin-right: 4px; }
  .preamble { margin: 12px 0 16px; font-size: 12px; line-height: 1.8; }
  .section-title { font-weight: 700; margin: 16px 0 8px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11.5px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: center; }
  th { background: #f5f5f5; font-weight: 600; }
  td:first-child { text-align: left; }
  .total-row td { font-weight: 600; }
  .clause { margin: 6px 0; font-size: 12px; line-height: 1.75; }
  .clause-num { font-weight: 600; }
  .sign-area { display: flex; justify-content: space-between; margin-top: 40px; }
  .sign-block { width: 45%; }

  @media print {
    body { padding: 20px 30px; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="logo-area">
    <img class="logo-img" src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275986025/MnhiE9LdbgqX24MUwA2SN8/inchoilogo2_4a83c5e6.png" alt="INCHOI CASES" />
  </div>
  <div class="title-area"><h1>采购合同</h1></div>
</div>

<div class="meta-row">
  <span>合同编号：${docNo}</span>
  <span>下单日期：${orderDate}</span>
</div>

<div class="party-section">
  <div class="party-card">
    <div class="party-card-title">甲方（采购方）</div>
    <div class="party-card-name">${partyA.name}</div>
    ${partyA.address ? `<div class="party-card-row"><span>地址：</span>${partyA.address}</div>` : ''}
    ${partyA.taxNo ? `<div class="party-card-row"><span>税号：</span>${partyA.taxNo}</div>` : ''}
    ${partyA.bankName ? `<div class="party-card-row"><span>开户行：</span>${partyA.bankName}</div>` : ''}
    ${partyA.bankAccount ? `<div class="party-card-row"><span>账号：</span>${partyA.bankAccount}</div>` : ''}
  </div>
  <div class="party-card">
    <div class="party-card-title">乙方（供货方）</div>
    <div class="party-card-name">${partyB.name}</div>
    ${partyB.address ? `<div class="party-card-row"><span>地址：</span>${partyB.address}</div>` : ''}
    ${partyB.taxNo ? `<div class="party-card-row"><span>税号：</span>${partyB.taxNo}</div>` : ''}
    ${partyB.bankName ? `<div class="party-card-row"><span>开户行：</span>${partyB.bankName}</div>` : ''}
    ${partyB.bankAccount ? `<div class="party-card-row"><span>账号：</span>${partyB.bankAccount}</div>` : ''}
  </div>
</div>

<p class="preamble">
甲、乙双方为了实现各自的经营目的，本着自愿、公平和诚实守信的原则，经双方充分协商达成一致，甲方同意向乙方订购产品，特订立本合同，以资双方共同遵守。
</p>

<div class="section-title">一、产品明细：</div>
<p class="clause">1. 具体产品明细、单价及总金额详见下方表格或双方确认的《采购订单》。</p>

<table>
  <thead>
    <tr>
      <th>产品名称</th><th>型号</th><th>材质</th><th>数量（个）</th><th>单价（元）</th><th>金额（元）</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    ${extraRows.join("")}
    <tr class="total-row">
      <td colspan="3">合同总金额${needInvoice ? "（含增值税）" : ""}</td>
      <td colspan="2">${totalChinese}</td>
      <td>${formatAmount(totalAmount)}</td>
    </tr>
  </tbody>
</table>

<div class="section-title">二、质量要求与验收标准：</div>
<p class="clause"><span class="clause-num">1. 质量标准：</span>乙方提供的产品必须符合双方确认的样品或技术图纸/规格书要求，并符合该类产品的国家质量标准和行业安全标准。</p>
<p class="clause"><span class="clause-num">2. 验收方式：</span>乙方生产完成后，应提前通知甲方。甲方有权在发货前派员或委托第三方机构到乙方工厂进行验货。验货合格并不免除乙方在质保期内的质量责任。</p>
<p class="clause"><span class="clause-num">3. 售后处理：</span>在质保期内，如发现产品存在非人为的质量问题（包括但不限于功能故障、外观缺陷、材质不符），乙方应在收到通知后3日内予以免费维修、包换或包退，并承担由此产生的往返运费及相关损失。</p>

<div class="section-title">三、付款方式：</div>
<p class="clause"><span class="clause-num">1. 定金：</span>合同签订后3个工作日内，甲方向乙方支付合同总金额的 ${depositPct}% 作为预付款（${formatAmount(depositAmount)}）。</p>
<p class="clause"><span class="clause-num">2. 尾款：</span>乙方完成生产，经甲方（或甲方指定代表）验货合格${needInvoice ? "，并提供全额增值税专用发票" : ""}后，甲方向乙方支付剩余 ${balancePct}% 尾款（${formatAmount(balanceAmount)}）。乙方收到尾款后应在24小时内安排发货。</p>

<div class="section-title">四、交货地点及运输：</div>
<p class="clause"><span class="clause-num">1. 交货地点：</span><strong>${counterpartyAddress || "（以双方确认为准）"}</strong></p>
<p class="clause"><span class="clause-num">2. 运输方式与费用：</span>除非另有约定，运输费用及运输途中的保险费用由乙方承担。货物在交付给甲方指定的收货人之前，毁损、灭失的风险由乙方承担。</p>

<div class="section-title">五、违约责任：</div>
<p class="clause"><span class="clause-num">1. 逾期交货：</span>乙方应严格按期供货。未经甲方书面同意，如乙方延期交货，每延期一天，应向甲方支付合同总金额 1% 的违约金；延期超过 15 天，甲方有权单方面解除合同，乙方应退还已收全部款项，并支付合同总金额的 20% 作为赔偿金。</p>
<p class="clause"><span class="clause-num">2. 质量违约：</span>如经检验产品质量不合格，乙方应立即进行返工或重做，因此造成的交货延期按上述逾期交货条款处理。若返工后仍不合格，甲方有权拒收并要求退款赔偿。</p>

<div class="section-title">六、合同变更：</div>
<p class="clause">1. 本合同签订后，供需双方不能擅自变更内容。如任何一方需要变更，须事先提出书面要求，在征得对方同意并在双方共同协商的基础上签订补充协议。</p>

<div class="section-title">七、知识产权与保密：</div>
<p class="clause"><span class="clause-num">1. 侵权责任：</span>乙方保证其提供的产品不侵犯任何第三方的知识产权（包括商标、专利、著作权）。如因乙方产品引起知识产权纠纷，由乙方承担全部法律责任及赔偿费用，并赔偿甲方因此受到的损失。</p>
<p class="clause"><span class="clause-num">2. 专有权利（针对定制/OEM）：</span>若产品是依据甲方的设计、图纸或模具生产的，产品的知识产权、模具所有权及设计方案归甲方所有。未经甲方书面授权，乙方不得将相关产品销售给第三方，也不得泄露甲方的图纸和技术资料。</p>
<p class="clause"><span class="clause-num">3. 保密义务：</span>乙方对在合作过程中知悉的甲方商业秘密（包括但不限于设计图纸、采购数量、价格策略）负有保密义务，不得向任何第三方披露。</p>

<div class="section-title">八、争议解决：</div>
<p class="clause">1. 双方在执行本合同过程中如有争议，应友好协商解决；如协商无法解决，由甲方（需方）住所地人民法院管辖及诉讼。</p>

<div class="section-title">九、其他：</div>
<p class="clause">1. 本合同一式二份，经双方签字或盖章后生效，双方各执一份，具有同等法律效力。</p>
<p class="clause">2. 传真件、扫描件与原件具有同等法律效力。</p>

<p class="clause" style="margin-top: 20px;">本合同经甲乙双方签字并在甲方支付首批预付款后即日生效。</p>

<div class="sign-area">
  <div class="sign-block">
    <p>甲方：${partyA.name}</p>
    <p>签字：</p>
    <div style="height: 40px;"></div>
  </div>
  <div class="sign-block">
    <p>乙方：${partyB.name}</p>
    <p>签字：</p>
    <div style="height: 40px;"></div>
  </div>
</div>

</body>
</html>`;
}

// ─── HTML 模板：PI / CI ────────────────────────────────────────────────────────

function buildPiCiHtml(data: PiCiData): string {
  const {
    docType, docNo, docDate, deliveryDate,
    buyerName, buyerAttn, buyerCompany, buyerAddress, buyerTel, buyerEmail,
    lineItems, totalAmount, currency,
    depositPct, balancePct,
    incoterms, portOfLoading, transitDays, bankChoice,
    extras
  } = data;

  const depositAmount = Math.round(totalAmount * depositPct / 100 * 100) / 100;
  const balanceAmount = Math.round(totalAmount * balancePct / 100 * 100) / 100;
  const currencySymbol = currency === "USD" ? "USD " : (currency === "EUR" ? "EUR " : "");
  const docTitle = docType === "pi" ? "PROFORMA INVOICE" : "COMMERCIAL INVOICE";

  // 银行信息
  const bankName = bankChoice === "citi" ? ENV.companyCitiEnBankName : ENV.companyIcbcEnBankName;
  const bankAccount = bankChoice === "citi" ? ENV.companyCitiUsdAccount : ENV.companyIcbcUsdAccount;
  const bankSwift = bankChoice === "citi" ? ENV.companyCitiSwift : ENV.companyIcbcSwift;

  const tableRows = lineItems.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td style="text-align:left">${item.modelName || ""}</td>
      <td>${item.spec || ""}</td>
      <td>${item.quantity || ""}</td>
      <td>${item.unitPrice > 0 ? currencySymbol + item.unitPrice.toFixed(2) : ""}</td>
      <td>${item.amount > 0 ? currencySymbol + item.amount.toFixed(2) : ""}</td>
    </tr>
  `).join("");

  // 附加明细行
  const extraRows: string[] = [];
  if (extras) {
    if (extras.hasLiner && extras.linerAmount > 0) {
      const matLabel = extras.linerMaterial ? ` (${linerMatEn(extras.linerMaterial)})` : "";
      const desc = extras.linerDescription ? ` - ${extras.linerDescription}` : "";
      extraRows.push(`<tr><td colspan="3" style="text-align:left">Foam${matLabel}${desc}</td><td>${extras.linerQuantity}</td><td>${extras.linerUnitPrice > 0 ? currencySymbol + extras.linerUnitPrice.toFixed(2) : ""}</td><td>${currencySymbol}${extras.linerAmount.toFixed(2)}</td></tr>`);
    }
    if (extras.hasLiner && extras.hasLinerTemplate && extras.linerTemplateAmount > 0) {
      extraRows.push(`<tr><td colspan="3" style="text-align:left">Foam Mold Fee</td><td>${extras.linerTemplateQuantity}</td><td>${extras.linerTemplateUnitPrice > 0 ? currencySymbol + extras.linerTemplateUnitPrice.toFixed(2) : ""}</td><td>${currencySymbol}${extras.linerTemplateAmount.toFixed(2)}</td></tr>`);
    }
    if (extras.hasLogo && extras.logoAmount > 0) {
      const matLabel = extras.logoMaterial ? ` (${logoMatEn(extras.logoMaterial)})` : "";
      const desc = extras.logoDescription ? ` - ${extras.logoDescription}` : "";
      extraRows.push(`<tr><td colspan="3" style="text-align:left">Custom Logo${matLabel}${desc}</td><td>${extras.logoQuantity}</td><td>${extras.logoUnitPrice > 0 ? currencySymbol + extras.logoUnitPrice.toFixed(2) : ""}</td><td>${currencySymbol}${extras.logoAmount.toFixed(2)}</td></tr>`);
    }
    if (extras.hasSilkPrint && extras.silkPrintAmount > 0) {
      const desc = extras.silkPrintDescription ? ` - ${extras.silkPrintDescription}` : "";
      extraRows.push(`<tr><td colspan="3" style="text-align:left">Silk Printing${desc}</td><td>${extras.silkPrintQuantity}</td><td>${extras.silkPrintUnitPrice > 0 ? currencySymbol + extras.silkPrintUnitPrice.toFixed(2) : ""}</td><td>${currencySymbol}${extras.silkPrintAmount.toFixed(2)}</td></tr>`);
    }
    if (extras.hasSilkPrint && extras.hasSilkPrintTemplate && extras.silkPrintTemplateAmount > 0) {
      extraRows.push(`<tr><td colspan="3" style="text-align:left">Silk Print Mold Fee</td><td>${extras.silkPrintTemplateQuantity}</td><td>${extras.silkPrintTemplateUnitPrice > 0 ? currencySymbol + extras.silkPrintTemplateUnitPrice.toFixed(2) : ""}</td><td>${currencySymbol}${extras.silkPrintTemplateAmount.toFixed(2)}</td></tr>`);
    }
    if (extras.hasCustomColor && extras.customColorAmount > 0) {
      extraRows.push(`<tr><td colspan="3" style="text-align:left">Custom Color Fee</td><td>${extras.customColorQuantity}</td><td>${extras.customColorUnitPrice > 0 ? currencySymbol + extras.customColorUnitPrice.toFixed(2) : ""}</td><td>${currencySymbol}${extras.customColorAmount.toFixed(2)}</td></tr>`);
    }
    if (extras.domesticFreight > 0) {
      extraRows.push(`<tr><td colspan="5" style="text-align:left">Domestic Freight (China Inland)</td><td>${currencySymbol}${extras.domesticFreight.toFixed(2)}</td></tr>`);
    }
    if (extras.internationalFreight > 0) {
      const freightMode = extras.internationalFreightType === "air" ? " (Air Freight)" : extras.internationalFreightType === "sea" ? " (Sea Freight)" : "";
      extraRows.push(`<tr><td colspan="5" style="text-align:left">International Freight${freightMode}</td><td>${currencySymbol}${extras.internationalFreight.toFixed(2)}</td></tr>`);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #1a1a1a;
    padding: 36px 48px;
    line-height: 1.6;
  }
  .header { position: relative; display: flex; align-items: flex-start; margin-bottom: 16px; min-height: 60px; }
  .logo-img { height: 55px; width: auto; position: relative; z-index: 1; }
  .title-area { position: absolute; left: 0; right: 0; top: 0; text-align: center; pointer-events: none; }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: 3px; margin-top: 6px; }
  .doc-no { font-size: 13px; font-weight: 600; margin-top: 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .info-block { }
  .info-block h3 { font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 6px; }
  .info-block p { font-size: 11px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th, td { border: 1px solid #aaa; padding: 5px 7px; text-align: center; }
  th { background: #f0f0f0; font-weight: 700; font-size: 10px; text-transform: uppercase; }
  .total-row td { font-weight: 700; background: #f8f8f8; }
  .payment-section { margin: 14px 0; }
  .payment-section h3 { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
  .payment-section p { font-size: 11px; margin: 3px 0; }
  .bank-section { margin: 14px 0; border: 1px solid #ddd; padding: 10px 14px; background: #fafafa; }
  .bank-section h3 { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
  .bank-row { display: flex; gap: 8px; margin: 3px 0; font-size: 11px; }
  .bank-label { font-weight: 600; min-width: 120px; }
  .sign-area { display: flex; justify-content: space-between; margin-top: 36px; }
  .sign-block { width: 44%; }
  .sign-block h4 { font-size: 11px; font-weight: 700; margin-bottom: 8px; }
  .sign-label { font-size: 10px; color: #555; }
</style>
</head>
<body>

<div class="header">
  <div>
    <img class="logo-img" src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275986025/MnhiE9LdbgqX24MUwA2SN8/inchoilogo2_4a83c5e6.png" alt="INCHOI CASES" />
  </div>
  <div class="title-area">
    <h1>${docTitle}</h1>
    <div class="doc-no">${docNo}</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-block">
    <h3>Seller</h3>
    <p><strong>${ENV.companyEnName}</strong></p>
    <p>${ENV.companyEnAddress}</p>
    <p>Tel: ${ENV.companyContactPhone}</p>
    <p>Email: ${ENV.companyContactEmail}</p>
    ${ENV.companyContactName ? `<p>Contact: ${ENV.companyContactName}</p>` : ""}
  </div>
  <div class="info-block">
    <h3>Buyer</h3>
    ${buyerCompany ? `<p><strong>${buyerCompany}</strong></p>` : (buyerName ? `<p><strong>${buyerName}</strong></p>` : "")}
    ${buyerAddress ? `<p>${buyerAddress}</p>` : ""}
    ${buyerTel ? `<p>Tel: ${buyerTel}</p>` : ""}
    ${buyerEmail ? `<p>Email: ${buyerEmail}</p>` : ""}
    ${buyerAttn ? `<p>Attn: ${buyerAttn}</p>` : ""}
  </div>
  <div class="info-block">
    <h3>Invoice Date</h3>
    <p>${docDate}</p>
  </div>
  <div class="info-block">
    <h3>Shipment Terms</h3>
    ${incoterms ? `<p>Incoterms: ${incoterms}${portOfLoading ? ", " + portOfLoading : ""}</p>` : ""}
    ${transitDays ? `<p>Est. Transit: ${transitDays}</p>` : ""}
    ${extras?.freightDescription ? `<p>Logistics: ${extras.freightDescription}</p>` : ""}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Description</th>
      <th>Specification</th>
      <th>Qty (pcs)</th>
      <th>Unit Price (${currency})</th>
      <th>Amount (${currency})</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    ${extraRows.join("\n")}
    <tr class="total-row">
      <td colspan="5">TOTAL</td>
      <td>${currencySymbol}${totalAmount.toFixed(2)}</td>
    </tr>
  </tbody>
</table>

<div class="payment-section">
  <h3>Payment Terms:</h3>
  <p>1. Deposit: ${depositPct}% of total amount (${currencySymbol}${depositAmount.toFixed(2)}) to be paid within 3 working days after signing this ${docType.toUpperCase()}.</p>
  <p>2. Balance: ${balancePct}% of total amount (${currencySymbol}${balanceAmount.toFixed(2)}) to be paid before shipment.</p>
</div>

<div class="bank-section">
  <h3>Bank Information:</h3>
  <div class="bank-row"><span class="bank-label">Beneficiary:</span><span>${ENV.companyEnName}</span></div>
  <div class="bank-row"><span class="bank-label">Bank Name:</span><span>${bankName}</span></div>
  <div class="bank-row"><span class="bank-label">Account No.:</span><span>${bankAccount}</span></div>
  <div class="bank-row"><span class="bank-label">Swift Code:</span><span>${bankSwift}</span></div>
</div>

<div class="sign-area">
  <div class="sign-block">
    <h4>Seller: ${ENV.companyEnName}</h4>
    <div class="sign-label">Authorized Signature &amp; Date</div>
    <div style="height: 40px;"></div>
  </div>
  <div class="sign-block">
    <h4>Buyer: ${buyerCompany || buyerName}</h4>
    <div class="sign-label">Authorized Signature &amp; Date</div>
    <div style="height: 40px;"></div>
  </div>
</div>

</body>
</html>`;
}

// ─── PDF 生成函数 ──────────────────────────────────────────────────────────────

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // 设置超时为 60s，适配 NAS 环境 Chromium 启动较慢
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      timeout: 60000,
    });
    return Buffer.from(pdf);
  } catch (err: any) {
    console.error("[PDF生成失败]", err?.message ?? err);
    throw new Error(`PDF 生成失败：${err?.message ?? "未知错误"}`);
  } finally {
    // 关闭页面，但保留浏览器实例供下次复用
    await page.close().catch(() => {});
  }
}

export async function generateContractCnPdf(data: ContractCnData): Promise<Buffer> {
  const html = buildContractCnHtml(data);
  return htmlToPdf(html);
}

export async function generatePiCiPdf(data: PiCiData): Promise<Buffer> {
  const html = buildPiCiHtml(data);
  return htmlToPdf(html);
}
