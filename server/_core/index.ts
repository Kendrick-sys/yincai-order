import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { generateOrderExcel } from "../exportExcel";
import { generateCustomersExcel } from "../exportCustomers";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

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
