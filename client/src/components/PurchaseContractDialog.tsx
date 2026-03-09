/**
 * PurchaseContractDialog.tsx
 * 吟彩向亿丰的采购合同弹窗（独立组件）
 * - 甲方（采购方）：深圳市吟彩新型材料制品有限公司（固定）
 * - 乙方（供货方）：恩平市亿丰塑料模具有限公司（固定）
 * - 无需填写甲乙方信息，直接填写产品明细和付款条款即可
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { lookupCost } from "@/lib/yifengCostTable";
import type { DocSyncData } from "@/components/DocumentDialog";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, AlertCircle, ShoppingCart, Lock, LockOpen } from "lucide-react";

// ─── 常量 ──────────────────────────────────────────────────────────────────────
const YINCAI_INFO = {
  name: "深圳市吟彩新型材料制品有限公司",
  address: "深圳市龙华区龙华街道油松社区镇乾大厦520",
  contactName: "张昊",
  phone: "+86 15338774063",
  bankAccount: "4000 0517 0910 0504 972",
  bankName: "中国工商银行深圳市分行",
};

const YIFENG_INFO = {
  name: "恩平市亿丰塑料模具有限公司",
  address: "恩平市恩城江门产业转移工业园恩平园区三区A10",
  taxNo: "91440785584676855C",
  bankAccount: "2012 0090 0912 4868 277",
  bankName: "中国工商銀行恩平支行",
};

const PRODUCT_NAME_OPTIONS = ["塑料工具箱", "其他"];
const BOX_MATERIAL_OPTIONS = ["PP", "ABS", "其他"];
const LINER_MATERIAL_OPTIONS = ["PU", "EPE", "XPE", "EVA", "其他"];
const LOGO_MATERIAL_OPTIONS = ["PVC", "Epoxy Resin", "PC", "Laser Engraving", "Metal Brushed"];
const VAT_RATE = 1.13;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── 类型 ──────────────────────────────────────────────────────────────────────
interface LineItemInput {
  modelName: string;
  material: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  /** 锁定后 syncData 不会覆盖该行单价 */
  priceLocked?: boolean;
}

interface DomesticExtras {
  hasLiner: boolean;
  linerMaterial: string;
  linerDescription: string;
  linerQuantity: number;
  linerUnitPrice: number;
  linerAmount: number;
  hasLinerTemplate: boolean;
  linerTemplateQuantity: number;
  linerTemplateUnitPrice: number;
  linerTemplateAmount: number;
  hasLogo: boolean;
  logoMaterial: string;
  logoDescription: string;
  logoQuantity: number;
  logoUnitPrice: number;
  logoAmount: number;
  hasSilkPrint: boolean;
  silkPrintDescription: string;
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

function defaultExtras(): DomesticExtras {
  return {
    hasLiner: false, linerMaterial: "", linerDescription: "",
    linerQuantity: 0, linerUnitPrice: 0, linerAmount: 0,
    hasLinerTemplate: false, linerTemplateQuantity: 0, linerTemplateUnitPrice: 0, linerTemplateAmount: 0,
    hasLogo: false, logoMaterial: "", logoDescription: "",
    logoQuantity: 0, logoUnitPrice: 0, logoAmount: 0,
    hasSilkPrint: false, silkPrintDescription: "",
    silkPrintQuantity: 0, silkPrintUnitPrice: 0, silkPrintAmount: 0,
    hasSilkPrintTemplate: false, silkPrintTemplateQuantity: 0, silkPrintTemplateUnitPrice: 0, silkPrintTemplateAmount: 0,
    hasCustomColor: false, customColorQuantity: 0, customColorUnitPrice: 0, customColorAmount: 0,
    shippingFee: 0,
  };
}

interface OrderModel {
  modelName?: string | null;
  modelCode?: string | null;
  material?: string | null;
  quantity?: string | null;
  topCover?: string | null;
  bottomCover?: string | null;
  hasCustomColor?: boolean | null;
}

interface OrderData {
  id: number;
  customer?: string | null;
  orderDate?: string | null;
  deliveryDate?: string | null;
  models?: OrderModel[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  order: OrderData;
  /** 来自 DocumentDialog 的实时数据，用于自动填充单价和附加费用 */
  syncData?: DocSyncData | null;
}

// ─── 子组件：产品明细表格 ────────────────────────────────────────────────────────
function LineItemsTable({
  items,
  onChange,
  syncSource,
}: {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
  syncSource?: "pi" | "ci" | "cn" | null;
}) {
  const sourceLabelMap: Record<string, { text: string; color: string }> = {
    pi: { text: "来自 PI", color: "bg-blue-100 text-blue-700 border-blue-200" },
    ci: { text: "来自 CI", color: "bg-purple-100 text-purple-700 border-purple-200" },
    cn: { text: "来自国内合同", color: "bg-green-100 text-green-700 border-green-200" },
  };
  const sourceLabel = syncSource ? sourceLabelMap[syncSource] : null;
  const [customProductName, setCustomProductName] = useState<Record<number, boolean>>({});
  const [customMaterial, setCustomMaterial] = useState<Record<number, boolean>>({});

  const updateItem = (idx: number, field: keyof LineItemInput, value: string | number | boolean) => {
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
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{ width: '22%' }}>产品名称</th>
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{ width: '14%' }}>型号</th>
              <th className="border-b border-r border-border px-2 py-2 text-left font-medium text-xs tracking-wide text-muted-foreground" style={{ width: '16%' }}>材质</th>
              <th className="border-b border-r border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{ width: '14%' }}>数量</th>
              <th className="border-b border-r border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{ width: '16%' }}>单价(元)</th>
              <th className="border-b border-border px-2 py-2 text-center font-medium text-xs tracking-wide text-muted-foreground" style={{ width: '18%' }}>金额(元)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
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
                <td className="border-b border-r border-border px-1 py-1">
                  <Input
                    value={item.spec}
                    onChange={e => updateItem(idx, "spec", e.target.value)}
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="型号"
                  />
                </td>
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
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-0.5 w-full">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.unitPrice || ""}
                        onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1 text-center flex-1"
                        placeholder="0.00"
                      />
                      <button
                        type="button"
                        title={item.priceLocked ? "单价已锁定，点击解锁" : "锁定单价，防止被自动覆盖"}
                        onClick={() => updateItem(idx, "priceLocked", !item.priceLocked)}
                        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${
                          item.priceLocked
                            ? "text-amber-600 bg-amber-100 hover:bg-amber-200"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {item.priceLocked
                          ? <Lock className="w-3 h-3" />
                          : <LockOpen className="w-3 h-3" />}
                      </button>
                    </div>
                    {item.priceLocked && (
                      <span className="text-[9px] px-1 py-0.5 rounded border font-medium leading-none bg-amber-100 text-amber-700 border-amber-200">
                        已锁定
                      </span>
                    )}
                    {!item.priceLocked && sourceLabel && item.unitPrice > 0 && (
                      <span className={`text-[9px] px-1 py-0.5 rounded border font-medium leading-none ${sourceLabel.color}`}>
                        {sourceLabel.text}
                      </span>
                    )}
                  </div>
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
      <p className="text-xs text-muted-foreground mt-1">× 输入单价后金额自动计算；产品名称选『其他』可手动输入；点击单价列的 <Lock className="w-3 h-3 inline text-amber-600" /> 图标可锁定单价，锁定后不再被自动覆盖</p>
    </div>
  );
}

// ─── 子组件：附加费用行 ──────────────────────────────────────────────────────────
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
  subtotal?: number;
  subtotalLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <p className="text-xs font-semibold text-foreground/80">{label}</p>
      </div>
      <div className="px-3 py-3">
        <div className="flex flex-wrap gap-3 items-end">
          {showMaterial && materialOptions && onMaterialChange && (
            <div className="space-y-1 min-w-[110px]">
              <Label className="text-xs text-muted-foreground">材质</Label>
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
              <Label className="text-xs text-muted-foreground">描述</Label>
              <Input
                value={description || ""}
                onChange={e => onDescriptionChange(e.target.value)}
                placeholder={descriptionPlaceholder || ""}
                className="h-8 text-xs"
              />
            </div>
          )}
          <div className="space-y-1 min-w-[80px]">
            <Label className="text-xs text-muted-foreground">数量（个）</Label>
            <Input
              type="number" min={0}
              value={quantity || ""}
              onChange={e => onQuantityChange(parseFloat(e.target.value) || 0)}
              className="h-8 text-xs"
              placeholder="0"
            />
          </div>
          <div className="space-y-1 min-w-[100px]">
            <Label className="text-xs text-muted-foreground">单价（元）</Label>
            <Input
              type="number" step="0.01" min={0}
              value={unitPrice || ""}
              onChange={e => onUnitPriceChange(parseFloat(e.target.value) || 0)}
              className="h-8 text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1 min-w-[100px]">
            <Label className="text-xs text-muted-foreground">金额（元）</Label>
            <Input
              type="number" readOnly
              value={amount > 0 ? amount.toFixed(2) : ""}
              className="h-8 text-xs bg-muted/40 cursor-not-allowed"
              placeholder="自动计算"
            />
          </div>
        </div>
        {subtotal !== undefined && (
          <div className="mt-2 flex justify-end">
            <span className="text-xs text-muted-foreground">{subtotalLabel ?? "小计"}：</span>
            <span className="text-xs font-bold text-primary ml-1">¥{subtotal.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 子组件：付款条款 ────────────────────────────────────────────────────────────
function PaymentTerms({
  depositPct,
  balancePct,
  totalAmount,
  onDepositChange,
  onBalanceChange,
}: {
  depositPct: number;
  balancePct: number;
  totalAmount: number;
  onDepositChange: (v: number) => void;
  onBalanceChange: (v: number) => void;
}) {
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
              type="number" min={1} max={99}
              value={depositPct}
              onChange={e => {
                const v = parseInt(e.target.value) || 0;
                onDepositChange(v);
                onBalanceChange(100 - v);
              }}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              = ¥{depositAmount.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">尾款比例 (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={99}
              value={balancePct}
              onChange={e => {
                const v = parseInt(e.target.value) || 0;
                onBalanceChange(v);
                onDepositChange(100 - v);
              }}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              = ¥{balanceAmount.toFixed(2)}
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

// // ─── 主组件 ──────────────────────────────────────────────────────────────────────────────────
function PurchaseContractDialog({ open, onClose, order, syncData }: Props) {
  const utils = trpc.useUtils();

  // 从数据库读取最新成本表（staleTime 5min，避免频繁请求）
  const { data: dbCostItems } = trpc.costItems.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  // 构建本地 lookup 函数：优先用数据库数据，回退到静态表
  const lookupCostFn = useCallback((model: string, material: string) => {
    if (dbCostItems && dbCostItems.length > 0) {
      const m = model.trim().toUpperCase();
      const mat = material.trim().toUpperCase();
      const exact = dbCostItems.find(e => e.model.toUpperCase() === m && e.material.toUpperCase() === mat);
      if (exact) return { boxPrice: parseFloat(exact.boxPrice) || 0, puPrice: parseFloat(exact.puPrice) || 0, evaPrice: parseFloat(exact.evaPrice) || 0, linerMoldFee: parseFloat(exact.linerMoldFee) || 0 };
      if (!mat) {
        const fallback = dbCostItems.find(e => e.model.toUpperCase() === m);
        if (fallback) return { boxPrice: parseFloat(fallback.boxPrice) || 0, puPrice: parseFloat(fallback.puPrice) || 0, evaPrice: parseFloat(fallback.evaPrice) || 0, linerMoldFee: parseFloat(fallback.linerMoldFee) || 0 };
      }
      return null;
    }
    return lookupCost(model, material);
  }, [dbCostItems]);

  // 从订单 models 初始化产品明细，并自动匹配成本表单价
  const buildInitialLineItems = useCallback((models: OrderModel[]): LineItemInput[] => {
    return (models ?? []).map(m => {
      const spec = m.modelCode || m.modelName || "";
      const material = m.material || "PP";
      const cost = lookupCostFn(spec, material);
      const unitPrice = cost ? cost.boxPrice : 0;
      const quantity = parseInt(m.quantity ?? "0") || 0;
      return {
        modelName: "塑料工具箱",
        material,
        spec,
        quantity,
        unitPrice,
        amount: round2(unitPrice * quantity),
      };
    });
  }, [lookupCostFn]);

  const [lineItems, setLineItems] = useState<LineItemInput[]>(() =>
    buildInitialLineItems(order.models ?? [])
  );
  const [extras, setExtras] = useState<DomesticExtras>(defaultExtras);
  const [needInvoice, setNeedInvoice] = useState(false);
  const [depositPct, setDepositPct] = useState(30);
  const [balancePct, setBalancePct] = useState(70);
  // 记录联动来源：来自 PI / CI / 国内合同
  const [syncSource, setSyncSource] = useState<"pi" | "ci" | "cn" | null>(null);

  // 当弹窗打开时重置表单（从订单数据重新初始化）
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // 弹窗刚打开：从订单 models 初始化
      setLineItems(buildInitialLineItems(order.models ?? []));
      setExtras(defaultExtras());
      setNeedInvoice(false);
      setDepositPct(30);
      setBalancePct(70);
      setSyncSource(null);
    }
    prevOpenRef.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 当 syncData 变化时，自动用成本表填充单价和附加费用
  useEffect(() => {
    if (!open || !syncData) return;

    // 确定来源：优先用 PI/CI，其次国内合同
    const srcItems = syncData.lineItems;
    const activeTab = syncData.activeTab;
    const srcExtras = (activeTab === "pi" || activeTab === "ci")
      ? syncData.piExtras
      : syncData.extras;
    // 记录来源
    setSyncSource(activeTab === "pi" ? "pi" : activeTab === "ci" ? "ci" : "cn");

    // ─ 1. 更新产品明细单价（按型号+材质匹配成本表，跳过已锁定行）
    if (srcItems.length > 0) {
      setLineItems(prev => {
        // 如果行数不同，就用 srcItems 重建；否则只更新单价和数量
        const newItems = srcItems.map((src, idx) => {
          const spec = src.spec || src.modelName || "";
          const material = src.material || "PP";
          const cost = lookupCostFn(spec, material);
          const quantity = src.quantity || 0;
          // 若该行单价已被锁定，保留原单价，不覆盖
          const prevItem = prev[idx];
          const isLocked = prevItem?.priceLocked === true;
          const unitPrice = isLocked
            ? (prevItem?.unitPrice ?? 0)
            : (cost ? cost.boxPrice : (prevItem?.unitPrice ?? 0));
          return {
            modelName: prevItem?.modelName || "塑料工具箱",
            material,
            spec,
            quantity,
            unitPrice,
            amount: round2(unitPrice * quantity),
            priceLocked: prevItem?.priceLocked,
          };
        });
        return newItems;
      });
    }

    // ─ 2. 更新附加费用（内衬/丝印/颜色）
    setExtras(prev => {
      const updated = { ...prev };

      // 内衬：若来源单据有内衬，自动开启并填充单价
      if (srcExtras.hasLiner) {
        updated.hasLiner = true;
        const linerMat = srcExtras.linerMaterial || "";
        updated.linerMaterial = linerMat;
        updated.linerDescription = srcExtras.linerDescription || "";
        updated.linerQuantity = srcExtras.linerQuantity || 0;

        // 根据每个型号的内衬单价求平均
        const linerUnitPrices: number[] = [];
        srcItems.forEach(src => {
          const spec = src.spec || src.modelName || "";
          const material = src.material || "PP";
          const cost = lookupCostFn(spec, material);
          if (cost) {
            const matUpper = linerMat.toUpperCase();
            if (matUpper === "PU") linerUnitPrices.push(cost.puPrice);
            else if (matUpper === "EVA") linerUnitPrices.push(cost.evaPrice);
          }
        });
        if (linerUnitPrices.length > 0) {
          // 多型号时取平均单价
          const avgPrice = round2(linerUnitPrices.reduce((a, b) => a + b, 0) / linerUnitPrices.length);
          updated.linerUnitPrice = avgPrice;
          updated.linerAmount = round2(avgPrice * (updated.linerQuantity || 0));
        } else {
          // 没有匹配则保留手动填写
          updated.linerUnitPrice = prev.linerUnitPrice;
          updated.linerAmount = round2(prev.linerUnitPrice * (updated.linerQuantity || 0));
        }

        // 内衬开模费
        if (srcExtras.hasLinerTemplate) {
          updated.hasLinerTemplate = true;
          updated.linerTemplateQuantity = srcExtras.linerTemplateQuantity || 1;
          // 开模费单价：取所有匹配型号的 linerMoldFee 平均
          const moldFees: number[] = [];
          srcItems.forEach(src => {
            const spec = src.spec || src.modelName || "";
            const material = src.material || "PP";
            const cost = lookupCostFn(spec, material);
            if (cost && cost.linerMoldFee > 0) moldFees.push(cost.linerMoldFee);
          });
          if (moldFees.length > 0) {
            const avgMold = round2(moldFees.reduce((a, b) => a + b, 0) / moldFees.length);
            updated.linerTemplateUnitPrice = avgMold;
            updated.linerTemplateAmount = round2(avgMold * updated.linerTemplateQuantity);
          }
        }
      }

      // 丝印：若来源单据有丝印，自动开启（不填充单价，高亮提醒手动填写）
      if (srcExtras.hasSilkPrint) {
        updated.hasSilkPrint = true;
      }

      // 定制颜色：若来源单据有定制颜色，自动开启（高亮提醒手动填写）
      if (srcExtras.hasCustomColor) {
        updated.hasCustomColor = true;
      }

      return updated;
    });
  }, [open, syncData, lookupCostFn]); // eslint-disable-line react-hooks/exhaustive-deps

  // 总价计算
  const boxSubtotal = useMemo(
    () => round2(lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)),
    [lineItems]
  );
  const linerTotal = extras.hasLiner ? round2(extras.linerAmount + (extras.hasLinerTemplate ? extras.linerTemplateAmount : 0)) : 0;
  const logoTotal = extras.hasLogo ? extras.logoAmount : 0;
  const silkPrintTotal = extras.hasSilkPrint ? round2(extras.silkPrintAmount + (extras.hasSilkPrintTemplate ? extras.silkPrintTemplateAmount : 0)) : 0;
  const customColorTotal = extras.hasCustomColor ? extras.customColorAmount : 0;
  const shippingTotal = extras.shippingFee || 0;

  const subtotalBeforeTax = useMemo(
    () => round2(boxSubtotal + linerTotal + logoTotal + silkPrintTotal + customColorTotal + shippingTotal),
    [boxSubtotal, linerTotal, logoTotal, silkPrintTotal, customColorTotal, shippingTotal]
  );

  const finalTotalAmount = useMemo(
    () => needInvoice ? round2(subtotalBeforeTax * VAT_RATE) : subtotalBeforeTax,
    [subtotalBeforeTax, needInvoice]
  );

  const isPaymentValid = depositPct + balancePct === 100;

  // 附加费用更新辅助
  const updateExtra = useCallback(
    <K extends keyof DomesticExtras>(key: K, value: DomesticExtras[K]) => {
      setExtras(prev => ({ ...prev, [key]: value }));
    }, []);

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

  // 生成采购合同 mutation
  const generateMutation = trpc.documents.generateContractCn.useMutation({
    onSuccess: (data) => {
      toast.success(`采购合同 ${data.docNo} 已生成`);
      window.open(data.pdfUrl, "_blank");
      utils.documents.listByOrder.invalidate({ orderId: order.id });
      onClose();
    },
    onError: (err) => toast.error(`生成失败：${err.message}`),
  });

  const handleGenerate = () => {
    if (!isPaymentValid) {
      toast.error("定金 + 尾款比例之和必须等于 100%");
      return;
    }
    if (finalTotalAmount <= 0) {
      toast.error("请填写产品单价，总金额不能为零");
      return;
    }
    // 固定：甲方=吟彩（isAmazon=true 模式），乙方=亿丰
    generateMutation.mutate({
      orderId: order.id,
      isAmazon: true,
      counterpartyName: YIFENG_INFO.name,
      counterpartyAddress: YIFENG_INFO.address,
      buyerCnCompany: undefined,
      buyerTaxNo: YIFENG_INFO.taxNo,
      buyerBankAccount: YIFENG_INFO.bankAccount,
      buyerBankName: YIFENG_INFO.bankName,
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
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            生成采购合同
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 甲乙方信息（固定，只读展示） */}
          <div className="grid grid-cols-2 gap-4">
            {/* 甲方：吟彩（采购方） */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <p className="text-xs font-semibold text-primary mb-2">甲方（采购方）——固定</p>
              <p className="text-sm font-semibold text-foreground">{YINCAI_INFO.name}</p>
              <p className="text-xs text-muted-foreground">{YINCAI_INFO.address}</p>
              <p className="text-xs text-muted-foreground">开户行：{YINCAI_INFO.bankName}</p>
              <p className="text-xs text-muted-foreground">账号：{YINCAI_INFO.bankAccount}</p>
            </div>
            {/* 乙方：亿丰（供货方） */}
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-1.5">
              <p className="text-xs font-semibold text-orange-700 mb-2">乙方（供货方）——固定</p>
              <p className="text-sm font-semibold text-foreground">{YIFENG_INFO.name}</p>
              <p className="text-xs text-muted-foreground">{YIFENG_INFO.address}</p>
              <p className="text-xs text-muted-foreground">税号：{YIFENG_INFO.taxNo}</p>
              <p className="text-xs text-muted-foreground">开户行：{YIFENG_INFO.bankName}</p>
              <p className="text-xs text-muted-foreground">账号：{YIFENG_INFO.bankAccount}</p>
            </div>
          </div>

          {/* 是否开票 */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <input
              type="checkbox"
              id="purchaseNeedInvoice"
              checked={needInvoice}
              onChange={e => setNeedInvoice(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <label htmlFor="purchaseNeedInvoice" className="text-sm font-medium text-amber-800 cursor-pointer select-none">
              需要开具增值税发票（含税价 × 1.13）
            </label>
          </div>

          {/* 一、产品明细 */}
          <Separator />
          <p className="text-xs font-semibold text-foreground/70">一、产品明细（请填写单价）</p>
          <LineItemsTable items={lineItems} onChange={setLineItems} syncSource={syncSource} />

          {/* 二、内衬明细 */}
          <Separator />
          <div className="flex items-center gap-3">
            <Switch id="pc-hasLiner" checked={extras.hasLiner} onCheckedChange={v => updateExtra("hasLiner", v)} />
            <label htmlFor="pc-hasLiner" className="text-xs font-semibold text-foreground/70 cursor-pointer">二、内衬明细</label>
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
                <Switch id="pc-hasLinerTemplate" checked={extras.hasLinerTemplate} onCheckedChange={v => updateExtra("hasLinerTemplate", v)} />
                <label htmlFor="pc-hasLinerTemplate" className="text-xs text-muted-foreground cursor-pointer">含内衬开模费</label>
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

          {/* 三、定制 LOGO */}
          <Separator />
          <div className="flex items-center gap-3">
            <Switch id="pc-hasLogo" checked={extras.hasLogo} onCheckedChange={v => updateExtra("hasLogo", v)} />
            <label htmlFor="pc-hasLogo" className="text-xs font-semibold text-foreground/70 cursor-pointer">三、定制 LOGO</label>
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

          {/* 四、定制丝印 */}
          <Separator />
          <div className="flex items-center gap-3">
            <Switch id="pc-hasSilkPrint" checked={extras.hasSilkPrint} onCheckedChange={v => updateExtra("hasSilkPrint", v)} />
            <label htmlFor="pc-hasSilkPrint" className="text-xs font-semibold text-foreground/70 cursor-pointer">四、定制丝印</label>
            <span className="ml-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5 font-medium">
              ⚠️ 请对照国内合同/PI/CI 确认是否有定制丝印
            </span>
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
                <Switch id="pc-hasSilkPrintTemplate" checked={extras.hasSilkPrintTemplate} onCheckedChange={v => updateExtra("hasSilkPrintTemplate", v)} />
                <label htmlFor="pc-hasSilkPrintTemplate" className="text-xs text-muted-foreground cursor-pointer">含丝印开版费</label>
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

          {/* 五、定制颜色费 */}
          <Separator />
          <div className="flex items-center gap-3">
            <Switch id="pc-hasCustomColor" checked={extras.hasCustomColor} onCheckedChange={v => updateExtra("hasCustomColor", v)} />
            <label htmlFor="pc-hasCustomColor" className="text-xs font-semibold text-foreground/70 cursor-pointer">五、定制颜色费</label>
            <span className="ml-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 font-medium">
              ⚠️ 请对照国内合同/PI/CI 确认是否有定制颜色费
            </span>
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

          {/* 六、物流运费 */}
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
            onDepositChange={setDepositPct}
            onBalanceChange={setBalancePct}
          />
        </div>

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
            <Button variant="outline" onClick={onClose} disabled={generateMutation.isPending}>
              取消
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !isPaymentValid}
              className="gap-2"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
              ) : (
                <><Download className="w-4 h-4" />生成采购合同</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PurchaseContractDialog;
