/**
 * Settings.tsx
 * 系统设置页面 - 单据编号前缀配置
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings as SettingsIcon, FileText, ArrowLeft, Save, RotateCcw, Info, Package, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

// ─── 默认前缀 ──────────────────────────────────────────────────────────────────
const DEFAULT_PREFIXES = {
  contract_cn: "HT",
  pi: "PI",
  ci: "CI",
};

// ─── 主组件 ────────────────────────────────────────────────────────────────────

export default function Settings() {
  usePageTitle("系统设置");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: savedPrefixes, isLoading, refetch } = trpc.settings.getDocPrefixes.useQuery();

  const [prefixes, setPrefixes] = useState({
    contract_cn: DEFAULT_PREFIXES.contract_cn,
    pi: DEFAULT_PREFIXES.pi,
    ci: DEFAULT_PREFIXES.ci,
  });
  const [isDirty, setIsDirty] = useState(false);

  // 加载已保存的前缀
  useEffect(() => {
    if (savedPrefixes) {
      setPrefixes({
        contract_cn: savedPrefixes.contract_cn ?? DEFAULT_PREFIXES.contract_cn,
        pi: savedPrefixes.pi ?? DEFAULT_PREFIXES.pi,
        ci: savedPrefixes.ci ?? DEFAULT_PREFIXES.ci,
      });
      setIsDirty(false);
    }
  }, [savedPrefixes]);

  const saveMutation = trpc.settings.saveDocPrefixes.useMutation({
    onSuccess: () => {
      toast.success("设置已保存");
      setIsDirty(false);
      refetch();
    },
    onError: (err) => {
      toast.error(`保存失败：${err.message}`);
    },
  });

  const handleChange = (key: keyof typeof prefixes, value: string) => {
    // 只允许字母、数字、连字符
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 16);
    setPrefixes(prev => ({ ...prev, [key]: sanitized }));
    setIsDirty(true);
  };

  const handleReset = () => {
    setPrefixes({ ...DEFAULT_PREFIXES });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!prefixes.contract_cn || !prefixes.pi || !prefixes.ci) {
      toast.error("前缀不能为空");
      return;
    }
    saveMutation.mutate(prefixes);
  };

  // 预览编号示例
  const today = new Date();
  const ym = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
  const exampleNos = {
    contract_cn: `${prefixes.contract_cn}-${ym}-001`,
    pi: `${prefixes.pi}-${ym}-001`,
    ci: `${prefixes.ci}-${ym}-001`,
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-[#1A3C5E]">
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
            </Link>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1A3C5E] flex items-center justify-center">
                <SettingsIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-[#1A3C5E] text-base leading-tight">系统设置</h1>
                <p className="text-xs text-gray-400">吟彩销售订单系统</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-gray-500"
              onClick={handleReset}
              disabled={saveMutation.isPending}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复默认
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-[#1A3C5E] hover:bg-[#15304d]"
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
            >
              <Save className="w-3.5 h-3.5" />
              {saveMutation.isPending ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* 单据编号前缀设置 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <div className="w-1 h-6 rounded-full bg-[#1A3C5E] flex-shrink-0" />
            <FileText className="w-5 h-5 text-[#1A3C5E]" />
            <div>
              <h2 className="font-semibold text-gray-800 text-base">单据编号前缀</h2>
              <p className="text-xs text-gray-400 mt-0.5">自定义合同、PI、CI 的编号前缀，将影响所有新生成的单据</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* 说明 */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 space-y-0.5">
                <p>编号格式为：<strong>前缀-年月-序号</strong>，例如 <code className="bg-blue-100 px-1 rounded">HT-202503-001</code></p>
                <p>前缀仅支持大写字母、数字和连字符（-），最多 16 个字符。修改后仅影响新生成的单据，历史单据不受影响。</p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* 国内采购合同 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      国内采购合同前缀
                    </Label>
                    <p className="text-xs text-gray-400">用于国内供应商采购合同（中文版）</p>
                    <Input
                      value={prefixes.contract_cn}
                      onChange={e => handleChange("contract_cn", e.target.value)}
                      placeholder="如：HT"
                      className="h-9 font-mono uppercase"
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-1.5 pt-0 md:pt-7">
                    <Label className="text-xs text-gray-400">编号预览</Label>
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-dashed border-gray-200 bg-gray-50">
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-mono">
                        {exampleNos.contract_cn}
                      </Badge>
                      <span className="text-xs text-gray-400">（示例）</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* PI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      PI 形式发票前缀
                    </Label>
                    <p className="text-xs text-gray-400">用于出口形式发票（Proforma Invoice）</p>
                    <Input
                      value={prefixes.pi}
                      onChange={e => handleChange("pi", e.target.value)}
                      placeholder="如：PI"
                      className="h-9 font-mono uppercase"
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-1.5 pt-0 md:pt-7">
                    <Label className="text-xs text-gray-400">编号预览</Label>
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-dashed border-gray-200 bg-gray-50">
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 font-mono">
                        {exampleNos.pi}
                      </Badge>
                      <span className="text-xs text-gray-400">（示例）</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* CI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      CI 商业发票前缀
                    </Label>
                    <p className="text-xs text-gray-400">用于出口商业发票（Commercial Invoice）</p>
                    <Input
                      value={prefixes.ci}
                      onChange={e => handleChange("ci", e.target.value)}
                      placeholder="如：CI"
                      className="h-9 font-mono uppercase"
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-1.5 pt-0 md:pt-7">
                    <Label className="text-xs text-gray-400">编号预览</Label>
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-dashed border-gray-200 bg-gray-50">
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 font-mono">
                        {exampleNos.ci}
                      </Badge>
                      <span className="text-xs text-gray-400">（示例）</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部保存按钮 */}
        {isDirty && (
          <div className="flex justify-end gap-3 pb-4">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              恢复默认
            </Button>
            <Button
              className="bg-[#1A3C5E] hover:bg-[#15304d] gap-2"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "保存中..." : "保存设置"}
            </Button>
          </div>
        )}
        {/* 型号成本管理入口（仅管理员） */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-1 h-6 rounded-full bg-[#1A3C5E] flex-shrink-0" />
              <Package className="w-5 h-5 text-[#1A3C5E]" />
              <div>
                <h2 className="font-semibold text-gray-800 text-base">型号成本管理</h2>
                <p className="text-xs text-gray-400 mt-0.5">管理吟彩→亿丰采购单价表，支持 Excel 导入/导出，用于采购合同自动填价</p>
              </div>
            </div>
            <div className="p-6">
              <Link href="/admin/cost-items">
                <Button className="gap-2 bg-[#1A3C5E] hover:bg-[#15304d]">
                  <Package className="w-4 h-4" />
                  进入型号成本管理
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
