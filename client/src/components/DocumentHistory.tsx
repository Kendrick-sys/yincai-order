/**
 * DocumentHistory.tsx
 * 订单详情页中展示历史生成的单据列表（合同/PI/CI）
 * 功能：预览、下载、作废、重新生成（版本号+1）、PI→CI关联展示、ZIP批量导出、已发送标记
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, ExternalLink, Clock, Ban, RefreshCw, Download, ArrowRight, Send, SendHorizonal, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  orderId: number;
}

const DOC_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  contract_cn: { label: "国内采购合同", color: "bg-blue-100 text-blue-700 border-blue-200" },
  pi: { label: "PI（形式发票）", color: "bg-green-100 text-green-700 border-green-200" },
  ci: { label: "CI（商业发票）", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

export default function DocumentHistory({ orderId }: Props) {
  const utils = trpc.useUtils();
  const { data: docs, isLoading } = trpc.documents.listByOrder.useQuery({ orderId });
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  // PDF 预览弹窗状态
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  const voidMutation = trpc.documents.void.useMutation({
    onSuccess: () => {
      toast.success("单据已作废");
      utils.documents.listByOrder.invalidate({ orderId });
    },
    onError: (err) => {
      toast.error(`作废失败：${err.message}`);
    },
  });

  const regenerateMutation = trpc.documents.regenerate.useMutation({
    onSuccess: (data) => {
      toast.success(`已重新生成 v${data.version}，PDF 已更新`);
      utils.documents.listByOrder.invalidate({ orderId });
      setRegeneratingId(null);
    },
    onError: (err) => {
      toast.error(`重新生成失败：${err.message}`);
      setRegeneratingId(null);
    },
  });

  const markSentMutation = trpc.documents.markSent.useMutation({
    onSuccess: () => {
      toast.success("已标记为已发送");
      utils.documents.listByOrder.invalidate({ orderId });
    },
    onError: (err) => toast.error(`操作失败：${err.message}`),
  });

  const unmarkSentMutation = trpc.documents.unmarkSent.useMutation({
    onSuccess: () => {
      toast.success("已取消发送标记");
      utils.documents.listByOrder.invalidate({ orderId });
    },
    onError: (err) => toast.error(`操作失败：${err.message}`),
  });

  const handleRegenerate = (id: number) => {
    setRegeneratingId(id);
    regenerateMutation.mutate({ id });
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      const response = await fetch(`/api/export/documents/${orderId}/zip`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "下载失败" }));
        throw new Error(err.error ?? "下载失败");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `订单${orderId}_单据包_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("ZIP 文件已下载");
    } catch (err: any) {
      toast.error(err.message ?? "下载失败");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handlePreview = (pdfUrl: string, docNo: string, docType: string) => {
    const typeInfo = DOC_TYPE_LABELS[docType] ?? { label: docType };
    setPreviewTitle(`${typeInfo.label} · ${docNo}`);
    setPreviewUrl(pdfUrl);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!docs || docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <FileText className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">暂无生成的单据</p>
        <p className="text-xs mt-0.5">点击「生成单据」按钮创建合同/PI/CI</p>
      </div>
    );
  }

  // 构建 PI→CI 关联映射（piDocId → PI docNo）
  const piMap = new Map<number, string>();
  docs.forEach((d) => {
    if (d.docType === "pi") piMap.set(d.id, d.docNo);
  });

  const activeDocs = docs.filter(d => d.status === "active");

  return (
    <div className="space-y-3">
      {/* PDF 预览弹窗 */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-medium">{previewTitle}</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => previewUrl && window.open(previewUrl, "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  在新标签页打开
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={previewTitle}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量下载 ZIP 按钮 */}
      {activeDocs.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
          >
            {isDownloadingZip ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {isDownloadingZip ? "打包中..." : `批量下载 ZIP（${activeDocs.length} 份）`}
          </Button>
        </div>
      )}

      {/* 单据列表 */}
      <div className="space-y-2">
        {docs.map((doc) => {
          const typeInfo = DOC_TYPE_LABELS[doc.docType] ?? { label: doc.docType, color: "" };
          const isVoided = doc.status === "voided";
          const isRegenerating = regeneratingId === doc.id;
          const isSent = !!doc.sentAt;
          const version = doc.version ?? 1;
          const createdAt = new Date(doc.createdAt).toLocaleString("zh-CN", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          });
          const sentAtStr = doc.sentAt
            ? new Date(doc.sentAt).toLocaleString("zh-CN", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })
            : null;

          // PI→CI 关联：如果是 CI 且有 piDocId，找到对应 PI 的 docNo
          const linkedPiNo = doc.docType === "ci" && doc.piDocId
            ? piMap.get(doc.piDocId)
            : undefined;

          return (
            <div
              key={doc.id}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                isVoided
                  ? "border-border bg-muted/20 opacity-60"
                  : isSent
                    ? "border-green-200 bg-green-50/40 hover:bg-green-50/60"
                    : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className={`w-4 h-4 flex-shrink-0 ${isVoided ? "text-muted-foreground/50" : isSent ? "text-green-600" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${isVoided ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {doc.docNo}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 ${isVoided ? "opacity-50" : typeInfo.color}`}
                    >
                      {typeInfo.label}
                    </Badge>
                    {/* 版本号标签（版本>1时显示） */}
                    {version > 1 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200">
                        v{version}
                      </Badge>
                    )}
                    {/* 已发送标签 */}
                    {isSent && !isVoided && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 bg-green-50 text-green-600 border-green-200 gap-1">
                        <SendHorizonal className="w-2.5 h-2.5" />
                        已发送
                      </Badge>
                    )}
                    {isVoided && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 bg-red-50 text-red-500 border-red-200">
                        已作废
                      </Badge>
                    )}
                    {!isVoided && doc.currency && doc.currency !== "CNY" && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {doc.currency}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{createdAt}</span>
                    {doc.counterpartyName && (
                      <span className="text-xs text-muted-foreground">
                        · {doc.counterpartyName}
                      </span>
                    )}
                    {doc.totalAmount && (
                      <span className="text-xs text-muted-foreground">
                        · {doc.currency === "CNY" ? "¥" : doc.currency === "USD" ? "$" : "€"}
                        {parseFloat(doc.totalAmount).toFixed(2)}
                      </span>
                    )}
                    {/* 发送时间 */}
                    {sentAtStr && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-0.5 text-xs text-green-600 cursor-default">
                            · 已发送于 {sentAtStr}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>点击右侧按钮可取消发送标记</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* PI→CI 关联追踪 */}
                    {linkedPiNo && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-0.5 text-xs text-purple-500 cursor-default">
                            <ArrowRight className="w-3 h-3" />
                            来自 {linkedPiNo}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>此 CI 由 PI 单据 {linkedPiNo} 创建</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* 预览按钮 */}
                {doc.pdfUrl && !isVoided && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => handlePreview(doc.pdfUrl!, doc.docNo, doc.docType)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        预览
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>在弹窗中预览 PDF，无需下载</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {doc.pdfUrl && !isVoided && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => window.open(doc.pdfUrl!, "_blank")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    下载
                  </Button>
                )}

                {/* 已发送 / 标记发送 按钮 */}
                {!isVoided && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`gap-1.5 text-xs h-7 ${
                          isSent
                            ? "border-green-300 text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700"
                            : "text-muted-foreground hover:text-green-600 hover:border-green-300"
                        }`}
                        onClick={() => {
                          if (isSent) {
                            unmarkSentMutation.mutate({ id: doc.id });
                          } else {
                            markSentMutation.mutate({ id: doc.id });
                          }
                        }}
                        disabled={markSentMutation.isPending || unmarkSentMutation.isPending}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSent ? "已发送" : "标记发送"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isSent ? "点击取消发送标记" : "标记此单据已通过邮件发送给客户"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* 重新生成按钮 */}
                {!isVoided && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => handleRegenerate(doc.id)}
                        disabled={isRegenerating}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                        {isRegenerating ? "生成中..." : "重新生成"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>使用当前订单数据重新生成 PDF，版本号 +1</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {!isVoided && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 bg-transparent"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        作废
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认作废单据？</AlertDialogTitle>
                        <AlertDialogDescription>
                          单据 <strong>{doc.docNo}</strong> 将被标记为「已作废」，无法再下载或使用。此操作不可撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600 text-white"
                          onClick={() => voidMutation.mutate({ id: doc.id })}
                        >
                          确认作废
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
