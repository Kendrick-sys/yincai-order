/**
 * CostItemsManager.tsx
 * 型号成本管理页面（仅管理员）
 * 支持：查看/编辑/删除/新增/Excel导入/导出模板
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Plus, Upload, Download, Pencil, Trash2,
  Package, Search, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import * as XLSX from "xlsx";

// ─── 类型 ──────────────────────────────────────────────────────────────────────
interface CostItem {
  id: number;
  model: string;
  material: string;
  boxPrice: string;
  puPrice: string;
  evaPrice: string;
  linerMoldFee: string;
  sortOrder: number;
}

interface EditForm {
  model: string;
  material: string;
  boxPrice: string;
  puPrice: string;
  evaPrice: string;
  linerMoldFee: string;
}

const EMPTY_FORM: EditForm = {
  model: "", material: "", boxPrice: "0", puPrice: "0", evaPrice: "0", linerMoldFee: "0",
};

// ─── 主组件 ────────────────────────────────────────────────────────────────────
export default function CostItemsManager() {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading, refetch } = trpc.costItems.list.useQuery();

  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<CostItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [isNewItem, setIsNewItem] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = trpc.costItems.create.useMutation({
    onSuccess: () => {
      toast.success("已添加成本条目");
      setEditItem(null);
      setIsNewItem(false);
      utils.costItems.list.invalidate();
    },
    onError: (e) => toast.error(`添加失败：${e.message}`),
  });

  const updateMutation = trpc.costItems.update.useMutation({
    onSuccess: () => {
      toast.success("已保存修改");
      setEditItem(null);
      utils.costItems.list.invalidate();
    },
    onError: (e) => toast.error(`保存失败：${e.message}`),
  });

  const deleteMutation = trpc.costItems.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      setDeleteId(null);
      utils.costItems.list.invalidate();
    },
    onError: (e) => toast.error(`删除失败：${e.message}`),
  });

  const importMutation = trpc.costItems.importAll.useMutation({
    onSuccess: (data) => {
      toast.success(`导入成功，共 ${data.count} 条记录`);
      utils.costItems.list.invalidate();
    },
    onError: (e) => toast.error(`导入失败：${e.message}`),
    onSettled: () => setImporting(false),
  });

  // ─── 过滤 ────────────────────────────────────────────────────────────────────
  const filtered = items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.model.toLowerCase().includes(q) || item.material.toLowerCase().includes(q);
  });

  // ─── 编辑弹窗 ────────────────────────────────────────────────────────────────
  const openEdit = (item: CostItem) => {
    setEditItem(item);
    setEditForm({
      model: item.model,
      material: item.material,
      boxPrice: item.boxPrice,
      puPrice: item.puPrice,
      evaPrice: item.evaPrice,
      linerMoldFee: item.linerMoldFee,
    });
    setIsNewItem(false);
  };

  const openNew = () => {
    setEditItem({ id: 0 } as CostItem);
    setEditForm(EMPTY_FORM);
    setIsNewItem(true);
  };

  const handleSave = () => {
    if (!editForm.model.trim()) {
      toast.error("型号不能为空");
      return;
    }
    if (isNewItem) {
      createMutation.mutate({
        ...editForm,
        sortOrder: items.length,
      });
    } else if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...editForm });
    }
  };

  // ─── Excel 导出模板 ──────────────────────────────────────────────────────────
  const handleExportTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["序号", "型号", "材质", "箱子采购价", "PU内衬单价", "EVA内衬单价", "内衬开模费"],
      [1, "示例：1409", "PP", 11.0, 1.2, 2.4, 150.0],
      [2, "示例：1409", "ABS", 13.0, 1.2, 2.4, 150.0],
    ]);
    // 设置列宽
    ws["!cols"] = [
      { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "型号成本表");
    XLSX.writeFile(wb, "亿丰成本表模板.xlsx");
    toast.success("模板已下载");
  };

  // ─── 导出当前数据 ────────────────────────────────────────────────────────────
  const handleExportData = () => {
    const rows = items.map((item, idx) => [
      idx + 1,
      item.model,
      item.material,
      parseFloat(item.boxPrice) || 0,
      parseFloat(item.puPrice) || 0,
      parseFloat(item.evaPrice) || 0,
      parseFloat(item.linerMoldFee) || 0,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      ["序号", "型号", "材质", "箱子采购价", "PU内衬单价", "EVA内衬单价", "内衬开模费"],
      ...rows,
    ]);
    ws["!cols"] = [
      { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "型号成本表");
    XLSX.writeFile(wb, `亿丰成本表_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.xlsx`);
    toast.success(`已导出 ${items.length} 条记录`);
  };

  // ─── Excel 导入 ──────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

        // 跳过标题行，从第2行开始
        const parsed = rows.slice(1)
          .filter(row => Array.isArray(row) && row.length >= 3 && row[1])
          .map((row, idx) => ({
            model:        String(row[1] ?? "").trim(),
            material:     String(row[2] ?? "").trim(),
            boxPrice:     String(parseFloat(String(row[3] ?? "0")) || 0),
            puPrice:      String(parseFloat(String(row[4] ?? "0")) || 0),
            evaPrice:     String(parseFloat(String(row[5] ?? "0")) || 0),
            linerMoldFee: String(parseFloat(String(row[6] ?? "0")) || 0),
            sortOrder:    idx,
          }))
          .filter(item => item.model);

        if (parsed.length === 0) {
          toast.error("未找到有效数据，请检查文件格式");
          setImporting(false);
          return;
        }

        importMutation.mutate({ items: parsed });
      } catch (err) {
        toast.error("文件解析失败，请检查格式");
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    // 清空 input 以允许重复上传同一文件
    e.target.value = "";
  };

  // ─── 渲染 ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-[#1A3C5E]">
                <ArrowLeft className="w-4 h-4" />
                返回设置
              </Button>
            </Link>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1A3C5E] flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-[#1A3C5E] text-base leading-tight">型号成本管理</h1>
                <p className="text-xs text-gray-400">吟彩→亿丰采购单价表</p>
              </div>
            </div>
            {!isLoading && (
              <Badge variant="secondary" className="ml-2 text-xs">
                共 {items.length} 条
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-gray-500" onClick={handleExportTemplate}>
              <Download className="w-4 h-4" />
              下载模板
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-gray-500" onClick={handleExportData} disabled={items.length === 0}>
              <Download className="w-4 h-4" />
              导出数据
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="w-4 h-4" />
              {importing ? "导入中..." : "导入 Excel"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <Button size="sm" className="gap-1.5 bg-[#1A3C5E] hover:bg-[#15304d]" onClick={openNew}>
              <Plus className="w-4 h-4" />
              新增型号
            </Button>
          </div>
        </div>
      </header>

      {/* 提示栏 */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">导入说明：</span>
            Excel 第一行为标题行（自动跳过），从第二行开始填写数据。列顺序：序号、型号、材质、箱子采购价、PU内衬单价、EVA内衬单价、内衬开模费。
            <strong className="text-red-600 ml-1">导入将替换全部现有数据，请谨慎操作。</strong>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <main className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索型号或材质..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
            刷新
          </Button>
          {search && (
            <span className="text-sm text-gray-500">
              找到 {filtered.length} 条
            </span>
          )}
        </div>

        {/* 数据表格 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>型号</TableHead>
                <TableHead>材质</TableHead>
                <TableHead className="text-right">箱子采购价</TableHead>
                <TableHead className="text-right">PU内衬单价</TableHead>
                <TableHead className="text-right">EVA内衬单价</TableHead>
                <TableHead className="text-right">内衬开模费</TableHead>
                <TableHead className="w-20 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                    {search ? "未找到匹配的型号" : "暂无数据，请导入 Excel 或手动添加"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item, idx) => (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell className="text-center text-gray-400 text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-[#1A3C5E]">{item.model}</TableCell>
                    <TableCell>
                      {item.material ? (
                        <Badge variant="outline" className="text-xs">{item.material}</Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">通用</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">¥{parseFloat(item.boxPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-blue-600">¥{parseFloat(item.puPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-600">¥{parseFloat(item.evaPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-orange-600">¥{parseFloat(item.linerMoldFee).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-[#1A3C5E]"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* 编辑/新增弹窗 */}
      <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNewItem ? "新增型号成本" : "编辑型号成本"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>型号 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="如：1409"
                  value={editForm.model}
                  onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>材质</Label>
                <Input
                  placeholder="如：PP / ABS（空=通用）"
                  value={editForm.material}
                  onChange={e => setEditForm(f => ({ ...f, material: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>箱子采购价（元）</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editForm.boxPrice}
                  onChange={e => setEditForm(f => ({ ...f, boxPrice: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>内衬开模费（元）</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editForm.linerMoldFee}
                  onChange={e => setEditForm(f => ({ ...f, linerMoldFee: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>PU 内衬单价（元）</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editForm.puPrice}
                  onChange={e => setEditForm(f => ({ ...f, puPrice: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>EVA 内衬单价（元）</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editForm.evaPrice}
                  onChange={e => setEditForm(f => ({ ...f, evaPrice: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>取消</Button>
            <Button
              className="bg-[#1A3C5E] hover:bg-[#15304d]"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，确定要删除这条成本记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
