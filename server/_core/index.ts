import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { setupVite, serveStatic } from "./vite";
import { createContext } from "./context";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = process.env.PORT || 3000;
  server.listen(Number(port), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
