import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { generateOrderExcel, generateMonthlyOrdersExcel } from "../exportExcel";
import { generateCustomersExcel } from "../exportCustomers";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import archiver from "archiver";
import { getDocumentsByOrderId } from "../db.documents";
import https from "https";
import http from "http";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Excel 导出路由
  app.get("/api/export/order/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ error: "无效的订单ID" }); return; }
      const buffer = await generateOrderExcel(id);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent('吟彩订单_' + id + '.xlsx')}`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "导出失败" });
    }
  });

  // 按年月批量导出订单 Excel 路由
  app.get("/api/export/orders/monthly", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);
      const status = (req.query.status as string) || undefined;
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: "请提供有效的年份和月份" }); return;
      }
      const validStatuses = ["draft", "submitted", "in_production", "completed", "cancelled"];
      if (status && !validStatuses.includes(status)) {
        res.status(400).json({ error: "无效的订单状态" }); return;
      }
      const buffer = await generateMonthlyOrdersExcel(year, month, status as any);
      const statusSuffix = status ? `_${{ draft: "草稿", submitted: "已提交", in_production: "生产中", completed: "已完成", cancelled: "已取消" }[status] ?? status}` : "";
      const filename = encodeURIComponent(`吟彩订单_${year}年${month}月${statusSuffix}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "导出失败" });
    }
  });

  // 客户档案 Excel 导出路由
  app.get("/api/export/customers", async (_req, res) => {
    try {
      const buffer = await generateCustomersExcel();
      const filename = encodeURIComponent(`吟彩客户档案_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "导出失败" });
    }
  });

  // 图片上传路由（base64 → S3）
  app.post("/api/upload/image", async (req, res) => {
    try {
      const { base64, mimeType, category } = req.body as { base64: string; mimeType: string; category?: string };
      if (!base64 || !mimeType) { res.status(400).json({ error: "缺少 base64 或 mimeType" }); return; }
      const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const key = `order-images/${category ?? "misc"}/${nanoid()}.${ext}`;
      const buffer = Buffer.from(base64, "base64");
      const { url } = await storagePut(key, buffer, mimeType);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "上传失败" });
    }
  });

  // 单据 ZIP 批量导出路由
  app.get("/api/export/documents/:orderId/zip", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) { res.status(400).json({ error: "无效的订单ID" }); return; }

      const docs = await getDocumentsByOrderId(orderId);
      const activeDocs = docs.filter(d => d.status === "active" && d.pdfUrl);

      if (activeDocs.length === 0) {
        res.status(404).json({ error: "该订单下没有有效的单据" }); return;
      }

      const filename = encodeURIComponent(`订单${orderId}_单据包_${new Date().toISOString().slice(0,10)}.zip`);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);

      // 并发下载所有 PDF 并追加到 zip
      const downloadFile = (url: string): Promise<Buffer> => new Promise((resolve, reject) => {
        const protocol = url.startsWith("https") ? https : http;
        protocol.get(url, (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        }).on("error", reject);
      });

      for (const doc of activeDocs) {
        try {
          const buf = await downloadFile(doc.pdfUrl!);
          const typeLabel = { contract_cn: "采购合同", pi: "PI形式发票", ci: "CI商业发票" }[doc.docType] ?? doc.docType;
          const versionSuffix = (doc.version ?? 1) > 1 ? `_v${doc.version}` : "";
          archive.append(buf, { name: `${typeLabel}_${doc.docNo}${versionSuffix}.pdf` });
        } catch {
          // 跳过下载失败的单据
        }
      }

      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ error: err.message ?? "导出失败" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
