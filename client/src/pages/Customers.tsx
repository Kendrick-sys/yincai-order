import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Users, ArrowLeft, GripVertical } from "lucide-react";
import { Link } from "wouter";

type CustomerForm = {
  name: string;
  address: string;
  contact: string;
  phone: string;
  remarks: string;
};

const emptyForm: CustomerForm = { name: "", address: "", contact: "", phone: "", remarks: "" };

export default function Customers() {
  const utils = trpc.useUtils();
  const { data: customers = [] } = trpc.customers.list.useQuery(
    undefined,
    { staleTime: 60_000 }  // 1分钟内不重新拉取
  );
  const createMut = trpc.customers.create.useMutation({ onSuccess: () => { utils.customers.list.invalidate(); setDialogOpen(false); toast.success("客户已添加"); } });
  const updateMut = trpc.customers.update.useMutation({ onSuccess: () => { utils.customers.list.invalidate(); setDialogOpen(false); toast.success("客户已更新"); } });
  const deleteMut = trpc.customers.delete.useMutation({ onSuccess: () => { utils.customers.list.invalidate(); setDeleteId(null); toast.success("客户已删除"); } });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({ name: c.name ?? "", address: c.address ?? c.code ?? "", contact: c.contact ?? "", phone: c.phone ?? "", remarks: c.remarks ?? "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("客户名称不能为空"); return; }
    if (editingId !== null) {
      updateMut.mutate({ id: editingId, data: { ...form, code: form.address } });
    } else {
      createMut.mutate({ ...form, code: form.address });
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

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
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-base leading-tight">客户管理</h1>
              <p className="text-xs text-muted-foreground leading-tight">管理下单时的预设客户列表</p>
            </div>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          新增客户
        </Button>
      </header>

      {/* 内容区 */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">暂无预设客户</p>
            <p className="text-sm text-muted-foreground mb-6">点击「新增客户」添加常用客户，下单时可直接选择</p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              新增第一个客户
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">共 {customers.length} 个预设客户，下单时可在客户字段直接选择</p>
            {customers.map((c: any) => (
              <div
                key={c.id}
                className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors group"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    {(c.address || c.code) && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{c.address || c.code}</span>
                    )}
                  </div>
                  {(c.contact || c.phone) && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {[c.contact, c.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {c.remarks && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{c.remarks}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-8 w-8 p-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(c.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "编辑客户" : "新增客户"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">客户名称 <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                placeholder="如：香港佬、安卡"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">客户地址</Label>
                <Input
                  className="mt-1"
                  placeholder="如：广东省广州市"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">联系人</Label>
                <Input
                  className="mt-1"
                  placeholder="可选"
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">联系电话</Label>
              <Input
                className="mt-1"
                placeholder="可选"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">备注</Label>
              <Textarea
                className="mt-1"
                placeholder="可选"
                rows={2}
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除客户？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该客户将从预设列表中移除，已有订单中的客户名称不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMut.mutate({ id: deleteId })}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
