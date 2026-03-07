// 吟彩销售订单系统 - 数据类型定义
// 设计风格：清爽商务风，深蓝靛色主色调

export interface OrderFormData {
  // 基本信息
  orderNo: string;           // 金蝶系统订单号
  maker: string;             // 制单员
  salesperson: string;       // 销售员
  customer: string;          // 客户名称
  orderDate: string;         // 下单日期
  deliveryDate: string;      // 预计交货日期
  quantity: string;          // 数量
  orderDescription: string;  // 订单描述
  remarks: string;           // 备注

  // 一、箱体描述
  topCover: string;          // 上盖
  bottomCover: string;       // 下盖
  plasticParts: string;      // 塑料配件
  metalParts: string;        // 金属配件

  // 二、贴纸描述
  stickerSource: 'customer' | 'factory' | '';  // 贴纸来源
  stickerDesc: string;       // 贴纸描述
  stickerQty: string;        // 贴纸数量说明

  // 三、丝印描述（仅吟彩版有）
  silkPrintDesc: string;     // 丝印描述

  // 四、内衬描述
  topLiner: string;          // 上盖内衬
  bottomLiner: string;       // 下盖内衬
  topLiner2: string;         // 上盖内衬（第二行）
  bottomLiner2: string;      // 下盖内衬（第二行）

  // 五、纸箱描述
  innerBox: string;          // 内箱
  outerBox: string;          // 外箱
}

export const defaultOrderForm: OrderFormData = {
  orderNo: '',
  maker: '',
  salesperson: '',
  customer: '',
  orderDate: new Date().toISOString().split('T')[0],
  deliveryDate: '',
  quantity: '',
  orderDescription: '',
  remarks: '',

  topCover: '',
  bottomCover: '',
  plasticParts: '',
  metalParts: '',

  stickerSource: '',
  stickerDesc: '',
  stickerQty: '',

  silkPrintDesc: '',

  topLiner: '',
  bottomLiner: '',
  topLiner2: '',
  bottomLiner2: '',

  innerBox: '',
  outerBox: '',
};

export const STEPS = [
  { id: 'basic', label: '基本信息', icon: '📋' },
  { id: 'box', label: '箱体描述', icon: '📦' },
  { id: 'sticker', label: '贴纸描述', icon: '🏷️' },
  { id: 'silkprint', label: '丝印描述', icon: '🖨️' },
  { id: 'liner', label: '内衬描述', icon: '🧲' },
  { id: 'carton', label: '纸箱描述', icon: '📫' },
  { id: 'preview', label: '预览 & 导出', icon: '✅' },
];

export type StepId = typeof STEPS[number]['id'];
