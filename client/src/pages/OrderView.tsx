import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Printer, FileDown, ImageOff } from "lucide-react";
import { useLocation, useParams } from "wouter";

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

function InfoRow({ label, value, span }: { label: string; value?: string | null; span?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${span ? "col-span-2" : ""}`}>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-sm text-gray-800">{value || "—"}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 rounded-full bg-[#1A3C5E]" />
      <h3 className="font-semibold text-gray-700 text-sm">{children}</h3>
    </div>
  );
}

function ImageGallery({ images, label }: { images: string[]; label: string }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-xs text-gray-400 mb-1.5">{label}附件图片</p>
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

  const { data: order, isLoading } = trpc.orders.get.useQuery(
    { id: orderId },
    { staleTime: 30_000 }  // 30秒内不重新拉取，与 PrintPreview 共享缓存
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
              const linerImages = (() => { try { return JSON.parse(m.linerImages || "[]"); } catch { return []; } })();

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

                  <div className="p-5 space-y-5">
                    {/* 箱体描述 */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">箱体描述</p>
                      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                        <InfoRow label="上盖材质" value={m.topCover} />
                        <InfoRow label="下盖材质" value={m.bottomCover} />
                        <InfoRow label="配件" value={m.accessories} />
                      </div>
                    </div>

                    {/* 贴纸描述 */}
                    {m.needSticker && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">贴纸描述</p>
                        <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                          <InfoRow label="贴纸来源" value={m.stickerSource} />
                          <InfoRow label="贴纸描述" value={m.stickerDesc} span />
                        </div>
                        <ImageGallery images={stickerImages} label="贴纸" />
                      </div>
                    )}

                    {/* 丝印描述 */}
                    {m.needSilkPrint && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">丝印描述</p>
                        <InfoRow label="丝印描述" value={m.silkPrintDesc} />
                        <ImageGallery images={silkPrintImages} label="丝印" />
                      </div>
                    )}

                    {/* 内衬描述 */}
                    {m.needLiner && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">内衬描述</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                          <InfoRow label="上盖内衬" value={m.topLiner} />
                          <InfoRow label="下盖内衬" value={m.bottomLiner} />
                        </div>
                        <ImageGallery images={linerImages} label="内衬" />
                      </div>
                    )}

                    {/* 纸箱描述 */}
                    {m.needCarton && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">纸箱描述</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                          <InfoRow label="内箱规格" value={m.innerBox} />
                          <InfoRow label="外箱规格" value={m.outerBox} />
                        </div>
                      </div>
                    )}

                    {m.modelRemarks && (
                      <InfoRow label="型号备注" value={m.modelRemarks} />
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
      </div>
    </div>
  );
}
