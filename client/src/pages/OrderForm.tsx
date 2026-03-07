import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronUp,
  Package, Tag, Printer, Layers, Archive, AlertCircle
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";

// ─── 类型 ─────────────────────────────────────────────────────────────────────
interface ModelRow {
  modelName:       string;
  modelCode:       string;
  quantity:        string;
  topCover:        string;
  bottomCover:     string;
  accessories:     string;
  needSticker:     boolean;
  stickerSource:   string;
  stickerDesc:     string;
  stickerImages:   string[];   // 图片 URL 列表
  needSilkPrint:   boolean;
  silkPrintDesc:   string;
  silkPrintImages: string[];
  needLiner:       boolean;
  topLiner:        string;
  bottomLiner:     string;
  linerImages:     string[];
  needCarton:      boolean;
  innerBox:        string;
  outerBox:        string;
  modelRemarks:    string;
  _expanded:       boolean;
}

const emptyModel = (): ModelRow => ({
  modelName: "", modelCode: "", quantity: "",
  topCover: "", bottomCover: "", accessories: "",
  needSticker: true, stickerSource: "", stickerDesc: "", stickerImages: [],
  needSilkPrint: true, silkPrintDesc: "", silkPrintImages: [],
  needLiner: true, topLiner: "", bottomLiner: "", linerImages: [],
  needCarton: true, innerBox: "", outerBox: "",
  modelRemarks: "", _expanded: true,
});

// ─── 子组件：型号卡片 ─────────────────────────────────────────────────────────
function ModelCard({
  model, index, total,
  onChange, onDelete,
}: {
  model: ModelRow; index: number; total: number;
  onChange: (field: keyof ModelRow, value: string | boolean | string[]) => void;
  onDelete: () => void;
}) {
  const toggle = (field: keyof ModelRow) => onChange(field, !model[field]);

  const SectionHeader = ({ icon: Icon, title, switchField, color }: {
    icon: React.ElementType; title: string; switchField?: keyof ModelRow; color: string;
  }) => (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-5 h-5 rounded flex items-center justify-center ${color}`}>
        <Icon className="w-3 h-3 text-white" />
      </div>
      <span className="text-sm font-semibold text-gray-700">{title}</span>
      {switchField && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">此型号需要</span>
          <Switch
            checked={model[switchField] as boolean}
            onCheckedChange={v => onChange(switchField, v)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 型号标题栏 */}
      <div
        className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-[#1A3C5E]/5 to-transparent border-b border-gray-100 cursor-pointer"
        onClick={() => onChange("_expanded", !model._expanded)}
      >
        <div className="w-7 h-7 rounded-lg bg-[#1A3C5E] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">
            {model.modelName || `型号 ${index + 1}`}
          </p>
          {!model._expanded && (
            <p className="text-xs text-gray-400 truncate">
              {[model.quantity && `数量：${model.quantity}`, model.topCover && `上盖：${model.topCover}`].filter(Boolean).join("  ·  ") || "点击展开填写"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {total > 1 && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-gray-300 hover:text-red-400"
              onClick={e => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {model._expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </div>

      {model._expanded && (
        <div className="p-5 space-y-5">
          {/* 基本信息 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">型号名称 <span className="text-red-400">*</span></Label>
              <Input placeholder="如：安卡手提箱A款" value={model.modelName} onChange={e => onChange("modelName", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">型号编码</Label>
              <Input placeholder="如：AK-2024-A" value={model.modelCode} onChange={e => onChange("modelCode", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">数量 <span className="text-red-400">*</span></Label>
              <Input placeholder="如：500" value={model.quantity} onChange={e => onChange("quantity", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* 一、箱体描述 */}
          <div className="bg-blue-50/50 rounded-lg p-4">
            <SectionHeader icon={Package} title="一、箱体描述" color="bg-blue-500" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">上盖材质</Label>
                <Input placeholder="如：PP料，黑色" value={model.topCover} onChange={e => onChange("topCover", e.target.value)} className="h-9 text-sm bg-white" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">下盖材质</Label>
                <Input placeholder="如：PP料，黑色" value={model.bottomCover} onChange={e => onChange("bottomCover", e.target.value)} className="h-9 text-sm bg-white" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">配件</Label>
                <Input placeholder="如：304不锈钉铰链" value={model.accessories} onChange={e => onChange("accessories", e.target.value)} className="h-9 text-sm bg-white" />
              </div>
            </div>
          </div>

          {/* 二、贴纸描述 */}
          <div className={`rounded-lg p-4 transition-colors ${model.needSticker ? "bg-green-50/50" : "bg-gray-50"}`}>
            <SectionHeader icon={Tag} title="二、贴纸描述" switchField="needSticker" color="bg-green-500" />
            {model.needSticker ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">贴纸来源</Label>
                    <Select value={model.stickerSource} onValueChange={v => onChange("stickerSource", v)}>
                      <SelectTrigger className="h-9 text-sm bg-white">
                        <SelectValue placeholder="请选择来源" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="客户提供">客户提供</SelectItem>
                        <SelectItem value="外部采购">外部采购</SelectItem>
                        <SelectItem value="工厂自备">工厂自备</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">贴纸描述</Label>
                    <Input placeholder="如：效果图，每个编码各一张" value={model.stickerDesc} onChange={e => onChange("stickerDesc", e.target.value)} className="h-9 text-sm bg-white" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">贴纸图片（可上传效果图）</Label>
                  <ImageUploader
                    label="贴纸"
                    category="sticker"
                    images={model.stickerImages}
                    onChange={urls => onChange("stickerImages", urls)}
                    maxCount={5}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">此型号不需要贴纸</p>
            )}
          </div>

          {/* 三、丝印描述 */}
          <div className={`rounded-lg p-4 transition-colors ${model.needSilkPrint ? "bg-indigo-50/50" : "bg-gray-50"}`}>
            <SectionHeader icon={Printer} title="三、丝印描述" switchField="needSilkPrint" color="bg-indigo-500" />
            {model.needSilkPrint ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="请详细描述丝印内容、位置、颜色等..."
                  value={model.silkPrintDesc}
                  onChange={e => onChange("silkPrintDesc", e.target.value)}
                  rows={2}
                  className="text-sm bg-white resize-none"
                />
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">丝印图片（可上传设计稿）</Label>
                  <ImageUploader
                    label="丝印"
                    category="silkprint"
                    images={model.silkPrintImages}
                    onChange={urls => onChange("silkPrintImages", urls)}
                    maxCount={5}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">此型号不需要丝印</p>
            )}
          </div>

          {/* 四、内衬描述 */}
          <div className={`rounded-lg p-4 transition-colors ${model.needLiner ? "bg-purple-50/50" : "bg-gray-50"}`}>
            <SectionHeader icon={Layers} title="四、内衬描述" switchField="needLiner" color="bg-purple-500" />
            {model.needLiner ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">上盖内衬</Label>
                    <Textarea placeholder="材质、颜色、厚度等" value={model.topLiner} onChange={e => onChange("topLiner", e.target.value)} rows={2} className="text-sm bg-white resize-none" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">下盖内衬</Label>
                    <Textarea placeholder="材质、颜色、厚度等" value={model.bottomLiner} onChange={e => onChange("bottomLiner", e.target.value)} rows={2} className="text-sm bg-white resize-none" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">内衬图片（可上传 CAD 图纸）</Label>
                  <ImageUploader
                    label="内衬CAD"
                    category="liner"
                    images={model.linerImages}
                    onChange={urls => onChange("linerImages", urls)}
                    maxCount={5}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">此型号不需要内衬</p>
            )}
          </div>

          {/* 五、纸箱描述 */}
          <div className={`rounded-lg p-4 transition-colors ${model.needCarton ? "bg-amber-50/50" : "bg-gray-50"}`}>
            <SectionHeader icon={Archive} title="五、纸箱描述" switchField="needCarton" color="bg-amber-500" />
            {model.needCarton ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">内箱规格</Label>
                  <Input placeholder="如：30×20×15cm，白色" value={model.innerBox} onChange={e => onChange("innerBox", e.target.value)} className="h-9 text-sm bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">外箱规格</Label>
                  <Input placeholder="如：60×40×30cm，五层瓦楞" value={model.outerBox} onChange={e => onChange("outerBox", e.target.value)} className="h-9 text-sm bg-white" />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">此型号不需要纸箱</p>
            )}
          </div>

          {/* 型号备注 */}
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">型号备注</Label>
            <Input placeholder="此型号的特殊说明..." value={model.modelRemarks} onChange={e => onChange("modelRemarks", e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────
export default function OrderForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const orderId = params.id ? parseInt(params.id) : undefined;

  // 从数据库读取客户列表（60秒内不重新拉取，与 Customers 页面共享缓存）
  const { data: customerList = [] } = trpc.customers.list.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  // 订单头部
  const [header, setHeader] = useState({
    orderNo: "", orderDescription: "", customer: "",
    isNewCustomer: false,
    maker: "", salesperson: "", orderDate: new Date().toISOString().slice(0, 10),
    deliveryDate: "", remarks: "", status: "draft" as const,
    recipientName: "", recipientPhone: "", recipientAddress: "", factoryShipNo: "",
  });

  // 型号列表
  const [models, setModels] = useState<ModelRow[]>([emptyModel()]);

  // 加载已有订单
  const { data: existingOrder } = trpc.orders.get.useQuery(
    { id: orderId! },
    { enabled: isEdit && !!orderId }
  );

  useEffect(() => {
    if (!existingOrder) return;
    setHeader({
      orderNo: existingOrder.orderNo ?? "",
      orderDescription: existingOrder.orderDescription ?? "",
      customer: existingOrder.customer ?? "",
      isNewCustomer: existingOrder.isNewCustomer ?? false,
      maker: existingOrder.maker ?? "",
      salesperson: existingOrder.salesperson ?? "",
      orderDate: existingOrder.orderDate ?? "",
      deliveryDate: existingOrder.deliveryDate ?? "",
      remarks: existingOrder.remarks ?? "",
      status: existingOrder.status as any,
      recipientName: existingOrder.recipientName ?? "",
      recipientPhone: existingOrder.recipientPhone ?? "",
      recipientAddress: existingOrder.recipientAddress ?? "",
      factoryShipNo: existingOrder.factoryShipNo ?? "",
    });
    if (existingOrder.models?.length) {
      setModels(existingOrder.models.map((m: any) => ({
        modelName:       m.modelName ?? "",
        modelCode:       m.modelCode ?? "",
        quantity:        m.quantity ?? "",
        topCover:        m.topCover ?? "",
        bottomCover:     m.bottomCover ?? "",
        accessories:     m.accessories ?? "",
        needSticker:     m.needSticker ?? true,
        stickerSource:   m.stickerSource ?? "",
        stickerDesc:     m.stickerDesc ?? "",
        stickerImages:   m.stickerImages ? JSON.parse(m.stickerImages) : [],
        needSilkPrint:   m.needSilkPrint ?? true,
        silkPrintDesc:   m.silkPrintDesc ?? "",
        silkPrintImages: m.silkPrintImages ? JSON.parse(m.silkPrintImages) : [],
        needLiner:       m.needLiner ?? true,
        topLiner:        m.topLiner ?? "",
        bottomLiner:     m.bottomLiner ?? "",
        linerImages:     m.linerImages ? JSON.parse(m.linerImages) : [],
        needCarton:      m.needCarton ?? true,
        innerBox:        m.innerBox ?? "",
        outerBox:        m.outerBox ?? "",
        modelRemarks:    m.modelRemarks ?? "",
        _expanded:       false,
      })));
    }
  }, [existingOrder]);

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: () => { toast.success("订单已创建！"); navigate("/"); },
    onError: () => toast.error("创建失败，请重试"),
  });
  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => { toast.success("订单已保存！"); navigate("/"); },
    onError: () => toast.error("保存失败，请重试"),
  });

  const handleSave = (status: "draft" | "submitted") => {
    if (!header.customer) {
      toast.warning("请选择客户名称");
      return;
    }
    // 序列化图片数组为 JSON 字符串存储
    const modelsPayload = models.map(({ _expanded, stickerImages, silkPrintImages, linerImages, ...m }) => ({
      ...m,
      stickerImages:   JSON.stringify(stickerImages),
      silkPrintImages: JSON.stringify(silkPrintImages),
      linerImages:     JSON.stringify(linerImages),
    }));
    if (isEdit && orderId) {
      updateMutation.mutate({ id: orderId, order: { ...header, status }, models: modelsPayload });
    } else {
      createMutation.mutate({ order: { ...header, status }, models: modelsPayload });
    }
  };

  const updateModel = (index: number, field: keyof ModelRow, value: string | boolean | string[]) => {
    setModels(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const addModel = () => {
    setModels(prev => [...prev, emptyModel()]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 100);
  };

  const deleteModel = (index: number) => {
    setModels(prev => prev.filter((_, i) => i !== index));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // 判断客户是否在数据库列表中
  const customerNames = customerList.map((c: any) => c.name);
  const isPresetCustomer = customerNames.includes(header.customer);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-bold text-gray-900 text-base" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {isEdit ? "编辑订单" : "新建订单"}
              </h1>
              <p className="text-xs text-gray-400">{models.length} 个型号</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleSave("draft")} disabled={isSaving} className="gap-2">
              <Save className="w-4 h-4" />
              保存草稿
            </Button>
            <Button onClick={() => handleSave("submitted")} disabled={isSaving} className="bg-[#1A3C5E] hover:bg-[#15304d] gap-2">
              提交订单
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* 订单基本信息 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#1A3C5E] rounded-full inline-block" />
            订单基本信息
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">订单描述</Label>
              <Input placeholder="订单描述" value={header.orderDescription} onChange={e => setHeader(h => ({ ...h, orderDescription: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">
                客户名称 <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-3">
                <Select
                  value={header.customer}
                  onValueChange={v => setHeader(h => ({ ...h, customer: v }))}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue placeholder="请选择客户（必填）" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerNames.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                        暂无预设客户，请先到《客户管理》中添加
                      </div>
                    ) : (
                      customerList.map((c: any) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {/* 新老客户选项 */}
                <div className="flex gap-2 flex-shrink-0">
                  {[
                    { value: false, label: "老客户" },
                    { value: true,  label: "新客户" },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setHeader(h => ({ ...h, isNewCustomer: opt.value }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150
                        ${header.isNewCustomer === opt.value
                          ? opt.value
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">订单号</Label>
              <Input placeholder="如：ODYC-20260307-001" value={header.orderNo} onChange={e => setHeader(h => ({ ...h, orderNo: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">预计交货日期</Label>
              <Input type="date" value={header.deliveryDate} onChange={e => setHeader(h => ({ ...h, deliveryDate: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">制单员</Label>
              <Input placeholder="姓名" value={header.maker} onChange={e => setHeader(h => ({ ...h, maker: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">销售员</Label>
              <Input placeholder="姓名" value={header.salesperson} onChange={e => setHeader(h => ({ ...h, salesperson: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">备注</Label>
              <Textarea placeholder="订单整体备注..." value={header.remarks} onChange={e => setHeader(h => ({ ...h, remarks: e.target.value }))} rows={2} className="text-sm resize-none" />
            </div>
          </div>
        </div>

        {/* 收件人信息 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#1A3C5E] rounded-full inline-block" />
            收件人信息
            <span className="text-xs text-gray-400 font-normal">（可选）</span>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">收件人姓名</Label>
              <Input placeholder="姓名" value={header.recipientName} onChange={e => setHeader(h => ({ ...h, recipientName: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">收件人电话</Label>
              <Input placeholder="手机号码" value={header.recipientPhone} onChange={e => setHeader(h => ({ ...h, recipientPhone: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">收件地址</Label>
              <Input placeholder="详细收件地址" value={header.recipientAddress} onChange={e => setHeader(h => ({ ...h, recipientAddress: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">工厂发货单号</Label>
              <Input placeholder="工厂发货单号" value={header.factoryShipNo} onChange={e => setHeader(h => ({ ...h, factoryShipNo: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* 型号列表 */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <span className="w-1 h-5 bg-[#1A3C5E] rounded-full inline-block" />
            型号明细
            <Badge variant="outline" className="text-xs ml-1">{models.length} 个</Badge>
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setModels(prev => prev.map(m => ({ ...m, _expanded: false })))}>
              全部收起
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setModels(prev => prev.map(m => ({ ...m, _expanded: true })))}>
              全部展开
            </Button>
          </div>
        </div>

        {models.map((model, index) => (
          <ModelCard
            key={index}
            model={model}
            index={index}
            total={models.length}
            onChange={(field, value) => updateModel(index, field, value)}
            onDelete={() => deleteModel(index)}
          />
        ))}

        {/* 添加型号按钮 */}
        <button
          onClick={addModel}
          className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-[#1A3C5E]/40 hover:text-[#1A3C5E] transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          添加型号
        </button>

        {/* 底部提示 */}
        <div className="flex items-start gap-2 text-xs text-gray-400 pb-8">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>每个型号可独立控制是否需要贴纸、丝印、内衬、纸箱，并可上传对应图片（CAD图纸/效果图/设计稿）。关闭对应开关后该模块将不显示在打印版本中。</span>
        </div>
      </main>
    </div>
  );
}
