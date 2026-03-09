import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Printer, FileDown, ImageOff, Box, Tag, Layers, Archive, Paintbrush, FileText, ShoppingCart, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocation, useParams } from "wouter";
import DocumentDialog from "@/components/DocumentDialog";
import PurchaseContractDialog from "@/components/PurchaseContractDialog";
import DocumentHistory from "@/components/DocumentHistory";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:         { label: "草稿",   color: "bg-gray-100 text-gray-600 border-gray-200" },
  submitted:     { label: "已提交", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  in_production: { label: "生产中", color: "bg-orange-50 text-orange-700 border-orange-200" },
  completed:     { label: "已完成", color: "bg-green-50 text-green-700 border-green-200" },
  cancelled:     { label: "已取消", color: "bg-red-50 text-red-600 border-red-200" },
};

function downloadOrderExcel(orderId: number) {
  const a = document.createElement("a");
  a.href = `/api/export/order/${orderId}`;
  a.download = `吟彩订单_${orderId}.xlsx`;
  a.click();
}

/** 基本信息字段：标签 + 值 */
function InfoRow({ label, value, span }: { label: string; value?: string | null; span?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${span ? "col-span-2" : ""}`}>
      <span className="text-xs text-gray-400 font-medium tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 leading-relaxed">{value || "—"}</span>
    </div>
  );
}

/** 型号内各描述区块的大标题（带图标 + 色条 + 分割线） */
function BlockTitle({ icon: Icon, children, color = "bg-[#1A3C5E]" }: {
  icon: React.ElementType;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-1 h-5 rounded-full ${color} flex-shrink-0`} />
      <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <h4 className="text-sm font-bold text-gray-700 tracking-wide">{children}</h4>
    </div>
  );
}

/** 描述区块内的字段：标签小、值大，带底部分割线 */
function DescField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

/** 描述区块内的字段网格（横排多列） */
function DescGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y divide-gray-50 md:divide-y-0">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full bg-[#1A3C5E]" />
      <h3 className="font-semibold text-gray-700 text-sm">{children}</h3>
    </div>
  );
}

function ImageGallery({ images, label }: { images: string[]; label: string }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}附件图片</p>
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url}
              alt={`${label}图片${i + 1}`}
              className="w-24 h-20 object-contain border border-gray-200 rounded-lg bg-gray-50 hover:border-[#1A3C5E] transition-colors cursor-pointer"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function OrderView() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const updatePurchaseStatusMutation = trpc.orders.updatePurchaseContractStatus.useMutation({
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "signed" ? "已标记为已签采购合同" : "已标记为未签采购合同");
      utils.orders.get.invalidate({ id: orderId });
    },
    onError: () => toast.error("状态更新失败"),
  });

  const { data: order, isLoading } = trpc.orders.get.useQuery(
    { id: orderId },
    { staleTime: 0 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <ImageOff className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">订单不存在或已被删除</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("/")}>
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  const models = order.models ?? [];
  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;

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
              <h1 className="font-bold text-gray-900 text-base leading-tight" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {order.orderDescription || "订单详情"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {order.orderNo && <span className="text-xs text-gray-400">订单号：{order.orderNo}</span>}
                <Badge className={`text-xs border ${statusCfg.color}`} variant="outline">
                  {statusCfg.label}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-sm" onClick={() => downloadOrderExcel(orderId)}>
              <FileDown className="w-3.5 h-3.5" />
              导出 Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-sm" onClick={() => navigate(`/order/${orderId}/print`)}>
              <Printer className="w-3.5 h-3.5" />
              打印预览
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setDocDialogOpen(true)}
            >
              <FileText className="w-3.5 h-3.5" />
              生成单据
            </Button>
            <Button size="sm" className="bg-[#1A3C5E] hover:bg-[#15304d] gap-1.5 text-sm" onClick={() => navigate(`/order/${orderId}/edit`)}>
              <Pencil className="w-3.5 h-3.5" />
              编辑订单
            </Button>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

        {/* 基本信息 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <SectionTitle>基本信息</SectionTitle>
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            <InfoRow label="订单描述" value={order.orderDescription} />
            <InfoRow label="客户名称" value={order.customer} />
            <InfoRow label="订单号" value={order.orderNo} />
            <InfoRow label="下单日期" value={order.orderDate} />
            <InfoRow label="预计交货" value={order.deliveryDate} />
            <InfoRow label="制单员" value={order.maker} />
            <InfoRow label="销售员" value={order.salesperson} />
            {/* 客户类型 + 报关状态 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-medium tracking-wide">客户类型</span>
              {(order as any).customerType === "overseas" ? (
                <span className="text-sm font-semibold text-[#1A3C5E]">「国外客户」</span>
              ) : (
                <span className="text-sm text-gray-600">「国内客户」</span>
              )}
            </div>
            {(order as any).customerType === "overseas" && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400 font-medium tracking-wide">报关状态</span>
                {(order as any).customsDeclared === null ? (
                  <span className="text-sm text-gray-400 italic">未标注</span>
                ) : (order as any).customsDeclared ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md w-fit">
                    ☑ 需要报关
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md w-fit">
                    ☐ 无需报关
                  </span>
                )}
              </div>
            )}
            {/* 订单渠道 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-medium tracking-wide">订单渠道</span>
              {((order as any).isAlibaba || (order as any).is1688 || (order as any).isAmazon) ? (
                <div className="flex flex-col gap-1.5">
                  {(order as any).isAlibaba && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#FF6A00] px-2 py-1 rounded-md">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                        </svg>
                        阿里巴巴订单
                      </span>
                      {(order as any).alibabaOrderNo && (
                        <span className="text-sm text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {(order as any).alibabaOrderNo}
                        </span>
                      )}
                    </div>
                  )}
                  {(order as any).is1688 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#7C3AED] px-2 py-1 rounded-md">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                        </svg>
                        1688订单
                      </span>
                      {(order as any).alibaba1688OrderNo && (
                        <span className="text-sm text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {(order as any).alibaba1688OrderNo}
                        </span>
                      )}
                    </div>
                  )}
                  {(order as any).isAmazon && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#1D6FA4] px-2 py-1 rounded-md">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                        </svg>
                        亚马逊订单
                      </span>
                      {(order as any).amazonOrderNo && (
                        <span className="text-sm text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {(order as any).amazonOrderNo}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-sm text-gray-600">普通订单</span>
              )}
            </div>
            {order.remarks && <InfoRow label="备注" value={order.remarks} span />}
          </div>
        </div>

        {/* 收件人信息（如有） */}
        {(order.recipientName || order.recipientPhone || order.recipientAddress || order.factoryShipNo) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <SectionTitle>收件人信息</SectionTitle>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <InfoRow label="收件人姓名" value={order.recipientName} />
              <InfoRow label="收件人电话" value={order.recipientPhone} />
              <InfoRow label="工厂发货单号" value={order.factoryShipNo} />
              {order.recipientAddress && <InfoRow label="收件地址" value={order.recipientAddress} span />}
            </div>
          </div>
        )}

        {/* 型号明细 */}
        {models.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
              型号明细 · 共 {models.length} 个型号
            </h2>
            {models.map((m: any, i: number) => {
              const stickerImages = (() => { try { return JSON.parse(m.stickerImages || "[]"); } catch { return []; } })();
              const silkPrintImages = (() => { try { return JSON.parse(m.silkPrintImages || "[]"); } catch { return []; } })();
              const topLinerImages = (() => { try { return JSON.parse(m.topLinerImages || "[]"); } catch { return []; } })();
              const bottomLinerImages = (() => { try { return JSON.parse(m.bottomLinerImages || "[]"); } catch { return []; } })();
              const innerBoxImages = (() => { try { return JSON.parse(m.innerBoxImages || "[]"); } catch { return []; } })();
              const outerBoxImages = (() => { try { return JSON.parse(m.outerBoxImages || "[]"); } catch { return []; } })();

              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* 型号标题 */}
                  <div className="bg-[#1A3C5E] px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{m.modelName || `型号 ${i + 1}`}</span>
                      {m.modelCode && <span className="text-white/60 text-xs">({m.modelCode})</span>}
                    </div>
                    <span className="text-white/80 text-sm">数量：{m.quantity || "—"}</span>
                  </div>

                  <div className="p-5 space-y-0 divide-y divide-gray-100">

                    {/* 箱体描述 */}
                    <div className="pb-5">
                      <BlockTitle icon={Box} color="bg-blue-500">箱体描述</BlockTitle>
                      <DescGrid>
                        <DescField label="上盖材质" value={m.topCover} />
                        <DescField label="下盖材质" value={m.bottomCover} />
                        <DescField label="配件" value={m.accessories} />
                      </DescGrid>
                      {!m.topCover && !m.bottomCover && !m.accessories && (
                        <p className="text-sm text-gray-400 italic">暂无箱体描述</p>
                      )}
                    </div>

                    {/* 贴纸描述 */}
                    {m.needSticker && (
                      <div className="py-5">
                        <BlockTitle icon={Tag} color="bg-amber-500">贴纸描述</BlockTitle>
                        <DescGrid>
                          <DescField label="贴纸来源" value={m.stickerSource} />
                          <DescField label="贴纸描述" value={m.stickerDesc} />
                        </DescGrid>
                        <ImageGallery images={stickerImages} label="贴纸" />
                      </div>
                    )}

                    {/* 丝印描述 */}
                    {m.needSilkPrint && (
                      <div className="py-5">
                        <BlockTitle icon={Paintbrush} color="bg-purple-500">丝印描述</BlockTitle>
                        <DescField label="丝印描述" value={m.silkPrintDesc} />
                        <ImageGallery images={silkPrintImages} label="丝印" />
                      </div>
                    )}

                    {/* 内衬描述 */}
                    {m.needLiner && (
                      <div className="py-5">
                        <BlockTitle icon={Layers} color="bg-teal-500">内衬描述</BlockTitle>
                        <DescGrid>
                          <DescField label="上盖内衬" value={m.topLiner} />
                          <DescField label="下盖内衬" value={m.bottomLiner} />
                        </DescGrid>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            {topLinerImages.length > 0 && (
                              <>
                                <p className="text-xs font-medium text-gray-500 mb-1">上盖内衬图片</p>
                                <ImageGallery images={topLinerImages} label="上盖内衬" />
                              </>
                            )}
                          </div>
                          <div>
                            {bottomLinerImages.length > 0 && (
                              <>
                                <p className="text-xs font-medium text-gray-500 mb-1">下盖内衬图片</p>
                                <ImageGallery images={bottomLinerImages} label="下盖内衬" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 纸箱描述 */}
                    {m.needCarton && (
                      <div className="py-5">
                        <BlockTitle icon={Archive} color="bg-orange-500">纸箱描述</BlockTitle>
                        <DescGrid>
                          <DescField label="内箱规格" value={m.innerBox} />
                          <DescField label="外箱规格" value={m.outerBox} />
                        </DescGrid>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            {innerBoxImages.length > 0 && (
                              <>
                                <p className="text-xs font-medium text-gray-500 mb-1">内箱图片</p>
                                <ImageGallery images={innerBoxImages} label="内箱" />
                              </>
                            )}
                          </div>
                          <div>
                            {outerBoxImages.length > 0 && (
                              <>
                                <p className="text-xs font-medium text-gray-500 mb-1">外箱图片</p>
                                <ImageGallery images={outerBoxImages} label="外箱" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 型号备注 */}
                    {m.modelRemarks && (
                      <div className="pt-4">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">型号备注</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{m.modelRemarks}</p>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 空型号提示 */}
        {models.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-gray-400 text-sm">此订单暂无型号明细</p>
          </div>
        )}

        {/* 采购合同专区 */}
        <div className={`rounded-xl border-2 shadow-sm p-5 ${
          order.purchaseContractStatus === "signed"
            ? "bg-green-50 border-green-200"
            : "bg-red-50 border-red-200"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                order.purchaseContractStatus === "signed" ? "bg-green-100" : "bg-red-100"
              }`}>
                {order.purchaseContractStatus === "signed"
                  ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                  : <AlertCircle className="w-5 h-5 text-red-500" />
                }
              </div>
              <div>
                <p className={`font-semibold text-sm ${
                  order.purchaseContractStatus === "signed" ? "text-green-800" : "text-red-700"
                }`}>
                  {order.purchaseContractStatus === "signed" ? "已向亿丰下采购合同" : "未向亿丰下采购合同"}
                </p>
                <p className={`text-xs mt-0.5 ${
                  order.purchaseContractStatus === "signed" ? "text-green-600" : "text-red-500"
                }`}>
                  供货商：恩平市亿丰塑料模具有限公司
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-[#1A3C5E] hover:bg-[#1A3C5E]/90 text-white"
                onClick={() => setPurchaseDialogOpen(true)}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                生成采购合同
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={`gap-1.5 text-xs ${
                  order.purchaseContractStatus === "signed"
                    ? "border-red-300 text-red-600 hover:bg-red-50"
                    : "border-green-300 text-green-700 hover:bg-green-50"
                }`}
                onClick={() => updatePurchaseStatusMutation.mutate({
                  id: orderId,
                  status: order.purchaseContractStatus === "signed" ? "unsigned" : "signed",
                })}
                disabled={updatePurchaseStatusMutation.isPending}
              >
                {order.purchaseContractStatus === "signed" ? "标记为未签" : "标记为已签"}
              </Button>
            </div>
          </div>
        </div>

        {/* 历史单据 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-[#1A3C5E]" />
              <h3 className="font-semibold text-gray-700 text-sm">历史单据</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setDocDialogOpen(true)}
            >
              <FileText className="w-3.5 h-3.5" />
              生成单据
            </Button>
          </div>
          <DocumentHistory orderId={orderId} />
        </div>
      </div>

      {/* 生成单据弹窗 */}
      {order && (
        <DocumentDialog
          open={docDialogOpen}
          onClose={() => setDocDialogOpen(false)}
          order={{
            id: order.id,
            customer: order.customer,
            orderDate: order.orderDate,
            deliveryDate: order.deliveryDate,
            customerType: (order as any).customerType,
            isAmazon: (order as any).isAmazon,
            models: (order.models ?? []).map((m: any) => ({
              modelName: m.modelName,
              modelCode: m.modelCode,
              quantity: m.quantity,
              topCover: m.topCover,
              bottomCover: m.bottomCover,
            })),
          }}
        />
      )}

      {/* 采购合同弹窗（吟彩→亿丰，独立组件） */}
      {order && (
        <PurchaseContractDialog
          open={purchaseDialogOpen}
          onClose={() => setPurchaseDialogOpen(false)}
          order={{
            id: order.id,
            customer: order.customer,
            orderDate: order.orderDate,
            deliveryDate: order.deliveryDate,
            models: (order.models ?? []).map((m: any) => {
              // 从 topCover/bottomCover 文本中提取材质（PP/ABS）
              const coverText = ((m.topCover || '') + ' ' + (m.bottomCover || '')).toUpperCase();
              const material = coverText.includes('ABS') ? 'ABS' : 'PP';
              return {
                modelName: m.modelName,
                modelCode: m.modelCode,
                material,
                quantity: m.quantity,
                topCover: m.topCover,
                bottomCover: m.bottomCover,
              };
            }),
          }}
        />
      )}
    </div>
  );
}
