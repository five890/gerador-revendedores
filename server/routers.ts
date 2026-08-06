import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb, getUserByUsername, getUserById, createLog } from "./db";
import { users, keys, downloads, sessions, logs } from "../drizzle/schema";
import { hashPassword, verifyPassword, signJwt } from "./auth";
import { eq, desc, and, count } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return ctx.user;
    }),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string(), deviceIdentifier: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados indisponível");

        const user = await getUserByUsername(input.username);
        if (!user || !user.isActive) {
          throw new Error("Usuário não encontrado ou inativo.");
        }

        if (!verifyPassword(input.password, user.passwordHash)) {
          throw new Error("Senha incorreta.");
        }

        const deviceId = input.deviceIdentifier || "default-device";

        // Regra de sessão única para Revendedor e Cliente
        if (user.role === "reseller" || user.role === "client") {
          const existingSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
          if (existingSessions.length > 0) {
            const activeSession = existingSessions[0];
            if (activeSession.deviceIdentifier !== deviceId) {
              throw new Error("Sua conta já está conectada em outro dispositivo. Solicite ao Moderador o reset da sessão.");
            }
          }
        }

        const token = signJwt({ userId: user.id, username: user.username, role: user.role });

        await db.delete(sessions).where(eq(sessions.userId, user.id));
        await db.insert(sessions).values({
          userId: user.id,
          token,
          deviceIdentifier: deviceId,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

        await createLog(user.id, "LOGIN", `Usuário ${user.username} fez login`, ctx.req.ip);

        return { success: true, user };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (ctx.user && db) {
        await db.delete(sessions).where(eq(sessions.userId, ctx.user.id));
        await createLog(ctx.user.id, "LOGOUT", `Usuário ${ctx.user.username} fez logout`);
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),

    registerModerator: publicProcedure
      .input(z.object({ username: z.string(), password: z.string(), secretKey: z.string() }))
      .mutation(async ({ input }) => {
        if (input.secretKey !== "MOD_SETUP_2026") {
          throw new Error("Chave secreta de configuração inválida.");
        }
        const db = await getDb();
        if (!db) throw new Error("Banco de dados indisponível");

        const existing = await getUserByUsername(input.username);
        if (existing) throw new Error("Usuário já existe.");

        await db.insert(users).values({
          username: input.username,
          passwordHash: hashPassword(input.password),
          role: "moderator",
          credits: 9999,
        });

        return { success: true };
      }),
  }),

  moderator: router({
    dashboardStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const [totalClients] = await db.select({ count: count() }).from(users).where(eq(users.role, "client"));
      const [totalResellers] = await db.select({ count: count() }).from(users).where(eq(users.role, "reseller"));
      const [totalKeys] = await db.select({ count: count() }).from(keys);
      const [usedKeys] = await db.select({ count: count() }).from(keys).where(eq(keys.isUsed, true));
      const activeSessionsCount = await db.select({ count: count() }).from(sessions);

      return {
        totalClients: totalClients.count,
        totalResellers: totalResellers.count,
        totalKeys: totalKeys.count,
        usedKeys: usedKeys.count,
        activeSessions: activeSessionsCount.length > 0 ? activeSessionsCount[0].count : 0,
      };
    }),

    listResellers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const resellers = await db.select().from(users).where(eq(users.role, "reseller"));
      const result = [];
      for (const r of resellers) {
        const clientCount = await db.select({ count: count() }).from(users).where(eq(users.resellerId, r.id));
        result.push({
          ...r,
          clientCount: clientCount[0].count,
        });
      }
      return result;
    }),

    createReseller: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string(), credits: z.number().default(0) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        const existing = await getUserByUsername(input.username);
        if (existing) throw new Error("Nome de usuário já existe.");

        await db.insert(users).values({
          username: input.username,
          passwordHash: hashPassword(input.password),
          role: "reseller",
          credits: input.credits,
        });

        await createLog(ctx.user.id, "CREATE_RESELLER", `Criou revendedor ${input.username} com ${input.credits} créditos`);
        return { success: true };
      }),

    updateResellerCredits: protectedProcedure
      .input(z.object({ resellerId: z.number(), credits: z.number(), action: z.enum(["add", "remove", "set"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        const reseller = await getUserById(input.resellerId);
        if (!reseller || reseller.role !== "reseller") throw new Error("Revendedor não encontrado.");

        let newCredits = reseller.credits;
        if (input.action === "add") newCredits += input.credits;
        else if (input.action === "remove") newCredits = Math.max(0, newCredits - input.credits);
        else if (input.action === "set") newCredits = input.credits;

        await db.update(users).set({ credits: newCredits }).where(eq(users.id, input.resellerId));
        await createLog(ctx.user.id, "UPDATE_CREDITS", `Atualizou créditos do revendedor ${reseller.username} para ${newCredits}`);

        return { success: true, newCredits };
      }),

    toggleUserStatus: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        const target = await getUserById(input.userId);
        if (!target) throw new Error("Usuário não encontrado.");

        const newStatus = !target.isActive;
        await db.update(users).set({ isActive: newStatus }).where(eq(users.id, input.userId));
        await createLog(ctx.user.id, "TOGGLE_USER", `Alterou status do usuário ${target.username} para ${newStatus ? "Ativo" : "Bloqueado"}`);

        return { success: true, isActive: newStatus };
      }),

    resetUserSession: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        await db.delete(sessions).where(eq(sessions.userId, input.userId));
        const target = await getUserById(input.userId);
        await createLog(ctx.user.id, "RESET_SESSION", `Resetou sessão do usuário ${target?.username || input.userId}`);

        return { success: true };
      }),

    resetUserPassword: protectedProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        await db.update(users).set({ passwordHash: hashPassword(input.newPassword) }).where(eq(users.id, input.userId));
        const target = await getUserById(input.userId);
        await createLog(ctx.user.id, "RESET_PASSWORD", `Resetou senha do usuário ${target?.username || input.userId}`);

        return { success: true };
      }),

    deleteUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        const target = await getUserById(input.userId);
        if (!target) throw new Error("Usuário não encontrado.");

        if (target.keyId) {
          await db.update(keys).set({ isUsed: false }).where(eq(keys.id, target.keyId));
        }

        await db.delete(users).where(eq(users.id, input.userId));
        await createLog(ctx.user.id, "DELETE_USER", `Excluiu usuário ${target.username}`);

        return { success: true };
      }),

    listClients: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const clients = await db.select().from(users).where(eq(users.role, "client"));
      const result = [];
      for (const c of clients) {
        let keyValue = "N/A";
        if (c.keyId) {
          const k = await db.select().from(keys).where(eq(keys.id, c.keyId)).limit(1);
          if (k.length > 0) keyValue = k[0].keyValue;
        }
        let resellerName = "Admin / Direto";
        if (c.resellerId) {
          const r = await getUserById(c.resellerId);
          if (r) resellerName = r.username;
        }
        result.push({
          ...c,
          keyValue,
          resellerName,
        });
      }
      return result;
    }),

    listKeys: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      return await db.select().from(keys).orderBy(desc(keys.id));
    }),

    addKey: protectedProcedure
      .input(z.object({ keyValue: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        await db.insert(keys).values({ keyValue: input.keyValue });
        await createLog(ctx.user.id, "ADD_KEY", `Adicionou key ${input.keyValue}`);
        return { success: true };
      }),

    importKeysBatch: protectedProcedure
      .input(z.object({ keysList: z.array(z.string()) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        let added = 0;
        for (const k of input.keysList) {
          const trimmed = k.trim();
          if (!trimmed) continue;
          try {
            await db.insert(keys).values({ keyValue: trimmed });
            added++;
          } catch (e) {}
        }
        await createLog(ctx.user.id, "IMPORT_KEYS", `Importou ${added} keys em lote`);
        return { success: true, added };
      }),

    deleteKey: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        await db.delete(keys).where(eq(keys.id, input.keyId));
        await createLog(ctx.user.id, "DELETE_KEY", `Excluiu key ID ${input.keyId}`);
        return { success: true };
      }),

    listDownloads: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      return await db.select().from(downloads).orderBy(desc(downloads.id));
    }),

    addDownload: protectedProcedure
      .input(z.object({ title: z.string(), description: z.string().optional(), version: z.string(), fileUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        await db.insert(downloads).values(input);
        await createLog(ctx.user.id, "ADD_DOWNLOAD", `Cadastrou download ${input.title}`);
        return { success: true };
      }),

    deleteDownload: protectedProcedure
      .input(z.object({ downloadId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        await db.delete(downloads).where(eq(downloads.id, input.downloadId));
        await createLog(ctx.user.id, "DELETE_DOWNLOAD", `Removeu download ID ${input.downloadId}`);
        return { success: true };
      }),

    listLogs: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      return await db.select().from(logs).orderBy(desc(logs.id)).limit(100);
    }),
  }),

  reseller: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "reseller") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const reseller = await getUserById(ctx.user.id);
      const myClients = await db.select().from(users).where(eq(users.resellerId, ctx.user.id));

      return {
        credits: reseller?.credits || 0,
        clientsCount: myClients.length,
        clients: myClients.map(c => ({
          id: c.id,
          username: c.username,
          isActive: c.isActive,
          createdAt: c.createdAt,
        })),
      };
    }),

    createClient: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        const reseller = await getUserById(ctx.user.id);
        if (!reseller || reseller.credits < 1) {
          throw new Error("Créditos insuficientes para criar um novo cliente.");
        }

        const existing = await getUserByUsername(input.username);
        if (existing) throw new Error("Nome de usuário já em uso.");

        const availableKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.isUsed, false))).limit(1);
        if (availableKey.length === 0) {
          throw new Error("Não há Keys disponíveis no sistema. Solicite ao Moderador.");
        }
        const key = availableKey[0];

        await db.update(users).set({ credits: reseller.credits - 1 }).where(eq(users.id, ctx.user.id));
        await db.update(keys).set({ isUsed: true }).where(eq(keys.id, key.id));

        await db.insert(users).values({
          username: input.username,
          passwordHash: hashPassword(input.password),
          role: "client",
          resellerId: ctx.user.id,
          keyId: key.id,
        });

        await createLog(ctx.user.id, "CREATE_CLIENT", `Revendedor ${ctx.user.username} criou cliente ${input.username} consumindo 1 crédito`);

        return { success: true };
      }),

    editClientPassword: protectedProcedure
      .input(z.object({ clientId: z.number(), newPassword: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        const client = await getUserById(input.clientId);
        if (!client || client.resellerId !== ctx.user.id) {
          throw new Error("Cliente não encontrado ou não pertence a você.");
        }

        await db.update(users).set({ passwordHash: hashPassword(input.newPassword) }).where(eq(users.id, input.clientId));
        await createLog(ctx.user.id, "RESET_CLIENT_PASS", `Resetou senha do cliente ${client.username}`);

        return { success: true };
      }),

    deleteClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller") throw new Error("Acesso negado");
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");

        const client = await getUserById(input.clientId);
        if (!client || client.resellerId !== ctx.user.id) {
          throw new Error("Cliente não encontrado ou não pertence a você.");
        }

        if (client.keyId) {
          await db.update(keys).set({ isUsed: false }).where(eq(keys.id, client.keyId));
        }

        await db.delete(users).where(eq(users.id, input.clientId));
        await createLog(ctx.user.id, "DELETE_CLIENT", `Removeu cliente ${client.username}`);

        return { success: true };
      }),
  }),

  clientPanel: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "client") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      let keyValue = "N/A";
      if (ctx.user.keyId) {
        const k = await db.select().from(keys).where(eq(keys.id, ctx.user.keyId)).limit(1);
        if (k.length > 0) keyValue = k[0].keyValue;
      }

      const allDownloads = await db.select().from(downloads).orderBy(desc(downloads.id));

      return {
        username: ctx.user.username,
        keyValue,
        downloads: allDownloads,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
