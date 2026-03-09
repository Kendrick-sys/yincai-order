import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Search, FileDown, Pencil, Trash2,
  ClipboardList, Package, CheckCircle2, XCircle,
  Clock, Factory, ChevronRight, Copy, Printer,
  Users, Trash, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CalendarRange, Loader2, X, AlertTriangle, MessageSquare, Settings,
  User, Menu
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, KeyRound, ShieldCheck } from "lucide-react";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";

// ─── 关键词高亮组件 ────────────────────────────────────────────────────────────
function HighlightText({ text, keyword, className }: { text: string; keyword: string; className?: string }) {
  if (!keyword || !text) return <span className={className}>{text}</span>;
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKeyword);
  if (idx === -1) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic font-inherit">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </span>
  );
}

function downloadOrderExcel(orderId: number) {
  const a = document.createElement("a");
  a.href = `/api/export/order/${orderId}`;
  a.download = `吟彩订单_${orderId}.xlsx`;
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
  const { user, logout } = useAuth();
  const [search, setSearch]         = useState("");
  const [activeTab, setActiveTab]   = useState<StatusKey | "all">("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "alibaba" | "1688" | "amazon">("all");
  const [sortField, setSortField]   = useState<SortField>(null);
  const [sortDir, setSortDir]       = useState<SortDir>("asc");
  const [showMonthExport, setShowMonthExport] = useState(false);
  const [exportYear, setExportYear]   = useState(() => new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(() => new Date().getMonth() + 1);
  const [exporting, setExporting]     = useState(false);
  const [exportStatus, setExportStatus] = useState<string>("");

  // 读取 URL 参数 ?customer=xxx（从客户管理页跳转过来）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerParam = params.get("customer");
    if (customerParam) setSearch(customerParam);
  }, []);

  const utils = trpc.useUtils();
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery(
    undefined,
    { staleTime: 5_000 }
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

  // 搜索过滤（大小写不敏感）
  const searchFiltered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      (o.customer ?? "").toLowerCase().includes(q) ||
      (o.orderDescription ?? "").toLowerCase().includes(q) ||
      (o.orderNo ?? "").toLowerCase().includes(q) ||
      (o.alibabaOrderNo ?? "").toLowerCase().includes(q) ||
      (o.alibaba1688OrderNo ?? "").toLowerCase().includes(q) ||
      (o.amazonOrderNo ?? "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  // 渠道过滤
  const channelFiltered = useMemo(() => {
    if (channelFilter === "all") return searchFiltered;
    if (channelFilter === "alibaba") return searchFiltered.filter(o => o.isAlibaba);
    if (channelFilter === "1688")    return searchFiltered.filter(o => o.is1688);
    if (channelFilter === "amazon")  return searchFiltered.filter(o => o.isAmazon);
    return searchFiltered;
  }, [searchFiltered, channelFilter]);

  // Tab 过滤
  const tabFiltered = useMemo(() =>
    activeTab === "all"
      ? channelFiltered
      : channelFiltered.filter(o => o.status === activeTab),
    [channelFiltered, activeTab]
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
  const stats = useMemo(() => Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    count: searchFiltered.filter(o => o.status === key).length,
    dot: cfg.dot,
  })), [searchFiltered]);

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

  // 月导出面板内容（桌面端下拉 + 移动端 Sheet 共用）
  const MonthExportPanel = () => (
    <div className="p-4 w-full">
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
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">订单状态</label>
        <select
          value={exportStatus}
          onChange={e => setExportStatus(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3C5E]/30"
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="submitted">已提交</option>
          <option value="in_production">生产中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>
      <Button
        className="w-full bg-[#1A3C5E] hover:bg-[#15304d] gap-2 text-sm"
        disabled={exporting}
        onClick={async () => {
          setExporting(true);
          try {
            const statusParam = exportStatus ? `&status=${exportStatus}` : "";
            const res = await fetch(`/api/export/orders/monthly?year=${exportYear}&month=${exportMonth}${statusParam}`);
            if (!res.ok) {
              const err = await res.json();
              toast.error(err.error ?? "导出失败");
              return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const statusNames: Record<string, string> = {
              draft: "草稿", submitted: "已提交",
              in_production: "生产中", completed: "已完成", cancelled: "已取消"
            };
            const statusSuffix = exportStatus ? `_${statusNames[exportStatus] ?? exportStatus}` : "";
            a.download = `吟彩订单_${exportYear}年${exportMonth}月${statusSuffix}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            const statusLabel = exportStatus ? statusNames[exportStatus] ?? exportStatus : "全部";
            toast.success(`${exportYear}年${exportMonth}月「${statusLabel}」订单导出成功`);
            setShowMonthExport(false);
          } catch {
            toast.error("导出失败，请重试");
          } finally {
            setExporting(false);
          }
        }}
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        {exporting ? "导出中..." : `导出 ${exportYear}年${exportMonth}月${
          exportStatus ? `·${{ draft: "草稿", submitted: "已提交", in_production: "生产中", completed: "已完成", cancelled: "已取消" }[exportStatus] ?? exportStatus}` : ""
        }`}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275986025/MnhiE9LdbgqX24MUwA2SN8/logo-192_cb43ed67.png"
              alt="吟彩 Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="font-bold text-gray-900 text-base leading-tight" style={{ fontFamily: "'Noto Serif SC', serif" }}>吟彩销售订单系统</h1>
              <p className="text-xs text-gray-400">Sales Order Management</p>
            </div>
            <h1 className="sm:hidden font-bold text-gray-900 text-sm" style={{ fontFamily: "'Noto Serif SC', serif" }}>吟彩订单</h1>
          </div>

          {/* 桌面端操作区 */}
          <div className="hidden md:flex items-center gap-2">
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
                <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-64">
                  <MonthExportPanel />
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
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5 text-gray-500 border-gray-200 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30">
                <Settings className="w-3.5 h-3.5" />
                系统设置
              </Button>
            </Link>
            <Button onClick={() => navigate("/order/new")} className="bg-[#1A3C5E] hover:bg-[#15304d] gap-2">
              <Plus className="w-4 h-4" />
              新建订单
            </Button>
            {/* 用户下拉菜单 */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-gray-500 border-gray-200 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30">
                    <User className="w-3.5 h-3.5" />
                    <span className="max-w-[80px] truncate">{user.displayName ?? user.name ?? "用户"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <div className="px-3 py-2 text-xs text-slate-400">
                    {user.role === "admin" ? "管理员" : "业务员"}
                  </div>
                   <DropdownMenuSeparator />
                   {user.role === "admin" && (
                    <DropdownMenuItem onClick={() => navigate("/admin/users")} className="gap-2 cursor-pointer">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      账号管理
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/change-password")} className="gap-2 cursor-pointer">
                    <KeyRound className="w-3.5 h-3.5" />
                    修改密码
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="gap-2 cursor-pointer text-red-500 focus:text-red-500">
                    <LogOut className="w-3.5 h-3.5" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* 移动端操作区 */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              onClick={() => navigate("/order/new")}
              size="sm"
              className="bg-[#1A3C5E] hover:bg-[#15304d] gap-1.5 px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">新建</span>
            </Button>
            {/* 移动端汉堡菜单 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 border-gray-200">
                  <Menu className="w-4 h-4 text-gray-500" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  {/* 用户信息 */}
                  {user && (
                    <div className="px-4 py-4 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1A3C5E] flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{user.displayName ?? user.name ?? "用户"}</p>
                          <p className="text-xs text-gray-400">{user.role === "admin" ? "管理员" : "业务员"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* 菜单项 */}
                  <nav className="flex-1 px-3 py-3 space-y-1">
                    <button
                      onClick={() => setShowMonthExport(v => !v)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 text-left"
                    >
                      <CalendarRange className="w-4 h-4 text-gray-400" />
                      按月导出 Excel
                    </button>
                    {showMonthExport && (
                      <div className="mx-1 border border-gray-200 rounded-xl overflow-hidden">
                        <MonthExportPanel />
                      </div>
                    )}
                    <Link href="/trash">
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 text-left">
                        <Trash className="w-4 h-4 text-gray-400" />
                        回收站
                      </button>
                    </Link>
                    <Link href="/customers">
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 text-left">
                        <Users className="w-4 h-4 text-gray-400" />
                        客户管理
                      </button>
                    </Link>
                    <Link href="/settings">
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 text-left">
                        <Settings className="w-4 h-4 text-gray-400" />
                        系统设置
                      </button>
                    </Link>
                    {user?.role === "admin" && (
                      <button
                        onClick={() => navigate("/admin/users")}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 text-left"
                      >
                        <ShieldCheck className="w-4 h-4 text-gray-400" />
                        账号管理
                      </button>
                    )}
                    <button
                      onClick={() => navigate("/change-password")}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 text-left"
                    >
                      <KeyRound className="w-4 h-4 text-gray-400" />
                      修改密码
                    </button>
                  </nav>
                  {/* 退出登录 */}
                  <div className="px-3 py-3 border-t border-gray-100">
                    <button
                      onClick={() => logout()}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* 状态统计卡片（点击可筛选）：移动端 2 列，桌面端 5 列 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          {stats.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveTab(prev => prev === s.key ? "all" : s.key as StatusKey)}
              className={`bg-white rounded-xl border px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm text-left transition-all duration-150
                ${activeTab === s.key
                  ? "border-[#1A3C5E] ring-1 ring-[#1A3C5E]/20"
                  : "border-gray-100 hover:border-gray-200"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className="text-xs text-gray-500 truncate">{s.label}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-800">{s.count}</p>
            </button>
          ))}
        </div>

        {/* 搜索栏 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <Input
            placeholder="搜索客户、订单描述、订单号..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 状态筛选 Tab + 渠道筛选 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-2 sm:px-3 py-2">
          {/* 移动端：横向滚动 Tab */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {STATUS_TABS.map(tab => {
              const count = tab.key === "all"
                ? channelFiltered.length
                : channelFiltered.filter(o => o.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex-shrink-0
                    ${activeTab === tab.key
                      ? "bg-[#1A3C5E] text-white"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                >
                  {tab.label}
                  <span className={`text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-normal
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
            {/* 渠道筛选下拉 */}
            <div className="ml-auto flex-shrink-0 pl-1">
              <select
                value={channelFilter}
                onChange={e => setChannelFilter(e.target.value as typeof channelFilter)}
                className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1A3C5E]/30 transition-colors ${
                  channelFilter !== "all"
                    ? "border-[#1A3C5E] text-[#1A3C5E] bg-[#1A3C5E]/5 font-medium"
                    : "border-gray-200 text-gray-500 bg-white"
                }`}
              >
                <option value="all">全部渠道</option>
                <option value="alibaba">阿里巴巴</option>
                <option value="1688">1688</option>
                <option value="amazon">亚马逊</option>
              </select>
            </div>
          </div>
          {/* 排序提示 */}
          {sortField && (
            <div className="flex items-center gap-1.5 text-xs text-[#1A3C5E] mt-1.5 pt-1.5 border-t border-gray-50">
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
          {/* 桌面端表头（含可排序列）：md 以上显示 */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_220px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>订单信息</span>
            <span className="text-center">客户</span>
            <SortableHeader label="下单日期" field="orderDate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <SortableHeader label="交货日期" field="deliveryDate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <span className="text-center">制单员</span>
            <SortableHeader label="状态" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
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

                // 交货日期预警：生产中且交货日期≤7天
                const deliveryDiffDays = (() => {
                  if (order.status !== "in_production" || !order.deliveryDate) return null;
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const delivery = new Date(order.deliveryDate); delivery.setHours(0, 0, 0, 0);
                  return Math.ceil((delivery.getTime() - today.getTime()) / 86400000);
                })();
                const isOverdue = deliveryDiffDays !== null && deliveryDiffDays < 0;
                const isUrgent  = deliveryDiffDays !== null && deliveryDiffDays >= 0 && deliveryDiffDays <= 7;

                const urgencyClass = isOverdue
                  ? "bg-red-50/60 border-l-4 border-l-red-400"
                  : isUrgent
                    ? "bg-orange-50/60 border-l-4 border-l-orange-400"
                    : "";

                return (
                  <div key={order.id}>
                    {/* ── 桌面端行（md 以上） ── */}
                    <div className={`hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_220px] gap-4 px-6 py-4 items-center transition-colors ${urgencyClass} ${!isOverdue && !isUrgent ? "hover:bg-gray-50/50" : ""}`}>
                      {/* 订单信息 */}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-gray-800 text-sm leading-tight">
                            <HighlightText text={order.orderDescription || "（未填写描述）"} keyword={search} />
                          </p>
                          {order.isAlibaba && (
                            <span className="text-xs font-medium text-[#CC4400] bg-[#FFF0E6] px-1.5 py-0.5 rounded flex-shrink-0">阿里巴巴</span>
                           )}
                           {order.is1688 && (
                             <span className="text-xs font-medium text-[#6D28D9] bg-[#F5F3FF] px-1.5 py-0.5 rounded flex-shrink-0">1688</span>
                           )}
                           {order.isAmazon && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[#1D6FA4] bg-[#EFF6FF] px-1.5 py-0.5 rounded flex-shrink-0">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.1 17 7 17h11v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H18c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 22.46 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                              亚马逊
                            </span>
                          )}
                          {order.customerType === "overseas" && order.customsDeclared && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-white bg-orange-500 px-1.5 py-0.5 rounded flex-shrink-0">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                              </svg>
                              报关
                            </span>
                          )}
                          {order.remarks && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-default flex-shrink-0">
                                  <MessageSquare className="w-3.5 h-3.5 text-gray-400 hover:text-[#1A3C5E] transition-colors" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                                <p className="font-medium text-foreground mb-1">备注</p>
                                <p className="text-muted-foreground whitespace-pre-wrap">{order.remarks}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {order.orderNo ? <>订单号：<HighlightText text={order.orderNo} keyword={search} /></> : ""}
                        </p>
                      </div>
                      {/* 客户 */}
                      <span className="text-sm text-gray-600 text-center">
                        {order.customer ? <HighlightText text={order.customer} keyword={search} /> : "—"}
                      </span>
                      {/* 下单日期 */}
                      <span className={`text-sm text-center ${sortField === "orderDate" ? "text-[#1A3C5E] font-medium" : "text-gray-600"}`}>
                        {order.orderDate || "—"}
                      </span>
                      {/* 交货日期 */}
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm text-center ${isOverdue ? "text-red-600 font-semibold" : isUrgent ? "text-orange-600 font-semibold" : sortField === "deliveryDate" ? "text-[#1A3C5E] font-medium" : "text-gray-600"}`}>
                          {order.deliveryDate || "—"}
                        </span>
                        {isOverdue && (
                          <span className="text-xs text-red-500 flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />已超期
                          </span>
                        )}
                        {!isOverdue && isUrgent && (
                          <span className="text-xs text-orange-500 flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />还剩{deliveryDiffDays}天
                          </span>
                        )}
                      </div>
                      {/* 制单员 */}
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm text-gray-600 text-center">{order.maker || "—"}</span>
                        {order.creatorIsActive === false && (
                          <span className="text-xs text-red-400">（已离职）</span>
                        )}
                      </div>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#1A3C5E]" onClick={() => navigate(`/order/${order.id}/view`)} title="预览">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#1A3C5E]" onClick={() => navigate(`/order/${order.id}/edit`)} title="编辑">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-purple-600" onClick={() => navigate(`/order/${order.id}/print`)} title="打印预览">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => handleDuplicate(order.id, order.orderDescription ?? "")} title="复制订单" disabled={duplicateMutation.isPending}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-green-600" onClick={() => downloadOrderExcel(order.id)} title="导出 Excel">
                          <FileDown className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => handleDelete(order.id, order.orderDescription ?? "")} title="删除">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* ── 移动端卡片（md 以下） ── */}
                    <div className={`md:hidden px-4 py-3 transition-colors ${urgencyClass}`}>
                      {/* 第一行：订单描述 + 状态 */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-gray-800 text-sm leading-tight">
                              <HighlightText text={order.orderDescription || "（未填写描述）"} keyword={search} />
                            </p>
                            {order.isAlibaba && (
                              <span className="text-xs font-medium text-[#CC4400] bg-[#FFF0E6] px-1 py-0.5 rounded">阿里</span>
                             )}
                             {order.is1688 && (
                               <span className="text-xs font-medium text-[#6D28D9] bg-[#F5F3FF] px-1 py-0.5 rounded">1688</span>
                             )}
                             {order.isAmazon && (
                              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[#1D6FA4] bg-[#EFF6FF] px-1 py-0.5 rounded">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.1 17 7 17h11v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H18c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 22.46 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                                亚马逊
                              </span>
                            )}
                            {order.customerType === "overseas" && order.customsDeclared && (
                              <span className="text-xs font-semibold text-white bg-orange-500 px-1 py-0.5 rounded">报关</span>
                            )}
                          </div>
                          {order.orderNo && (
                            <p className="text-xs text-gray-400 mt-0.5">订单号：<HighlightText text={order.orderNo} keyword={search} /></p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Badge className={`text-xs border ${statusCfg.color}`} variant="outline">
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </div>

                      {/* 第二行：客户 + 日期信息 */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 flex-wrap">
                        {order.customer && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <HighlightText text={order.customer} keyword={search} />
                          </span>
                        )}
                        {order.orderDate && (
                          <span>下单：{order.orderDate}</span>
                        )}
                        {order.deliveryDate && (
                          <span className={isOverdue ? "text-red-500 font-semibold" : isUrgent ? "text-orange-500 font-semibold" : ""}>
                            交货：{order.deliveryDate}
                            {isOverdue && " ⚠ 已超期"}
                            {!isOverdue && isUrgent && ` ⚠ 还剩${deliveryDiffDays}天`}
                          </span>
                        )}
                        {order.maker && (
                          <span>制单：{order.maker}</span>
                        )}
                      </div>

                      {/* 第三行：操作按钮 + 推进状态 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#1A3C5E]" onClick={() => navigate(`/order/${order.id}/view`)} title="预览">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#1A3C5E]" onClick={() => navigate(`/order/${order.id}/edit`)} title="编辑">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-purple-600" onClick={() => navigate(`/order/${order.id}/print`)} title="打印预览">
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => handleDuplicate(order.id, order.orderDescription ?? "")} title="复制" disabled={duplicateMutation.isPending}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => handleDelete(order.id, order.orderDescription ?? "")} title="删除">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {next && (
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: order.id, status: next })}
                            className="text-xs text-[#1A3C5E] hover:underline flex items-center gap-0.5 flex-shrink-0"
                          >
                            推进至{STATUS_CONFIG[next].label}
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
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
