/**
 * CostItemsManager.tsx
 * 型号成本管理页面（仅管理员）
 * 支持：查看/内联编辑/删除/新增/Excel导入(含校验报告)/导出/版本历史回滚
 *
 * 内联编辑：点击数值单元格直接编辑，失焦自动保存并创建快照
 */

import { useState, useRef, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Plus, Upload, Download, Pencil, Trash2,
  Package, Search, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, History, RotateCcw, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import { usePageTitle } from "@/hooks/usePageTitle";

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

interface SkippedRow {
  rowIndex: number;
  model: string;
  material: string;
  reason: string;
}

interface ImportResult {
  successCount: number;
  skippedCount: number;
  skipped: SkippedRow[];
}

interface Snapshot {
  id: number;
  snapshotName: string;
  createdByName: string;
  itemCount: number;
  createdAt: Date;
}

/** 内联编辑中的单元格标识 */
interface EditingCell {
  id: number;
  field: "boxPrice" | "puPrice" | "evaPrice" | "linerMoldFee";
}

const EMPTY_FORM: EditForm = {
  model: "", material: "", boxPrice: "0", puPrice: "0", evaPrice: "0", linerMoldFee: "0",
};

/** 内联编辑的字段颜色 */
const FIELD_COLOR: Record<EditingCell["field"], string> = {
  boxPrice: "text-gray-800",
  puPrice: "text-blue-600",
  evaPrice: "text-green-600",
  linerMoldFee: "text-orange-600",
};

// ─── 主组件 ────────────────────────────────────────────────────────────────────
export default function CostItemsManager() {
  usePageTitle("型号成本管理");
  const utils = trpc.useUtils();
  const { data: items = [], isLoading, refetch } = trpc.costItems.list.useQuery();
  const { data: snapshots = [], refetch: refetchSnapshots } = trpc.costSnapshots.list.useQuery();

  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<CostItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [isNewItem, setIsNewItem] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rollbackId, setRollbackId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 内联编辑状态 ────────────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  /** 防止 onBlur 和 onKeyDown(Enter) 同时触发保存 */
  const savingRef = useRef(false);

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

  /** 内联编辑专用 mutation：静默保存，自动创建快照 */
  const inlineUpdateMutation = trpc.costItems.update.useMutation({
    onSuccess: () => {
      utils.costItems.list.invalidate();
      utils.costSnapshots.list.invalidate();
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
      setImportResult(data);
      setShowImportResult(true);
      utils.costItems.list.invalidate();
      utils.costSnapshots.list.invalidate();
    },
    onError: (e) => toast.error(`导入失败：${e.message}`),
    onSettled: () => setImporting(false),
  });

  const rollbackMutation = trpc.costSnapshots.rollback.useMutation({
      onSuccess: () => {
      toast.success("已回滚到该版本");
      setRollbackId(null);
      setShowHistory(false);
      utils.costItems.list.invalidate();
      utils.costSnapshots.list.invalidate();
    },
    onError: (e) => toast.error(`回滚失败：${e.message}`),
  });

  // ─── 过滤 ────────────────────────────────────────────────────────────────────
  const filtered = items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.model.toLowerCase().includes(q) || item.material.toLowerCase().includes(q);
  });

  // ─── 内联编辑逻辑 ────────────────────────────────────────────────────────────
  /** 点击数值单元格，进入编辑模式 */
  const startInlineEdit = useCallback((item: CostItem, field: EditingCell["field"]) => {
    setEditingCell({ id: item.id, field });
    setInlineValue(parseFloat(item[field]).toFixed(2));
    savingRef.current = false;
  }, []);

  /** 提交内联编辑（失焦或按 Enter 时调用） */
  const commitInlineEdit = useCallback(() => {
    if (savingRef.current) return;
    if (!editingCell) return;

    const val = parseFloat(inlineValue);
    if (isNaN(val) || val < 0) {
      toast.error("价格必须为非负数");
      setEditingCell(null);
      return;
    }

    savingRef.current = true;
    const strVal = val.toFixed(2);
    inlineUpdateMutation.mutate(
      { id: editingCell.id, [editingCell.field]: strVal, createSnapshot: true },
      {
        onSettled: () => {
          savingRef.current = false;
          setEditingCell(null);
        },
      }
    );
  }, [editingCell, inlineValue, inlineUpdateMutation]);

  /** 取消内联编辑（按 Escape 时调用） */
  const cancelInlineEdit = useCallback(() => {
    savingRef.current = true; // 阻止 onBlur 触发保存
    setEditingCell(null);
    setTimeout(() => { savingRef.current = false; }, 100);
  }, []);

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
      createMutation.mutate({ ...editForm, sortOrder: items.length });
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
    ws["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "型号成本表");
    XLSX.writeFile(wb, "亿丰成本表模板.xlsx");
    toast.success("模板已下载");
  };

  // ─── 导出当前数据 ────────────────────────────────────────────────────────────
  const handleExportData = () => {
    const rows = items.map((item, idx) => [
      idx + 1, item.model, item.material,
      parseFloat(item.boxPrice) || 0,
      parseFloat(item.puPrice) || 0,
      parseFloat(item.evaPrice) || 0,
      parseFloat(item.linerMoldFee) || 0,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      ["序号", "型号", "材质", "箱子采购价", "PU内衬单价", "EVA内衬单价", "内衬开模费"],
      ...rows,
    ]);
    ws["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "型号成本表");
    XLSX.writeFile(wb, `亿丰成本表_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.xlsx`);
    toast.success(`已导出 ${items.length} 条记录`);
  };

  // ─── Excel 导入（含逐行校验） ─────────────────────────────────────────────────
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

        // 跳过标题行，逐行校验
        const dataRows = rows.slice(1);
        const parsed: Array<{
          model: string; material: string; boxPrice: string;
          puPrice: string; evaPrice: string; linerMoldFee: string; sortOrder: number;
        }> = [];
        const clientSkipped: SkippedRow[] = [];

        dataRows.forEach((row, idx) => {
          const rowIndex = idx + 2; // 实际行号（含标题行）
          if (!Array.isArray(row) || row.length < 2) {
            if (Array.isArray(row) && row.some(c => c !== null && c !== undefined && c !== "")) {
              clientSkipped.push({ rowIndex, model: "", material: "", reason: "行数据不足（至少需要型号列）" });
            }
            return;
          }
          const model = String(row[1] ?? "").trim();
          const material = String(row[2] ?? "").trim();

          if (!model) {
            clientSkipped.push({ rowIndex, model: "", material, reason: "型号不能为空" });
            return;
          }

          const boxPrice = parseFloat(String(row[3] ?? "0"));
          const puPrice = parseFloat(String(row[4] ?? "0"));
          const evaPrice = parseFloat(String(row[5] ?? "0"));
          const linerMoldFee = parseFloat(String(row[6] ?? "0"));

          if (boxPrice < 0 || puPrice < 0 || evaPrice < 0 || linerMoldFee < 0) {
            clientSkipped.push({ rowIndex, model, material, reason: "价格不能为负数" });
            return;
          }

          parsed.push({
            model,
            material,
            boxPrice: String(isNaN(boxPrice) ? 0 : boxPrice),
            puPrice: String(isNaN(puPrice) ? 0 : puPrice),
            evaPrice: String(isNaN(evaPrice) ? 0 : evaPrice),
            linerMoldFee: String(isNaN(linerMoldFee) ? 0 : linerMoldFee),
            sortOrder: parsed.length,
          });
        });

        if (parsed.length === 0) {
          toast.error("未找到有效数据，请检查文件格式");
          setImporting(false);
          return;
        }

        importMutation.mutate({ items: parsed });
      } catch {
        toast.error("文件解析失败，请检查格式");
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // ─── 内联编辑单元格渲染辅助 ──────────────────────────────────────────────────
  const renderNumericCell = (
    item: CostItem,
    field: EditingCell["field"],
    displayValue: string,
    colorClass: string,
  ) => {
    const isEditing = editingCell?.id === item.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <TableCell className="text-right p-1">
          <input
            type="number"
            step="0.01"
            min="0"
            autoFocus
            value={inlineValue}
            onChange={e => setInlineValue(e.target.value)}
            onBlur={commitInlineEdit}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitInlineEdit(); }
              if (e.key === "Escape") { e.preventDefault(); cancelInlineEdit(); }
            }}
            className={`w-full text-right font-mono text-sm border border-blue-400 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50 ${colorClass}`}
            style={{ minWidth: 70 }}
          />
        </TableCell>
      );
    }
    return (
      <TableCell
        className={`text-right font-mono text-sm cursor-pointer select-none hover:bg-blue-50 hover:text-blue-700 transition-colors rounded px-3 ${colorClass}`}
        title="点击直接编辑"
        onClick={() => startInlineEdit(item, field)}
      >
        ¥{displayValue}
      </TableCell>
    );
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
              <Badge variant="secondary" className="ml-2 text-xs">共 {items.length} 条</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-gray-500"
              onClick={() => { setShowHistory(true); refetchSnapshots(); }}
            >
              <History className="w-4 h-4" />
              版本历史
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-gray-500" onClick={handleExportTemplate}>
              <Download className="w-4 h-4" />
              下载模板
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-gray-500" onClick={handleExportData} disabled={items.length === 0}>
              <Download className="w-4 h-4" />
              导出数据
            </Button>
            <Button
              variant="outline" size="sm"
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
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
          <div>
            <span className="font-medium">快速编辑提示：</span>
            点击价格单元格可直接修改，按 <kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs font-mono">Enter</kbd> 或失焦自动保存并创建版本快照。
            点击 <Pencil className="w-3 h-3 inline" /> 按钮可编辑型号和材质。
            <span className="ml-2 text-red-600 font-medium">导入 Excel 将替换全部数据。</span>
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
          {search && <span className="text-sm text-gray-500">找到 {filtered.length} 条</span>}
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
                  <TableRow key={item.id} className="hover:bg-gray-50 group">
                    <TableCell className="text-center text-gray-400 text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-[#1A3C5E]">{item.model}</TableCell>
                    <TableCell>
                      {item.material ? (
                        <Badge variant="outline" className="text-xs">{item.material}</Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">通用</span>
                      )}
                    </TableCell>
                    {renderNumericCell(item, "boxPrice", parseFloat(item.boxPrice).toFixed(2), FIELD_COLOR.boxPrice)}
                    {renderNumericCell(item, "puPrice", parseFloat(item.puPrice).toFixed(2), FIELD_COLOR.puPrice)}
                    {renderNumericCell(item, "evaPrice", parseFloat(item.evaPrice).toFixed(2), FIELD_COLOR.evaPrice)}
                    {renderNumericCell(item, "linerMoldFee", parseFloat(item.linerMoldFee).toFixed(2), FIELD_COLOR.linerMoldFee)}
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-[#1A3C5E]"
                          title="编辑型号/材质"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                          title="删除"
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

      {/* ─── 导入结果报告弹窗 ─────────────────────────────────────────────────────── */}
      <Dialog open={showImportResult} onOpenChange={setShowImportResult}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              导入完成
            </DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              {/* 汇总 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.successCount}</div>
                  <div className="text-xs text-green-700 mt-0.5">成功导入</div>
                </div>
                <div className={`border rounded-lg p-3 text-center ${importResult.skippedCount > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className={`text-2xl font-bold ${importResult.skippedCount > 0 ? "text-amber-600" : "text-gray-400"}`}>{importResult.skippedCount}</div>
                  <div className={`text-xs mt-0.5 ${importResult.skippedCount > 0 ? "text-amber-700" : "text-gray-500"}`}>跳过行数</div>
                </div>
              </div>

              {/* 跳过明细 */}
              {importResult.skipped.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-amber-500" />
                    跳过明细（共 {importResult.skipped.length} 行）
                  </p>
                  <ScrollArea className="h-48 rounded-lg border border-amber-200 bg-amber-50">
                    <div className="p-3 space-y-1.5">
                      {importResult.skipped.map((row, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-amber-600 font-mono w-12 flex-shrink-0">第{row.rowIndex}行</span>
                          <span className="text-gray-600 flex-1">
                            {row.model ? <><span className="font-medium">{row.model}</span>{row.material ? ` (${row.material})` : ""} — </> : ""}
                            <span className="text-amber-700">{row.reason}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <p className="text-xs text-gray-500">
                系统已自动保存本次导入前的版本快照，可在「版本历史」中回滚。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-[#1A3C5E] hover:bg-[#15304d]" onClick={() => setShowImportResult(false)}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 版本历史弹窗 ─────────────────────────────────────────────────────────── */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#1A3C5E]" />
              版本历史
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              每次导入 Excel 或内联编辑后，系统会自动保存版本快照。点击「回滚」可恢复到该版本。
            </p>
            <ScrollArea className="h-80">
              {snapshots.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">暂无历史版本</div>
              ) : (
                <div className="space-y-2 pr-2">
                  {(snapshots as Snapshot[]).map((snap, idx) => (
                    <div
                      key={snap.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? "bg-[#1A3C5E] text-white" : "bg-gray-200 text-gray-600"}`}>
                          {idx === 0 ? "最新" : `V${snapshots.length - idx}`}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{snap.snapshotName}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {snap.createdByName} · {snap.itemCount} 条记录 · {new Date(snap.createdAt).toLocaleString("zh-CN")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {idx === 0 && (
                          <Badge variant="secondary" className="text-xs">当前版本</Badge>
                        )}
                        {idx > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 text-xs"
                            onClick={() => setRollbackId(snap.id)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            回滚
                          </Button>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistory(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 编辑/新增弹窗（型号+材质） ──────────────────────────────────────────── */}
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
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={editForm.boxPrice}
                  onChange={e => setEditForm(f => ({ ...f, boxPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>内衬开模费（元）</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={editForm.linerMoldFee}
                  onChange={e => setEditForm(f => ({ ...f, linerMoldFee: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>PU 内衬单价（元）</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={editForm.puPrice}
                  onChange={e => setEditForm(f => ({ ...f, puPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>EVA 内衬单价（元）</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={editForm.evaPrice}
                  onChange={e => setEditForm(f => ({ ...f, evaPrice: e.target.value }))} />
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

      {/* ─── 删除确认弹窗 ─────────────────────────────────────────────────────────── */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，确定要删除这条成本记录吗？</AlertDialogDescription>
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

      {/* ─── 回滚确认弹窗 ─────────────────────────────────────────────────────────── */}
      <AlertDialog open={rollbackId !== null} onOpenChange={open => { if (!open) setRollbackId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回滚</AlertDialogTitle>
            <AlertDialogDescription>
              回滚将用所选版本的数据替换当前全部成本表数据，操作前系统会自动保存当前版本快照。确定要回滚吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600"
              onClick={() => rollbackId !== null && rollbackMutation.mutate({ id: rollbackId })}
            >
              确认回滚
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
