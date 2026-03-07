import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, FileDown, Pencil, Trash2,
  ClipboardList, Package, CheckCircle2, XCircle,
  Clock, Factory, ChevronRight, Copy, Printer,
  Users, Trash, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CalendarRange, Loader2, X
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

function downloadOrderExcel(orderId: number) {
  const a = document.createElement("a");
  a.href = `/api/export/order/${orderId}`;
  a.download = `吟彩订单_${orderId}.xlsx`;
  a.click();
}

function downloadMonthlyExcel(year: number, month: number) {
  const a = document.createElement("a");
  a.href = `/api/export/orders/monthly?year=${year}&month=${month}`;
  a.download = `吟彩订单_${year}年${month}月.xlsx`;
  a.click();
}

// 状态配置
const STATUS_CONFIG = {
  draft:         { label: "草稿",   color: "bg-slate-100 text-slate-600 border-slate-200",    icon: Clock,         dot: "bg-slate-400",  order: 0 },
  submitted:     { label: "已提交", color: "bg-amber-100 text-amber-700 border-amber-200",    icon: ClipboardList, dot: "bg-amber-400",  order: 1 },
  in_production: { label: "生产中", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Factory,       dot: "bg-orange-400", order: 2 },
  completed:     { label: "已完成", color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle2,  dot: "bg-green-500",  order: 3 },
  cancelled:     { label: "已取消", color: "bg-red-100 text-red-600 border-red-200",          icon: XCircle,       dot: "bg-red-400",    order: 4 },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

// 排序字段类型
type SortField = "deliveryDate" | "orderDate" | "status" | null;
type SortDir   = "asc" | "desc";

// 状态筛选 Tab
const STATUS_TABS: Array<{ key: StatusKey | "all"; label: string }> = [
  { key: "all",           label: "全部" },
  { key: "draft",         label: "草稿" },
  { key: "submitted",     label: "已提交" },
  { key: "in_production", label: "生产中" },
  { key: "completed",     label: "已完成" },
  { key: "cancelled",     label: "已取消" },
];

// 可排序表头组件
function SortableHeader({
  label, field, sortField, sortDir, onSort,
  className = "",
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center justify-center gap-1 group select-none ${className}`}
    >
      <span className={active ? "text-[#1A3C5E]" : ""}>{label}</span>
      {active
        ? sortDir === "asc"
          ? <ArrowUp className="w-3 h-3 text-[#1A3C5E]" />
          : <ArrowDown className="w-3 h-3 text-[#1A3C5E]" />
        : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
      }
    </button>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState<StatusKey | "all">("all");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir]     = useState<SortDir>("asc");
  const [showMonthExport, setShowMonthExport] = useState(false);
  const [exportYear, setExportYear]   = useState(() => new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(() => new Date().getMonth() + 1);
  const [exporting, setExporting]     = useState(false);

  // 读取 URL 参数 ?customer=xxx（从客户管理页跳转过来）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerParam = params.get("customer");
    if (customerParam) setSearch(customerParam);
  }, []);

  const utils = trpc.useUtils();
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery(
    undefined,
    { staleTime: 30_000 }
  );

  const deleteMutation = trpc.orders.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.orders.list.cancel();
      const prev = utils.orders.list.getData();
      utils.orders.list.setData(undefined, old => old?.filter(o => o.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.orders.list.setData(undefined, ctx.prev);
      toast.error("删除失败，请重试");
    },
    onSuccess: () => { toast.success("订单已移入回收站"); utils.orders.list.invalidate(); },
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.orders.list.cancel();
      const prev = utils.orders.list.getData();
      utils.orders.list.setData(undefined, old => old?.map(o => o.id === id ? { ...o, status } : o));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.orders.list.setData(undefined, ctx.prev);
      toast.error("状态更新失败");
    },
    onSuccess: () => { toast.success("状态已更新"); utils.orders.list.invalidate(); },
  });

  const duplicateMutation = trpc.orders.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success("订单已复制，正在跳转编辑...");
      utils.orders.list.invalidate();
      navigate(`/order/${data.id}/edit`);
    },
    onError: () => toast.error("复制失败，请重试"),
  });

  // 处理排序点击：同字段切换方向，不同字段重置为升序
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // 搜索过滤
  const searchFiltered = useMemo(() =>
    orders.filter(o =>
      !search ||
      (o.customer ?? "").includes(search) ||
      (o.orderDescription ?? "").includes(search) ||
      (o.orderNo ?? "").includes(search)
    ),
    [orders, search]
  );

  // Tab 过滤
  const tabFiltered = useMemo(() =>
    activeTab === "all"
      ? searchFiltered
      : searchFiltered.filter(o => o.status === activeTab),
    [searchFiltered, activeTab]
  );

  // 排序
  const filtered = useMemo(() => {
    if (!sortField) return tabFiltered;
    return [...tabFiltered].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortField === "deliveryDate") {
        av = a.deliveryDate ?? "";
        bv = b.deliveryDate ?? "";
      } else if (sortField === "orderDate") {
        av = a.orderDate ?? "";
        bv = b.orderDate ?? "";
      } else if (sortField === "status") {
        av = STATUS_CONFIG[a.status as StatusKey]?.order ?? 99;
        bv = STATUS_CONFIG[b.status as StatusKey]?.order ?? 99;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [tabFiltered, sortField, sortDir]);

  // 统计（基于搜索结果，不受 Tab 影响）
  const stats = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    count: searchFiltered.filter(o => o.status === key).length,
    dot: cfg.dot,
  }));

  const handleDelete = (id: number, desc: string) => {
    if (!confirm(`确定要删除订单「${desc || id}」吗？此操作不可恢复。`)) return;
    deleteMutation.mutate({ id });
  };

  const handleDuplicate = (id: number, desc: string) => {
    if (!confirm(`确定要复制订单「${desc || id}」吗？将生成一份草稿副本。`)) return;
    duplicateMutation.mutate({ id });
  };

  const nextStatus: Record<StatusKey, StatusKey | null> = {
    draft: "submitted",
    submitted: "in_production",
    in_production: "completed",
    completed: null,
    cancelled: null,
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1A3C5E] flex items-center justify-center">
              <span className="text-white font-bold text-sm" style={{ fontFamily: "'Noto Serif SC', serif" }}>吟</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-tight" style={{ fontFamily: "'Noto Serif SC', serif" }}>吟彩销售订单系统</h1>
              <p className="text-xs text-gray-400">Sales Order Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 按月导出面板 */}
            <div className="relative">
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-gray-500 border-gray-200 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30"
                onClick={() => setShowMonthExport(v => !v)}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                按月导出
              </Button>
              {showMonthExport && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">选择导出年月</p>
                    <button onClick={() => setShowMonthExport(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">年份</label>
                      <select
                        value={exportYear}
                        onChange={e => setExportYear(Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3C5E]/30"
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                          <option key={y} value={y}>{y}年</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">月份</label>
                      <select
                        value={exportMonth}
                        onChange={e => setExportMonth(Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3C5E]/30"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{m}月</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-[#1A3C5E] hover:bg-[#15304d] gap-2 text-sm"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const res = await fetch(`/api/export/orders/monthly?year=${exportYear}&month=${exportMonth}`);
                        if (!res.ok) {
                          const err = await res.json();
                          toast.error(err.error ?? "导出失败");
                          return;
                        }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `吟彩订单_${exportYear}年${exportMonth}月.xlsx`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success(`${exportYear}年${exportMonth}月订单导出成功`);
                        setShowMonthExport(false);
                      } catch {
                        toast.error("导出失败，请重试");
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    {exporting ? "导出中..." : `导出 ${exportYear}年${exportMonth}月`}
                  </Button>
                </div>
              )}
            </div>
            <Link href="/trash">
              <Button variant="outline" size="sm" className="gap-1.5 text-gray-500 border-gray-200 hover:text-red-500 hover:border-red-200">
                <Trash className="w-3.5 h-3.5" />
                回收站
              </Button>
            </Link>
            <Link href="/customers">
              <Button variant="outline" size="sm" className="gap-1.5 text-gray-500 border-gray-200 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30">
                <Users className="w-3.5 h-3.5" />
                客户管理
              </Button>
            </Link>
            <Button onClick={() => navigate("/order/new")} className="bg-[#1A3C5E] hover:bg-[#15304d] gap-2">
              <Plus className="w-4 h-4" />
              新建订单
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {/* 状态统计卡片（点击可筛选） */}
        <div className="grid grid-cols-5 gap-3">
          {stats.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveTab(prev => prev === s.key ? "all" : s.key as StatusKey)}
              className={`bg-white rounded-xl border px-4 py-3 shadow-sm text-left transition-all duration-150
                ${activeTab === s.key
                  ? "border-[#1A3C5E] ring-1 ring-[#1A3C5E]/20"
                  : "border-gray-100 hover:border-gray-200"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{s.count}</p>
            </button>
          ))}
        </div>

        {/* 搜索栏 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <Input
            placeholder="搜索客户名称、订单描述、订单号..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
              清除
            </button>
          )}
        </div>

        {/* 状态筛选 Tab */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2">
          {STATUS_TABS.map(tab => {
            const count = tab.key === "all"
              ? searchFiltered.length
              : searchFiltered.filter(o => o.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${activeTab === tab.key
                    ? "bg-[#1A3C5E] text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal
                  ${activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {/* 排序提示 */}
          {sortField && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-[#1A3C5E]">
              <span>
                按{sortField === "deliveryDate" ? "交货日期" : sortField === "orderDate" ? "下单日期" : "状态"}
                {sortDir === "asc" ? "升序" : "降序"}
              </span>
              <button
                onClick={() => { setSortField(null); setSortDir("asc"); }}
                className="text-gray-400 hover:text-gray-600 underline"
              >
                清除
              </button>
            </div>
          )}
        </div>

        {/* 订单列表 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* 表头（含可排序列） */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_220px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>订单信息</span>
            <span className="text-center">客户</span>
            <SortableHeader
              label="交货日期"
              field="deliveryDate"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <span className="text-center">制单员</span>
            <SortableHeader
              label="状态"
              field="status"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <span className="text-center">操作</span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {search
                  ? `没有找到「${search}」的相关订单`
                  : activeTab !== "all"
                    ? `暂无「${STATUS_CONFIG[activeTab as StatusKey]?.label}」状态的订单`
                    : "暂无订单，点击「新建订单」开始"}
              </p>
              {(search || activeTab !== "all") && (
                <button
                  onClick={() => { setSearch(""); setActiveTab("all"); }}
                  className="mt-2 text-xs text-[#1A3C5E] hover:underline"
                >
                  清除筛选条件
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(order => {
                const statusCfg = STATUS_CONFIG[order.status as StatusKey] ?? STATUS_CONFIG.draft;
                const next = nextStatus[order.status as StatusKey];
                return (
                  <div key={order.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_220px] gap-4 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors">
                    {/* 订单信息 */}
                    <div>
                      <p className="font-medium text-gray-800 text-sm leading-tight">
                        {order.orderDescription || "（未填写描述）"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.orderNo ? `订单号：${order.orderNo}` : ""}
                        {order.orderNo && order.orderDate ? "  ·  " : ""}
                        {order.orderDate ? `下单：${order.orderDate}` : ""}
                      </p>
                    </div>
                    {/* 客户 */}
                    <span className="text-sm text-gray-600 text-center">{order.customer || "—"}</span>
                    {/* 交货日期 */}
                    <span className={`text-sm text-center ${sortField === "deliveryDate" ? "text-[#1A3C5E] font-medium" : "text-gray-600"}`}>
                      {order.deliveryDate || "—"}
                    </span>
                    {/* 制单员 */}
                    <span className="text-sm text-gray-600 text-center">{order.maker || "—"}</span>
                    {/* 状态 */}
                    <div className="flex flex-col gap-1 items-center">
                      <Badge className={`text-xs border ${statusCfg.color}`} variant="outline">
                        {statusCfg.label}
                      </Badge>
                      {next && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: next })}
                          className="text-xs text-[#1A3C5E] hover:underline flex items-center gap-0.5"
                        >
                          推进至{STATUS_CONFIG[next].label}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {/* 操作 */}
                    <div className="flex items-center gap-1 justify-center">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-[#1A3C5E]"
                        onClick={() => navigate(`/order/${order.id}/view`)}
                        title="预览"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-[#1A3C5E]"
                        onClick={() => navigate(`/order/${order.id}/edit`)}
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-purple-600"
                        onClick={() => navigate(`/order/${order.id}/print`)}
                        title="打印预览"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-blue-600"
                        onClick={() => handleDuplicate(order.id, order.orderDescription ?? "")}
                        title="复制订单"
                        disabled={duplicateMutation.isPending}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-green-600"
                        onClick={() => downloadOrderExcel(order.id)}
                        title="导出 Excel"
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                        onClick={() => handleDelete(order.id, order.orderDescription ?? "")}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
