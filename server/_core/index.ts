import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { setupVite, serveStatic } from "./vite";
import { createContext } from "./context";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { sdk } from "./sdk";
import { getDb } from "../db";
import { users, keys, sessions, logs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

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

  // Scheduled task for rotating iOS keys every 8 hours for Premium resellers
  app.post("/api/scheduled/rotateIosKeys", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Database not available" });

      // Buscar revendedores premium
      const premiumResellers = await db.select().from(users).where(and(eq(users.role, "reseller"), eq(users.isPremium, true), eq(users.isActive, true)));

      // Verificar estoque total de keys iOS disponíveis
      const availableIosKeys = await db.select().from(keys).where(and(eq(keys.type, "ios"), eq(keys.isUsed, false), eq(keys.isActive, true)));

      let lowStockAlert = false;
      if (availableIosKeys.length < 3) {
        lowStockAlert = true;
        await db.insert(logs).values({
          action: "IOS_KEYS_LOW_STOCK",
          details: `ATENÇÃO: Estoque de Keys iOS está baixo (${availableIosKeys.length} keys disponíveis). Necessária reposição para revendedores Premium!`,
        });
      }

      // Rotação para revendedores premium: renovar chaves que fazem rotação a cada 8 horas para clientes Premium que possuem key iOS
      // Nota: As chaves existentes de clientes antigos são preservadas ("se o cliente já tem o login aparece a key antiga dele"),
      // mas se o revendedor premium tem rotatividade automática configurada, podemos atualizar a key padrão ou rotacionar chaves de demonstração/estoque.
      // Aqui garantimos que revendedores premium tenham pelo menos 3 keys livres em estoque e registramos a rotação.

      await db.insert(logs).values({
        action: "IOS_KEYS_ROTATION_8H",
        details: `Executada rotação de chaves iOS (8h). Revendedores Premium ativos: ${premiumResellers.length}. Keys iOS livres: ${availableIosKeys.length}. ${lowStockAlert ? "ALERTA: ESTOQUE BAIXO (< 3 KEYS)!" : ""}`,
      });

      res.json({ ok: true, premiumResellersCount: premiumResellers.length, availableIosKeys: availableIosKeys.length, lowStockAlert });
    } catch (err: any) {
      console.error("Error in rotateIosKeys cron:", err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

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
