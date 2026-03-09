import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import { useLocation, useParams } from "wouter";

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 将图片字段（可能是 JSON 字符串或数组）安全解析为 string[] */
function parseImages(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  in_production: "生产中",
  completed: "已完成",
  cancelled: "已取消",
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

function downloadOrderExcel(orderId: number) {
  const a = document.createElement("a");
  a.href = `/api/export/order/${orderId}`;
  a.download = `吟彩订单_${orderId}.xlsx`;
  a.click();
}

// 打印样式
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area {
    position: fixed !important;
    left: 0; top: 0;
    width: 100%; height: auto;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #print-area * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print { display: none !important; }
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }
}
`;

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

const tdLabel2: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  fontWeight: "bold",
  padding: "5px 8px",
  border: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  width: "70px",
  color: "#334155",
  fontSize: "10px",
};

const tdValue2: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #e2e8f0",
  fontSize: "10px",
  verticalAlign: "top",
};

const imgStyle: React.CSSProperties = {
  width: "120px",
  height: "90px",
  objectFit: "contain",
  border: "1px solid #eee",
  borderRadius: "3px",
  backgroundColor: "#fafafa",
};

const imgRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "6px",
};

// ── 子组件 ────────────────────────────────────────────────────────────────────

function ModelRow({ m, i }: { m: any; i: number }) {
  const stickerImgs = parseImages(m.stickerImages);
  const silkImgs = parseImages(m.silkPrintImages);
  const topLinerImgs = parseImages(m.topLinerImages);
  const bottomLinerImgs = parseImages(m.bottomLinerImages);
  const innerBoxImgs = parseImages(m.innerBoxImages);
  const outerBoxImgs = parseImages(m.outerBoxImages);

  return (
    <div style={{ marginBottom: "16px", border: "1px solid #ddd", borderRadius: "4px", overflow: "hidden" }}>
      {/* 型号标题行 */}
      <div style={{ backgroundColor: "#1A3C5E", color: "white", padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: "bold", fontSize: "12px" }}>
          {m.modelName || `型号 ${i + 1}`}
          {m.modelCode && <span style={{ fontSize: "10px", marginLeft: "8px", opacity: 0.8 }}>({m.modelCode})</span>}
        </span>
        <span style={{ fontSize: "11px" }}>数量：{m.quantity || "—"}</span>
      </div>

      {/* 型号明细表 */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
        <tbody>
          {/* 箱体 */}
          <tr>
            <td style={tdLabel2}>上盖材质</td>
            <td style={tdValue2}>{m.topCover || "—"}</td>
            <td style={tdLabel2}>下盖材质</td>
            <td style={tdValue2}>{m.bottomCover || "—"}</td>
            <td style={tdLabel2}>配件</td>
            <td style={tdValue2}>{m.accessories || "—"}</td>
          </tr>

          {/* 贴纸 */}
          <tr>
            <td style={tdLabel2}>贴纸描述</td>
            <td style={{ ...tdValue2 }} colSpan={5}>
              {m.needSticker ? (
                <div>
                  {m.stickerSource && (
                    <span style={{ color: "#1A3C5E", fontWeight: "bold", marginRight: "6px" }}>
                      [{m.stickerSource}]
                    </span>
                  )}
                  <span>{m.stickerDesc || "—"}</span>
                  {stickerImgs.length > 0 && (
                    <div style={imgRowStyle}>
                      {stickerImgs.map((url, idx) => (
                        <img key={idx} src={url} alt={`贴纸图${idx + 1}`} style={imgStyle} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span style={{ color: "#aaa", fontStyle: "italic" }}>不需要</span>
              )}
            </td>
          </tr>

          {/* 丝印 */}
          <tr>
            <td style={tdLabel2}>丝印描述</td>
            <td style={{ ...tdValue2 }} colSpan={5}>
              {m.needSilkPrint ? (
                <div>
                  <span>{m.silkPrintDesc || "—"}</span>
                  {silkImgs.length > 0 && (
                    <div style={imgRowStyle}>
                      {silkImgs.map((url, idx) => (
                        <img key={idx} src={url} alt={`丝印图${idx + 1}`} style={imgStyle} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span style={{ color: "#aaa", fontStyle: "italic" }}>不需要</span>
              )}
            </td>
          </tr>

          {/* 内衬 */}
          <tr>
            <td style={tdLabel2}>内衬描述</td>
            <td style={{ ...tdValue2 }} colSpan={5}>
              {m.needLiner ? (
                <div>
                  {(m.topLiner || m.bottomLiner) && (
                    <div style={{ marginBottom: "4px" }}>
                      {m.topLiner && <span>上盖：{m.topLiner}</span>}
                      {m.topLiner && m.bottomLiner && (
                        <span style={{ margin: "0 8px", color: "#ccc" }}>|</span>
                      )}
                      {m.bottomLiner && <span>下盖：{m.bottomLiner}</span>}
                    </div>
                  )}
                  {(topLinerImgs.length > 0 || bottomLinerImgs.length > 0) && (
                    <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                      {topLinerImgs.length > 0 && (
                        <div>
                          <div style={{ fontSize: "9px", color: "#888", marginBottom: "2px" }}>上盖内衬</div>
                          <div style={imgRowStyle}>
                            {topLinerImgs.map((url, idx) => (
                              <img key={idx} src={url} alt={`上盖内衬图${idx + 1}`} style={imgStyle} />
                            ))}
                          </div>
                        </div>
                      )}
                      {bottomLinerImgs.length > 0 && (
                        <div>
                          <div style={{ fontSize: "9px", color: "#888", marginBottom: "2px" }}>下盖内衬</div>
                          <div style={imgRowStyle}>
                            {bottomLinerImgs.map((url, idx) => (
                              <img key={idx} src={url} alt={`下盖内衬图${idx + 1}`} style={imgStyle} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span style={{ color: "#aaa", fontStyle: "italic" }}>不需要</span>
              )}
            </td>
          </tr>

          {/* 纸箱 */}
          {m.needCarton && (
            <tr>
              <td style={tdLabel2}>纸箱描述</td>
              <td style={{ ...tdValue2 }} colSpan={5}>
                <div>
                  {(m.innerBox || m.outerBox) && (
                    <div style={{ marginBottom: "4px" }}>
                      {m.innerBox && <span>内箱：{m.innerBox}</span>}
                      {m.innerBox && m.outerBox && (
                        <span style={{ margin: "0 8px", color: "#ccc" }}>|</span>
                      )}
                      {m.outerBox && <span>外箱：{m.outerBox}</span>}
                    </div>
                  )}
                  {(innerBoxImgs.length > 0 || outerBoxImgs.length > 0) && (
                    <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                      {innerBoxImgs.length > 0 && (
                        <div>
                          <div style={{ fontSize: "9px", color: "#888", marginBottom: "2px" }}>内箱图片</div>
                          <div style={imgRowStyle}>
                            {innerBoxImgs.map((url, idx) => (
                              <img key={idx} src={url} alt={`内箱图${idx + 1}`} style={imgStyle} />
                            ))}
                          </div>
                        </div>
                      )}
                      {outerBoxImgs.length > 0 && (
                        <div>
                          <div style={{ fontSize: "9px", color: "#888", marginBottom: "2px" }}>外箱图片</div>
                          <div style={imgRowStyle}>
                            {outerBoxImgs.map((url, idx) => (
                              <img key={idx} src={url} alt={`外箱图${idx + 1}`} style={imgStyle} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}

          {/* 型号备注 */}
          {m.modelRemarks && (
            <tr>
              <td style={tdLabel2}>型号备注</td>
              <td style={{ ...tdValue2 }} colSpan={5}>{m.modelRemarks}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function PrintPreview() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id);

  const { data: order, isLoading } = trpc.orders.get.useQuery(
    { id: orderId },
    { staleTime: 0 }  // 始终拉取最新数据
  );

  const handlePrint = () => {
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
      {/* 顶部操作栏 */}
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
        <div
          id="print-area"
          className="bg-white shadow-lg mx-auto"
          style={{ width: "794px", minHeight: "1123px", padding: "28px 32px", fontFamily: "'Noto Sans SC', '微软雅黑', sans-serif", fontSize: "11px", color: "#111" }}
        >
          {/* 标题 */}
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <h1 style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "'Noto Serif SC', serif", letterSpacing: "4px", margin: 0 }}>
              吟彩销售订单记录表
            </h1>
            <p style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>YINCAI SALES ORDER RECORD</p>
          </div>

          {/* 订单头部信息 */}
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
                <td style={tdLabel}>订单号</td>
                <td style={tdValue}>{order.orderNo || "—"}</td>
                <td style={tdLabel}>下单日期</td>
                <td style={tdValue}>{order.orderDate || "—"}</td>
                <td style={tdLabel}>预计交货</td>
                <td style={tdValue}>{order.deliveryDate || "—"}</td>
              </tr>
              <tr>
                <td style={tdLabel}>销售员</td>
                <td style={tdValue}>{order.salesperson || "—"}</td>
                <td style={tdLabel}>制单员</td>
                <td style={tdValue}>{order.maker || "—"}</td>
                <td style={tdLabel}>型号数量</td>
                <td style={tdValue}>{models.length} 个型号</td>
              </tr>
              <tr>
                <td style={tdLabel}>客户类型</td>
                <td style={tdValue}>
                  {(order as any).customerType === "overseas" ? (
                    <span style={{ color: "#1A3C5E", fontWeight: "bold" }}>「国外客户」</span>
                  ) : (
                    <span style={{ color: "#555" }}>「国内客户」</span>
                  )}
                </td>
                {(order as any).customerType === "overseas" ? (
                  <>
                    <td style={tdLabel}>报关状态</td>
                    <td style={{
                      ...tdValue,
                      backgroundColor: (order as any).customsDeclared ? "#fffbeb" : "#f8f8f8",
                      fontWeight: "bold",
                      color: (order as any).customsDeclared ? "#92400e" : "#555",
                    }} colSpan={3}>
                      {(order as any).customsDeclared === null ? "报关未标注" :
                       (order as any).customsDeclared ? "☑ 需要报关" : "☐ 无需报关"}
                    </td>
                  </>
                ) : (
                  <td style={tdValue} colSpan={4}>国内订单无需报关</td>
                )}
              </tr>
              <tr>
                <td style={tdLabel}>订单渠道</td>
                <td style={{ ...tdValue, borderRight: "1px solid #ccc" }} colSpan={5}>
                  {((order as any).isAlibaba || (order as any).is1688 || (order as any).isAmazon) ? (
                    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
                      {(order as any).isAlibaba && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: "#FF6A00",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 4,
                            WebkitPrintColorAdjust: "exact" as any,
                            printColorAdjust: "exact" as any,
                          }}>
                            阿里巴巴订单
                          </span>
                          {(order as any).alibabaOrderNo && (
                            <span style={{
                              fontSize: 12,
                              color: "#333",
                              backgroundColor: "#f3f4f6",
                              padding: "1px 6px",
                              borderRadius: 3,
                              WebkitPrintColorAdjust: "exact" as any,
                              printColorAdjust: "exact" as any,
                            }}>
                              {(order as any).alibabaOrderNo}
                            </span>
                          )}
                        </span>
                      )}
                      {(order as any).is1688 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: "#7C3AED",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 4,
                            WebkitPrintColorAdjust: "exact" as any,
                            printColorAdjust: "exact" as any,
                          }}>
                            1688订单
                          </span>
                          {(order as any).alibaba1688OrderNo && (
                            <span style={{
                              fontSize: 12,
                              color: "#333",
                              backgroundColor: "#f3f4f6",
                              padding: "1px 6px",
                              borderRadius: 3,
                              WebkitPrintColorAdjust: "exact" as any,
                              printColorAdjust: "exact" as any,
                            }}>
                              {(order as any).alibaba1688OrderNo}
                            </span>
                          )}
                        </span>
                      )}
                      {(order as any).isAmazon && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: "#1D6FA4",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 4,
                            WebkitPrintColorAdjust: "exact" as any,
                            printColorAdjust: "exact" as any,
                          }}>
                            亚马逊订单
                          </span>
                          {(order as any).amazonOrderNo && (
                            <span style={{
                              fontSize: 12,
                              color: "#333",
                              backgroundColor: "#f3f4f6",
                              padding: "1px 6px",
                              borderRadius: 3,
                              WebkitPrintColorAdjust: "exact" as any,
                              printColorAdjust: "exact" as any,
                            }}>
                              {(order as any).amazonOrderNo}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: "#666", fontSize: 12 }}>普通订单</span>
                  )}
                </td>
              </tr>
              {order.remarks && (
                <tr>
                  <td style={tdLabel}>备注</td>
                  <td style={{ ...tdValue, borderRight: "1px solid #ccc" }} colSpan={5}>{order.remarks}</td>
                </tr>
              )}
              {(order.recipientName || order.recipientPhone || order.recipientAddress || order.factoryShipNo) && (
                <>
                  <tr>
                    <td style={tdLabel}>收件人</td>
                    <td style={tdValue}>{order.recipientName || "—"}</td>
                    <td style={tdLabel}>收件电话</td>
                    <td style={tdValue}>{order.recipientPhone || "—"}</td>
                    <td style={tdLabel}>发货单号</td>
                    <td style={tdValue}>{order.factoryShipNo || "—"}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>收件地址</td>
                    <td style={{ ...tdValue, borderRight: "1px solid #ccc" }} colSpan={5}>{order.recipientAddress || "—"}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {/* 型号明细 */}
          {models.map((m: any, i: number) => (
            <ModelRow key={i} m={m} i={i} />
          ))}

          {/* 签名区域 */}
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

          {/* 页脚 */}
          <div style={{ marginTop: "16px", borderTop: "1px solid #eee", paddingTop: "8px", display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: "9px" }}>
            <span>吟彩销售订单系统 · 打印时间：{new Date().toLocaleString("zh-CN")}</span>
            <span>订单编号：#{orderId}</span>
          </div>
        </div>

        <div className="no-print text-center mt-4 text-xs text-gray-400">
          以上为打印预览效果，点击右上角「打印」按钮输出 A4 纸张
        </div>
      </div>
    </div>
  );
}
