import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import { useLocation, useParams } from "wouter";

// 状态标签
const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  in_production: "生产中",
  completed: "已完成",
  cancelled: "已取消",
};

function downloadOrderExcel(orderId: number) {
  const a = document.createElement("a");
  a.href = `/api/export/order/${orderId}`;
  a.download = `吟彩订单_${orderId}.xlsx`;
  a.click();
}

// 打印样式（注入到 <head>）
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area {
    position: fixed !important;
    left: 0; top: 0;
    width: 100%; height: auto;
  }
  .no-print { display: none !important; }
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }
}
`;

export default function PrintPreview() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id);

  const { data: order, isLoading } = trpc.orders.get.useQuery({ id: orderId });

  const handlePrint = () => {
    // 注入打印样式
    let styleEl = document.getElementById("print-preview-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "print-preview-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = PRINT_STYLE;
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <p className="text-gray-400 text-sm">订单不存在</p>
      </div>
    );
  }

  const models = order.models ?? [];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* 顶部操作栏（打印时隐藏） */}
      <header className="no-print bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-bold text-gray-900 text-base" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                打印预览
              </h1>
              <p className="text-xs text-gray-400">{order.orderDescription || "订单"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => downloadOrderExcel(orderId)} className="gap-2 text-sm">
              <FileDown className="w-4 h-4" />
              导出 Excel
            </Button>
            <Button onClick={handlePrint} className="bg-[#1A3C5E] hover:bg-[#15304d] gap-2 text-sm">
              <Printer className="w-4 h-4" />
              打印
            </Button>
          </div>
        </div>
      </header>

      {/* 预览区域 */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* A4 纸张模拟 */}
        <div
          id="print-area"
          className="bg-white shadow-lg mx-auto"
          style={{ width: "794px", minHeight: "1123px", padding: "28px 32px", fontFamily: "'Noto Sans SC', '微软雅黑', sans-serif", fontSize: "11px", color: "#111" }}
        >
          {/* ── 标题 ── */}
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <h1 style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "'Noto Serif SC', serif", letterSpacing: "4px", margin: 0 }}>
              吟彩销售订单记录表
            </h1>
            <p style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>YINCAI SALES ORDER RECORD</p>
          </div>

          {/* ── 订单头部信息 ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", fontSize: "11px" }}>
            <tbody>
              <tr>
                <td style={tdLabel}>订单描述</td>
                <td style={tdValue}>{order.orderDescription || "—"}</td>
                <td style={tdLabel}>客户名称</td>
                <td style={tdValue}>{order.customer || "—"}</td>
                <td style={tdLabel}>订单状态</td>
                <td style={tdValue}>
                  <span style={{ fontWeight: "bold", color: statusColor(order.status) }}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={tdLabel}>金蝶订单号</td>
                <td style={tdValue}>{order.orderNo || "—"}</td>
                <td style={tdLabel}>下单日期</td>
                <td style={tdValue}>{order.orderDate || "—"}</td>
                <td style={tdLabel}>预计交货</td>
                <td style={tdValue}>{order.deliveryDate || "—"}</td>
              </tr>
              <tr>
                <td style={tdLabel}>制单员</td>
                <td style={tdValue}>{order.maker || "—"}</td>
                <td style={tdLabel}>销售员</td>
                <td style={tdValue}>{order.salesperson || "—"}</td>
                <td style={tdLabel}>型号数量</td>
                <td style={tdValue}>{models.length} 个型号</td>
              </tr>
              {order.remarks && (
                <tr>
                  <td style={tdLabel}>备注</td>
                  <td style={{ ...tdValue, borderRight: "1px solid #ccc" }} colSpan={5}>{order.remarks}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── 型号明细表格 ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "#1A3C5E", color: "white" }}>
                <th style={th}>型号名称</th>
                <th style={th}>数量</th>
                <th style={th}>上盖材质</th>
                <th style={th}>下盖材质</th>
                <th style={th}>配件</th>
                <th style={th}>贴纸描述</th>
                <th style={th}>丝印描述</th>
                <th style={th}>内衬（上/下）</th>
                <th style={th}>纸箱（内/外）</th>
                <th style={th}>备注</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m: any, i: number) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                  <td style={td}>
                    <div style={{ fontWeight: "bold" }}>{m.modelName || `型号${i + 1}`}</div>
                    {m.modelCode && <div style={{ color: "#666", fontSize: "9px" }}>{m.modelCode}</div>}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{m.quantity || "—"}</td>
                  <td style={td}>{m.topCover || "—"}</td>
                  <td style={td}>{m.bottomCover || "—"}</td>
                  <td style={td}>{m.accessories || "—"}</td>
                  <td style={td}>
                    {m.needSticker
                      ? <span>{m.stickerSource ? `[${m.stickerSource}] ` : ""}{m.stickerDesc || "—"}</span>
                      : <span style={{ color: "#aaa", fontStyle: "italic" }}>不需要</span>
                    }
                  </td>
                  <td style={td}>
                    {m.needSilkPrint
                      ? <span>{m.silkPrintDesc || "—"}</span>
                      : <span style={{ color: "#aaa", fontStyle: "italic" }}>不需要</span>
                    }
                  </td>
                  <td style={td}>
                    {m.needLiner
                      ? <span>{[m.topLiner, m.bottomLiner].filter(Boolean).join(" / ") || "—"}</span>
                      : <span style={{ color: "#aaa", fontStyle: "italic" }}>不需要</span>
                    }
                  </td>
                  <td style={td}>
                    {m.needCarton
                      ? <span>{[m.innerBox, m.outerBox].filter(Boolean).join(" / ") || "—"}</span>
                      : <span style={{ color: "#aaa", fontStyle: "italic" }}>不需要</span>
                    }
                  </td>
                  <td style={td}>{m.modelRemarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── 签名区域 ── */}
          <div style={{ marginTop: "24px", borderTop: "1px solid #ddd", paddingTop: "12px" }}>
            <p style={{ fontSize: "10px", color: "#666", marginBottom: "10px", fontWeight: "bold" }}>各部门签名确认</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
              {["计划部", "仓库", "质检部", "生产部", "销售部"].map(dept => (
                <div key={dept} style={{ textAlign: "center" }}>
                  <div style={{ height: "40px", border: "1px dashed #ccc", borderRadius: "4px", marginBottom: "4px" }} />
                  <p style={{ fontSize: "9px", color: "#888" }}>{dept}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 页脚 ── */}
          <div style={{ marginTop: "16px", borderTop: "1px solid #eee", paddingTop: "8px", display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: "9px" }}>
            <span>吟彩销售订单系统 · 打印时间：{new Date().toLocaleString("zh-CN")}</span>
            <span>订单编号：#{orderId}</span>
          </div>
        </div>

        {/* 提示文字 */}
        <div className="no-print text-center mt-4 text-xs text-gray-400">
          以上为打印预览效果，点击右上角「打印」按钮输出 A4 纸张
        </div>
      </div>
    </div>
  );
}

// ── 样式常量 ──────────────────────────────────────────────────────────────────
const tdLabel: React.CSSProperties = {
  backgroundColor: "#f0f4f8",
  fontWeight: "bold",
  padding: "5px 8px",
  border: "1px solid #ccc",
  whiteSpace: "nowrap",
  width: "70px",
  color: "#1A3C5E",
};

const tdValue: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #ccc",
  minWidth: "100px",
};

const th: React.CSSProperties = {
  padding: "6px 6px",
  border: "1px solid #0f2a42",
  textAlign: "center",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  fontSize: "10px",
};

const td: React.CSSProperties = {
  padding: "5px 6px",
  border: "1px solid #ddd",
  verticalAlign: "top",
  lineHeight: "1.4",
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: "#64748b",
    submitted: "#d97706",
    in_production: "#ea580c",
    completed: "#16a34a",
    cancelled: "#dc2626",
  };
  return map[status] ?? "#111";
}
