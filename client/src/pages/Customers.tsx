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
import { Plus, Pencil, Trash2, Users, ArrowLeft, GripVertical, Download, Globe, Home, ExternalLink, Upload, FileSpreadsheet } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

type CustomerForm = {
  name: string;
  address: string;
  country: "domestic" | "overseas";
  company: string;   // 公司名（英文，用于 PI/CI）
  attn: string;      // 联系人（Attn，英文，用于 PI/CI）
  enAddress: string; // 英文地址（用于 PI/CI Buyer 区块）
  email: string;
  contact: string;
  phone: string;
  // 国内客户专用字段
  cnCompany: string;   // 公司全称
  taxNo: string;       // 统一社会信用代码（税号）
  bankAccount: string; // 对公账号
  bankName: string;    // 对公开户行
  remarks: string;
};

const emptyForm: CustomerForm = {
  name: "", address: "", country: "domestic",
  company: "", attn: "", enAddress: "",
  email: "", contact: "", phone: "",
  cnCompany: "", taxNo: "", bankAccount: "", bankName: "",
  remarks: "",
};

export default function Customers() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: customers = [] } = trpc.customers.list.useQuery(
    undefined,
    { staleTime: 60_000 }
  );
  const createMut = trpc.customers.create.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); setDialogOpen(false); toast.success("客户已添加"); },
  });
  const updateMut = trpc.customers.update.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); setDialogOpen(false); toast.success("客户已更新"); },
  });
  const deleteMut = trpc.customers.delete.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); setDeleteId(null); toast.success("客户已删除"); },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "",
      address: c.address ?? c.code ?? "",
      country: c.country ?? "domestic",
      company: c.company ?? "",
      attn: c.attn ?? "",
      enAddress: c.enAddress ?? "",
      email: c.email ?? "",
      contact: c.contact ?? "",
      phone: c.phone ?? "",
      cnCompany: c.cnCompany ?? "",
      taxNo: c.taxNo ?? "",
      bankAccount: c.bankAccount ?? "",
      bankName: c.bankName ?? "",
      remarks: c.remarks ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("客户名称不能为空"); return; }
    if (!form.contact.trim()) { toast.error("联系人不能为空"); return; }
    if (!form.phone.trim()) { toast.error("联系电话不能为空"); return; }
    // 国外客户：地址必填；国内客户：地址选填
    if (form.country === "overseas" && !form.address.trim()) {
      toast.error("国外客户必须填写国家地址"); return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("邮箱格式不正确"); return;
    }
    const payload = { ...form, code: form.address };
    if (editingId !== null) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleExport = async () => {
    if (customers.length === 0) { toast.error("暂无客户数据可导出"); return; }
    setIsExporting(true);
    try {
      const a = document.createElement("a");
      a.href = "/api/export/customers";
      a.download = `吟彩客户档案_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "")}.xlsx`;
      a.click();
      toast.success("客户档案 Excel 已开始下载");
    } catch {
      toast.error("导出失败，请重试");
    } finally {
      setTimeout(() => setIsExporting(false), 2000);
    }
  };

  const handleDownloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/api/export/customers/template";
    a.download = "吟彩客户导入模板.xlsx";
    a.click();
    toast.success("模板已开始下载，请删除示例行后填写数据");
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("请上传 Excel 文件（.xlsx 或 .xls）");
      return;
    }
    setIsImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const response = await fetch("/api/import/customers", {
        method: "POST",
        body: arrayBuffer,
        headers: { "Content-Type": "application/octet-stream" },
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "导入失败");
        return;
      }
      utils.customers.list.invalidate();
      if (result.errors?.length) {
        toast.warning(`导入完成：成功 ${result.created} 条，失败 ${result.errors.length} 条`);
      } else {
        toast.success(`成功导入 ${result.created} 个客户`);
      }
    } catch {
      toast.error("导入失败，请重试");
    } finally {
      setIsImporting(false);
    }
  };

  const triggerImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleImport(file);
    };
    input.click();
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2" title="下载导入模板">
            <FileSpreadsheet className="w-4 h-4" />
            下载模板
          </Button>
          <Button variant="outline" onClick={triggerImport} disabled={isImporting} className="gap-2" title="从 Excel 批量导入客户">
            <Upload className="w-4 h-4" />
            {isImporting ? "导入中..." : "批量导入"}
          </Button>
          {customers.length > 0 && (
            <Button variant="outline" onClick={handleExport} disabled={isExporting} className="gap-2">
              <Download className="w-4 h-4" />
              {isExporting ? "导出中..." : "导出 Excel"}
            </Button>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            新增客户
          </Button>
        </div>
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
                    {/* 国内/国外标签 */}
                    <Badge variant={c.country === "overseas" ? "default" : "secondary"} className="text-xs gap-1">
                      {c.country === "overseas"
                        ? <><Globe className="w-3 h-3" />国外</>
                        : <><Home className="w-3 h-3" />国内</>
                      }
                    </Badge>
                    {(c.address || c.code) && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full truncate max-w-[160px]">{c.address || c.code}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {(c.contact || c.phone) && (
                      <p className="text-sm text-muted-foreground">
                        {[c.contact, c.phone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-muted-foreground/70">{c.email}</p>
                    )}
                  </div>
                  {c.remarks && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{c.remarks}</p>
                  )}
                  {/* 订单统计 */}
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => navigate(`/?customer=${encodeURIComponent(c.name)}`)}
                      className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer"
                    >
                      <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">{Number(c.orderCount) || 0}</span>
                      历史订单
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    {c.lastOrderDate && (
                      <span className="text-xs text-muted-foreground">
                        最近下单：{c.lastOrderDate}
                      </span>
                    )}
                    {!c.lastOrderDate && Number(c.orderCount) === 0 && (
                      <span className="text-xs text-muted-foreground/50">暂无订单记录</span>
                    )}
                  </div>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "编辑客户" : "新增客户"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 客户名称 */}
            <div>
              <Label className="text-sm font-medium">客户名称 <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                placeholder="如：香港佬、安卡"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* 国家 */}
            <div>
              <Label className="text-sm font-medium">国家 <span className="text-destructive">*</span></Label>
              <div className="flex gap-3 mt-1">
                {[
                  { value: "domestic", label: "国内", icon: <Home className="w-3.5 h-3.5" /> },
                  { value: "overseas", label: "国外", icon: <Globe className="w-3.5 h-3.5" /> },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, country: opt.value as "domestic" | "overseas" }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all duration-150
                      ${form.country === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 客户地址（国外必填，国内选填） */}
            <div>
              <Label className="text-sm font-medium">
                客户地址
                {form.country === "overseas"
                  ? <span className="text-destructive ml-1">*</span>
                  : <span className="text-muted-foreground ml-1 text-xs font-normal">（选填）</span>
                }
              </Label>
              <Input
                className="mt-1"
                placeholder={
                  form.country === "overseas"
                    ? "如：123 Main St, New York, NY 10001, USA"
                    : "如：广东省广州市天河区（选填）"
                }
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
              {form.country === "overseas" && !form.address.trim() && (
                <p className="text-xs text-amber-600 mt-1">国外客户需填写国家地址</p>
              )}
            </div>

            {/* 联系人 + 联系电话 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">联系人 <span className="text-destructive">*</span></Label>
                <Input
                  className="mt-1"
                  placeholder="如：张三"
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">联系电话 <span className="text-destructive">*</span></Label>
                <Input
                  className="mt-1"
                  placeholder="如：13800138000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>

            {/* 邮箱 */}
            <div>
              <Label className="text-sm font-medium">邮箱</Label>
              <Input
                className="mt-1"
                type="email"
                placeholder="如：example@company.com（选填）"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* PI/CI 英文信息（仅国外客户显示） */}
            {form.country === "overseas" && (
              <>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">PI/CI 英文信息（用于生成单据）</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Attn（英文联系人）</Label>
                    <Input
                      className="mt-1"
                      placeholder="如：Jad A. EL Eid"
                      value={form.attn}
                      onChange={e => setForm(f => ({ ...f, attn: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Company Name（公司名）</Label>
                    <Input
                      className="mt-1"
                      placeholder="如：Schemes L.L.C"
                      value={form.company}
                      onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">English Address（英文地址）</Label>
                  <Input
                    className="mt-1"
                    placeholder="如：Building 5, Al Quoz Industrial Area 3, Dubai, UAE"
                    value={form.enAddress}
                    onChange={e => setForm(f => ({ ...f, enAddress: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">将自动填入 PI/CI 的 Buyer 地址字段</p>
                </div>
              </>
            )}

            {/* 国内客户专用字段（用于国内合同甲方信息） */}
            {form.country === "domestic" && (
              <>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">国内合同甲方信息（可选，用于自动填充合同）</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">公司全称</Label>
                  <Input
                    className="mt-1"
                    placeholder="如：深圳市某某有限公司"
                    value={form.cnCompany}
                    onChange={e => setForm(f => ({ ...f, cnCompany: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">统一社会信用代码（税号）</Label>
                  <Input
                    className="mt-1"
                    placeholder="18 位统一社会信用代码"
                    value={form.taxNo}
                    onChange={e => setForm(f => ({ ...f, taxNo: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-sm font-medium">对公账号</Label>
                    <Input
                      className="mt-1"
                      placeholder="如：1234 5678 9012 3456"
                      value={form.bankAccount}
                      onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">对公开户行</Label>
                    <Input
                      className="mt-1"
                      placeholder="如：中国工商银行深圳市某某支行"
                      value={form.bankName}
                      onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">以上信息将自动填入国内合同的甲方信息栏</p>
              </>
            )}

            {/* 备注 */}
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
