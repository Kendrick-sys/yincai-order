/**
 * DocumentDialog.tsx
 * 生成单据弹窗：国内采购合同（中文）/ PI / CI（英文）
 * 从订单数据自动填充，用户补充单价、付款比例等字段后一键生成 PDF
 * CI Tab 支持「从PI创建」：选择已有PI单据自动填充数据
 */

import { useState, useEffect, useMemo } from "react";
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
import { Loader2, FileText, Download, AlertCircle, Copy } from "lucide-react";

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const COMPANY_NAME_CN = "深圳市吟彩新型材料制品有限公司";
const VAT_RATE = 1.13; // 增值税税率 13%

// 产品名称选项
const PRODUCT_NAME_OPTIONS = ["塑料工具箱", "其他"];
// 箱体材质选项
const BOX_MATERIAL_OPTIONS = ["PP", "ABS"];
// 内衬材质选项
const LINER_MATERIAL_OPTIONS = ["PU（普通棉）", "EPE（珍珠棉）", "XPE", "EVA"];
// LOGO 材质选项
const LOGO_MATERIAL_OPTIONS = ["PVC", "滴胶", "PC", "镭射", "金属拉丝"];

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
  // 物流运费（只有金额）
  shippingFee: number;
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
  models?: OrderModel[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  order: OrderData;
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/** 精确四舍五入到2位小数，避免浮点误差 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildInitialLineItems(models: OrderModel[]): LineItemInput[] {
  return (models ?? []).map(m => ({
    modelName: "塑料工具箱", // 默认产品名称
    material: "PP",          // 默认材质
    spec: m.modelCode ?? "",
    quantity: parseInt(m.quantity ?? "0") || 0,
    unitPrice: 0,
    amount: 0,
  }));
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

  const total = useMemo(() => round2(items.reduce((sum, item) => sum + (item.amount || 0), 0)), [items]);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="border border-border px-2 py-1.5 text-left font-medium w-32">产品名称</th>
              <th className="border border-border px-2 py-1.5 text-left font-medium">型号</th>
              <th className="border border-border px-2 py-1.5 text-left font-medium w-24">材质</th>
              <th className="border border-border px-2 py-1.5 text-center font-medium w-20">数量（个）</th>
              <th className="border border-border px-2 py-1.5 text-center font-medium w-28">单价（元）</th>
              <th className="border border-border px-2 py-1.5 text-center font-medium w-28">金额（元）</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/20">
                {/* 产品名称：下拉选择，选「其他」时手动输入 */}
                <td className="border border-border px-1 py-1">
                  {customProductName[idx] ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={item.modelName}
                        onChange={e => updateItem(idx, "modelName", e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                        placeholder="请输入产品名称"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomProductName(prev => ({ ...prev, [idx]: false }));
                          updateItem(idx, "modelName", "塑料工具箱");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground px-1 flex-shrink-0"
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
                {/* 型号：读取订单型号编码 */}
                <td className="border border-border px-1 py-1">
                  <Input
                    value={item.spec}
                    onChange={e => updateItem(idx, "spec", e.target.value)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="型号"
                  />
                </td>
                {/* 材质：下拉选择 PP / ABS */}
                <td className="border border-border px-1 py-1">
                  <Select
                    value={BOX_MATERIAL_OPTIONS.includes(item.material) ? item.material : "PP"}
                    onValueChange={v => updateItem(idx, "material", v)}
                  >
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 px-1">
                      <SelectValue placeholder="选择..." />
                    </SelectTrigger>
                    <SelectContent>
                      {BOX_MATERIAL_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-border px-1 py-1 text-center">
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ""}
                    onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1 text-center"
                    placeholder="0"
                  />
                </td>
                <td className="border border-border px-1 py-1 text-center">
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
                <td className="border border-border px-2 py-1 text-center text-xs font-medium text-muted-foreground">
                  {item.amount > 0 ? item.amount.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30 font-semibold">
              <td colSpan={5} className="border border-border px-2 py-1.5 text-right text-sm">箱子小计</td>
              <td className="border border-border px-2 py-1.5 text-center text-sm">
                ¥{total.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">* 输入单价后金额自动计算；产品名称选「其他」可手动输入</p>
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
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-foreground/70">{label}</p>
      <div className="grid grid-cols-12 gap-2 items-end">
        {showMaterial && materialOptions && onMaterialChange && (
          <div className="col-span-3 space-y-1">
            <Label className="text-xs text-muted-foreground">材质</Label>
            <Select value={material || ""} onValueChange={onMaterialChange}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="选择材质..." />
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
          <div className={`${showMaterial ? "col-span-3" : "col-span-4"} space-y-1`}>
            <Label className="text-xs text-muted-foreground">描述</Label>
            <Input
              value={description || ""}
              onChange={e => onDescriptionChange(e.target.value)}
              placeholder={descriptionPlaceholder || "可选描述"}
              className="h-7 text-xs"
            />
          </div>
        )}
        <div className={`${showMaterial && showDescription ? "col-span-2" : showMaterial || showDescription ? "col-span-3" : "col-span-4"} space-y-1`}>
          <Label className="text-xs text-muted-foreground">数量（个）</Label>
          <Input
            type="number"
            min={0}
            value={quantity || ""}
            onChange={e => onQuantityChange(parseFloat(e.target.value) || 0)}
            className="h-7 text-xs text-center"
            placeholder="0"
          />
        </div>
        <div className={`${showMaterial && showDescription ? "col-span-2" : showMaterial || showDescription ? "col-span-3" : "col-span-4"} space-y-1`}>
          <Label className="text-xs text-muted-foreground">单价（元）</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={unitPrice || ""}
            onChange={e => onUnitPriceChange(parseFloat(e.target.value) || 0)}
            className="h-7 text-xs text-center"
            placeholder="0.00"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs text-muted-foreground">金额（元）</Label>
          <div className="h-7 flex items-center justify-center text-xs font-semibold text-foreground bg-background border border-border rounded px-2">
            {amount > 0 ? `¥${amount.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 子组件：PI/CI 行项目表格 ────────────────────────────────────────────────────

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

  const total = useMemo(() => round2(items.reduce((sum, item) => sum + (item.amount || 0), 0)), [items]);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="border border-border px-2 py-1.5 text-left font-medium">产品名称</th>
              <th className="border border-border px-2 py-1.5 text-left font-medium">材质</th>
              <th className="border border-border px-2 py-1.5 text-left font-medium">规格</th>
              <th className="border border-border px-2 py-1.5 text-center font-medium w-20">数量</th>
              <th className="border border-border px-2 py-1.5 text-center font-medium w-28">单价</th>
              <th className="border border-border px-2 py-1.5 text-center font-medium w-28">金额</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/20">
                <td className="border border-border px-1 py-1">
                  <Input
                    value={item.modelName}
                    onChange={e => updateItem(idx, "modelName", e.target.value)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="产品名称"
                  />
                </td>
                <td className="border border-border px-1 py-1">
                  <Input
                    value={item.material}
                    onChange={e => updateItem(idx, "material", e.target.value)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="材质"
                  />
                </td>
                <td className="border border-border px-1 py-1">
                  <Input
                    value={item.spec}
                    onChange={e => updateItem(idx, "spec", e.target.value)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="规格"
                  />
                </td>
                <td className="border border-border px-1 py-1 text-center">
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ""}
                    onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1 text-center"
                    placeholder="0"
                  />
                </td>
                <td className="border border-border px-1 py-1 text-center">
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
                <td className="border border-border px-2 py-1 text-center text-xs font-medium text-muted-foreground">
                  {item.amount > 0 ? item.amount.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30 font-semibold">
              <td colSpan={5} className="border border-border px-2 py-1.5 text-right text-sm">合计</td>
              <td className="border border-border px-2 py-1.5 text-center text-sm">
                {currencySymbol}{total.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">* 输入单价后金额自动计算，可手动调整</p>
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

// ─── PI/CI 共用字段组件 ────────────────────────────────────────────────────────

function PiCiFields({
  buyerName,
  buyerAddress,
  currency,
  bankChoice,
  incoterms,
  portOfLoading,
  onBuyerNameChange,
  onBuyerAddressChange,
  onCurrencyChange,
  onBankChoiceChange,
  onIncotermsChange,
  onPortOfLoadingChange,
}: {
  buyerName: string;
  buyerAddress: string;
  currency: "USD" | "EUR";
  bankChoice: "icbc" | "citi";
  incoterms: string;
  portOfLoading: string;
  onBuyerNameChange: (v: string) => void;
  onBuyerAddressChange: (v: string) => void;
  onCurrencyChange: (v: "USD" | "EUR") => void;
  onBankChoiceChange: (v: "icbc" | "citi") => void;
  onIncotermsChange: (v: string) => void;
  onPortOfLoadingChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Buyer Name <span className="text-destructive ml-1">*</span></Label>
        <Input
          value={buyerName}
          onChange={e => onBuyerNameChange(e.target.value)}
          placeholder="Customer / Company Name"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Buyer Address</Label>
        <Input
          value={buyerAddress}
          onChange={e => onBuyerAddressChange(e.target.value)}
          placeholder="Optional"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Currency</Label>
        <Select value={currency} onValueChange={v => onCurrencyChange(v as "USD" | "EUR")}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD（美元）</SelectItem>
            <SelectItem value="EUR">EUR（欧元）</SelectItem>
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
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────

export default function DocumentDialog({ open, onClose, order }: Props) {
  const isOverseas = order.customerType === "overseas";
  const defaultTab = isOverseas ? "pi" : "contract_cn";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);

  // 国内合同专属
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyAddress, setCounterpartyAddress] = useState("");
  const [needInvoice, setNeedInvoice] = useState(false);
  const [extras, setExtras] = useState<DomesticExtras>(defaultExtras());

  // PI/CI 专属
  const [buyerName, setBuyerName] = useState(order.customer ?? "");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [incoterms, setIncoterms] = useState("FOB");
  const [portOfLoading, setPortOfLoading] = useState("Shenzhen");
  const [bankChoice, setBankChoice] = useState<"icbc" | "citi">("icbc");

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

  // 初始化行项目
  useEffect(() => {
    if (open) {
      setLineItems(buildInitialLineItems(order.models ?? []));
      setBuyerName(order.customer ?? "");
      setActiveTab(defaultTab);
      setSelectedPiId("");
      setExtras(defaultExtras());
      setNeedInvoice(false);
    }
  }, [open, order]);

  // 切换到 CI Tab 时重置 PI 选择
  useEffect(() => {
    if (activeTab !== "ci") {
      setSelectedPiId("");
    }
  }, [activeTab]);

  // ── 附加费用更新辅助 ──────────────────────────────────────────────────────────

  const updateExtra = <K extends keyof DomesticExtras>(key: K, value: DomesticExtras[K]) => {
    setExtras(prev => ({ ...prev, [key]: value }));
  };

  /** 更新数量或单价时自动重算金额 */
  const updateExtraWithCalc = (
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
  };

  // ── 总价计算 ─────────────────────────────────────────────────────────────────

  /** 箱子明细小计 */
  const boxSubtotal = useMemo(
    () => round2(lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)),
    [lineItems]
  );

  /** 各附加项金额 */
  const linerTotal = extras.hasLiner ? round2(extras.linerAmount + (extras.hasLinerTemplate ? extras.linerTemplateAmount : 0)) : 0;
  const logoTotal = extras.hasLogo ? extras.logoAmount : 0;
  const silkPrintTotal = extras.hasSilkPrint ? round2(extras.silkPrintAmount + (extras.hasSilkPrintTemplate ? extras.silkPrintTemplateAmount : 0)) : 0;
  const customColorTotal = extras.hasCustomColor ? extras.customColorAmount : 0;
  const shippingTotal = extras.shippingFee || 0;

  /** 税前总价 */
  const subtotalBeforeTax = useMemo(
    () => round2(boxSubtotal + linerTotal + logoTotal + silkPrintTotal + customColorTotal + shippingTotal),
    [boxSubtotal, linerTotal, logoTotal, silkPrintTotal, customColorTotal, shippingTotal]
  );

  /** 最终总价（含税时 × 1.13） */
  const finalTotalAmount = useMemo(
    () => needInvoice ? round2(subtotalBeforeTax * VAT_RATE) : subtotalBeforeTax,
    [subtotalBeforeTax, needInvoice]
  );

  /** PI/CI 总价（仅箱子明细） */
  const piCiTotalAmount = useMemo(
    () => round2(lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)),
    [lineItems]
  );

  const isPaymentValid = depositPct + balancePct === 100;

  // ── 从 PI 填充 CI ─────────────────────────────────────────────────────────────

  const handleLoadFromPi = (piId: string) => {
    setSelectedPiId(piId);
    if (!piId || !activePiList) return;
    const pi = activePiList.find(p => String(p.id) === piId);
    if (!pi) return;

    if (pi.counterpartyName) setBuyerName(pi.counterpartyName);
    if (pi.counterpartyAddress) setBuyerAddress(pi.counterpartyAddress);
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
        setLineItems(piItems.map((item: any) => ({
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
      onClose();
    },
    onError: (err) => toast.error(`生成失败：${err.message}`),
  });

  const generatePiCiMutation = trpc.documents.generatePiCi.useMutation({
    onSuccess: (data) => {
      toast.success(`${activeTab.toUpperCase()} ${data.docNo} 已生成`);
      window.open(data.pdfUrl, "_blank");
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
        toast.error("请填写甲方（采购方）公司名称");
        return;
      }
      generateContractMutation.mutate({
        orderId: order.id,
        counterpartyName,
        counterpartyAddress: counterpartyAddress || undefined,
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
        toast.error("请填写买方名称");
        return;
      }
      generatePiCiMutation.mutate({
        orderId: order.id,
        docType: activeTab as "pi" | "ci",
        buyerName,
        buyerAddress: buyerAddress || undefined,
        lineItems: lineItems.map(item => ({
          modelName: item.modelName,
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
        bankChoice,
        deliveryDate: order.deliveryDate ?? undefined,
        piDocId: selectedPiId ? Number(selectedPiId) : undefined,
      });
    }
  };

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
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="contract_cn" disabled={isOverseas}>
              国内采购合同
            </TabsTrigger>
            <TabsTrigger value="pi">PI（形式发票）</TabsTrigger>
            <TabsTrigger value="ci">CI（商业发票）</TabsTrigger>
          </TabsList>

          {/* ─── 国内采购合同 ─── */}
          <TabsContent value="contract_cn" className="space-y-4 mt-4">

            {/* 甲乙方信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">甲方（采购方）</p>
                <p className="text-sm font-medium text-foreground">{order.customer || "—"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">即本订单客户</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-1">乙方（供货方）</p>
                <p className="text-sm font-medium text-foreground">{COMPANY_NAME_CN}</p>
                <p className="text-xs text-muted-foreground mt-0.5">即我方</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">甲方全称（采购方）<span className="text-destructive ml-1">*</span></Label>
                <Input
                  value={counterpartyName}
                  onChange={e => setCounterpartyName(e.target.value)}
                  placeholder="请输入甲方（采购方）公司全称"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">交货地址</Label>
                <Input
                  value={counterpartyAddress}
                  onChange={e => setCounterpartyAddress(e.target.value)}
                  placeholder="可选，如：广东省深圳市..."
                  className="h-8 text-sm"
                />
              </div>
            </div>

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
              {needInvoice && (
                <span className="text-xs text-amber-600 ml-1">
                  税前 ¥{subtotalBeforeTax.toFixed(2)} → 含税 ¥{finalTotalAmount.toFixed(2)}
                </span>
              )}
            </div>

            {/* 箱子明细 */}
            <Separator />
            <p className="text-xs font-semibold text-foreground/70">一、箱子明细（请填写单价）</p>
            <DomesticLineItemsTable items={lineItems} onChange={setLineItems} />

            {/* 内衬 */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch
                id="hasLiner"
                checked={extras.hasLiner}
                onCheckedChange={v => updateExtra("hasLiner", v)}
              />
              <label htmlFor="hasLiner" className="text-xs font-semibold text-foreground/70 cursor-pointer">
                二、内衬明细
              </label>
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
                  descriptionPlaceholder="如：上下盖各一片"
                  quantity={extras.linerQuantity}
                  unitPrice={extras.linerUnitPrice}
                  amount={extras.linerAmount}
                  onQuantityChange={qty => updateExtraWithCalc("linerQuantity", "linerUnitPrice", "linerAmount", qty, extras.linerUnitPrice)}
                  onUnitPriceChange={price => updateExtraWithCalc("linerQuantity", "linerUnitPrice", "linerAmount", extras.linerQuantity, price)}
                />
                <div className="flex items-center gap-3">
                  <Switch
                    id="hasLinerTemplate"
                    checked={extras.hasLinerTemplate}
                    onCheckedChange={v => updateExtra("hasLinerTemplate", v)}
                  />
                  <label htmlFor="hasLinerTemplate" className="text-xs text-muted-foreground cursor-pointer">
                    包含内衬定制模板费
                  </label>
                </div>
                {extras.hasLinerTemplate && (
                  <ExtraFeeRow
                    label="内衬定制模板费"
                    quantity={extras.linerTemplateQuantity}
                    unitPrice={extras.linerTemplateUnitPrice}
                    amount={extras.linerTemplateAmount}
                    onQuantityChange={qty => updateExtraWithCalc("linerTemplateQuantity", "linerTemplateUnitPrice", "linerTemplateAmount", qty, extras.linerTemplateUnitPrice)}
                    onUnitPriceChange={price => updateExtraWithCalc("linerTemplateQuantity", "linerTemplateUnitPrice", "linerTemplateAmount", extras.linerTemplateQuantity, price)}
                  />
                )}
              </div>
            )}

            {/* LOGO */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch
                id="hasLogo"
                checked={extras.hasLogo}
                onCheckedChange={v => updateExtra("hasLogo", v)}
              />
              <label htmlFor="hasLogo" className="text-xs font-semibold text-foreground/70 cursor-pointer">
                三、定制 LOGO
              </label>
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
                />
              </div>
            )}

            {/* 丝印 */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch
                id="hasSilkPrint"
                checked={extras.hasSilkPrint}
                onCheckedChange={v => updateExtra("hasSilkPrint", v)}
              />
              <label htmlFor="hasSilkPrint" className="text-xs font-semibold text-foreground/70 cursor-pointer">
                四、定制丝印
              </label>
            </div>
            {extras.hasSilkPrint && (
              <div className="space-y-3 pl-2">
                <ExtraFeeRow
                  label="丝印费用"
                  showDescription
                  description={extras.silkPrintDescription}
                  onDescriptionChange={v => updateExtra("silkPrintDescription", v)}
                  descriptionPlaceholder="如：黑色单色丝印，正面"
                  quantity={extras.silkPrintQuantity}
                  unitPrice={extras.silkPrintUnitPrice}
                  amount={extras.silkPrintAmount}
                  onQuantityChange={qty => updateExtraWithCalc("silkPrintQuantity", "silkPrintUnitPrice", "silkPrintAmount", qty, extras.silkPrintUnitPrice)}
                  onUnitPriceChange={price => updateExtraWithCalc("silkPrintQuantity", "silkPrintUnitPrice", "silkPrintAmount", extras.silkPrintQuantity, price)}
                />
                <div className="flex items-center gap-3">
                  <Switch
                    id="hasSilkPrintTemplate"
                    checked={extras.hasSilkPrintTemplate}
                    onCheckedChange={v => updateExtra("hasSilkPrintTemplate", v)}
                  />
                  <label htmlFor="hasSilkPrintTemplate" className="text-xs text-muted-foreground cursor-pointer">
                    包含丝印定制模板费
                  </label>
                </div>
                {extras.hasSilkPrintTemplate && (
                  <ExtraFeeRow
                    label="丝印定制模板费"
                    quantity={extras.silkPrintTemplateQuantity}
                    unitPrice={extras.silkPrintTemplateUnitPrice}
                    amount={extras.silkPrintTemplateAmount}
                    onQuantityChange={qty => updateExtraWithCalc("silkPrintTemplateQuantity", "silkPrintTemplateUnitPrice", "silkPrintTemplateAmount", qty, extras.silkPrintTemplateUnitPrice)}
                    onUnitPriceChange={price => updateExtraWithCalc("silkPrintTemplateQuantity", "silkPrintTemplateUnitPrice", "silkPrintTemplateAmount", extras.silkPrintTemplateQuantity, price)}
                  />
                )}
              </div>
            )}

            {/* 定制颜色 */}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch
                id="hasCustomColor"
                checked={extras.hasCustomColor}
                onCheckedChange={v => updateExtra("hasCustomColor", v)}
              />
              <label htmlFor="hasCustomColor" className="text-xs font-semibold text-foreground/70 cursor-pointer">
                五、定制颜色
              </label>
            </div>
            {extras.hasCustomColor && (
              <div className="pl-2">
                <ExtraFeeRow
                  label="定制颜色费用"
                  quantity={extras.customColorQuantity}
                  unitPrice={extras.customColorUnitPrice}
                  amount={extras.customColorAmount}
                  onQuantityChange={qty => updateExtraWithCalc("customColorQuantity", "customColorUnitPrice", "customColorAmount", qty, extras.customColorUnitPrice)}
                  onUnitPriceChange={price => updateExtraWithCalc("customColorQuantity", "customColorUnitPrice", "customColorAmount", extras.customColorQuantity, price)}
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
                    type="number"
                    step="0.01"
                    min={0}
                    value={extras.shippingFee || ""}
                    onChange={e => updateExtra("shippingFee", parseFloat(e.target.value) || 0)}
                    placeholder="0.00（不含运费则留空）"
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
                  <span className="text-muted-foreground">箱子小计</span>
                  <span>¥{boxSubtotal.toFixed(2)}</span>
                </div>
                {extras.hasLiner && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">内衬{extras.hasLinerTemplate ? "（含模板费）" : ""}</span>
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
                    <span className="text-muted-foreground">丝印{extras.hasSilkPrintTemplate ? "（含模板费）" : ""}</span>
                    <span>¥{silkPrintTotal.toFixed(2)}</span>
                  </div>
                )}
                {extras.hasCustomColor && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">定制颜色</span>
                    <span>¥{customColorTotal.toFixed(2)}</span>
                  </div>
                )}
                {extras.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">物流运费</span>
                    <span>¥{shippingTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">税前合计</span>
                  <span className="font-medium">¥{subtotalBeforeTax.toFixed(2)}</span>
                </div>
                {needInvoice && (
                  <div className="flex justify-between text-amber-700">
                    <span>增值税（×1.13）</span>
                    <span>¥{round2(subtotalBeforeTax * (VAT_RATE - 1)).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-primary/30 pt-2 mt-1">
                  <span className="font-bold text-base">最终总价{needInvoice ? "（含税）" : ""}</span>
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
            <PiCiFields
              buyerName={buyerName}
              buyerAddress={buyerAddress}
              currency={currency}
              bankChoice={bankChoice}
              incoterms={incoterms}
              portOfLoading={portOfLoading}
              onBuyerNameChange={setBuyerName}
              onBuyerAddressChange={setBuyerAddress}
              onCurrencyChange={setCurrency}
              onBankChoiceChange={setBankChoice}
              onIncotermsChange={setIncoterms}
              onPortOfLoadingChange={setPortOfLoading}
            />

            <Separator />
            <p className="text-xs font-semibold text-foreground/70">Product Details（请填写单价）</p>
            <LineItemsTable
              items={lineItems}
              currency={currency}
              onChange={setLineItems}
            />

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
          </TabsContent>

          {/* ─── CI ─── */}
          <TabsContent value="ci" className="space-y-4 mt-4">
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
              buyerAddress={buyerAddress}
              currency={currency}
              bankChoice={bankChoice}
              incoterms={incoterms}
              portOfLoading={portOfLoading}
              onBuyerNameChange={setBuyerName}
              onBuyerAddressChange={setBuyerAddress}
              onCurrencyChange={setCurrency}
              onBankChoiceChange={setBankChoice}
              onIncotermsChange={setIncoterms}
              onPortOfLoadingChange={setPortOfLoading}
            />

            <Separator />
            <p className="text-xs font-semibold text-foreground/70">Product Details（请填写实际发货数量和单价）</p>
            <LineItemsTable
              items={lineItems}
              currency={currency}
              onChange={setLineItems}
            />

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
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !isPaymentValid}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                生成 PDF 并下载
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
