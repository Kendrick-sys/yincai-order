/**
 * DocumentDialog.tsx
 * 生成单据弹窗：国内采购合同（中文）/ PI / CI（英文）
 * 从订单数据自动填充，用户补充单价、付款比例等字段后一键生成 PDF
 * CI Tab 支持「从PI创建」：选择已有PI单据自动填充数据
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, Download, AlertCircle, Copy, RotateCcw, Check, ChevronsUpDown, UserRound } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const COMPANY_NAME_CN = "深圳市吟彩新型材料制品有限公司";
const VAT_RATE = 1.13; // 增值税税率 13%

// ─── 亚马逊合同：采购方（甲方）固定为吟彩 ────────────────────────────────────────
const AMAZON_BUYER_INFO = {
  name: "深圳市吟彩新型材料制品有限公司",
  address: "深圳市龙华区龙华街道油松社区镇乾大厦520",
  taxNo: "91440300MAD58M3244",
  bankAccount: "4000 0517 0910 0504 972",
  bankName: "中国工商銀行深圳市分行",
};

// ─── 亚马逊合同：供货方（乙方）选项 ─────────────────────────────────────────────
const AMAZON_SUPPLIER_OPTIONS = [
  {
    label: "恩平市亿丰塑料模具有限公司",
    name: "恩平市亿丰塑料模具有限公司",
    address: "恩平市恩城江门产业转移工业园恩平园区三区A10",
    bankAccount: "2012 0090 0912 4868 277",
    bankName: "中国工商銀行恩平支行",
    taxNo: "91440785584676855C",
  },
];

// 产品名称选项（国内合同）
const PRODUCT_NAME_OPTIONS = ["塑料工具箱", "其他"];
// 产品名称选项（PI/CI，英文）
const PI_PRODUCT_NAME_OPTIONS = ["Plastic Case", "Other"];
// 箱体材质选项
const BOX_MATERIAL_OPTIONS = ["PP", "ABS", "其他"];
// 内衬材质选项（含「其他」手动输入）
const LINER_MATERIAL_OPTIONS = ["PU", "EPE", "XPE", "EVA", "其他"];
// LOGO 材质选项
const LOGO_MATERIAL_OPTIONS = ["PVC", "Epoxy Resin", "PC", "Laser Engraving", "Metal Brushed"];

// ─── 类型 ──────────────────────────────────────────────────────────────────────

interface LineItemInput {
  modelName: string;
  material: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** 通用附加费用行（数量 × 单价 = 金额） */
interface ExtraFeeItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** 国内合同附加明细 */
interface DomesticExtras {
  // 内衬
  hasLiner: boolean;
  linerMaterial: string;
  linerDescription: string;
  linerQuantity: number;
  linerUnitPrice: number;
  linerAmount: number;
  // 内衬定制模板费
  hasLinerTemplate: boolean;
  linerTemplateQuantity: number;
  linerTemplateUnitPrice: number;
  linerTemplateAmount: number;
  // LOGO
  hasLogo: boolean;
  logoMaterial: string;
  logoDescription: string;
  logoQuantity: number;
  logoUnitPrice: number;
  logoAmount: number;
  // 丝印
  hasSilkPrint: boolean;
  silkPrintDescription: string;
  silkPrintQuantity: number;
  silkPrintUnitPrice: number;
  silkPrintAmount: number;
  // 丝印定制模板费
  hasSilkPrintTemplate: boolean;
  silkPrintTemplateQuantity: number;
  silkPrintTemplateUnitPrice: number;
  silkPrintTemplateAmount: number;
  // 定制颜色
  hasCustomColor: boolean;
  customColorQuantity: number;
  customColorUnitPrice: number;
  customColorAmount: number;
  // 物流运费（只有金额，国内合同）
  shippingFee: number;
}

/** PI/CI 附加明细（运费拆分为国内+国外） */
interface PiExtras extends Omit<DomesticExtras, 'shippingFee'> {
  // 国内运输费
  domesticFreight: number;
  // 国外运输方式
  internationalFreightType: "air" | "sea" | "";
  // 国外运输费
  internationalFreight: number;
  // 物流描述
  freightDescription: string;
}

function defaultExtras(): DomesticExtras {
  return {
    hasLiner: false,
    linerMaterial: "",
    linerDescription: "",
    linerQuantity: 0,
    linerUnitPrice: 0,
    linerAmount: 0,
    hasLinerTemplate: false,
    linerTemplateQuantity: 0,
    linerTemplateUnitPrice: 0,
    linerTemplateAmount: 0,
    hasLogo: false,
    logoMaterial: "",
    logoDescription: "",
    logoQuantity: 0,
    logoUnitPrice: 0,
    logoAmount: 0,
    hasSilkPrint: false,
    silkPrintDescription: "",
    silkPrintQuantity: 0,
    silkPrintUnitPrice: 0,
    silkPrintAmount: 0,
    hasSilkPrintTemplate: false,
    silkPrintTemplateQuantity: 0,
    silkPrintTemplateUnitPrice: 0,
    silkPrintTemplateAmount: 0,
    hasCustomColor: false,
    customColorQuantity: 0,
    customColorUnitPrice: 0,
    customColorAmount: 0,
    shippingFee: 0,
  };
}

function defaultPiExtras(): PiExtras {
  return {
    hasLiner: false,
    linerMaterial: "",
    linerDescription: "",
    linerQuantity: 0,
    linerUnitPrice: 0,
    linerAmount: 0,
    hasLinerTemplate: false,
    linerTemplateQuantity: 0,
    linerTemplateUnitPrice: 0,
    linerTemplateAmount: 0,
    hasLogo: false,
    logoMaterial: "",
    logoDescription: "",
    logoQuantity: 0,
    logoUnitPrice: 0,
    logoAmount: 0,
    hasSilkPrint: false,
    silkPrintDescription: "",
    silkPrintQuantity: 0,
    silkPrintUnitPrice: 0,
    silkPrintAmount: 0,
    hasSilkPrintTemplate: false,
    silkPrintTemplateQuantity: 0,
    silkPrintTemplateUnitPrice: 0,
    silkPrintTemplateAmount: 0,
    hasCustomColor: false,
    customColorQuantity: 0,
    customColorUnitPrice: 0,
    customColorAmount: 0,
    domesticFreight: 0,
    internationalFreightType: "",
    internationalFreight: 0,
    freightDescription: "",
  };
}

interface OrderModel {
  modelName?: string | null;
  modelCode?: string | null;
  quantity?: string | null;
  topCover?: string | null;
  bottomCover?: string | null;
}

interface OrderData {
  id: number;
  customer?: string | null;
  orderDate?: string | null;
  deliveryDate?: string | null;
  customerType?: string | null;
  isAmazon?: boolean | null;
  models?: OrderModel[];
}

/** 同步给采购合同弹窗的数据快照 */
export interface DocSyncData {
  /** 国内合同/PI/CI 的产品明细（含型号、材质、数量） */
  lineItems: LineItemInput[];
  /** 国内合同附加明细（内衬/丝印/颜色等） */
  extras: DomesticExtras;
  /** PI/CI 附加明细（内衬/丝印/颜色等） */
  piExtras: PiExtras;
  /** 当前激活的 Tab */
  activeTab: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  order: OrderData;
  /** 如果为 true，打开时自动切换到国内合同 Tab 并预填亿丰供货商信息 */
  prefillYifeng?: boolean;
  /** 当 lineItems/extras 变化时，将数据同步给父组件（用于采购合同联动） */
  onSyncData?: (data: DocSyncData) => void;
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/** 精确四舍五入到2位小数，避免浮点误差 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildInitialLineItems(models: OrderModel[]): LineItemInput[] {
  return (models ?? []).map(m => {
    // 型号列只显示型号编码（简短），如 "2519"
    return {
      modelName: "塑料工具箱", // 默认产品名称
      material: "PP",          // 默认材质
      spec: m.modelCode || m.modelName || "",
      quantity: parseInt(m.quantity ?? "0") || 0,
      unitPrice: 0,
      amount: 0,
    };
  });
}

function buildInitialPiLineItems(models: OrderModel[]): LineItemInput[] {
  return (models ?? []).map(m => {
    // PI/CI 型号列只显示型号编码（简短），如 "2519"
    return {
      modelName: "Plastic Case", // 默认产品名称（英文）
      material: "PP",
      spec: m.modelCode || m.modelName || "",
      quantity: parseInt(m.quantity ?? "0") || 0,
      unitPrice: 0,
      amount: 0,
    };
  });
}

// ─── 子组件：国内合同箱子明细表格 ──────────────────────────────────────────────

function DomesticLineItemsTable({
  items,
  onChange,
}: {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
}) {
  // 每行产品名称是否为「其他」（手动输入）
  const [customProductName, setCustomProductName] = useState<Record<number, boolean>>({});
  // 每行材质是否为「其他」（手动输入）
  const [customMaterial, setCustomMaterial] = useState<Record<number, boolean>>({});

  const updateItem = (idx: number, field: keyof LineItemInput, value: string | number) => {
    const newItems = items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "unitPrice" || field === "quantity") {
        updated.amount = round2(
          parseFloat(String(updated.unitPrice || 0)) * parseFloat(String(updated.quantity || 0))
        );
      }
      return updated;
    });
    onChange(newItems);
  };

  const handleProductNameSelect = (idx: number, value: string) => {
    if (value === "其他") {
      setCustomProductName(prev => ({ ...prev, [idx]: true }));
      updateItem(idx, "modelName", "");
    } else {
      setCustomProductName(prev => ({ ...prev, [idx]: false }));
      updateItem(idx, "modelName", value);
    }
  };

  const handleMaterialSelect = (idx: number, value: string) => {
    if (value === "其他") {
      setCustomMaterial(prev => ({ ...prev, [idx]: true }));
      updateItem(idx, "material", "");
    } else {
      setCustomMaterial(prev => ({ ...prev, [idx]: false }));
      updateItem(idx, "material", value);
    }
  };

  const total = useMemo(() => round2(items.reduce((sum, item) => sum + (item.amount || 0), 0)), [items]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border">
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr className="bg-muted/60">
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{width:'22%'}}>产品名称</th>
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{width:'14%'}}>型号</th>
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{width:'16%'}}>材质</th>
              <th className="border-b border-r border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{width:'14%'}}>数量</th>
              <th className="border-b border-r border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{width:'16%'}}>单价(元)</th>
              <th className="border-b border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{width:'18%'}}>金额(元)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                {/* 产品名称：下拉选择，选「其他」时手动输入 */}
                <td className="border-b border-r border-border px-1 py-1">
                  {customProductName[idx] ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={item.modelName}
                        onChange={e => updateItem(idx, "modelName", e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                        placeholder="产品名称"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomProductName(prev => ({ ...prev, [idx]: false }));
                          updateItem(idx, "modelName", "塑料工具箱");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground px-0.5 flex-shrink-0"
                        title="切换回下拉"
                      >↩</button>
                    </div>
                  ) : (
                    <Select
                      value={PRODUCT_NAME_OPTIONS.includes(item.modelName) ? item.modelName : (item.modelName ? "其他" : "塑料工具箱")}
                      onValueChange={v => handleProductNameSelect(idx, v)}
                    >
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 px-1">
                        <SelectValue placeholder="选择..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_NAME_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                {/* 型号：自动关联订单型号编码 */}
                <td className="border-b border-r border-border px-1 py-1">
                  <Input
                    value={item.spec}
                    onChange={e => updateItem(idx, "spec", e.target.value)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="型号"
                  />
                </td>
                {/* 材质：下拉选择 PP / ABS / 其他（手动输入） */}
                <td className="border-b border-r border-border px-1 py-1">
                  {customMaterial[idx] ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={item.material}
                        onChange={e => updateItem(idx, "material", e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                        placeholder="材质"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomMaterial(prev => ({ ...prev, [idx]: false }));
                          updateItem(idx, "material", "PP");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground px-0.5 flex-shrink-0"
                        title="切换回下拉"
                      >↩</button>
                    </div>
                  ) : (
                    <Select
                      value={BOX_MATERIAL_OPTIONS.includes(item.material) ? item.material : (item.material ? "其他" : "PP")}
                      onValueChange={v => handleMaterialSelect(idx, v)}
                    >
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 px-1">
                        <SelectValue placeholder="材质" />
                      </SelectTrigger>
                      <SelectContent>
                        {BOX_MATERIAL_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="border-b border-r border-border px-1 py-1 text-center">
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ""}
                    onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1 text-center"
                    placeholder="0"
                  />
                </td>
                <td className="border-b border-r border-border px-1 py-1 text-center">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={item.unitPrice || ""}
                    onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1 text-center"
                    placeholder="0.00"
                  />
                </td>
                <td className="border-b border-border px-2 py-1 text-center text-xs font-medium text-muted-foreground">
                  {item.amount > 0 ? item.amount.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-primary/5 font-semibold">
              <td colSpan={5} className="border-r border-border px-2 py-1.5 text-right text-xs">箱子小计</td>
              <td className="px-2 py-1.5 text-center text-xs font-bold text-primary">
                ¥{total.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-1">※ 输入单价后金额自动计算；产品名称选「其他」可手动输入</p>
    </div>
  );
}

// ─── 子组件：附加费用行（通用：数量 × 单价 = 金额） ────────────────────────────

function ExtraFeeRow({
  label,
  quantity,
  unitPrice,
  amount,
  onQuantityChange,
  onUnitPriceChange,
  showDescription,
  description,
  onDescriptionChange,
  descriptionPlaceholder,
  showMaterial,
  material,
  materialOptions,
  onMaterialChange,
  subtotal,
  subtotalLabel,
  currency = "CNY",
}: {
  label: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  onQuantityChange: (v: number) => void;
  onUnitPriceChange: (v: number) => void;
  showDescription?: boolean;
  description?: string;
  onDescriptionChange?: (v: string) => void;
  descriptionPlaceholder?: string;
  showMaterial?: boolean;
  material?: string;
  materialOptions?: string[];
  onMaterialChange?: (v: string) => void;
  /** 小计金额（展示在卡片底部） */
  subtotal?: number;
  /** 小计标签，默认为「小计」 */
  subtotalLabel?: string;
  /** 货币（用于小计显示符号） */
  currency?: "USD" | "EUR" | "CNY";
}) {
  const currSymbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "€";
  const unitLabel = currency === "CNY" ? "单价（元）" : `Unit Price (${currency})`;
  const amtLabel = currency === "CNY" ? "金额（元）" : `Amount (${currency})`;
  const qtyLabel = currency === "CNY" ? "数量（个）" : "Qty";
  const descLabel = currency === "CNY" ? "描述" : "Description";
  const matLabel = currency === "CNY" ? "材质" : "Material";

  return (
    <div className="rounded-lg border border-border bg-background shadow-sm overflow-hidden">
      {/* 标题行 */}
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <p className="text-xs font-semibold text-foreground/80">{label}</p>
      </div>
      {/* 字段行 */}
      <div className="px-3 py-3">
        <div className="flex flex-wrap gap-3 items-end">
          {showMaterial && materialOptions && onMaterialChange && (
            <div className="space-y-1 min-w-[110px]">
              <Label className="text-xs text-muted-foreground">{matLabel}</Label>
              <Select value={material || ""} onValueChange={onMaterialChange}>
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder="选择..." />
                </SelectTrigger>
                <SelectContent>
                  {materialOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showDescription && onDescriptionChange !== undefined && (
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">{descLabel}</Label>
              <Input
                value={description || ""}
                onChange={e => onDescriptionChange(e.target.value)}
                placeholder={descriptionPlaceholder || "Optional description"}
                className="h-8 text-xs"
              />
            </div>
          )}
          <div className="space-y-1 w-[90px]">
            <Label className="text-xs text-muted-foreground">{qtyLabel}</Label>
            <Input
              type="number"
              min={0}
              value={quantity || ""}
              onChange={e => onQuantityChange(parseFloat(e.target.value) || 0)}
              className="h-8 text-xs text-center"
              placeholder="0"
            />
          </div>
          <div className="space-y-1 w-[110px]">
            <Label className="text-xs text-muted-foreground">{unitLabel}</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={unitPrice || ""}
              onChange={e => onUnitPriceChange(parseFloat(e.target.value) || 0)}
              className="h-8 text-xs text-center"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1 w-[110px]">
            <Label className="text-xs text-muted-foreground">{amtLabel}</Label>
            <div className={`h-8 flex items-center justify-center text-xs font-semibold rounded border px-2 ${amount > 0 ? "bg-primary/5 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground"}`}>
              {amount > 0 ? `${currSymbol}${amount.toFixed(2)}` : "—"}
            </div>
          </div>
        </div>
      </div>
      {/* 小计行：当小计金额 > 0 时展示 */}
      {subtotal !== undefined && subtotal > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-t border-primary/20">
          <span className="text-xs text-primary/70 font-medium">{subtotalLabel ?? "小计"}</span>
          <span className="text-sm font-bold text-primary">{currSymbol}{subtotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// ─── 子组件：客户档案可搜索选择器（国内合同 + PI/CI 通用） ─────────────────────────

interface CustomerFillOption {
  id: number;
  name: string;
  country?: string | null;
  cnCompany?: string | null;
  taxNo?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  address?: string | null;
  enAddress?: string | null;
  company?: string | null;
  attn?: string | null;
  phone?: string | null;
  email?: string | null;
}

function CustomerFillCombobox({
  customers,
  label,
  placeholder,
  onSelect,
  colorScheme = "blue",
}: {
  customers: CustomerFillOption[];
  label: string;
  placeholder: string;
  onSelect: (c: CustomerFillOption) => void;
  colorScheme?: "blue" | "indigo";
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = customers.find(c => c.id === selectedId);

  const bgClass = colorScheme === "indigo"
    ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
    : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
  const labelClass = colorScheme === "indigo"
    ? "text-indigo-700 dark:text-indigo-300"
    : "text-blue-700 dark:text-blue-300";

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border ${bgClass}`}>
      <UserRound className={`w-3.5 h-3.5 flex-shrink-0 ${labelClass}`} />
      <span className={`text-xs font-medium whitespace-nowrap ${labelClass}`}>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-7 text-xs flex-1 justify-between font-normal bg-white dark:bg-background px-2"
          >
            <span className="truncate text-left">
              {selected
                ? <>{selected.name}{(selected.cnCompany || selected.company) ? <span className="text-muted-foreground ml-1">· {selected.cnCompany || selected.company}</span> : null}</>
                : <span className="text-muted-foreground">{placeholder}</span>
              }
            </span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80" align="start">
          <Command>
            <CommandInput placeholder="搜索客户名称..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>
                <div className="py-3 text-center text-xs text-muted-foreground">未找到匹配的客户</div>
              </CommandEmpty>
              <CommandGroup>
                {customers.map(c => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.cnCompany ?? ""} ${c.company ?? ""}`}
                    onSelect={() => {
                      setSelectedId(c.id);
                      onSelect(c);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 cursor-pointer py-2"
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        selectedId === c.id ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      {(c.cnCompany || c.company) && (
                        <div className="text-xs text-muted-foreground truncate">{c.cnCompany || c.company}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── 子组件：PI/CI 行项目表格 ────────────────────────────────────────────

function LineItemsTable({
  items,
  currency,
  onChange,
}: {
  items: LineItemInput[];
  currency: string;
  onChange: (items: LineItemInput[]) => void;
}) {
  const currencySymbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "€";
  // 每行产品名称是否为「Other」（手动输入）
  const [customProductName, setCustomProductName] = useState<Record<number, boolean>>({});

  const updateItem = (idx: number, field: keyof LineItemInput, value: string | number) => {
    const newItems = items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "unitPrice" || field === "quantity") {
        updated.amount = round2(
          parseFloat(String(updated.unitPrice || 0)) * parseFloat(String(updated.quantity || 0))
        );
      }
      return updated;
    });
    onChange(newItems);
  };

  const handleProductNameSelect = (idx: number, value: string) => {
    if (value === "Other") {
      setCustomProductName(prev => ({ ...prev, [idx]: true }));
      updateItem(idx, "modelName", "");
    } else {
      setCustomProductName(prev => ({ ...prev, [idx]: false }));
      updateItem(idx, "modelName", value);
    }
  };

  const total = useMemo(() => round2(items.reduce((sum, item) => sum + (item.amount || 0), 0)), [items]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border">
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr className="bg-muted/60">
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{width:'22%'}}>Product Name</th>
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{width:'13%'}}>Model</th>
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{width:'13%'}}>Material</th>
              <th className="border-b border-r border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{width:'12%'}}>Qty</th>
              <th className="border-b border-r border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{width:'20%'}}>Unit Price ({currency})</th>
              <th className="border-b border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{width:'20%'}}>Amount ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                {/* Product Name: dropdown with Plastic Case / Other */}
                <td className="border-b border-r border-border px-1 py-1">
                  {customProductName[idx] ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={item.modelName}
                        onChange={e => updateItem(idx, "modelName", e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                        placeholder="Product name"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomProductName(prev => ({ ...prev, [idx]: false }));
                          updateItem(idx, "modelName", "Plastic Case");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground px-0.5 flex-shrink-0"
                        title="Back to dropdown"
                      >↩</button>
                    </div>
                  ) : (
                    <Select
                      value={PI_PRODUCT_NAME_OPTIONS.includes(item.modelName) ? item.modelName : (item.modelName ? "Other" : "Plastic Case")}
                      onValueChange={v => handleProductNameSelect(idx, v)}
                    >
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 px-1">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PI_PRODUCT_NAME_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="border-b border-r border-border px-1 py-1">
                  <Input
                    value={item.spec}
                    onChange={e => updateItem(idx, "spec", e.target.value)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="Model"
                  />
                </td>
                <td className="border-b border-r border-border px-1 py-1">
                  <Select
                    value={["PP", "ABS", "Other"].includes(item.material) ? item.material : "PP"}
                    onValueChange={v => updateItem(idx, "material", v)}
                  >
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 px-1">
                      <SelectValue placeholder="PP" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PP">PP</SelectItem>
                      <SelectItem value="ABS">ABS</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="border-b border-r border-border px-1 py-1 text-center">
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ""}
                    onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1 text-center"
                    placeholder="0"
                  />
                </td>
                <td className="border-b border-r border-border px-1 py-1 text-center">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={item.unitPrice || ""}
                    onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1 text-center"
                    placeholder="0.00"
                  />
                </td>
                <td className="border-b border-border px-2 py-1 text-center text-xs font-medium text-muted-foreground">
                  {item.amount > 0 ? item.amount.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-primary/5 font-semibold">
              <td colSpan={5} className="border-r border-border px-2 py-1.5 text-right text-xs">Subtotal</td>
              <td className="px-2 py-1.5 text-center text-xs font-bold text-primary">
                {currencySymbol}{total.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-1">※ Enter unit price to auto-calculate amount. Select "Other" to type a custom product name.</p>
    </div>
  );
}

// ─── 付款比例组件 ──────────────────────────────────────────────────────────────

function PaymentTerms({
  depositPct,
  balancePct,
  totalAmount,
  currency,
  onDepositChange,
  onBalanceChange,
}: {
  depositPct: number;
  balancePct: number;
  totalAmount: number;
  currency: string;
  onDepositChange: (v: number) => void;
  onBalanceChange: (v: number) => void;
}) {
  const currencySymbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "€";
  const depositAmount = round2(totalAmount * depositPct / 100);
  const balanceAmount = round2(totalAmount * balancePct / 100);
  const sum = depositPct + balancePct;
  const isValid = sum === 100;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">定金比例 (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={99}
              value={depositPct}
              onChange={e => {
                const v = parseInt(e.target.value) || 0;
                onDepositChange(v);
                onBalanceChange(100 - v);
              }}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              = {currencySymbol}{depositAmount.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">尾款比例 (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={99}
              value={balancePct}
              onChange={e => {
                const v = parseInt(e.target.value) || 0;
                onBalanceChange(v);
                onDepositChange(100 - v);
              }}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              = {currencySymbol}{balanceAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      {!isValid && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5" />
          定金 + 尾款比例之和必须等于 100%（当前 {sum}%）
        </div>
      )}
    </div>
  );
}

// ─── PI/CI 共用字段组件（扩展版，含完整 Buyer 信息） ─────────────────────────────

function PiCiFields({
  buyerName,
  buyerAttn,
  buyerCompany,
  buyerAddress,
  buyerTel,
  buyerEmail,
  currency,
  bankChoice,
  incoterms,
  portOfLoading,
  transitDays,
  onBuyerNameChange,
  onBuyerAttnChange,
  onBuyerCompanyChange,
  onBuyerAddressChange,
  onBuyerTelChange,
  onBuyerEmailChange,
  onCurrencyChange,
  onBankChoiceChange,
  onIncotermsChange,
  onPortOfLoadingChange,
  onTransitDaysChange,
}: {
  buyerName: string;
  buyerAttn: string;
  buyerCompany: string;
  buyerAddress: string;
  buyerTel: string;
  buyerEmail: string;
  currency: "USD" | "EUR";
  bankChoice: "icbc" | "citi";
  incoterms: string;
  portOfLoading: string;
  transitDays: string;
  onBuyerNameChange: (v: string) => void;
  onBuyerAttnChange: (v: string) => void;
  onBuyerCompanyChange: (v: string) => void;
  onBuyerAddressChange: (v: string) => void;
  onBuyerTelChange: (v: string) => void;
  onBuyerEmailChange: (v: string) => void;
  onCurrencyChange: (v: "USD" | "EUR") => void;
  onBankChoiceChange: (v: "icbc" | "citi") => void;
  onIncotermsChange: (v: string) => void;
  onPortOfLoadingChange: (v: string) => void;
  onTransitDaysChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Buyer 信息区块 */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground/70 mb-1">Buyer Information (TO)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Contact Name (TO) <span className="text-destructive ml-1">*</span></Label>
            <Input
              value={buyerName}
              onChange={e => onBuyerNameChange(e.target.value)}
              placeholder="e.g. John Smith"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Attn</Label>
            <Input
              value={buyerAttn}
              onChange={e => onBuyerAttnChange(e.target.value)}
              placeholder="e.g. Purchasing Dept."
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Company Name</Label>
            <Input
              value={buyerCompany}
              onChange={e => onBuyerCompanyChange(e.target.value)}
              placeholder="e.g. SCHEMES L.L.C"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Address</Label>
            <Input
              value={buyerAddress}
              onChange={e => onBuyerAddressChange(e.target.value)}
              placeholder="e.g. Dubai, U.A.E."
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tel</Label>
            <Input
              value={buyerTel}
              onChange={e => onBuyerTelChange(e.target.value)}
              placeholder="e.g. +971-4-334-6966"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              value={buyerEmail}
              onChange={e => onBuyerEmailChange(e.target.value)}
              placeholder="e.g. info@example.com"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 贸易条款区块 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Currency</Label>
          <Select value={currency} onValueChange={v => onCurrencyChange(v as "USD" | "EUR")}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD (US Dollar)</SelectItem>
              <SelectItem value="EUR">EUR (Euro)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bank Account</Label>
          <Select value={bankChoice} onValueChange={v => onBankChoiceChange(v as "icbc" | "citi")}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="icbc">工商银行（ICBC）</SelectItem>
              <SelectItem value="citi">花旗银行（Citibank，阿里巴巴收汇）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Incoterms</Label>
          <Select value={incoterms} onValueChange={onIncotermsChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FOB">FOB</SelectItem>
              <SelectItem value="CIF">CIF</SelectItem>
              <SelectItem value="EXW">EXW</SelectItem>
              <SelectItem value="DDP">DDP</SelectItem>
              <SelectItem value="CFR">CFR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Port of Loading</Label>
          <Input
            value={portOfLoading}
            onChange={e => onPortOfLoadingChange(e.target.value)}
            placeholder="e.g. Shenzhen"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Estimated Transit Days</Label>
          <Input
            value={transitDays}
            onChange={e => onTransitDaysChange(e.target.value)}
            placeholder="e.g. 25-30 days by sea"
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────

export default function DocumentDialog({ open, onClose, order, prefillYifeng, onSyncData }: Props) {
  const utils = trpc.useUtils();
  const isOverseas = order.customerType === "overseas";
  const isAmazonOrder = !!order.isAmazon; // 亚马逊订单：吟彩为甲方（采购方），供货商为乙方
  const defaultTab = isOverseas ? "pi" : "contract_cn";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);
  const [piLineItems, setPiLineItems] = useState<LineItemInput[]>([]);

  // 国内合同专属
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyAddress, setCounterpartyAddress] = useState("");
  const [needInvoice, setNeedInvoice] = useState(false);
  const [extras, setExtras] = useState<DomesticExtras>(defaultExtras());
  // 国内客户甲方信息（自动从客户档案填充）
  const [buyerCnCompany, setBuyerCnCompany] = useState("");
  const [buyerTaxNo, setBuyerTaxNo] = useState("");
  const [buyerBankAccount, setBuyerBankAccount] = useState("");
  const [buyerBankName, setBuyerBankName] = useState("");
  // 亚马逊合同：对方联系人和电话（供货商）
  const [counterpartyContactName, setCounterpartyContactName] = useState("");
  const [counterpartyPhone, setCounterpartyPhone] = useState("");
  // 亚马逊合同：当前选中的供货商索引（0 = 恩平亿丰，-1 = 自定义）
  const [amazonSupplierIdx, setAmazonSupplierIdx] = useState(0);

  // PI/CI 专属
  const [piExtras, setPiExtras] = useState<PiExtras>(defaultPiExtras());
  const [buyerName, setBuyerName] = useState(order.customer ?? "");
  const [buyerAttn, setBuyerAttn] = useState("");
  const [buyerCompany, setBuyerCompany] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerTel, setBuyerTel] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [incoterms, setIncoterms] = useState("FOB");
  const [portOfLoading, setPortOfLoading] = useState("Shenzhen");
  const [bankChoice, setBankChoice] = useState<"icbc" | "citi">("icbc");
  const [transitDays, setTransitDays] = useState("");

  // 通用
  const [depositPct, setDepositPct] = useState(30);
  const [balancePct, setBalancePct] = useState(70);

  // CI 从 PI 创建
  const [selectedPiId, setSelectedPiId] = useState<string>("");

  // 查询订单下的有效 PI 列表（仅在 CI Tab 激活时查询）
  const { data: activePiList } = trpc.documents.getActivePi.useQuery(
    { orderId: order.id },
    { enabled: open && activeTab === "ci" }
  );

  // 查询客户列表（用于自动填入 Buyer 信息）
  const { data: customerList } = trpc.customers.list.useQuery(
    undefined,
    { enabled: open, staleTime: 60_000 }
  );

  // 从数据库加载草稿（跨设备共享）
  const { data: dbDraftCn } = trpc.documentDrafts.get.useQuery(
    { orderId: order.id, draftType: "contract_cn" },
    { enabled: open, staleTime: 0 }
  );
  const { data: dbDraftPi } = trpc.documentDrafts.get.useQuery(
    { orderId: order.id, draftType: "pi" },
    { enabled: open, staleTime: 0 }
  );

  // 保存草稿到数据库（防抖 1.5s）
  const saveDraftMutation = trpc.documentDrafts.save.useMutation({
    onSuccess: () => {
      toast.success("草稿已自动保存", { duration: 1500, id: "draft-auto-save" });
    },
  });
  const saveDraftMutationRef = useRef(saveDraftMutation);
  saveDraftMutationRef.current = saveDraftMutation;
  const saveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraftToDb = useCallback((draftType: "contract_cn" | "pi", data: object) => {
    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    saveDraftTimerRef.current = setTimeout(() => {
      saveDraftMutationRef.current.mutate({ orderId: order.id, draftType, data: JSON.stringify(data) });
    }, 1500);
  }, [order.id]);

  // 弹窗关闭时清除防抖 timer，防止内存泄漏
  useEffect(() => {
    if (!open && saveDraftTimerRef.current) {
      clearTimeout(saveDraftTimerRef.current);
      saveDraftTimerRef.current = null;
    }
    return () => {
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
    };
  }, [open]);

  // ── 客户列表分组（useMemo 避免每次 render 重新过滤）─────────────────────────────────────────
  const domesticCustomers = useMemo(
    () => (customerList ?? []).filter((c: any) => c.country === "domestic"),
    [customerList]
  );
  const overseasCustomers = useMemo(
    () => (customerList ?? []).filter((c: any) => c.country === "overseas"),
    [customerList]
  );

  // ── localStorage 持久化 key（按订单 ID 区分）────────────────────────────────────────────
  const storageKey = `yincai_contract_cn_${order.id}`;
  const piStorageKey = `yincai_pi_${order.id}`;

  // 初始化行项目（优先从数据库草稿恢复，其次 localStorage，最后用订单数据初始化）
  useEffect(() => {
    if (!open) return;

    setBuyerName(order.customer ?? "");
    setActiveTab(defaultTab);
    setSelectedPiId("");

    // 优先从数据库草稿恢复（跨设备共享）
    let cnRestoredFromCache = false;
    let piRestoredFromCache = false;

    if (dbDraftCn?.data) {
      try {
        const parsed = JSON.parse(dbDraftCn.data);
        // 如果草稿中有 lineItems 且非空，使用草稿数据；否则从订单 models 初始化
        if (parsed.lineItems && Array.isArray(parsed.lineItems) && parsed.lineItems.length > 0) {
          setLineItems(parsed.lineItems);
        } else {
          setLineItems(buildInitialLineItems(order.models ?? []));
        }
        if (parsed.counterpartyName !== undefined) setCounterpartyName(parsed.counterpartyName);
        if (parsed.counterpartyAddress !== undefined) setCounterpartyAddress(parsed.counterpartyAddress);
        if (parsed.buyerCnCompany !== undefined) setBuyerCnCompany(parsed.buyerCnCompany);
        if (parsed.buyerTaxNo !== undefined) setBuyerTaxNo(parsed.buyerTaxNo);
        if (parsed.buyerBankAccount !== undefined) setBuyerBankAccount(parsed.buyerBankAccount);
        if (parsed.buyerBankName !== undefined) setBuyerBankName(parsed.buyerBankName);
        if (parsed.needInvoice !== undefined) setNeedInvoice(parsed.needInvoice);
        if (parsed.extras) setExtras({ ...defaultExtras(), ...parsed.extras });
        if (parsed.depositPct) setDepositPct(parsed.depositPct);
        if (parsed.balancePct) setBalancePct(parsed.balancePct);
        cnRestoredFromCache = true;
      } catch { /* 解析失败则从 localStorage 恢复 */ }
    }

    if (!cnRestoredFromCache) {
      // 备用：尝试从 localStorage 恢复国内合同内容
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          // 如果 localStorage 草稿中有 lineItems 且非空，使用草稿；否则从订单 models 初始化
          if (parsed.lineItems && Array.isArray(parsed.lineItems) && parsed.lineItems.length > 0) {
            setLineItems(parsed.lineItems);
          } else {
            setLineItems(buildInitialLineItems(order.models ?? []));
          }
          if (parsed.counterpartyName !== undefined) setCounterpartyName(parsed.counterpartyName);
          if (parsed.counterpartyAddress !== undefined) setCounterpartyAddress(parsed.counterpartyAddress);
          if (parsed.buyerCnCompany !== undefined) setBuyerCnCompany(parsed.buyerCnCompany);
          if (parsed.buyerTaxNo !== undefined) setBuyerTaxNo(parsed.buyerTaxNo);
          if (parsed.buyerBankAccount !== undefined) setBuyerBankAccount(parsed.buyerBankAccount);
          if (parsed.buyerBankName !== undefined) setBuyerBankName(parsed.buyerBankName);
          if (parsed.needInvoice !== undefined) setNeedInvoice(parsed.needInvoice);
          if (parsed.extras) setExtras({ ...defaultExtras(), ...parsed.extras });
          if (parsed.depositPct) setDepositPct(parsed.depositPct);
          if (parsed.balancePct) setBalancePct(parsed.balancePct);
          cnRestoredFromCache = true;
        } else {
          setLineItems(buildInitialLineItems(order.models ?? []));
          setExtras(defaultExtras());
          setNeedInvoice(false);
          setCounterpartyName("");
          setCounterpartyAddress("");
        }
      } catch {
        setLineItems(buildInitialLineItems(order.models ?? []));
      }
    }

    if (dbDraftPi?.data) {
      try {
        const parsed = JSON.parse(dbDraftPi.data);
        // 如果草稿中有 piLineItems 且非空，使用草稿数据；否则从订单 models 初始化
        if (parsed.piLineItems && Array.isArray(parsed.piLineItems) && parsed.piLineItems.length > 0) {
          setPiLineItems(parsed.piLineItems);
        } else {
          setPiLineItems(buildInitialPiLineItems(order.models ?? []));
        }
        if (parsed.buyerAttn !== undefined) setBuyerAttn(parsed.buyerAttn);
        if (parsed.buyerCompany !== undefined) setBuyerCompany(parsed.buyerCompany);
        if (parsed.buyerAddress !== undefined) setBuyerAddress(parsed.buyerAddress);
        if (parsed.buyerTel !== undefined) setBuyerTel(parsed.buyerTel);
        if (parsed.buyerEmail !== undefined) setBuyerEmail(parsed.buyerEmail);
        if (parsed.currency) setCurrency(parsed.currency);
        if (parsed.incoterms) setIncoterms(parsed.incoterms);
        if (parsed.portOfLoading !== undefined) setPortOfLoading(parsed.portOfLoading);
        if (parsed.bankChoice) setBankChoice(parsed.bankChoice);
        if (parsed.transitDays !== undefined) setTransitDays(parsed.transitDays);
        if (parsed.piExtras) setPiExtras({ ...defaultPiExtras(), ...parsed.piExtras });
        if (parsed.depositPct) setDepositPct(parsed.depositPct);
        if (parsed.balancePct) setBalancePct(parsed.balancePct);
        piRestoredFromCache = true;
      } catch { /* 解析失败则从 localStorage 恢复 */ }
    }

    if (!piRestoredFromCache) {
      // 尝试从 localStorage 恢复 PI/CI 内容（优先级高于客户档案自动填充）
      try {
        const piSaved = localStorage.getItem(piStorageKey);
        if (piSaved) {
          const parsed = JSON.parse(piSaved);
          // 如果 localStorage 草稿中有 piLineItems 且非空，使用草稿；否则从订单 models 初始化
          if (parsed.piLineItems && Array.isArray(parsed.piLineItems) && parsed.piLineItems.length > 0) {
            setPiLineItems(parsed.piLineItems);
          } else {
            setPiLineItems(buildInitialPiLineItems(order.models ?? []));
          }
          if (parsed.buyerAttn !== undefined) setBuyerAttn(parsed.buyerAttn);
          if (parsed.buyerCompany !== undefined) setBuyerCompany(parsed.buyerCompany);
          if (parsed.buyerAddress !== undefined) setBuyerAddress(parsed.buyerAddress);
          if (parsed.buyerTel !== undefined) setBuyerTel(parsed.buyerTel);
          if (parsed.buyerEmail !== undefined) setBuyerEmail(parsed.buyerEmail);
          if (parsed.currency) setCurrency(parsed.currency);
          if (parsed.incoterms) setIncoterms(parsed.incoterms);
          if (parsed.portOfLoading !== undefined) setPortOfLoading(parsed.portOfLoading);
          if (parsed.bankChoice) setBankChoice(parsed.bankChoice);
          if (parsed.transitDays !== undefined) setTransitDays(parsed.transitDays);
          if (parsed.piExtras) setPiExtras({ ...defaultPiExtras(), ...parsed.piExtras });
          if (parsed.depositPct) setDepositPct(parsed.depositPct);
          if (parsed.balancePct) setBalancePct(parsed.balancePct);
          piRestoredFromCache = true;
        } else {
          setPiLineItems(buildInitialPiLineItems(order.models ?? []));
          setPiExtras(defaultPiExtras());
        }
      } catch {
        setPiLineItems(buildInitialPiLineItems(order.models ?? []));
      }
    }

    // 再从客户档案自动补全空字段（不覆盖用户已修改的内容）
    if (order.customer) {
      const matchedCustomer = customerList?.find(
        (c: any) => c.name === order.customer
      );
      if (matchedCustomer) {
        // 国外客户：自动填入 PI/CI Buyer 信息（缓存不存在时才填）
        if (!piRestoredFromCache) {
          if (matchedCustomer.attn) setBuyerAttn(matchedCustomer.attn);
          if (matchedCustomer.company) setBuyerCompany(matchedCustomer.company);
          if (matchedCustomer.phone) setBuyerTel(matchedCustomer.phone);
          if (matchedCustomer.email) setBuyerEmail(matchedCustomer.email);
          if (matchedCustomer.enAddress) setBuyerAddress(matchedCustomer.enAddress);
          else if (matchedCustomer.address) setBuyerAddress(matchedCustomer.address);
        }
        // 国内客户：自动填入甲方信息（空字段才填，不覆盖用户已修改的内容）
        if (matchedCustomer.country === "domestic" && !isAmazonOrder) {
          if (matchedCustomer.cnCompany) setBuyerCnCompany(prev => prev || (matchedCustomer.cnCompany ?? ""));
          if (matchedCustomer.taxNo) setBuyerTaxNo(prev => prev || (matchedCustomer.taxNo ?? ""));
          if (matchedCustomer.bankAccount) setBuyerBankAccount(prev => prev || (matchedCustomer.bankAccount ?? ""));
          if (matchedCustomer.bankName) setBuyerBankName(prev => prev || (matchedCustomer.bankName ?? ""));
          if (matchedCustomer.name) setCounterpartyName(prev => prev || (matchedCustomer.name ?? ""));
          if (matchedCustomer.address) setCounterpartyAddress(prev => prev || (matchedCustomer.address ?? ""));
        }
      }
    }

    // 亚马逊订单：若草稿中没有供货商信息，默认填入恩平亿丰
    if (isAmazonOrder && !cnRestoredFromCache) {
      const defaultSupplier = AMAZON_SUPPLIER_OPTIONS[0];
      setCounterpartyName(defaultSupplier.name);
      setCounterpartyAddress(defaultSupplier.address);
      setBuyerBankAccount(defaultSupplier.bankAccount);
      setBuyerBankName(defaultSupplier.bankName);
      if (defaultSupplier.taxNo) setBuyerTaxNo(defaultSupplier.taxNo);
      setAmazonSupplierIdx(0);
    }

    // prefillYifeng：强制切换到国内合同 Tab 并预填亿丰供货商信息
    if (prefillYifeng) {
      setActiveTab("contract_cn");
      const yifeng = AMAZON_SUPPLIER_OPTIONS[0];
      setCounterpartyName(yifeng.name);
      setCounterpartyAddress(yifeng.address);
      setBuyerBankAccount(yifeng.bankAccount);
      setBuyerBankName(yifeng.bankName);
      if (yifeng.taxNo) setBuyerTaxNo(yifeng.taxNo);
    }
  }, [open, order, dbDraftCn, dbDraftPi, prefillYifeng]);

  // 每次国内合同字段变化时，自动保存到 localStorage 和数据库
  useEffect(() => {
    if (!open) return;
    const draftData = {
      lineItems,
      counterpartyName,
      counterpartyAddress,
      buyerCnCompany,
      buyerTaxNo,
      buyerBankAccount,
      buyerBankName,
      needInvoice,
      extras,
      depositPct,
      balancePct,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(draftData));
    } catch {
      // 存储失败（如隐私模式），静默忽略
    }
    // 同时防抖保存到数据库（跨设备共享）
    saveDraftToDb("contract_cn", draftData);
  }, [open, lineItems, counterpartyName, counterpartyAddress, buyerCnCompany, buyerTaxNo, buyerBankAccount, buyerBankName, needInvoice, extras, depositPct, balancePct, saveDraftToDb]);

  // 每次 PI/CI 字段变化时，自动保存到 localStorage 和数据库
  useEffect(() => {
    if (!open) return;
    const piDraftData = {
      piLineItems,
      buyerAttn,
      buyerCompany,
      buyerAddress,
      buyerTel,
      buyerEmail,
      currency,
      incoterms,
      portOfLoading,
      bankChoice,
      transitDays,
      piExtras,
      depositPct,
      balancePct,
    };
    try {
      localStorage.setItem(piStorageKey, JSON.stringify(piDraftData));
    } catch {
      // 存储失败，静默忽略
    }
    // 同时防抖保存到数据库（跨设备共享）
    saveDraftToDb("pi", piDraftData);
  }, [open, piLineItems, buyerAttn, buyerCompany, buyerAddress, buyerTel, buyerEmail, currency, incoterms, portOfLoading, bankChoice, transitDays, piExtras, depositPct, balancePct, saveDraftToDb]);

  // 切换到 CI Tab 时重置 PI 选择
  useEffect(() => {
    if (activeTab !== "ci") {
      setSelectedPiId("");
    }
  }, [activeTab]);

  // ── 同步数据给父组件（用于采购合同联动） ──────────────────────────────────────────
  const onSyncDataRef = useRef(onSyncData);
  onSyncDataRef.current = onSyncData;
  useEffect(() => {
    if (!open || !onSyncDataRef.current) return;
    onSyncDataRef.current({ lineItems, extras, piExtras, activeTab });
  }, [open, lineItems, extras, piExtras, activeTab]);

  // ── 附加费用更新辅助 ──────────────────────────────────────────────────────────

  // useCallback 避免每次 render 重新创建这些辅助函数
  const updateExtra = useCallback(
    <K extends keyof DomesticExtras>(key: K, value: DomesticExtras[K]) => {
      setExtras(prev => ({ ...prev, [key]: value }));
    }, []);

  /** 更新数量或单价时自动重算金额 */
  const updateExtraWithCalc = useCallback((
    qtyKey: keyof DomesticExtras,
    priceKey: keyof DomesticExtras,
    amountKey: keyof DomesticExtras,
    qty: number,
    price: number,
  ) => {
    setExtras(prev => ({
      ...prev,
      [qtyKey]: qty,
      [priceKey]: price,
      [amountKey]: round2(qty * price),
    }));
  }, []);

  // PI/CI 附加费用更新辅助
  const updatePiExtra = useCallback(
    <K extends keyof PiExtras>(key: K, value: PiExtras[K]) => {
      setPiExtras(prev => ({ ...prev, [key]: value }));
    }, []);

  const updatePiExtraWithCalc = useCallback((
    qtyKey: keyof PiExtras,
    priceKey: keyof PiExtras,
    amountKey: keyof PiExtras,
    qty: number,
    price: number,
  ) => {
    setPiExtras(prev => ({
      ...prev,
      [qtyKey]: qty,
      [priceKey]: price,
      [amountKey]: round2(qty * price),
    }));
  }, []);

  // ── 总价计算 ─────────────────────────────────────────────────────────────────

  /** 箱子明细小计（国内合同） */
  const boxSubtotal = useMemo(
    () => round2(lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)),
    [lineItems]
  );

  /** 各附加项金额（国内合同） */
  const linerTotal = extras.hasLiner ? round2(extras.linerAmount + (extras.hasLinerTemplate ? extras.linerTemplateAmount : 0)) : 0;
  const logoTotal = extras.hasLogo ? extras.logoAmount : 0;
  const silkPrintTotal = extras.hasSilkPrint ? round2(extras.silkPrintAmount + (extras.hasSilkPrintTemplate ? extras.silkPrintTemplateAmount : 0)) : 0;
  const customColorTotal = extras.hasCustomColor ? extras.customColorAmount : 0;
  const shippingTotal = extras.shippingFee || 0;

  /** 税前总价（国内合同） */
  const subtotalBeforeTax = useMemo(
    () => round2(boxSubtotal + linerTotal + logoTotal + silkPrintTotal + customColorTotal + shippingTotal),
    [boxSubtotal, linerTotal, logoTotal, silkPrintTotal, customColorTotal, shippingTotal]
  );

  /** 最终总价（含税时 × 1.13） */
  const finalTotalAmount = useMemo(
    () => needInvoice ? round2(subtotalBeforeTax * VAT_RATE) : subtotalBeforeTax,
    [subtotalBeforeTax, needInvoice]
  );

  /** PI/CI 总价（箱子 + 附加明细） */
  const piCiTotalAmount = useMemo(
    () => round2(
      piLineItems.reduce((sum, item) => sum + (item.amount || 0), 0) +
      (piExtras.hasLiner ? round2(piExtras.linerAmount + (piExtras.hasLinerTemplate ? piExtras.linerTemplateAmount : 0)) : 0) +
      (piExtras.hasLogo ? piExtras.logoAmount : 0) +
      (piExtras.hasSilkPrint ? round2(piExtras.silkPrintAmount + (piExtras.hasSilkPrintTemplate ? piExtras.silkPrintTemplateAmount : 0)) : 0) +
      (piExtras.hasCustomColor ? piExtras.customColorAmount : 0) +
      (piExtras.domesticFreight || 0) +
      (piExtras.internationalFreight || 0)
    ),
    [piLineItems, piExtras]
  );

  const isPaymentValid = depositPct + balancePct === 100;

  // ── 重置表单 ─────────────────────────────────────────────────────────────────────────
  const handleResetForm = () => {
    if (!confirm("确定要清空本订单的所有填写内容吗？")) return;
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    try { localStorage.removeItem(piStorageKey); } catch { /* ignore */ }
    // 同时清除数据库草稿
    saveDraftMutation.mutate({ orderId: order.id, draftType: "contract_cn", data: "{}" });
    saveDraftMutation.mutate({ orderId: order.id, draftType: "pi", data: "{}" });
    setLineItems(buildInitialLineItems(order.models ?? []));
    setPiLineItems(buildInitialPiLineItems(order.models ?? []));
    setExtras(defaultExtras());
    setPiExtras(defaultPiExtras());
    setNeedInvoice(false);
    setCounterpartyName("");
    setCounterpartyAddress("");
    setDepositPct(30);
    setBalancePct(70);
    setBuyerName(order.customer ?? "");
    setBuyerAttn("");
    setBuyerCompany("");
    setBuyerAddress("");
    setBuyerTel("");
    setBuyerEmail("");
    setCurrency("USD");
    setIncoterms("FOB");
    setPortOfLoading("Shenzhen");
    setBankChoice("icbc");
    setTransitDays("");
    // 国内合同甲方信息也一并清空
    setBuyerCnCompany("");
    setBuyerTaxNo("");
    setBuyerBankAccount("");
    setBuyerBankName("");
    // 亚马逊订单：重置时恢复默认供货商（恩平亿丰）
    if (isAmazonOrder) {
      const defaultSupplier = AMAZON_SUPPLIER_OPTIONS[0];
      setCounterpartyName(defaultSupplier.name);
      setCounterpartyAddress(defaultSupplier.address);
      setBuyerBankAccount(defaultSupplier.bankAccount);
      setBuyerBankName(defaultSupplier.bankName);
      if (defaultSupplier.taxNo) setBuyerTaxNo(defaultSupplier.taxNo);
      setAmazonSupplierIdx(0);
    }
  };

  // ── 从 PI 填充 CI ─────────────────────────────────────────────────────────────

  const handleLoadFromPi = (piId: string) => {
    setSelectedPiId(piId);
    if (!piId || !activePiList) return;
    const pi = activePiList.find(p => String(p.id) === piId);
    if (!pi) return;

    if (pi.counterpartyName) setBuyerName(pi.counterpartyName);
    if (pi.counterpartyAddress) setBuyerAddress(pi.counterpartyAddress);
    // 同步 Buyer 英文联系信息
    if (pi.buyerAttn) setBuyerAttn(pi.buyerAttn);
    if (pi.buyerCompany) setBuyerCompany(pi.buyerCompany);
    if (pi.buyerTel) setBuyerTel(pi.buyerTel);
    if (pi.buyerEmail) setBuyerEmail(pi.buyerEmail);
    if (pi.transitDays) setTransitDays(pi.transitDays);
    if (pi.currency && (pi.currency === "USD" || pi.currency === "EUR")) {
      setCurrency(pi.currency as "USD" | "EUR");
    }
    if (pi.bankChoice) setBankChoice(pi.bankChoice as "icbc" | "citi");
    if (pi.incoterms) setIncoterms(pi.incoterms);
    if (pi.portOfLoading) setPortOfLoading(pi.portOfLoading);
    if (pi.depositPct) setDepositPct(pi.depositPct);
    if (pi.balancePct) setBalancePct(pi.balancePct);

    try {
      const piItems = JSON.parse(pi.lineItems ?? "[]");
      if (Array.isArray(piItems) && piItems.length > 0) {
        setPiLineItems(piItems.map((item: any) => ({
          modelName: item.modelName ?? "",
          material: item.material ?? "",
          spec: item.spec ?? "",
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          amount: Number(item.amount) || 0,
        })));
      }
    } catch {
      // ignore parse error
    }

    toast.success(`已从 PI ${pi.docNo} 填充数据`);
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const generateContractMutation = trpc.documents.generateContractCn.useMutation({
    onSuccess: (data) => {
      toast.success(`采购合同 ${data.docNo} 已生成`);
      window.open(data.pdfUrl, "_blank");
      utils.documents.listByOrder.invalidate({ orderId: order.id });
      onClose();
    },
    onError: (err) => toast.error(`生成失败：${err.message}`),
  });

  const generatePiCiMutation = trpc.documents.generatePiCi.useMutation({
    onSuccess: (data) => {
      toast.success(`${activeTab.toUpperCase()} ${data.docNo} 已生成`);
      window.open(data.pdfUrl, "_blank");
      utils.documents.listByOrder.invalidate({ orderId: order.id });
      onClose();
    },
    onError: (err) => toast.error(`生成失败：${err.message}`),
  });

  const isLoading = generateContractMutation.isPending || generatePiCiMutation.isPending;

  const handleGenerate = () => {
    if (!isPaymentValid) {
      toast.error("定金 + 尾款比例之和必须等于 100%");
      return;
    }

    if (activeTab === "contract_cn") {
      if (finalTotalAmount <= 0) {
        toast.error("请填写产品单价，总金额不能为零");
        return;
      }
      if (!counterpartyName.trim()) {
        toast.error(isAmazonOrder ? "请填写乙方（供货商）公司名称" : "请填写甲方（采购方）公司名称");
        return;
      }
      generateContractMutation.mutate({
        orderId: order.id,
        isAmazon: isAmazonOrder,
        counterpartyName,
        counterpartyAddress: counterpartyAddress || undefined,
        counterpartyContactName: counterpartyContactName || undefined,
        counterpartyPhone: counterpartyPhone || undefined,
        buyerCnCompany: buyerCnCompany || undefined,
        buyerTaxNo: buyerTaxNo || undefined,
        buyerBankAccount: buyerBankAccount || undefined,
        buyerBankName: buyerBankName || undefined,
        lineItems: lineItems.map(item => ({
          modelName: item.modelName,
          material: item.material || undefined,
          spec: item.spec || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
        totalAmount: finalTotalAmount,
        depositPct,
        balancePct,
        needInvoice,
        orderDate: order.orderDate ?? undefined,
        deliveryDate: order.deliveryDate ?? undefined,
        extras: {
          hasLiner: extras.hasLiner,
          linerMaterial: extras.linerMaterial || undefined,
          linerDescription: extras.linerDescription || undefined,
          linerQuantity: extras.linerQuantity,
          linerUnitPrice: extras.linerUnitPrice,
          linerAmount: extras.linerAmount,
          hasLinerTemplate: extras.hasLinerTemplate,
          linerTemplateQuantity: extras.linerTemplateQuantity,
          linerTemplateUnitPrice: extras.linerTemplateUnitPrice,
          linerTemplateAmount: extras.linerTemplateAmount,
          hasLogo: extras.hasLogo,
          logoMaterial: extras.logoMaterial || undefined,
          logoDescription: extras.logoDescription || undefined,
          logoQuantity: extras.logoQuantity,
          logoUnitPrice: extras.logoUnitPrice,
          logoAmount: extras.logoAmount,
          hasSilkPrint: extras.hasSilkPrint,
          silkPrintDescription: extras.silkPrintDescription || undefined,
          silkPrintQuantity: extras.silkPrintQuantity,
          silkPrintUnitPrice: extras.silkPrintUnitPrice,
          silkPrintAmount: extras.silkPrintAmount,
          hasSilkPrintTemplate: extras.hasSilkPrintTemplate,
          silkPrintTemplateQuantity: extras.silkPrintTemplateQuantity,
          silkPrintTemplateUnitPrice: extras.silkPrintTemplateUnitPrice,
          silkPrintTemplateAmount: extras.silkPrintTemplateAmount,
          hasCustomColor: extras.hasCustomColor,
          customColorQuantity: extras.customColorQuantity,
          customColorUnitPrice: extras.customColorUnitPrice,
          customColorAmount: extras.customColorAmount,
          shippingFee: extras.shippingFee,
        },
      });
    } else {
      if (piCiTotalAmount <= 0) {
        toast.error("请填写产品单价");
        return;
      }
      if (!buyerName.trim()) {
        toast.error("Please enter Buyer Contact Name");
        return;
      }
      generatePiCiMutation.mutate({
        orderId: order.id,
        docType: activeTab as "pi" | "ci",
        buyerName,
        buyerAttn: buyerAttn || undefined,
        buyerCompany: buyerCompany || undefined,
        buyerAddress: buyerAddress || undefined,
        buyerTel: buyerTel || undefined,
        buyerEmail: buyerEmail || undefined,
        lineItems: piLineItems.map(item => ({
          modelName: item.modelName,
          material: item.material || undefined,
          spec: item.spec || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
        totalAmount: piCiTotalAmount,
        currency,
        depositPct,
        balancePct,
        incoterms: incoterms || undefined,
        portOfLoading: portOfLoading || undefined,
        transitDays: transitDays || undefined,
        bankChoice,
        deliveryDate: order.deliveryDate ?? undefined,
        piDocId: selectedPiId ? Number(selectedPiId) : undefined,
        piExtras: {
          hasLiner: piExtras.hasLiner,
          linerMaterial: piExtras.linerMaterial || undefined,
          linerDescription: piExtras.linerDescription || undefined,
          linerQuantity: piExtras.linerQuantity,
          linerUnitPrice: piExtras.linerUnitPrice,
          linerAmount: piExtras.linerAmount,
          hasLinerTemplate: piExtras.hasLinerTemplate,
          linerTemplateQuantity: piExtras.linerTemplateQuantity,
          linerTemplateUnitPrice: piExtras.linerTemplateUnitPrice,
          linerTemplateAmount: piExtras.linerTemplateAmount,
          hasLogo: piExtras.hasLogo,
          logoMaterial: piExtras.logoMaterial || undefined,
          logoDescription: piExtras.logoDescription || undefined,
          logoQuantity: piExtras.logoQuantity,
          logoUnitPrice: piExtras.logoUnitPrice,
          logoAmount: piExtras.logoAmount,
          hasSilkPrint: piExtras.hasSilkPrint,
          silkPrintDescription: piExtras.silkPrintDescription || undefined,
          silkPrintQuantity: piExtras.silkPrintQuantity,
          silkPrintUnitPrice: piExtras.silkPrintUnitPrice,
          silkPrintAmount: piExtras.silkPrintAmount,
          hasSilkPrintTemplate: piExtras.hasSilkPrintTemplate,
          silkPrintTemplateQuantity: piExtras.silkPrintTemplateQuantity,
          silkPrintTemplateUnitPrice: piExtras.silkPrintTemplateUnitPrice,
          silkPrintTemplateAmount: piExtras.silkPrintTemplateAmount,
          hasCustomColor: piExtras.hasCustomColor,
          customColorQuantity: piExtras.customColorQuantity,
          customColorUnitPrice: piExtras.customColorUnitPrice,
          customColorAmount: piExtras.customColorAmount,
          domesticFreight: piExtras.domesticFreight || 0,
          internationalFreightType: piExtras.internationalFreightType || undefined,
          internationalFreight: piExtras.internationalFreight || 0,
          freightDescription: piExtras.freightDescription || undefined,
        },
      });
    }
  };

  // ── PI/CI 附加明细渲染（复用于 PI 和 CI Tab） ─────────────────────────────────

  const renderPiExtras = (tabPrefix: string) => (
    <>
      {/* II. Foam */}
      <Separator />
      <div className="flex items-center gap-3">
        <Switch id={`${tabPrefix}-hasLiner`} checked={piExtras.hasLiner} onCheckedChange={v => updatePiExtra("hasLiner", v)} />
        <label htmlFor={`${tabPrefix}-hasLiner`} className="text-xs font-semibold text-foreground/70 cursor-pointer">II. Foam Details</label>
      </div>
      {piExtras.hasLiner && (
        <div className="space-y-3 pl-2">
          <ExtraFeeRow
            label="Foam Cost"
            showMaterial
            material={piExtras.linerMaterial}
            materialOptions={LINER_MATERIAL_OPTIONS}
            onMaterialChange={v => updatePiExtra("linerMaterial", v)}
            showDescription
            description={piExtras.linerDescription}
            onDescriptionChange={v => updatePiExtra("linerDescription", v)}
            descriptionPlaceholder="e.g. Top & Bottom lining"
            quantity={piExtras.linerQuantity}
            unitPrice={piExtras.linerUnitPrice}
            amount={piExtras.linerAmount}
            onQuantityChange={qty => updatePiExtraWithCalc("linerQuantity", "linerUnitPrice", "linerAmount", qty, piExtras.linerUnitPrice)}
            onUnitPriceChange={price => updatePiExtraWithCalc("linerQuantity", "linerUnitPrice", "linerAmount", piExtras.linerQuantity, price)}
            subtotal={!piExtras.hasLinerTemplate ? piExtras.linerAmount : undefined}
            subtotalLabel="Foam Subtotal"
            currency={currency}
          />
          <div className="flex items-center gap-3">
            <Switch id={`${tabPrefix}-hasLinerTemplate`} checked={piExtras.hasLinerTemplate} onCheckedChange={v => updatePiExtra("hasLinerTemplate", v)} />
            <label htmlFor={`${tabPrefix}-hasLinerTemplate`} className="text-xs text-muted-foreground cursor-pointer">Include Foam Mold Fee</label>
          </div>
          {piExtras.hasLinerTemplate && (
            <ExtraFeeRow
              label="Foam Mold Fee"
              quantity={piExtras.linerTemplateQuantity}
              unitPrice={piExtras.linerTemplateUnitPrice}
              amount={piExtras.linerTemplateAmount}
              onQuantityChange={qty => updatePiExtraWithCalc("linerTemplateQuantity", "linerTemplateUnitPrice", "linerTemplateAmount", qty, piExtras.linerTemplateUnitPrice)}
              onUnitPriceChange={price => updatePiExtraWithCalc("linerTemplateQuantity", "linerTemplateUnitPrice", "linerTemplateAmount", piExtras.linerTemplateQuantity, price)}
              subtotal={round2(piExtras.linerAmount + piExtras.linerTemplateAmount)}
              subtotalLabel="Foam Total (incl. Mold)"
              currency={currency}
            />
          )}
        </div>
      )}

      {/* III. Custom LOGO */}
      <Separator />
      <div className="flex items-center gap-3">
        <Switch id={`${tabPrefix}-hasLogo`} checked={piExtras.hasLogo} onCheckedChange={v => updatePiExtra("hasLogo", v)} />
        <label htmlFor={`${tabPrefix}-hasLogo`} className="text-xs font-semibold text-foreground/70 cursor-pointer">III. Custom LOGO</label>
      </div>
      {piExtras.hasLogo && (
        <div className="pl-2">
          <ExtraFeeRow
            label="LOGO Cost"
            showMaterial
            material={piExtras.logoMaterial}
            materialOptions={LOGO_MATERIAL_OPTIONS}
            onMaterialChange={v => updatePiExtra("logoMaterial", v)}
            showDescription
            description={piExtras.logoDescription}
            onDescriptionChange={v => updatePiExtra("logoDescription", v)}
            descriptionPlaceholder="e.g. Front gold-stamped LOGO"
            quantity={piExtras.logoQuantity}
            unitPrice={piExtras.logoUnitPrice}
            amount={piExtras.logoAmount}
            onQuantityChange={qty => updatePiExtraWithCalc("logoQuantity", "logoUnitPrice", "logoAmount", qty, piExtras.logoUnitPrice)}
            onUnitPriceChange={price => updatePiExtraWithCalc("logoQuantity", "logoUnitPrice", "logoAmount", piExtras.logoQuantity, price)}
            subtotal={piExtras.logoAmount}
            subtotalLabel="LOGO Subtotal"
            currency={currency}
          />
        </div>
      )}

      {/* IV. Silk Screen Printing */}
      <Separator />
      <div className="flex items-center gap-3">
        <Switch id={`${tabPrefix}-hasSilkPrint`} checked={piExtras.hasSilkPrint} onCheckedChange={v => updatePiExtra("hasSilkPrint", v)} />
        <label htmlFor={`${tabPrefix}-hasSilkPrint`} className="text-xs font-semibold text-foreground/70 cursor-pointer">IV. Silk Screen Printing</label>
      </div>
      {piExtras.hasSilkPrint && (
        <div className="space-y-3 pl-2">
          <ExtraFeeRow
            label="Silk Print Cost"
            showDescription
            description={piExtras.silkPrintDescription}
            onDescriptionChange={v => updatePiExtra("silkPrintDescription", v)}
            descriptionPlaceholder="e.g. Single-color silk print, front"
            quantity={piExtras.silkPrintQuantity}
            unitPrice={piExtras.silkPrintUnitPrice}
            amount={piExtras.silkPrintAmount}
            onQuantityChange={qty => updatePiExtraWithCalc("silkPrintQuantity", "silkPrintUnitPrice", "silkPrintAmount", qty, piExtras.silkPrintUnitPrice)}
            onUnitPriceChange={price => updatePiExtraWithCalc("silkPrintQuantity", "silkPrintUnitPrice", "silkPrintAmount", piExtras.silkPrintQuantity, price)}
            subtotal={!piExtras.hasSilkPrintTemplate ? piExtras.silkPrintAmount : undefined}
            subtotalLabel="Silk Print Subtotal"
            currency={currency}
          />
          <div className="flex items-center gap-3">
            <Switch id={`${tabPrefix}-hasSilkPrintTemplate`} checked={piExtras.hasSilkPrintTemplate} onCheckedChange={v => updatePiExtra("hasSilkPrintTemplate", v)} />
            <label htmlFor={`${tabPrefix}-hasSilkPrintTemplate`} className="text-xs text-muted-foreground cursor-pointer">Include Silk Print Screen Fee</label>
          </div>
          {piExtras.hasSilkPrintTemplate && (
            <ExtraFeeRow
              label="Screen Fee"
              quantity={piExtras.silkPrintTemplateQuantity}
              unitPrice={piExtras.silkPrintTemplateUnitPrice}
              amount={piExtras.silkPrintTemplateAmount}
              onQuantityChange={qty => updatePiExtraWithCalc("silkPrintTemplateQuantity", "silkPrintTemplateUnitPrice", "silkPrintTemplateAmount", qty, piExtras.silkPrintTemplateUnitPrice)}
              onUnitPriceChange={price => updatePiExtraWithCalc("silkPrintTemplateQuantity", "silkPrintTemplateUnitPrice", "silkPrintTemplateAmount", piExtras.silkPrintTemplateQuantity, price)}
              subtotal={round2(piExtras.silkPrintAmount + piExtras.silkPrintTemplateAmount)}
              subtotalLabel="Silk Print Total (incl. Screen)"
              currency={currency}
            />
          )}
        </div>
      )}

      {/* V. Custom Color */}
      <Separator />
      <div className="flex items-center gap-3">
        <Switch id={`${tabPrefix}-hasCustomColor`} checked={piExtras.hasCustomColor} onCheckedChange={v => updatePiExtra("hasCustomColor", v)} />
        <label htmlFor={`${tabPrefix}-hasCustomColor`} className="text-xs font-semibold text-foreground/70 cursor-pointer">V. Custom Color</label>
      </div>
      {piExtras.hasCustomColor && (
        <div className="pl-2">
          <ExtraFeeRow
            label="Custom Color Fee"
            quantity={piExtras.customColorQuantity}
            unitPrice={piExtras.customColorUnitPrice}
            amount={piExtras.customColorAmount}
            onQuantityChange={qty => updatePiExtraWithCalc("customColorQuantity", "customColorUnitPrice", "customColorAmount", qty, piExtras.customColorUnitPrice)}
            onUnitPriceChange={price => updatePiExtraWithCalc("customColorQuantity", "customColorUnitPrice", "customColorAmount", piExtras.customColorQuantity, price)}
            subtotal={piExtras.customColorAmount}
            subtotalLabel="Color Subtotal"
            currency={currency}
          />
        </div>
      )}

      {/* VI. Freight */}
      <Separator />
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
        <p className="text-xs font-semibold text-foreground/70">VI. Freight</p>

        {/* 国内运输费 */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Domestic Freight (China inland)</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Amount ({currency})</Label>
              <Input
                type="number" step="0.01" min={0}
                value={piExtras.domesticFreight || ""}
                onChange={e => updatePiExtra("domesticFreight", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="h-8 text-sm"
              />
            </div>
            {piExtras.domesticFreight > 0 && (
              <div className="text-sm font-semibold text-foreground pt-5">
                {currency === "USD" ? "$" : "€"}{piExtras.domesticFreight.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* 国外运输费 */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">International Freight</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Shipping Mode</Label>
              <Select
                value={piExtras.internationalFreightType || "none"}
                onValueChange={v => updatePiExtra("internationalFreightType", v === "none" ? "" : v as "air" | "sea")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select mode..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not applicable</SelectItem>
                  <SelectItem value="air">Air Freight (空运)</SelectItem>
                  <SelectItem value="sea">Sea Freight (海运)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Amount ({currency})</Label>
              <Input
                type="number" step="0.01" min={0}
                value={piExtras.internationalFreight || ""}
                onChange={e => updatePiExtra("internationalFreight", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Logistics Description (Optional)</Label>
            <Input
              value={piExtras.freightDescription}
              onChange={e => updatePiExtra("freightDescription", e.target.value)}
              placeholder="e.g. FOB Shenzhen, via COSCO, ETD 2026-04-01"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* 运费小计 */}
        {(piExtras.domesticFreight > 0 || piExtras.internationalFreight > 0) && (
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground font-medium">Total Freight</span>
            <span className="text-sm font-bold text-primary">
              {currency === "USD" ? "$" : "€"}{round2((piExtras.domesticFreight || 0) + (piExtras.internationalFreight || 0)).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Price Summary */}
      <Separator />
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground/70 mb-2">Price Summary</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Product Subtotal</span>
            <span>{currency === "USD" ? "$" : "€"}{round2(piLineItems.reduce((s, i) => s + (i.amount || 0), 0)).toFixed(2)}</span>
          </div>
          {piExtras.hasLiner && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Foam{piExtras.hasLinerTemplate ? " (incl. Mold)" : ""}</span>
              <span>{currency === "USD" ? "$" : "€"}{round2(piExtras.linerAmount + (piExtras.hasLinerTemplate ? piExtras.linerTemplateAmount : 0)).toFixed(2)}</span>
            </div>
          )}
          {piExtras.hasLogo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custom LOGO</span>
              <span>{currency === "USD" ? "$" : "€"}{piExtras.logoAmount.toFixed(2)}</span>
            </div>
          )}
          {piExtras.hasSilkPrint && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Silk Print{piExtras.hasSilkPrintTemplate ? " (incl. Screen)" : ""}</span>
              <span>{currency === "USD" ? "$" : "€"}{round2(piExtras.silkPrintAmount + (piExtras.hasSilkPrintTemplate ? piExtras.silkPrintTemplateAmount : 0)).toFixed(2)}</span>
            </div>
          )}
          {piExtras.hasCustomColor && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custom Color</span>
              <span>{currency === "USD" ? "$" : "€"}{piExtras.customColorAmount.toFixed(2)}</span>
            </div>
          )}
          {piExtras.domesticFreight > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Domestic Freight</span>
              <span>{currency === "USD" ? "$" : "€"}{piExtras.domesticFreight.toFixed(2)}</span>
            </div>
          )}
          {piExtras.internationalFreight > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                International Freight{piExtras.internationalFreightType === "air" ? " (Air)" : piExtras.internationalFreightType === "sea" ? " (Sea)" : ""}
              </span>
              <span>{currency === "USD" ? "$" : "€"}{piExtras.internationalFreight.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-primary/30 pt-2 mt-1">
            <span className="font-bold text-base">Grand Total</span>
            <span className="font-bold text-base text-primary">{currency === "USD" ? "$" : "€"}{piCiTotalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-foreground/70">Payment Terms</p>
      <PaymentTerms
        depositPct={depositPct}
        balancePct={balancePct}
        totalAmount={piCiTotalAmount}
        currency={currency}
        onDepositChange={setDepositPct}
        onBalanceChange={setBalancePct}
      />
    </>
  );

  // ── 渲染 ──────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            生成单据
            <Badge variant="outline" className="text-xs ml-1">
              订单：{order.customer ?? "—"}
            </Badge>
            <button
              type="button"
              onClick={handleResetForm}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
              title="清空所有填写内容并恢复初始值"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置表单
            </button>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="contract_cn" disabled={isOverseas} title={isOverseas ? "国外客户不支持国内采购合同" : undefined}>
              国内采购合同
            </TabsTrigger>
            <TabsTrigger value="pi" disabled={!isOverseas} title={!isOverseas ? "国内客户不支持 PI" : undefined}>PI（形式发票）</TabsTrigger>
            <TabsTrigger value="ci" disabled={!isOverseas} title={!isOverseas ? "国内客户不支持 CI" : undefined}>CI（商业发票）</TabsTrigger>
          </TabsList>

          {/* 草稿作者和时间提示 */}
          {(() => {
            const currentDraft = (activeTab === "contract_cn") ? dbDraftCn : (activeTab === "pi" || activeTab === "ci") ? dbDraftPi : null;
            if (!currentDraft?.updatedByName) return null;
            const timeStr = currentDraft.updatedAt ? new Date(currentDraft.updatedAt).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "未知时间";
            return (
              <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                草稿由 <span className="font-medium">{currentDraft.updatedByName}</span> 于 {timeStr} 保存
              </div>
            );
          })()}

          {/* ─── 国内采购合同 ─── */}
          <TabsContent value="contract_cn" className="space-y-4 mt-4">

            {/* 客户档案快速选择（可搜索 Combobox）——仅非亚马逊订单显示 */}
            {!isAmazonOrder && domesticCustomers.length > 0 && (
              <CustomerFillCombobox
                customers={domesticCustomers}
                label="从客户档案选择："
                placeholder="搜索国内客户自动填充甲方信息..."
                onSelect={(c) => {
                  setCounterpartyName(c.name ?? "");
                  setBuyerCnCompany(c.cnCompany ?? "");
                  setBuyerTaxNo(c.taxNo ?? "");
                  setBuyerBankAccount(c.bankAccount ?? "");
                  setBuyerBankName(c.bankName ?? "");
                  setCounterpartyAddress(c.address ?? "");
                  toast.success(`已填充客户「${c.name}」的甲方信息`);
                }}
              />
            )}

            {/* 甲乙方信息 */}
            {isAmazonOrder && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                <span className="font-semibold">亚马逊订单模式：</span>
                <span>吟彩为甲方（采购方），供货商为乙方</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {isAmazonOrder ? (
                <>
                  {/* 甲方：吟彩完整信息展示 */}
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-0.5">
                    <p className="text-xs font-semibold text-primary mb-1">甲方（采购方）——固定</p>
                    <p className="text-sm font-bold text-foreground">{AMAZON_BUYER_INFO.name}</p>
                    <p className="text-xs text-muted-foreground">地址：{AMAZON_BUYER_INFO.address}</p>
                    <p className="text-xs text-muted-foreground">税号：{AMAZON_BUYER_INFO.taxNo}</p>
                    <p className="text-xs text-muted-foreground">开户行：{AMAZON_BUYER_INFO.bankName}</p>
                    <p className="text-xs text-muted-foreground">账号：{AMAZON_BUYER_INFO.bankAccount}</p>
                  </div>
                  {/* 乙方：供货商选择 */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">乙方（供货方）</p>
                      <Select
                        value={String(amazonSupplierIdx)}
                        onValueChange={(v) => {
                          const idx = parseInt(v);
                          setAmazonSupplierIdx(idx);
                          if (idx >= 0 && idx < AMAZON_SUPPLIER_OPTIONS.length) {
                            const s = AMAZON_SUPPLIER_OPTIONS[idx];
                            setCounterpartyName(s.name);
                            setCounterpartyAddress(s.address);
                            setBuyerBankAccount(s.bankAccount);
                            setBuyerBankName(s.bankName);
                            if (s.taxNo) setBuyerTaxNo(s.taxNo);
                            // contactName and phone removed from AMAZON_SUPPLIER_OPTIONS
                            toast.success(`已切换供货商：${s.name}`);
                          } else {
                            // 自定义：清空供货商字段
                            setCounterpartyName("");
                            setCounterpartyAddress("");
                            setBuyerBankAccount("");
                            setBuyerBankName("");
                            // contactName and phone removed from AMAZON_SUPPLIER_OPTIONS
                          }
                        }}
                      >
                        <SelectTrigger className="h-6 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AMAZON_SUPPLIER_OPTIONS.map((s, i) => (
                            <SelectItem key={i} value={String(i)} className="text-xs">{s.label}</SelectItem>
                          ))}
                          <SelectItem value="-1" className="text-xs">自定义</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {amazonSupplierIdx >= 0 && amazonSupplierIdx < AMAZON_SUPPLIER_OPTIONS.length ? (
                      <>
                        <p className="text-sm font-bold text-foreground">{AMAZON_SUPPLIER_OPTIONS[amazonSupplierIdx].name}</p>
                        <p className="text-xs text-muted-foreground">地址：{AMAZON_SUPPLIER_OPTIONS[amazonSupplierIdx].address}</p>
                        {AMAZON_SUPPLIER_OPTIONS[amazonSupplierIdx].taxNo && <p className="text-xs text-muted-foreground">税号：{AMAZON_SUPPLIER_OPTIONS[amazonSupplierIdx].taxNo}</p>}
                        <p className="text-xs text-muted-foreground">开户行：{AMAZON_SUPPLIER_OPTIONS[amazonSupplierIdx].bankName}</p>
                        <p className="text-xs text-muted-foreground">账号：{AMAZON_SUPPLIER_OPTIONS[amazonSupplierIdx].bankAccount}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">请在下方手动填写供货商信息</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-0.5">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">甲方（采购方）</p>
                    <p className="text-sm font-bold text-foreground">{counterpartyName || order.customer || "—"}</p>
                    {counterpartyAddress && <p className="text-xs text-muted-foreground">地址：{counterpartyAddress}</p>}
                    {buyerTaxNo && <p className="text-xs text-muted-foreground">税号：{buyerTaxNo}</p>}
                    {buyerBankName && <p className="text-xs text-muted-foreground">开户行：{buyerBankName}</p>}
                    {buyerBankAccount && <p className="text-xs text-muted-foreground">账号：{buyerBankAccount}</p>}
                    {!counterpartyAddress && !buyerTaxNo && !buyerBankName && <p className="text-xs text-muted-foreground">即本订单客户（可从客户档案选择填充详细信息）</p>}
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-0.5">
                    <p className="text-xs font-semibold text-primary mb-1">乙方（供货方）——固定</p>
                    <p className="text-sm font-bold text-foreground">{AMAZON_BUYER_INFO.name}</p>
                    <p className="text-xs text-muted-foreground">地址：{AMAZON_BUYER_INFO.address}</p>
                    <p className="text-xs text-muted-foreground">税号：{AMAZON_BUYER_INFO.taxNo}</p>
                    <p className="text-xs text-muted-foreground">开户行：{AMAZON_BUYER_INFO.bankName}</p>
                    <p className="text-xs text-muted-foreground">账号：{AMAZON_BUYER_INFO.bankAccount}</p>
                  </div>
                </>
              )}
            </div>

            {/* 亚马逊模式：选择预设供货商时隐藏冗余输入框；非亚马逊或自定义时显示 */}
            {(!isAmazonOrder || amazonSupplierIdx === -1) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAmazonOrder ? "乙方全称（供货商）" : "甲方全称（采购方）"}<span className="text-destructive ml-1">*</span></Label>
                    <Input
                      value={counterpartyName}
                      onChange={e => { setCounterpartyName(e.target.value); if (isAmazonOrder) setAmazonSupplierIdx(-1); }}
                      placeholder={isAmazonOrder ? "请输入乙方（供货商）公司全称" : "请输入甲方（采购方）公司全称"}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAmazonOrder ? "乙方公司全称（合同封面显示）" : "甲方公司全称（合同封面显示）"}</Label>
                    <Input
                      value={buyerCnCompany}
                      onChange={e => setBuyerCnCompany(e.target.value)}
                      placeholder="如与全称相同可不填"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAmazonOrder ? "乙方税号" : "甲方税号"}</Label>
                    <Input
                      value={buyerTaxNo}
                      onChange={e => setBuyerTaxNo(e.target.value)}
                      placeholder="18 位统一社会信用代码"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAmazonOrder ? "乙方地址" : "交货地址"}</Label>
                    <Input
                      value={counterpartyAddress}
                      onChange={e => { setCounterpartyAddress(e.target.value); if (isAmazonOrder) setAmazonSupplierIdx(-1); }}
                      placeholder="可选，如：广东省深圳市..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAmazonOrder ? "乙方对公账号" : "甲方对公账号"}</Label>
                    <Input
                      value={buyerBankAccount}
                      onChange={e => { setBuyerBankAccount(e.target.value); if (isAmazonOrder) setAmazonSupplierIdx(-1); }}
                      placeholder="可选"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAmazonOrder ? "乙方对公开户行" : "甲方对公开户行"}</Label>
                    <Input
                      value={buyerBankName}
                      onChange={e => { setBuyerBankName(e.target.value); if (isAmazonOrder) setAmazonSupplierIdx(-1); }}
                      placeholder="可选"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 是否开票 */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <input
                type="checkbox"
                id="needInvoice"
                checked={needInvoice}
                onChange={e => setNeedInvoice(e.target.checked)}
                className="w-4 h-4 accent-amber-600"
              />
              <label htmlFor="needInvoice" className="text-sm font-medium text-amber-800 cursor-pointer select-none">
                需要开具增值税发票（含税价 × 1.13）
              </label>
            </div>

            {/* 箱子明细 */}
            <Separator />
            <p className="text-xs font-semibold text-foreground/70">一、产品明细（请填写单价）</p>
            <DomesticLineItemsTable items={lineItems} onChange={setLineItems} />

            {/* 内衬 */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch id="hasLiner" checked={extras.hasLiner} onCheckedChange={v => updateExtra("hasLiner", v)} />
              <label htmlFor="hasLiner" className="text-xs font-semibold text-foreground/70 cursor-pointer">二、内衬明细</label>
            </div>
            {extras.hasLiner && (
              <div className="space-y-3 pl-2">
                <ExtraFeeRow
                  label="内衬费用"
                  showMaterial
                  material={extras.linerMaterial}
                  materialOptions={LINER_MATERIAL_OPTIONS}
                  onMaterialChange={v => updateExtra("linerMaterial", v)}
                  showDescription
                  description={extras.linerDescription}
                  onDescriptionChange={v => updateExtra("linerDescription", v)}
                  descriptionPlaceholder="如：上下盖内衬，EVA 黑色"
                  quantity={extras.linerQuantity}
                  unitPrice={extras.linerUnitPrice}
                  amount={extras.linerAmount}
                  onQuantityChange={qty => updateExtraWithCalc("linerQuantity", "linerUnitPrice", "linerAmount", qty, extras.linerUnitPrice)}
                  onUnitPriceChange={price => updateExtraWithCalc("linerQuantity", "linerUnitPrice", "linerAmount", extras.linerQuantity, price)}
                  subtotal={!extras.hasLinerTemplate ? extras.linerAmount : undefined}
                  subtotalLabel="内衬小计"
                />
                <div className="flex items-center gap-3">
                  <Switch id="hasLinerTemplate" checked={extras.hasLinerTemplate} onCheckedChange={v => updateExtra("hasLinerTemplate", v)} />
                  <label htmlFor="hasLinerTemplate" className="text-xs text-muted-foreground cursor-pointer">含内衬开模费</label>
                </div>
                {extras.hasLinerTemplate && (
                  <ExtraFeeRow
                    label="内衬开模费"
                    quantity={extras.linerTemplateQuantity}
                    unitPrice={extras.linerTemplateUnitPrice}
                    amount={extras.linerTemplateAmount}
                    onQuantityChange={qty => updateExtraWithCalc("linerTemplateQuantity", "linerTemplateUnitPrice", "linerTemplateAmount", qty, extras.linerTemplateUnitPrice)}
                    onUnitPriceChange={price => updateExtraWithCalc("linerTemplateQuantity", "linerTemplateUnitPrice", "linerTemplateAmount", extras.linerTemplateQuantity, price)}
                    subtotal={round2(extras.linerAmount + extras.linerTemplateAmount)}
                    subtotalLabel="内衬合计（含开模）"
                  />
                )}
              </div>
            )}

            {/* LOGO */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch id="hasLogo" checked={extras.hasLogo} onCheckedChange={v => updateExtra("hasLogo", v)} />
              <label htmlFor="hasLogo" className="text-xs font-semibold text-foreground/70 cursor-pointer">三、定制 LOGO</label>
            </div>
            {extras.hasLogo && (
              <div className="pl-2">
                <ExtraFeeRow
                  label="LOGO 费用"
                  showMaterial
                  material={extras.logoMaterial}
                  materialOptions={LOGO_MATERIAL_OPTIONS}
                  onMaterialChange={v => updateExtra("logoMaterial", v)}
                  showDescription
                  description={extras.logoDescription}
                  onDescriptionChange={v => updateExtra("logoDescription", v)}
                  descriptionPlaceholder="如：正面烫金 LOGO"
                  quantity={extras.logoQuantity}
                  unitPrice={extras.logoUnitPrice}
                  amount={extras.logoAmount}
                  onQuantityChange={qty => updateExtraWithCalc("logoQuantity", "logoUnitPrice", "logoAmount", qty, extras.logoUnitPrice)}
                  onUnitPriceChange={price => updateExtraWithCalc("logoQuantity", "logoUnitPrice", "logoAmount", extras.logoQuantity, price)}
                  subtotal={extras.logoAmount}
                  subtotalLabel="LOGO 小计"
                />
              </div>
            )}

            {/* 丝印 */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch id="hasSilkPrint" checked={extras.hasSilkPrint} onCheckedChange={v => updateExtra("hasSilkPrint", v)} />
              <label htmlFor="hasSilkPrint" className="text-xs font-semibold text-foreground/70 cursor-pointer">四、定制丝印</label>
            </div>
            {extras.hasSilkPrint && (
              <div className="space-y-3 pl-2">
                <ExtraFeeRow
                  label="丝印费用"
                  showDescription
                  description={extras.silkPrintDescription}
                  onDescriptionChange={v => updateExtra("silkPrintDescription", v)}
                  descriptionPlaceholder="如：单色丝印，正面"
                  quantity={extras.silkPrintQuantity}
                  unitPrice={extras.silkPrintUnitPrice}
                  amount={extras.silkPrintAmount}
                  onQuantityChange={qty => updateExtraWithCalc("silkPrintQuantity", "silkPrintUnitPrice", "silkPrintAmount", qty, extras.silkPrintUnitPrice)}
                  onUnitPriceChange={price => updateExtraWithCalc("silkPrintQuantity", "silkPrintUnitPrice", "silkPrintAmount", extras.silkPrintQuantity, price)}
                  subtotal={!extras.hasSilkPrintTemplate ? extras.silkPrintAmount : undefined}
                  subtotalLabel="丝印小计"
                />
                <div className="flex items-center gap-3">
                  <Switch id="hasSilkPrintTemplate" checked={extras.hasSilkPrintTemplate} onCheckedChange={v => updateExtra("hasSilkPrintTemplate", v)} />
                  <label htmlFor="hasSilkPrintTemplate" className="text-xs text-muted-foreground cursor-pointer">含丝印开版费</label>
                </div>
                {extras.hasSilkPrintTemplate && (
                  <ExtraFeeRow
                    label="丝印开版费"
                    quantity={extras.silkPrintTemplateQuantity}
                    unitPrice={extras.silkPrintTemplateUnitPrice}
                    amount={extras.silkPrintTemplateAmount}
                    onQuantityChange={qty => updateExtraWithCalc("silkPrintTemplateQuantity", "silkPrintTemplateUnitPrice", "silkPrintTemplateAmount", qty, extras.silkPrintTemplateUnitPrice)}
                    onUnitPriceChange={price => updateExtraWithCalc("silkPrintTemplateQuantity", "silkPrintTemplateUnitPrice", "silkPrintTemplateAmount", extras.silkPrintTemplateQuantity, price)}
                    subtotal={round2(extras.silkPrintAmount + extras.silkPrintTemplateAmount)}
                    subtotalLabel="丝印合计（含开版）"
                  />
                )}
              </div>
            )}

            {/* 定制颜色 */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch id="hasCustomColor" checked={extras.hasCustomColor} onCheckedChange={v => updateExtra("hasCustomColor", v)} />
              <label htmlFor="hasCustomColor" className="text-xs font-semibold text-foreground/70 cursor-pointer">五、定制颜色费</label>
            </div>
            {extras.hasCustomColor && (
              <div className="pl-2">
                <ExtraFeeRow
                  label="定制颜色费"
                  quantity={extras.customColorQuantity}
                  unitPrice={extras.customColorUnitPrice}
                  amount={extras.customColorAmount}
                  onQuantityChange={qty => updateExtraWithCalc("customColorQuantity", "customColorUnitPrice", "customColorAmount", qty, extras.customColorUnitPrice)}
                  onUnitPriceChange={price => updateExtraWithCalc("customColorQuantity", "customColorUnitPrice", "customColorAmount", extras.customColorQuantity, price)}
                  subtotal={extras.customColorAmount}
                  subtotalLabel="颜色费小计"
                />
              </div>
            )}

            {/* 物流运费 */}
            <Separator />
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground/70">六、物流运费</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">运费金额（元）</Label>
                  <Input
                    type="number" step="0.01" min={0}
                    value={extras.shippingFee || ""}
                    onChange={e => updateExtra("shippingFee", parseFloat(e.target.value) || 0)}
                    placeholder="0.00（无运费则留空）"
                    className="h-8 text-sm"
                  />
                </div>
                {extras.shippingFee > 0 && (
                  <div className="text-sm font-semibold text-foreground pt-5">
                    ¥{extras.shippingFee.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* 价格汇总 */}
            <Separator />
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground/70 mb-2">价格汇总</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">产品小计</span>
                  <span>¥{boxSubtotal.toFixed(2)}</span>
                </div>
                {extras.hasLiner && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">内衬{extras.hasLinerTemplate ? "（含开模）" : ""}</span>
                    <span>¥{linerTotal.toFixed(2)}</span>
                  </div>
                )}
                {extras.hasLogo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">定制 LOGO</span>
                    <span>¥{logoTotal.toFixed(2)}</span>
                  </div>
                )}
                {extras.hasSilkPrint && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">丝印{extras.hasSilkPrintTemplate ? "（含开版）" : ""}</span>
                    <span>¥{silkPrintTotal.toFixed(2)}</span>
                  </div>
                )}
                {extras.hasCustomColor && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">定制颜色费</span>
                    <span>¥{customColorTotal.toFixed(2)}</span>
                  </div>
                )}
                {extras.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">物流运费</span>
                    <span>¥{shippingTotal.toFixed(2)}</span>
                  </div>
                )}
                {needInvoice && (
                  <div className="flex justify-between text-amber-700">
                    <span>增值税（×1.13）</span>
                    <span>¥{round2(subtotalBeforeTax * (VAT_RATE - 1)).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-primary/30 pt-2 mt-1">
                  <span className="font-bold text-base">合同总价{needInvoice ? "（含税）" : ""}</span>
                  <span className="font-bold text-base text-primary">¥{finalTotalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 付款条款 */}
            <Separator />
            <p className="text-xs font-semibold text-foreground/70">付款条款</p>
            <PaymentTerms
              depositPct={depositPct}
              balancePct={balancePct}
              totalAmount={finalTotalAmount}
              currency="CNY"
              onDepositChange={setDepositPct}
              onBalanceChange={setBalancePct}
            />
          </TabsContent>

          {/* ─── PI ─── */}
          <TabsContent value="pi" className="space-y-4 mt-4">
            {/* 国外客户档案快速选择（可搜索 Combobox） */}
            {overseasCustomers.length > 0 && (
              <CustomerFillCombobox
                customers={overseasCustomers}
                label="从客户档案选择："
                placeholder="搜索国外客户自动填充 Buyer 信息..."
                colorScheme="indigo"
                onSelect={(c) => {
                  if (c.name) setBuyerName(c.name);
                  if (c.attn) setBuyerAttn(c.attn);
                  if (c.company) setBuyerCompany(c.company);
                  if (c.enAddress) setBuyerAddress(c.enAddress);
                  else if (c.address) setBuyerAddress(c.address);
                  if (c.phone) setBuyerTel(c.phone);
                  if (c.email) setBuyerEmail(c.email);
                  toast.success(`已填充客户「${c.name}」的 Buyer 信息`);
                }}
              />
            )}
            <PiCiFields
              buyerName={buyerName}
              buyerAttn={buyerAttn}
              buyerCompany={buyerCompany}
              buyerAddress={buyerAddress}
              buyerTel={buyerTel}
              buyerEmail={buyerEmail}
              currency={currency}
              bankChoice={bankChoice}
              incoterms={incoterms}
              portOfLoading={portOfLoading}
              transitDays={transitDays}
              onBuyerNameChange={setBuyerName}
              onBuyerAttnChange={setBuyerAttn}
              onBuyerCompanyChange={setBuyerCompany}
              onBuyerAddressChange={setBuyerAddress}
              onBuyerTelChange={setBuyerTel}
              onBuyerEmailChange={setBuyerEmail}
              onCurrencyChange={setCurrency}
              onBankChoiceChange={setBankChoice}
              onIncotermsChange={setIncoterms}
              onPortOfLoadingChange={setPortOfLoading}
              onTransitDaysChange={setTransitDays}
            />

            <Separator />
            <p className="text-xs font-semibold text-foreground/70">I. Product Details</p>
            <LineItemsTable
              items={piLineItems}
              currency={currency}
              onChange={setPiLineItems}
            />

            {renderPiExtras("pi")}
          </TabsContent>

          {/* ─── CI ─── */}
          <TabsContent value="ci" className="space-y-4 mt-4">
            {/* 国外客户档案快速选择（可搜索 Combobox） */}
            {overseasCustomers.length > 0 && (
              <CustomerFillCombobox
                customers={overseasCustomers}
                label="从客户档案选择："
                placeholder="搜索国外客户自动填充 Buyer 信息..."
                colorScheme="indigo"
                onSelect={(c) => {
                  if (c.name) setBuyerName(c.name);
                  if (c.attn) setBuyerAttn(c.attn);
                  if (c.company) setBuyerCompany(c.company);
                  if (c.enAddress) setBuyerAddress(c.enAddress);
                  else if (c.address) setBuyerAddress(c.address);
                  if (c.phone) setBuyerTel(c.phone);
                  if (c.email) setBuyerEmail(c.email);
                  toast.success(`已填充客户「${c.name}」的 Buyer 信息`);
                }}
              />
            )}
            {/* 从 PI 创建 */}
            {activePiList && activePiList.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Copy className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-700 mb-1.5">从已有 PI 创建</p>
                  <Select value={selectedPiId} onValueChange={handleLoadFromPi}>
                    <SelectTrigger className="h-8 text-xs bg-white border-blue-200">
                      <SelectValue placeholder="选择 PI 单据自动填充数据..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activePiList.map(pi => (
                        <SelectItem key={pi.id} value={String(pi.id)}>
                          <span className="font-medium">{pi.docNo}</span>
                          {pi.counterpartyName && (
                            <span className="text-muted-foreground ml-2">· {pi.counterpartyName}</span>
                          )}
                          {pi.totalAmount && (
                            <span className="text-muted-foreground ml-2">
                              · {pi.currency === "USD" ? "$" : "€"}{parseFloat(pi.totalAmount).toFixed(2)}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <PiCiFields
              buyerName={buyerName}
              buyerAttn={buyerAttn}
              buyerCompany={buyerCompany}
              buyerAddress={buyerAddress}
              buyerTel={buyerTel}
              buyerEmail={buyerEmail}
              currency={currency}
              bankChoice={bankChoice}
              incoterms={incoterms}
              portOfLoading={portOfLoading}
              transitDays={transitDays}
              onBuyerNameChange={setBuyerName}
              onBuyerAttnChange={setBuyerAttn}
              onBuyerCompanyChange={setBuyerCompany}
              onBuyerAddressChange={setBuyerAddress}
              onBuyerTelChange={setBuyerTel}
              onBuyerEmailChange={setBuyerEmail}
              onCurrencyChange={setCurrency}
              onBankChoiceChange={setBankChoice}
              onIncotermsChange={setIncoterms}
              onPortOfLoadingChange={setPortOfLoading}
              onTransitDaysChange={setTransitDays}
            />

            <Separator />
            <p className="text-xs font-semibold text-foreground/70">I. Product Details (Actual Shipped Qty &amp; Price)</p>
            <LineItemsTable
              items={piLineItems}
              currency={currency}
              onChange={setPiLineItems}
            />

            {renderPiExtras("ci")}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!isPaymentValid && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                定金 + 尾款必须等于 100%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              取消
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !isPaymentValid}
              className="gap-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
              ) : (
                <><Download className="w-4 h-4" />
                  {activeTab === "contract_cn" ? "生成国内合同" : activeTab === "pi" ? "生成 PI" : "生成 CI"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
