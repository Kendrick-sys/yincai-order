/**
 * DocumentHistory.tsx
 * 订单详情页中展示历史生成的单据列表（合同/PI/CI）
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ExternalLink, Clock } from "lucide-react";

interface Props {
  orderId: number;
}

const DOC_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  contract_cn: { label: "国内采购合同", color: "bg-blue-100 text-blue-700 border-blue-200" },
  pi: { label: "PI（形式发票）", color: "bg-green-100 text-green-700 border-green-200" },
  ci: { label: "CI（商业发票）", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

export default function DocumentHistory({ orderId }: Props) {
  const { data: docs, isLoading } = trpc.documents.listByOrder.useQuery({ orderId });

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

  return (
    <div className="space-y-2">
      {docs.map((doc) => {
        const typeInfo = DOC_TYPE_LABELS[doc.docType] ?? { label: doc.docType, color: "" };
        const createdAt = new Date(doc.createdAt).toLocaleString("zh-CN", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        });

        return (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{doc.docNo}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs px-1.5 py-0 ${typeInfo.color}`}
                  >
                    {typeInfo.label}
                  </Badge>
                  {doc.currency && doc.currency !== "CNY" && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {doc.currency}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
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
                </div>
              </div>
            </div>
            {doc.pdfUrl && (
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 gap-1.5 text-xs h-7"
                onClick={() => window.open(doc.pdfUrl!, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                下载 PDF
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
