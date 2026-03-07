// 吟彩销售订单系统 - 导出/打印工具
// 设计风格：清爽商务风

import { OrderFormData } from './orderTypes';

/**
 * 生成吟彩版订单HTML（用于打印）
 */
export function generateYincaiHTML(data: OrderFormData): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '宋体', 'SimSun', serif; font-size: 12pt; background: white; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 15mm; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
  .title { font-size: 16pt; font-weight: bold; text-align: center; padding: 10px; border: 1px solid #333; }
  .info-row td { height: 28px; }
  .section-title { font-weight: bold; background: #f0f0f0; }
  .label { font-weight: normal; color: #333; }
  .value { font-weight: normal; }
  .signature-row td { height: 40px; font-weight: bold; }
  .empty-area { height: 60px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { margin: 0; padding: 10mm; }
  }
</style>
</head>
<body>
<div class="page">
<table>
  <tr><td colspan="6" class="title">销售订单记录表（吟彩）</td></tr>
  <tr class="info-row">
    <td colspan="6">
      制单员：${data.maker}&nbsp;&nbsp;&nbsp;&nbsp;
      销售员：${data.salesperson}&nbsp;&nbsp;&nbsp;&nbsp;
      金蝶系统订单号：${data.orderNo}&nbsp;&nbsp;&nbsp;&nbsp;
      日期：${data.orderDate}
    </td>
  </tr>
  <tr>
    <td colspan="2" class="label">订单描述</td>
    <td class="label">数量</td>
    <td class="label">客户</td>
    <td class="label">预计交货日期</td>
    <td class="label">备注</td>
  </tr>
  <tr>
    <td colspan="2">${data.orderDescription}</td>
    <td>${data.quantity}</td>
    <td>${data.customer}</td>
    <td>${data.deliveryDate}</td>
    <td>${data.remarks}</td>
  </tr>
  <tr><td colspan="6" class="section-title">一、箱体描述</td></tr>
  <tr>
    <td class="label">上盖：</td>
    <td>${data.topCover}</td>
    <td class="label">下盖：</td>
    <td>${data.bottomCover}</td>
    <td class="label">塑料配件：</td>
    <td>${data.plasticParts}</td>
  </tr>
  <tr>
    <td colspan="4"></td>
    <td class="label">金属配件：</td>
    <td>${data.metalParts}</td>
  </tr>
  <tr><td colspan="6" class="section-title">二、贴纸描述，客户提供</td></tr>
  <tr><td colspan="6" class="empty-area">${data.stickerDesc}</td></tr>
  <tr><td colspan="6" class="section-title">三、丝印描述</td></tr>
  <tr><td colspan="6" class="empty-area">${data.silkPrintDesc}</td></tr>
  <tr><td colspan="6" class="section-title">四、内衬描述</td></tr>
  <tr>
    <td class="label">上盖：</td>
    <td colspan="2">${data.topLiner}</td>
    <td class="label">下盖：</td>
    <td colspan="2">${data.bottomLiner}</td>
  </tr>
  <tr>
    <td class="label">上盖：</td>
    <td colspan="2">${data.topLiner2}</td>
    <td class="label">下盖：</td>
    <td colspan="2">${data.bottomLiner2}</td>
  </tr>
  <tr><td colspan="6" class="section-title">四、纸箱描述</td></tr>
  <tr>
    <td class="label">内箱：</td>
    <td colspan="2">${data.innerBox}</td>
    <td class="label">外箱：</td>
    <td colspan="2">${data.outerBox}</td>
  </tr>
  <tr class="signature-row">
    <td>计划部签名：</td>
    <td>仓库签名：</td>
    <td>质检部签名：</td>
    <td></td>
    <td></td>
    <td>生产部签名：</td>
  </tr>
</table>
</div>
</body>
</html>`;
}

/**
 * 生成厂部版订单HTML（用于打印）
 */
export function generateFactoryHTML(data: OrderFormData): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '宋体', 'SimSun', serif; font-size: 12pt; background: white; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 15mm; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
  .title { font-size: 16pt; font-weight: bold; text-align: center; padding: 10px; border: 1px solid #333; }
  .info-row td { height: 28px; }
  .section-title { font-weight: bold; background: #f0f0f0; }
  .label { font-weight: normal; color: #333; }
  .value { font-weight: normal; }
  .signature-row td { height: 40px; font-weight: bold; }
  .empty-area { height: 60px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { margin: 0; padding: 10mm; }
  }
</style>
</head>
<body>
<div class="page">
<table>
  <tr><td colspan="6" class="title">销售订单记录表（厂部）</td></tr>
  <tr class="info-row">
    <td colspan="4">制单员：${data.maker}&nbsp;&nbsp;&nbsp;&nbsp;销售员：${data.salesperson}</td>
    <td colspan="2">下单日期：${data.orderDate}</td>
  </tr>
  <tr>
    <td colspan="2" class="label">订单描述</td>
    <td class="label">数量</td>
    <td class="label">客户</td>
    <td class="label">预计交货日期</td>
    <td class="label">备注</td>
  </tr>
  <tr>
    <td colspan="2">${data.orderDescription}</td>
    <td>${data.quantity}</td>
    <td>${data.customer}</td>
    <td>${data.deliveryDate}</td>
    <td>${data.remarks}</td>
  </tr>
  <tr><td colspan="6" class="section-title">一、箱体描述</td></tr>
  <tr>
    <td class="label">上盖：</td>
    <td>${data.topCover}</td>
    <td class="label">下盖：</td>
    <td>${data.bottomCover}</td>
    <td class="label">塑料配件：</td>
    <td>${data.plasticParts}</td>
  </tr>
  <tr>
    <td colspan="4"></td>
    <td class="label">金属配件：</td>
    <td>${data.metalParts}</td>
  </tr>
  <tr><td colspan="6" class="section-title">二、贴纸描述，按实际来料验货</td></tr>
  <tr>
    <td colspan="4">${data.stickerDesc || '效果图'}</td>
    <td colspan="2">${data.stickerQty || '每个编码各一张'}</td>
  </tr>
  <tr><td colspan="6" class="section-title">三、内衬描述</td></tr>
  <tr>
    <td class="label">上盖：</td>
    <td colspan="2">${data.topLiner}</td>
    <td class="label">下盖：</td>
    <td colspan="2">${data.bottomLiner}</td>
  </tr>
  <tr><td colspan="6" class="section-title">四、纸箱描述</td></tr>
  <tr>
    <td class="label">内箱：</td>
    <td colspan="2">${data.innerBox}</td>
    <td class="label">外箱：</td>
    <td colspan="2">${data.outerBox}</td>
  </tr>
  <tr class="signature-row">
    <td>计划部签名：</td>
    <td colspan="2">仓库签名：</td>
    <td colspan="2">质检签名：</td>
    <td>生产部签名：</td>
  </tr>
</table>
</div>
</body>
</html>`;
}

/**
 * 在新窗口打印指定版本的订单
 */
export function printOrder(data: OrderFormData, version: 'yincai' | 'factory') {
  const html = version === 'yincai'
    ? generateYincaiHTML(data)
    : generateFactoryHTML(data);

  const win = window.open('', '_blank');
  if (!win) {
    alert('请允许弹出窗口以打印订单');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}
