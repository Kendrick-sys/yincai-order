# 吟彩订单系统 TODO

- [x] 订单列表页（状态统计、搜索、增删改）
- [x] 订单录入页（多型号、模块化开关）
- [x] 数据库持久化（orders + order_models 表）
- [x] 订单状态管理（草稿→提交→生产→完成）
- [x] 导出 Excel（吟彩版 + 厂部版）

## 新功能

- [x] 客户名称改为下拉选择框，预设常用客户
- [x] 订单复制功能（一键复制已有订单）
- [x] 打印预览页面（网页内查看打印效果）

## 新功能（第二批）

- [x] 客户管理页面（增删改预设客户列表）
- [x] 型号图片上传（内衬CAD/贴纸/丝印图片，每个型号独立）
- [x] 订单回收站（软删除 + 恢复 + 彻底删除）
- [x] 「金蝶订单号」改名为「订单号」

## 新功能（第三批）

- [x] Excel 标题去掉“（吴彩版）”
- [x] Excel「金蝶订单号」改为「订单号」
- [x] Excel 导出时嵌入型号图片（贴纸/丝印/内衬）
- [x] 系统订单号格式改为 ODYC-YYYYMMDD-001
- [x] 订单描述 placeholder 去掉示例文字
- [x] 配件 placeholder 改为“如：304不锈钉铰链”
- [x] 丝印描述（吴彩版）改为丝印描述
- [x] 客户管理：客户编码→客户地址

## 新功能（第四批）

- [x] 数据库增加收件人姓名/电话/地址/工厂发货单号字段
- [x] 前端 OrderForm 增加收件人信息区块
- [x] Excel 底部增加收件人/发货单号信息行
- [x] Excel 图片嵌入到对应列（贴纸→贴纸列，丝印→丝印列，内衬→内衬列）
- [x] Excel 图片行高自适应/多行排列
- [x] 贴纸来源「按实际来料验货」改为「外部采购」
- [x] 系统性能优化（查询缓存、懒加载）

## 新功能（第五批）

- [x] 订单列表表头文字居中对齐
- [x] PDF 打印「金蝶订单号」→「订单号」
- [x] PDF 打印嵌入贴纸/丝印/内衬图片
- [x] 新增订单只读预览页面 OrderView.tsx

## Bug 修复

- [x] PrintPreview/OrderView 图片字段 JSON 解析错误（stickerImages.map is not a function）

## 新功能（第六批）

- [x] 修复订单列表表头与数据列对齐错位
- [x] 全面代码审查和性能优化

## 新功能（第七批）

- [x] 数据库 customers 表增加 country/email 字段
- [x] 数据库 orders 表增加 isNewCustomer 字段
- [x] 后端 customerSchema 增加 country/email 必填验证
- [x] 后端 orderHeaderSchema 增加 isNewCustomer 字段
- [x] 前端 Customers.tsx：国家（国内/国外）、邮箱必填、一键导出 Excel
- [x] 前端 OrderForm.tsx：客户必填下拉选择、新老客户选项
- [x] 后端增加客户 Excel 导出路由 /api/export/customers
- [x] 代码审查和性能优化

## 新功能（第八批）

- [x] 后端 db.ts 增加客户订单统计查询（历史订单数、最近下单日期）
- [x] 后端 routers.ts customers.list 返回统计字段
- [x] 前端 Customers.tsx 展示订单数量和最近下单日期
- [x] 全面代码审查和性能优化

## 新功能（第九批）

- [x] 客户管理：历史订单数点击跳转到该客户筛选的订单列表
- [x] 订单列表：增加状态筛选 Tab（全部/草稿/已提交/生产中/已完成）
- [x] 代码审查和性能优化

## 新功能（第十批）

- [x] 订单列表表头增加排序功能（交货日期、下单日期、状态）
- [x] 订单表单客户名称改为可搜索的 Combobox 下拉选择
- [x] 代码审查和性能优化

## 新功能（第十一批）

- [x] Combobox 下拉列表中客户名称旁显示邮箱（替换联系人）
- [x] 客户管理：选择「国外」时地址字段变为必填（前端 + 后端）
- [x] 代码审查和性能优化

## 新功能（第十二批）

- [x] 客户档案 Excel 导出增加「国内/国外」列
- [x] 代码审查和性能优化

## 新功能（第十三批）

- [x] 数据库 orders 表增加 customsDeclared 字段（是否报关）
- [x] 订单表单：国外客户时显示「是否报关」选项
- [x] 订单 Excel 客户信息行增加国内/国外标注及报关信息
- [x] 主页增加按年月批量导出订单 Excel 功能
- [x] 代码审查和性能优化

## 新功能（第十四批）

- [x] 后端按月导出增加 status 参数筛选（全部/草稿/已提交/生产中/已完成/已取消）
- [x] 前端按月导出面板增加状态筛选下拉选择
- [x] 订单列表交货日期预警（≤7天的「生产中」订单高亮显示）
- [x] 代码审查和性能优化

## 新功能（第十五批）

- [x] 订单列表行增加备注悬停 Tooltip 预览
- [x] 改善订单预览页面各描述区块的视觉层次（字号、标题、内容区分）
- [x] 代码审查和性能优化

## 新功能（第十六批）

- [x] 单个订单 Excel：删除厂部版工作表，只保留一个工作表，改名为「吟彩销售订单记录表」，增加是否报关标注
- [x] 按月导出 Excel：删除所有厂部版工作表，改为3个汇总工作表（全部/国内/国外），清晰标注是否报关
- [x] 代码审查和性能优化

## 新功能（第十七批）

- [x] 按月导出Excel三个汇总工作表底部增加总计行（总订单数 + 各型号销售数量汇总）
- [x] 按月导出Excel汇总表支持Excel自动筛选功能（AutoFilter）
- [x] 订单列表表格增加「下单日期」列，确保数据正确显示
- [x] 单个订单Excel导出清晰标注是否报关（独立字段行）
- [x] PDF打印预览清晰标注是否报关
- [x] 代码审查和性能优化

## 新功能（第十八批）

- [x] 修复单个订单Excel：信息行（行2/行3）合并单元格与列标题行对齐，消除错位
- [x] 取消单个订单Excel和按月汇总 Excel的所有AutoFilter筛选功能
- [x] 按月汇总表增加「数量」列，底部合计行汇总总件数
- [x] 代码审查和性能优化

## 新功能（第十九批）

- [x] 按月导出Excel增加第4工作表「型号数量明细」，统计当月所有订单中每种型号的总量
- [x] 代码审查和性能优化

## 新功能（第二十批）

- [x] 型号数量明细工作表增加「国内数量」和「国外数量」两列
- [x] 数据库 orders 表增加 isAlibaba（boolean）和 alibabaOrderNo（varchar）字段并迁移
- [x] 订单表单增加「是否阿里巴巴订单」开关，选是则显示阿里巴巴订单号输入框
- [x] 单个订单Excel导出标注阿里巴巴信息
- [x] PDF打印预览标注阿里巴巴信息
- [x] 按月汇总 Excel增加阿里巴巴列
- [x] 代码审查和性能优化

## 新功能（第二十一批）
- [x] 阿里巴巴订单号改为必填（选择阿里巴巴订单时，订单号不能为空）
- [x] 后端 tRPC schema 增加阿里巴巴订单号必填校验
- [x] 订单列表为「国外+需要报关」订单增加醒目的橙色标记

## 新功能（第二十二批）

- [x] 订单列表搜索框支持阿里巴巴订单号模糊搜索
- [x] 优化 OrderView.tsx 订单渠道区域阿里巴巴 UI 样式（当前文字被截断、布局不美观）
- [x] 代码审查和性能优化

## 新功能（第二十三批）

- [x] PrintPreview.tsx 阿里巴巴订单号和标签样式与 OrderView.tsx 保持一致

## 新功能（第二十四批）

- [x] 数据库增加 is1688 和 alibaba1688OrderNo 字段并迁移
- [x] 订单表单增加「1688渠道」开关和订单号输入（与阿里巴巴同级）
- [x] 修复 PDF 打印预览：标签颜色使用 -webkit-print-color-adjust 确保打印，等宽字体改为与页面一致的字体
- [x] 订单详情页/列表/Excel/月汇总表同步支持1688渠道展示
- [x] 代码审查和性能优化

## 新功能（第二十五批）

- [x] 订单渠道选择改为单选：普通订单 / 阿里巴巴 / 1688，选一个自动取消另一个

## 新功能（第二十六批）

- [x] 数据库增加 isAmazon/amazonOrderNo 字段并迁移
- [x] 1688渠道颜色改为紫色，亚马逊渠道（蓝色）全链路支持
- [x] 订单表单：四选一单选（普通/阿里巴巴/1688/亚马逊）
- [x] 订单列表：亚马逊蓝色徽章，渠道筛选下拉菜单
- [x] 订单详情/PDF打印预览：同步亚马逊渠道展示
- [x] Excel导出：单个订单和月汇总增加亚马逊渠道，月汇总增加阿里巴巴/1688/亚马逊独立工作表
- [x] 代码审查和性能优化

## 新功能（第二十七批）

- [x] 亚马逊渠道不需要填写订单号：移除后端必填验证，订单号输入框改为可选

## 新功能（第二十八批）

- [x] 修复 Excel 导出中销售员重复显示的 bug（第2行右侧改为销售员，第3行右侧改为制单员，第4行右侧改为订单号）
- [x] 代码审查和性能优化

## 新功能（第二十九批）

- [x] PDF 打印预览：调整销售员/制单员显示顺序与 Excel 一致（销售员在上，制单员在下）
- [x] 月汇总 Excel：将“销售员”列移到“制单员”列前面

## 新功能（第三十批）

- [x] 月汇总 Excel 亚马逊独立工作表已存在，修复工作表标题中的「吹彩」错别字，全部统一为「吴彩」
- [x] 代码审查和性能优化

## 新功能（第三十一批：合同/PI/CI单据生成）

- [x] 公司信息存入环境变量（中英文、银行账户）
- [x] 数据库新增 documents 表（合同/PI/CI记录）
- [x] 后端：PDF生成逻辑（国内采购合同中文 + PI/CI英文）
- [x] 后端：tRPC路由（创建/查询/下载单据）
- [x] 前端：订单详情页「生成单据」按钮 + 弹窗表单
- [x] 前端：历史单据列表（可重新下载）
- [x] 代码审查和性能优化

## 新功能（第三十二批）

- [x] 数据库 documents 表增加 status 字段（active/voided）
- [x] 数据库新增 settings 表（存储编号前缀等系统配置）
- [x] 后端：tRPC documents.void 路由（作废单据）
- [x] 后端：tRPC settings.getDocPrefixes / settings.saveDocPrefixes 路由
- [x] 后端：generateDocNo 改为读取 settings 表中的前缀
- [x] 前端：DocumentHistory 增加「作废」按钮，已作废单据显示灰色删除线
- [x] 前端：DocumentDialog CI Tab 增加「从PI创建」选项，选择后自动填充数据
- [x] 前端：设置页面新增「单据编号前缀」配置表单
- [x] 代码审查和性能优化

## 新功能（第三十三批）
- [x] 数据库 documents 表增加 version 字段（默认为1，重新生成时+1）
- [x] 后端：tRPC documents.regenerate 路由（重新生成PDF，版本号+1）
- [x] 后端：ZIP批量导出路由（/api/export/documents/:orderId/zip）
- [x] 数据库 order_models 表增加 boxImages 字段（纸箱图片JSON数组）
- [x] 后端：orderModels schema 增加 boxImages 字段支持
- [x] 前端：DocumentHistory 增加「重新生成」按钮
- [x] 前端：DocumentHistory 显示版本号标签
- [x] 前端：OrderView.tsx 历史单据区域展示 PI→CI 关联关系
- [x] 前端：OrderView.tsx 增加「批量下载ZIP」按钮
- [x] 前端：OrderForm.tsx 纸箱描述区域增加图片上传组件
- [x] 前端：OrderView.tsx/PrintPreview.tsx 同步展示纸箱图片
- [x] 代码审查和性能优化

## 新功能（第三十四批）

- [x] 数据库 order_models 表：linerImages 拆分为 topLinerImages / bottomLinerImages
- [x] 数据库 order_models 表：boxImages 拆分为 innerBoxImages / outerBoxImages
- [x] 后端 routers.ts：modelSchema 同步更新字段
- [x] 前端 OrderForm.tsx：内衬区域拆分为上盖/下盖两个 ImageUploader
- [x] 前端 OrderForm.tsx：纸箱区域拆分为内箱/外箱两个 ImageUploader
- [x] 前端 OrderView.tsx：内衬/纸箱图片展示同步拆分
- [x] Excel 导出：内衬列拆分为「上盖内衬图片」「下盖内衬图片」两列
- [x] Excel 导出：纸箱列拆分为「内箱图片」「外箱图片」两列
- [x] Excel 导出：修复「内筱」「外筱」错别字 → 「内箱」「外箱」
- [x] PDF 打印预览：内衬图片拆分为上盖/下盖展示
- [x] PDF 打印预览：纸箱图片拆分为内箱/外箱展示
- [x] 全局错别字修复（内筱→内箱，外筱→外箱）
- [x] 代码审查和性能优化

## 新功能（第三十五批）

- [x] Excel 吱彩销售订单记录表：冻结前4行（标题+订单信息+客户信息+列标题）

## 新功能（第三十六批）

- [x] 生成单据弹窗扩大：w-[90vw] max-w-5xl max-h-[92vh]，提升阅读和编辑舒适性

## 新功能（第三十七批）

- [x] DocumentDialog.tsx：国内合同甲乙方调换（客户=甲方/采购方，吹彩=乙方/供货方）
- [x] DocumentDialog.tsx：国内合同去掉交货时间字段
- [x] DocumentDialog.tsx：「产品明细（请填写单价）」改为「箱子明细（请填写单价）」
- [x] DocumentDialog.tsx：产品名称改为下拉选择（塑料工具箱 / 其他-手动输入）
- [x] DocumentDialog.tsx：材质改为下拉选择（PP / ABS）
- [x] DocumentDialog.tsx：规格改为「型号」，与材质列互换（型号在第2列读取产品名称，材质在第3列）
- [x] DocumentDialog.tsx：增加「是否开票」选项（勾选框，勾选后合同中注明开票要求）
- [x] DocumentDialog.tsx：弹窗扩大为 w-[95vw] max-w-6xl
- [x] generatePdf.ts：合同 PDF 同步调换甲乙方标签
- [x] generatePdf.ts：合同 PDF 去掉交货时间
- [x] generatePdf.ts：合同 PDF 列顺序调整（型号在前，材质在后）
- [x] generatePdf.ts：合同 PDF 增加开票信息展示（尾款条款动态显示）
- [x] 代码审查和性能优化

## 新功能（第三十八批）

- [x] 乙方公司名称改为：深圳市吹彩新型材料制品有限公司（即 COMPANY_CN_NAME 环境变量）
- [x] 产品名称默认值：塑料工具箱；材质默认值：PP
- [x] 新增内衬明细模块（材质下拉：PU/EPE/XPE/EVA，描述/数量/单价/金额）
- [x] 新增内衬定制模板费用（数量/单价/金额）
- [x] 新增是否定制LOGO选项（材质下拉：PVC/滴胶/PC/鄧射/金属拉丝，描述/数量/单价/金额）—鄧射即 Laser
- [x] 新增是否定制丝印选项（描述/数量/单价/金额）
- [x] 新增丝印定制模板费用（数量/单价/金额）
- [x] 新增是否定制颜色选项（定制颜色费用：数量/单价/金额）
- [x] 新增物流运费（金额）
- [x] 总价 = 箱子合计 + 内衬 + 内衬模板 + LOGO + 丝印 + 丝印模板 + 颜色 + 运费（精确浮点计算）
- [x] 勾选开票时总价 × 1.13（含税价）
- [x] generatePdf.ts 同步所有新增明细项（内衬/LOGO/丝印/颜色/运费行）
- [x] routers.ts tRPC schema 同步新字段（extras zod schema）
- [x] TypeScript 0 错误，10 个测试全部通过，数学算法验证正确

## 新功能（第三十九批）

- [x] 「定制颜色费用」改为「定制颜色费」
- [x] 「一、箱子明细（请填写单价）」改为「一、产品明细（请填写单价）」
- [x] 材质下拉增加「其他」选项（可手动输入，与产品名称逻辑一致）
- [x] 优化 ExtraFeeRow UI：标题分离头部区域、flex自适应布局、金额显示为主色卡片样式

## 新功能（第四十批）

- [x] localStorage 持久化：关闭弹窗后再打开，恢复上次填写内容（按订单 ID 分别存储）
- [x] 每个附加模块底部显示小计行（内衬/LOGO/丝印/颜色），主色卡片样式，展开模块时小计大字显示
- [x] 删除价格汇总中「税前 ¥0.00 → 含税 ¥0.00」的转换显示行（保留最终总价行）

## 新功能（第四十一批）

- [x] 国内合同：弹窗标题旁增加「重置表单」按鈕，清除 localStorage 并恢复初始值
- [x] 国内合同：内衬材质下拉增加「其他」选项（可手动输入）
- [x] PI Tab：新增附加明细模块（Liner/Logo/Silk Print/Custom Color/Freight），对应国内合同结构
- [x] PI Tab：所有标题翻译为标准英文
- [x] CI Tab：映射 PI 的附加明细模块（CI 通常与 PI 结构一致）
- [x] generatePdf.ts：PI/CI HTML 模板同步附加明细行
- [x] routers.ts：generatePiCi tRPC schema 同步 piExtras 字段
- [x] TypeScript 0 错误，10 个测试全部通过

## 新功能（第四十二批）

- [x] PI/CI：新增 Buyer 信息区块（联系人/公司名/地址/电话/邮箱），打印时对应 TO 区域
- [x] PI/CI：去掉到达日期，改为「预计运输天数」（Estimated Transit Days）
- [x] PI/CI：打印输出全部纯英文，无中文
- [x] PI/CI：产品名称改为下拉选择（Plastic Case / Other-手动输入）
- [x] PI/CI：运费拆分为国内运输费（Domestic Freight）+ 国外运输费（International Freight，含空运/海运选项 + 物流描述）
- [x] generatePdf.ts：PI/CI HTML 模板同步 Buyer 信息区块、运输天数、产品名称、运费拆分（纯英文）
- [x] routers.ts：PI/CI tRPC schema 同步所有新字段
- [x] TypeScript 0 错误，测试全部通过，数学算法验证

## 新功能（第四十三批）

- [x] 数据库：customers 表新增 attn / company / tel / email 字段并推送迁移
- [x] 客户管理页面：增删改 UI 支持联系人/公司/电话/邮箱四个新字段
- [x] tRPC：customers 相关 procedure 同步新字段（createCustomer / updateCustomer / listCustomers）
- [x] DocumentDialog：打开 PI Tab 时自动从客户信息填入 Buyer 字段
- [x] DocumentDialog：CI 从 PI 加载时同步 buyerAttn / buyerCompany / buyerTel / buyerEmail
- [x] 订单详情页：已有 DocumentHistory 组件，确认已完整实现
- [x] tRPC：已有 documents.listByOrder procedure
- [x] TypeScript 0 错误，测试全部通过

## 新功能（第四十四批）

- [x] generatePdf.ts：Liner 材质名称（PU/EPE/XPE/EVA）中文括号说明翻译为英文
- [x] generatePdf.ts：Logo 材质名称（PVC/滴胶/PC/鄧射/金属拉丝）全部翻译为英文
- [x] generatePdf.ts：Silk Print 等其他附加模块检查是否有中文残留（已验证无中文）
- [x] TypeScript 0 错误，测试全部通过

## 新功能（第四十五批）

- [x] DocumentDialog.tsx：PI/CI 所有 "Lining" 改为 "Foam"（标题/小计/标签）
- [x] DocumentDialog.tsx：Liner 材质下拉 `EPE (珍珠棉)` → `EPE`，`PU (普通棉)` → `PU`，`XPE (交联聚乙烯)` → `XPE`
- [x] DocumentDialog.tsx：Logo 材质下拉全部改为英文（滴胶→Epoxy Resin，鄧射→Laser Engraving，金属拉丝→Metal Brushed）
- [x] generatePdf.ts：Lining → Foam，映射表同步更新新选项値
- [x] TypeScript 0 错误，测试全部通过

## 新功能（第四十六批）

- [x] 上传 INCHOI CASES logo 到 CDN
- [x] generatePdf.ts：国内合同模板加 logo（左上角）、标题居中
- [x] generatePdf.ts：PI/CI 模板加 logo（左上角）、标题居中
- [x] generatePdf.ts：PI/CI BUYER 区块格式修正（公司名→地址→Tel→Email→Attn，去掉 Company: 前缀，去掉 Add: 前缀）
- [x] generatePdf.ts：PI/CI 标题从 TO (BUYER) 改为 BUYER
- [x] TypeScript 0 错误，测试全部通过

## 新功能（第四十七批）

- [x] Schema：customers 表新增 enAddress（英文地址）字段并推送迁移
- [x] Router/DB：customerSchema 和 listCustomersWithStats 同步 enAddress 字段
- [x] 客户管理 UI：国外客户编辑弹窗新增英文地址输入框
- [x] DocumentDialog：生成 PI/CI 时自动从客户 enAddress 填入 buyerAddress
- [x] generatePdf.ts：国内合同 logo 高度从 60px 改为 45px
- [x] generatePdf.ts：SELLER 区块公司名加粗，检查电话邮箱格式
- [x] TypeScript 0 错误，测试全部通过

## 全面审核与优化（第四十八批）

- [x] 错别字修复：合同前言缺少逗号（"达成一致甲方"→"达成一致，甲方"）
- [x] 错别字修复：exportExcel.ts 注释乱码字符清理
- [x] 性能优化：QueryClient 全局 staleTime/gcTime/retry/refetchOnWindowFocus 配置
- [x] 性能优化：ZIP 导出改为 Promise.allSettled 并发下载 PDF
- [x] 性能优化：月汇总 Excel 导出从 N 次并发查询优化为 1 次批量 inArray 查询
- [x] 代码清理：删除废弃的 orderExport.ts 和 orderTypes.ts（旧版前端打印遗留文件）
- [x] 功能补全：客户档案 Excel 导出新增英文地址（enAddress）列
- [x] 功能补全：exportCustomers.ts 改用 listCustomersWithStats（包含 enAddress 字段）
- [x] TypeScript 0 错误，10 项测试全部通过

## 第四十九批

- [x] PDF 标题居中修复：PI/CI 的 PROFORMA INVOICE / COMMERCIAL INVOICE 及国内合同“采购合同”标题真正居中
- [x] 订单编辑页图片上传支持拖拽（drag & drop）
- [x] DocumentHistory 新增“已发送”标记和发送时间记录（schema + router + UI）

## 第五十批

- [x] generatePdf.ts：删除国内合同底部签字栏实线和“年_月_日”行
- [x] generatePdf.ts：删除 PI/CI 底部签字栏实线和“年_月_日”行

## 第五十一批

- [x] DocumentHistory：新增“预览”按鈕，弹窗内嵌 iframe 展示 PDF
- [x] generatePdf.ts：国内合同和 PI/CI 签字标签下方增加 40px 空白留白
- [x] 客户档案批量导入：Excel 模板下载 + 上传解析 + 写入数据库（tRPC + UI）

## 第五十二批

- [x] DocumentHistory：删除 PDF 预览功能（iframe 弹窗）
- [x] generatePdf.ts / DocumentDialog.tsx：「一、筱子明细：」改为「一、产品明细：」
- [x] Schema：customers 表新增 cnCompany / taxNo / bankAccount / bankName 字段并推送迁移
- [x] DB + Router：同步新字段到 customerSchema 和 listCustomersWithStats
- [x] 客户管理 UI：国内客户编辑弹窗新增公司名/税号/公账/銀行名称输入框
- [x] DocumentDialog：国内合同甲方信息自动从客户档案填充（公司名/税号/公账/銀行名称）
- [x] generatePdf.ts：优化国内合同甲乙方信息栏（双栏对比布局，展示公司名/地址/税号/銀行信息）

## 第五十三批

- [x] generatePdf.ts：国内合同甲方税号/銀行信息为空时自动隐藏对应行
- [x] Customers.tsx：搜索框支持按 cnCompany（公司名）搜索国内客户

## 第五十四批

- [x] DocumentDialog：国内合同 Tab 打开时，根据订单客户名称自动匹配客户档案并填充甲方全部信息（cnCompany/taxNo/bankAccount/bankName/address）
- [x] DocumentDialog：国内合同 Tab 顶部增加“从客户档案选择”下拉框，手动切换客户后重新填充甲方信息

## 第五十五批

- [x] DocumentDialog：国内合同“从客户档案选择”升级为可搜索 Combobox（支持按名称/公司名模糊搜索）
- [x] DocumentDialog：PI/CI Tab 顶部增加“从客户档案选择” Combobox（国外客户，可搜索，选中后自动填充 Buyer 信息）
- [x] OrderForm：客户选择后自动同步 customerType（国内/国外）到订单头部
- [x] DocumentDialog：整体 UI 优化（Footer 增加付款校验提示、生成按鈕按 Tab 显示不同文字）
- [x] DocumentDialog：PI/CI 自动填充逻辑优化（先恢复缓存再补全空字段，与国内合同保持一致）

## 第五十六批（最终性能优化）

- [x] Customers.tsx：搜索过滤改为 useMemo 缓存
- [x] DocumentDialog.tsx：国内/国外客户列表 filter 改为 useMemo 缓存
- [x] DocumentDialog.tsx：updateExtra/updateExtraWithCalc/updatePiExtra 改为 useCallback
- [x] Home.tsx：stats 数组改为 useMemo 缓存
- [x] generatePdf.ts：Puppeteer 浏览器实例复用（单例模式）
- [x] generatePdf.ts：executablePath 读取 process.env 而非硬编码
- [x] vite.config.ts：增加 manualChunks 代码分割（react-core/radix-ui/framer-motion/lucide-react/trpc-query/vendor 独立 chunk）

## 第五十七批（多账号登录系统）

- [x] Schema：users 表新增 passwordHash、isActive 字段；orders/customers 表新增 createdBy 字段
- [x] pnpm db:push 推送 Schema 变更
- [x] 后端：新增 bcrypt 密码哈希工具函数
- [x] 后端：替换 Manus OAuth 为自建账号密码登录（/api/auth/login、/api/auth/logout）
- [x] 后端：修改 context.ts 认证逻辑（从 JWT Cookie 读取 appUserId）
- [x] 后端：orders/customers 查询加 createdBy 权限过滤（业务员只看自己的）
- [x] 后端：账号管理 tRPC 路由（管理员增删改账号、停用/启用）
- [x] 前端：登录页（用户名+密码表单，替换 Manus OAuth 跳转）
- [x] 前端：账号管理页（管理员专属，增删改账号）
- [x] 前端：订单列表管理员视图显示"制单员"列
- [x] 前端：客户列表管理员视图显示归属业务员
- [x] 前端：DashboardLayout 侧边栏增加"账号管理"入口（管理员可见）

## 第五十八批（离职转移 + 长期登录）

- [x] 长期登录：auth.login 增加 rememberMe 参数，选中时 JWT 有效期 30 天（默认 24 小时）
- [x] 长期登录：登录页增加「记住我」复选框
- [x] 长期登录：Cookie maxAge 随 rememberMe 动态设置
- [x] 离职转移：后端 userManagement.transferCustomers 路由（批量更新 createdBy）
- [x] 离职转移：账号管理页停用账号时弹出“转移客户”对话框（选择目标业务员或设为公共）
- [x] 离职标注：orders 和 customers 列表中，createdBy 对应账号 isActive=false 时显示“（已离职）”标注

## 第五十九批（权限隔离 + 客户排序 + 离职自动转移）

- [x] 权限隔离：确认 orders.list / customers.list 对业务员严格过滤（createdBy = 当前用户 id）
- [x] 权限隔离：确认 orders.create / customers.create 自动设置 createdBy = 当前用户 id
- [x] 权限隔离：customers.update / customers.delete 加入 createdBy 校验（业务员只能操作自己的客户）
- [x] 权限隔离：新增 getCustomerById 函数并导入 TRPCError
- [x] 客户排序：Customers.tsx 搜索框旁增加「最后下单」排序按鈕（点击循环：默认→最近在前→最早在前）
- [x] 离职自动转移：userManagement.update 路由停用账号时自动将其所有客户 createdBy 设为 null（公共客户）

## 第六十批（订单权限校验 + 分配业务员 + 创建订单快捷按钮）

- [x] 订单权限：orders.update/updateStatus/softDelete/restore/hardDelete 加入 createdBy 校验（业务员只能操作自己的订单）
- [x] 分配业务员：后端 customers.assignSalesperson 路由（管理员专属，更新 createdBy 字段）
- [x] 分配业务员：Customers.tsx 客户列表每行增加「分配业务员」按鈕（管理员可见，弹出对话框选择在职业务员或设为公共）
- [x] 创建订单快捷按鈕：客户列表每行增加「创建订单」图标按鈕，点击跳转 /order/new?customer=客户名
- [x] OrderForm.tsx：读取 URL 参数 customer，自动预填客户名字段

## 第六十一批（退出登录立即清除缓存）

- [x] 退出登录时调用 queryClient.clear() 清除全部 React Query 缓存，防止数据残留

## 第六十二批（全面性能与逻辑优化）

### 后端安全与稳定性
- [ ] Excel/ZIP/图片上传等 Express 路由添加认证中间件（防止未登录访问）
- [ ] orders.get 路由增加 createdBy 权限校验（业务员不能查看他人订单详情）
- [ ] duplicate 路由中的 `m: any` 类型改为具体类型

### 前端逻辑优化
- [ ] Home.tsx：URL 参数 ?customer 处理后清除 URL，避免刷新后重复触发
- [ ] OrderForm.tsx：提交时禁用按钮防止重复提交
- [ ] Login.tsx：登录失败时显示具体错误信息（用户名不存在 vs 密码错误）
- [ ] UserManagement.tsx：创建账号时校验用户名唯一性（前端即时提示）

### 用户体验细节
- [ ] 订单列表/客户列表：空状态提示优化（区分"无数据"和"加载中"）
- [ ] 全局：页面标题（document.title）随路由动态更新

## 最终生产优化（第六十二批）

- [x] 修复 clearCookie maxAge 废弃警告（改用 expires: new Date(0)）
- [x] 验证文档路由安全性（全部使用 protectedProcedure）
- [x] 更新 auth.logout.test.ts 测试（适配新 cookie 清除方式）
- [x] 创建 NAS 部署指南（NAS-DEPLOYMENT.md）
