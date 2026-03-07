/**
 * DocumentDialog.tsx
 * 生成单据弹窗：国内采购合同（中文）/ PI / CI（英文）
 * 从订单数据自动填充，用户补充单价、付款比例等字段后一键生成 PDF
 * CI Tab 支持「从PI创建」：选择已有PI单据自动填充数据
 */

import { useState, useEffect } from "react";
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
import { Loader2, FileText, Download, AlertCircle, Copy } from "lucide-react";

// ─── 类型 ──────────────────────────────────────────────────────────────────────

interface LineItemInput {
  modelName: string;
  material: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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

function buildInitialLineItems(models: OrderModel[]): LineItemInput[] {
  return (models ?? []).map(m => ({
    modelName: m.modelName ?? "",
    material: [m.topCover, m.bottomCover].filter(Boolean).join(" / ") || "",
    spec: m.modelCode ?? "",
    quantity: parseInt(m.quantity ?? "0") || 0,
    unitPrice: 0,
    amount: 0,
  }));
}

// ─── 子组件：行项目表格 ────────────────────────────────────────────────────────

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
        updated.amount = parseFloat(String(updated.unitPrice || 0)) * parseFloat(String(updated.quantity || 0));
        updated.amount = Math.round(updated.amount * 100) / 100;
      }
      return updated;
    });
    onChange(newItems);
  };

  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);

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
              <th className="border border-border px-2 py-1.5 text-center font-medium w-28">
                单价 ({currencySymbol})
              </th>
              <th className="border border-border px-2 py-1.5 text-center font-medium w-28">
                金额 ({currencySymbol})
              </th>
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
  const depositAmount = (totalAmount * depositPct / 100).toFixed(2);
  const balanceAmount = (totalAmount * balancePct / 100).toFixed(2);
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
              = {currencySymbol}{depositAmount}
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
              = {currencySymbol}{balanceAmount}
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
    }
  }, [open, order]);

  // 切换到 CI Tab 时重置 PI 选择
  useEffect(() => {
    if (activeTab !== "ci") {
      setSelectedPiId("");
    }
  }, [activeTab]);

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const isPaymentValid = depositPct + balancePct === 100;

  // 从选中的 PI 单据填充 CI 数据
  const handleLoadFromPi = (piId: string) => {
    setSelectedPiId(piId);
    if (!piId || !activePiList) return;
    const pi = activePiList.find(p => String(p.id) === piId);
    if (!pi) return;

    // 填充买方信息
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

    // 填充行项目
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

  // Mutations
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
    if (totalAmount <= 0) {
      toast.error("请填写产品单价");
      return;
    }

    if (activeTab === "contract_cn") {
      if (!counterpartyName.trim()) {
        toast.error("请填写供货单位（乙方）名称");
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
        totalAmount,
        depositPct,
        balancePct,
        orderDate: order.orderDate ?? undefined,
        deliveryDate: order.deliveryDate ?? undefined,
      });
    } else {
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
        totalAmount,
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-5xl max-h-[92vh] overflow-y-auto">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">供货单位（乙方）<span className="text-destructive ml-1">*</span></Label>
                <Input
                  value={counterpartyName}
                  onChange={e => setCounterpartyName(e.target.value)}
                  placeholder="请输入供货单位全称"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">供货地点（交货地址）</Label>
                <Input
                  value={counterpartyAddress}
                  onChange={e => setCounterpartyAddress(e.target.value)}
                  placeholder="可选，如：广东省深圳市..."
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Separator />
            <p className="text-xs font-semibold text-foreground/70">产品明细（请填写单价）</p>
            <LineItemsTable
              items={lineItems}
              currency="CNY"
              onChange={setLineItems}
            />

            <Separator />
            <p className="text-xs font-semibold text-foreground/70">付款条款</p>
            <PaymentTerms
              depositPct={depositPct}
              balancePct={balancePct}
              totalAmount={totalAmount}
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
              totalAmount={totalAmount}
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
              totalAmount={totalAmount}
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
            disabled={isLoading || !isPaymentValid || totalAmount <= 0}
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
