// 吟彩销售订单系统 - 主页面
// 设计风格：清爽商务风 | 深蓝靛色主色调 + 暖灰底色
// 布局：左侧固定进度导航 + 右侧分节卡片式填写

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ClipboardList, Package, Tag, Printer, Layers, Archive,
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Download, RotateCcw, Eye, Save, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OrderFormData, defaultOrderForm, STEPS } from '@/lib/orderTypes';
import { printOrder } from '@/lib/orderExport';

const STEP_ICONS = [ClipboardList, Package, Tag, Printer, Layers, Archive, Eye];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-sm font-medium text-foreground/80 mb-1 block">
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </Label>
  );
}

function SectionCard({ title, children, icon: Icon }: {
  title: string;
  children: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
        <div className="w-1 h-6 rounded-full bg-primary flex-shrink-0" />
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground text-base" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          {title}
        </h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function GridRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {children}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState<OrderFormData>(defaultOrderForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const update = (field: keyof OrderFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const goToStep = (idx: number) => {
    setCurrentStep(idx);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(currentStep);
    setCompletedSteps(newCompleted);
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) goToStep(currentStep - 1);
  };

  const handleReset = () => {
    if (confirm('确定要清空所有填写内容吗？')) {
      setForm(defaultOrderForm);
      setCompletedSteps(new Set());
      setCurrentStep(0);
      toast.success('已清空所有内容');
    }
  };

  const handleSaveDraft = () => {
    try {
      localStorage.setItem('yincai_order_draft', JSON.stringify(form));
      toast.success('草稿已保存到本地');
    } catch {
      toast.error('保存失败');
    }
  };

  const handleLoadDraft = () => {
    try {
      const draft = localStorage.getItem('yincai_order_draft');
      if (draft) {
        setForm(JSON.parse(draft));
        toast.success('草稿已加载');
      } else {
        toast.info('暂无保存的草稿');
      }
    } catch {
      toast.error('加载失败');
    }
  };

  const handlePrint = (version: 'yincai' | 'factory') => {
    if (!form.orderDescription && !form.customer) {
      toast.warning('请至少填写订单描述和客户信息');
      return;
    }
    printOrder(form, version);
    toast.success(`${version === 'yincai' ? '吟彩版' : '厂部版'}订单已发送到打印机`);
  };

  const isStepCompleted = (idx: number) => completedSteps.has(idx);

  const getCompletionCount = () => {
    const fields = [
      form.orderDescription, form.customer, form.quantity, form.deliveryDate,
      form.topCover, form.bottomCover,
      form.stickerDesc,
      form.topLiner, form.bottomLiner,
      form.innerBox, form.outerBox,
    ];
    return fields.filter(f => f && f.trim()).length;
  };

  const totalFields = 11;
  const completionPct = Math.round((getCompletionCount() / totalFields) * 100);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 左侧导航栏 */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        {/* Logo区域 */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm" style={{ fontFamily: "'Noto Serif SC', serif" }}>吟</span>
            </div>
            <div>
              <p className="font-semibold text-sidebar-foreground text-sm leading-tight">吟彩</p>
              <p className="text-xs text-sidebar-foreground/60 leading-tight">销售订单系统</p>
            </div>
          </div>
        </div>

        {/* 填写进度 */}
        <div className="px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-sidebar-foreground/60">填写进度</span>
            <span className="text-xs font-semibold text-sidebar-primary">{completionPct}%</span>
          </div>
          <div className="h-1.5 bg-sidebar-border rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-sidebar-primary rounded-full"
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* 步骤列表 */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {STEPS.map((step, idx) => {
            const Icon = STEP_ICONS[idx];
            const isActive = currentStep === idx;
            const isDone = isStepCompleted(idx);
            return (
              <button
                key={step.id}
                onClick={() => goToStep(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 text-sm
                  ${isActive
                    ? 'bg-sidebar-primary text-white font-medium'
                    : isDone
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
              >
                {isDone && !isActive
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-400" />
                  : <Icon className="w-4 h-4 flex-shrink-0" />
                }
                <span className="flex-1 truncate">{step.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* 底部操作 */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-sidebar-foreground border-sidebar-border bg-transparent hover:bg-sidebar-accent text-xs"
            onClick={handleSaveDraft}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            保存草稿
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-sidebar-foreground border-sidebar-border bg-transparent hover:bg-sidebar-accent text-xs"
            onClick={handleLoadDraft}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            加载草稿
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-sidebar-border bg-transparent hover:bg-destructive/10 text-xs"
            onClick={handleReset}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            清空重填
          </Button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        {/* 顶部标题栏 */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-8 py-4 flex items-center justify-between no-print">
          <div>
            <h1 className="font-bold text-foreground text-lg" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              销售订单记录表
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {STEPS[currentStep].label} · 第 {currentStep + 1} / {STEPS.length} 步
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              已填 {getCompletionCount()} / {totalFields} 项
            </Badge>
          </div>
        </div>

        {/* 表单内容区 */}
        <div className="px-8 py-6 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* 步骤0：基本信息 */}
              {currentStep === 0 && (
                <SectionCard title="基本信息" icon={ClipboardList}>
                  <div className="space-y-4">
                    <GridRow>
                      <div>
                        <FieldLabel required>订单描述</FieldLabel>
                        <Input
                          placeholder="请输入订单描述，如：安卡手提箱"
                          value={form.orderDescription}
                          onChange={e => update('orderDescription', e.target.value)}
                        />
                      </div>
                      <div>
                        <FieldLabel required>客户名称</FieldLabel>
                        <Input
                          placeholder="请输入客户名称"
                          value={form.customer}
                          onChange={e => update('customer', e.target.value)}
                        />
                      </div>
                    </GridRow>
                    <GridRow>
                      <div>
                        <FieldLabel required>数量</FieldLabel>
                        <Input
                          placeholder="请输入数量，如：1000"
                          value={form.quantity}
                          onChange={e => update('quantity', e.target.value)}
                        />
                      </div>
                      <div>
                        <FieldLabel required>预计交货日期</FieldLabel>
                        <Input
                          type="date"
                          value={form.deliveryDate}
                          onChange={e => update('deliveryDate', e.target.value)}
                        />
                      </div>
                    </GridRow>
                    <Separator />
                    <GridRow>
                      <div>
                        <FieldLabel>制单员</FieldLabel>
                        <Input
                          placeholder="请输入制单员姓名"
                          value={form.maker}
                          onChange={e => update('maker', e.target.value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>销售员</FieldLabel>
                        <Input
                          placeholder="请输入销售员姓名"
                          value={form.salesperson}
                          onChange={e => update('salesperson', e.target.value)}
                        />
                      </div>
                    </GridRow>
                    <GridRow>
                      <div>
                        <FieldLabel>金蝶系统订单号</FieldLabel>
                        <Input
                          placeholder="请输入金蝶系统订单号"
                          value={form.orderNo}
                          onChange={e => update('orderNo', e.target.value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>下单日期</FieldLabel>
                        <Input
                          type="date"
                          value={form.orderDate}
                          onChange={e => update('orderDate', e.target.value)}
                        />
                      </div>
                    </GridRow>
                    <div>
                      <FieldLabel>备注</FieldLabel>
                      <Textarea
                        placeholder="如有特殊要求请在此说明..."
                        value={form.remarks}
                        onChange={e => update('remarks', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* 步骤1：箱体描述 */}
              {currentStep === 1 && (
                <SectionCard title="一、箱体描述" icon={Package}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
                          <span className="w-5 h-5 bg-primary/10 text-primary rounded text-xs flex items-center justify-center font-bold">上</span>
                          上盖
                        </p>
                        <Input
                          placeholder="如：PP料，黑色"
                          value={form.topCover}
                          onChange={e => update('topCover', e.target.value)}
                        />
                      </div>
                      <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
                          <span className="w-5 h-5 bg-primary/10 text-primary rounded text-xs flex items-center justify-center font-bold">下</span>
                          下盖
                        </p>
                        <Input
                          placeholder="如：PP料，黑色"
                          value={form.bottomCover}
                          onChange={e => update('bottomCover', e.target.value)}
                        />
                      </div>
                    </div>
                    <Separator />
                    <p className="text-sm font-semibold text-foreground/70">配件信息</p>
                    <GridRow>
                      <div>
                        <FieldLabel>塑料配件</FieldLabel>
                        <Input
                          placeholder="如：PP，黑色"
                          value={form.plasticParts}
                          onChange={e => update('plasticParts', e.target.value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>金属配件</FieldLabel>
                        <Input
                          placeholder="如：铝合金，银色"
                          value={form.metalParts}
                          onChange={e => update('metalParts', e.target.value)}
                        />
                      </div>
                    </GridRow>
                  </div>
                </SectionCard>
              )}

              {/* 步骤2：贴纸描述 */}
              {currentStep === 2 && (
                <SectionCard title="二、贴纸描述" icon={Tag}>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>贴纸来源</FieldLabel>
                      <div className="flex gap-3 mt-1">
                        {[
                          { value: 'customer', label: '客户提供' },
                          { value: 'factory', label: '按实际来料验货' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => update('stickerSource', opt.value)}
                            className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all duration-150
                              ${form.stickerSource === opt.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>贴纸描述</FieldLabel>
                      <Textarea
                        placeholder="请描述贴纸内容，如：效果图，每个编码各一张"
                        value={form.stickerDesc}
                        onChange={e => update('stickerDesc', e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div>
                      <FieldLabel>数量说明</FieldLabel>
                      <Input
                        placeholder="如：每个编码各一张"
                        value={form.stickerQty}
                        onChange={e => update('stickerQty', e.target.value)}
                      />
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* 步骤3：丝印描述（仅吟彩版） */}
              {currentStep === 3 && (
                <SectionCard title="三、丝印描述" icon={Printer}>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-accent/50 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        此项仅在<strong className="text-foreground">吟彩版</strong>订单中显示，厂部版不包含丝印描述。
                      </p>
                    </div>
                    <div>
                      <FieldLabel>丝印描述</FieldLabel>
                      <Textarea
                        placeholder="请详细描述丝印内容、位置、颜色等信息..."
                        value={form.silkPrintDesc}
                        onChange={e => update('silkPrintDesc', e.target.value)}
                        rows={6}
                      />
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* 步骤4：内衬描述 */}
              {currentStep === 4 && (
                <SectionCard title="四、内衬描述" icon={Layers}>
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold text-foreground/70 mb-3">第一组内衬</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-foreground/70 flex items-center gap-2">
                            <span className="w-5 h-5 bg-primary/10 text-primary rounded text-xs flex items-center justify-center font-bold">上</span>
                            上盖内衬
                          </p>
                          <Textarea
                            placeholder="请描述上盖内衬材质、颜色等"
                            value={form.topLiner}
                            onChange={e => update('topLiner', e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-foreground/70 flex items-center gap-2">
                            <span className="w-5 h-5 bg-primary/10 text-primary rounded text-xs flex items-center justify-center font-bold">下</span>
                            下盖内衬
                          </p>
                          <Textarea
                            placeholder="请描述下盖内衬材质、颜色等"
                            value={form.bottomLiner}
                            onChange={e => update('bottomLiner', e.target.value)}
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold text-foreground/70 mb-3">第二组内衬（如有）</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-foreground/70 flex items-center gap-2">
                            <span className="w-5 h-5 bg-primary/10 text-primary rounded text-xs flex items-center justify-center font-bold">上</span>
                            上盖内衬（二）
                          </p>
                          <Textarea
                            placeholder="可选填"
                            value={form.topLiner2}
                            onChange={e => update('topLiner2', e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-foreground/70 flex items-center gap-2">
                            <span className="w-5 h-5 bg-primary/10 text-primary rounded text-xs flex items-center justify-center font-bold">下</span>
                            下盖内衬（二）
                          </p>
                          <Textarea
                            placeholder="可选填"
                            value={form.bottomLiner2}
                            onChange={e => update('bottomLiner2', e.target.value)}
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* 步骤5：纸箱描述 */}
              {currentStep === 5 && (
                <SectionCard title="五、纸箱描述" icon={Archive}>
                  <div className="space-y-4">
                    <GridRow>
                      <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-semibold text-foreground/70">内箱</p>
                        <Textarea
                          placeholder="请描述内箱规格、材质等"
                          value={form.innerBox}
                          onChange={e => update('innerBox', e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-semibold text-foreground/70">外箱</p>
                        <Textarea
                          placeholder="请描述外箱规格、材质等"
                          value={form.outerBox}
                          onChange={e => update('outerBox', e.target.value)}
                          rows={4}
                        />
                      </div>
                    </GridRow>
                  </div>
                </SectionCard>
              )}

              {/* 步骤6：预览 & 导出 */}
              {currentStep === 6 && (
                <div className="space-y-5">
                  {/* 信息汇总 */}
                  <SectionCard title="订单信息汇总" icon={Eye}>
                    <div className="space-y-4">
                      {/* 基本信息 */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">基本信息</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { label: '订单描述', value: form.orderDescription },
                            { label: '客户', value: form.customer },
                            { label: '数量', value: form.quantity },
                            { label: '预计交货', value: form.deliveryDate },
                            { label: '制单员', value: form.maker },
                            { label: '销售员', value: form.salesperson },
                            { label: '金蝶订单号', value: form.orderNo },
                            { label: '下单日期', value: form.orderDate },
                          ].map(item => (
                            <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                              <p className={`text-sm font-medium ${item.value ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                                {item.value || '未填写'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      {/* 箱体信息 */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">箱体描述</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: '上盖', value: form.topCover },
                            { label: '下盖', value: form.bottomCover },
                            { label: '塑料配件', value: form.plasticParts },
                            { label: '金属配件', value: form.metalParts },
                          ].map(item => (
                            <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                              <p className={`text-sm font-medium ${item.value ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                                {item.value || '未填写'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      {/* 其他信息 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">贴纸描述</p>
                          <p className={`text-sm ${form.stickerDesc ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                            {form.stickerDesc || '未填写'}
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">丝印描述（吟彩版）</p>
                          <p className={`text-sm ${form.silkPrintDesc ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                            {form.silkPrintDesc || '未填写'}
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">内箱</p>
                          <p className={`text-sm ${form.innerBox ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                            {form.innerBox || '未填写'}
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">外箱</p>
                          <p className={`text-sm ${form.outerBox ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                            {form.outerBox || '未填写'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  {/* 导出操作 */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                      <div className="w-1 h-6 rounded-full bg-primary flex-shrink-0" />
                      <Download className="w-5 h-5 text-primary" />
                      <h2 className="font-semibold text-foreground text-base" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                        打印 & 导出
                      </h2>
                    </div>
                    <div className="p-6">
                      <p className="text-sm text-muted-foreground mb-5">
                        系统将自动生成两份版本的订单。<strong>吟彩版</strong>包含丝印描述，<strong>厂部版</strong>不含丝印但包含贴纸来料说明。
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          onClick={() => handlePrint('yincai')}
                          className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all duration-200"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                            <Printer className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-foreground text-sm">打印吟彩版</p>
                            <p className="text-xs text-muted-foreground mt-0.5">含丝印描述，发给吟彩内部</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handlePrint('factory')}
                          className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all duration-200"
                        >
                          <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-muted/80 flex items-center justify-center transition-colors">
                            <Archive className="w-6 h-6 text-muted-foreground group-hover:text-foreground" />
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-foreground text-sm">打印厂部版</p>
                            <p className="text-xs text-muted-foreground mt-0.5">不含丝印，发给生产厂部</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 签名区域 */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                      <div className="w-1 h-6 rounded-full bg-primary flex-shrink-0" />
                      <h2 className="font-semibold text-foreground text-base" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                        各部门签名确认
                      </h2>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['计划部', '仓库', '质检部', '生产部'].map(dept => (
                          <div key={dept} className="flex flex-col items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">{dept}签名</p>
                            <div className="w-full h-14 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                              <span className="text-xs text-muted-foreground/40">签名区域</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        打印后在对应区域手写签名
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* 底部导航按钮 */}
          <div className="flex items-center justify-between mt-8 pb-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              上一步
            </Button>
            <div className="flex items-center gap-2">
              {STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToStep(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-200
                    ${idx === currentStep ? 'bg-primary w-6' : isStepCompleted(idx) ? 'bg-primary/40' : 'bg-border'}`}
                />
              ))}
            </div>
            {currentStep < STEPS.length - 1 ? (
              <Button onClick={nextStep} className="gap-2">
                下一步
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={() => handlePrint('yincai')}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Printer className="w-4 h-4" />
                立即打印
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
