import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, ArrowLeft, PackageOpen } from "lucide-react";
import { Link } from "wouter";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Trash() {
  usePageTitle("回收站");
  const utils = trpc.useUtils();
  const { data: trashed = [], isLoading } = trpc.orders.listTrashed.useQuery(
    undefined,
    { staleTime: 30_000 }
  );
  const restoreMut = trpc.orders.restore.useMutation({
    onMutate: async ({ id }) => {
      await utils.orders.listTrashed.cancel();
      const prev = utils.orders.listTrashed.getData();
      utils.orders.listTrashed.setData(undefined, old => old?.filter(o => o.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.orders.listTrashed.setData(undefined, ctx.prev);
    },
    onSuccess: () => {
      toast.success("订单已恢复到正常列表");
      utils.orders.listTrashed.invalidate();
      utils.orders.list.invalidate();
    },
  });
  const hardDeleteMut = trpc.orders.hardDelete.useMutation({
    onMutate: async ({ id }) => {
      await utils.orders.listTrashed.cancel();
      const prev = utils.orders.listTrashed.getData();
      utils.orders.listTrashed.setData(undefined, old => old?.filter(o => o.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.orders.listTrashed.setData(undefined, ctx.prev);
    },
    onSuccess: () => {
      setHardDeleteId(null);
      toast.success("订单已彻底删除");
      utils.orders.listTrashed.invalidate();
    },
  });

  const [hardDeleteId, setHardDeleteId] = useState<number | null>(null);

  const formatDate = (d: any) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const STATUS_LABELS: Record<string, string> = {
    draft: "草稿", submitted: "已提交", in_production: "生产中", completed: "已完成", cancelled: "已取消",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回订单列表
            </Button>
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-base leading-tight">回收站</h1>
              <p className="text-xs text-muted-foreground leading-tight">已删除的订单，可恢复或彻底删除</p>
            </div>
          </div>
        </div>
        {trashed.length > 0 && (
          <span className="text-sm text-muted-foreground">{trashed.length} 条已删除订单</span>
        )}
      </header>

      {/* 内容区 */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">加载中...</div>
        ) : trashed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <PackageOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">回收站为空</p>
            <p className="text-sm text-muted-foreground">删除的订单会在这里保留，可以随时恢复</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 mb-6">
              回收站中的订单可以随时恢复。点击「彻底删除」后数据将无法找回，请谨慎操作。
            </div>
            {trashed.map((order: any) => (
              <div
                key={order.id}
                className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">
                      {order.orderDescription || `订单 #${order.id}`}
                    </span>
                    {order.orderNo && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {order.orderNo}
                      </span>
                    )}
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {order.customer && <span>{order.customer}</span>}
                    {order.deliveryDate && <span>交货：{order.deliveryDate}</span>}
                    <span className="text-xs text-destructive/70">
                      删除于 {formatDate(order.deletedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => restoreMut.mutate({ id: order.id })}
                    disabled={restoreMut.isPending}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    恢复
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/5"
                    onClick={() => setHardDeleteId(order.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    彻底删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 彻底删除确认 */}
      <AlertDialog open={hardDeleteId !== null} onOpenChange={open => !open && setHardDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认彻底删除？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复，订单及其所有型号数据将被永久删除。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => hardDeleteId !== null && hardDeleteMut.mutate({ id: hardDeleteId })}
            >
              确认彻底删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
