import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { users, keys, downloads, tutorials, sessions, logs } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, signJwt } from "./auth";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return ctx.user;
      const res = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (res.length === 0) return null;
      const u = res[0];
      return {
        id: u.id,
        username: u.openId,
        role: u.role,
        credits: u.credits,
      };
    }),

    login: publicProcedure
      .input(
        z.object({
          username: z.string(),
          password: z.string(),
          deviceIdentifier: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not connected" });

        const userRes = await db.select().from(users).where(eq(users.openId, input.username)).limit(1);
        if (userRes.length === 0) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
        }

        const user = userRes[0];
        // @ts-ignore
        const isValid = verifyPassword(input.password, user.passwordHash || "");
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
        }

        if (!user.isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta está bloqueada pelo Moderador." });
        }

        // Restrição de sessão única para Reseller e Client (Moderador isento)
        if (user.role === "reseller" || user.role === "client") {
          const activeSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
          if (activeSessions.length > 0) {
            const existing = activeSessions[0];
            if (existing.deviceIdentifier !== input.deviceIdentifier) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "Aviso de Segurança: Esta conta já possui uma sessão ativa em outro dispositivo. Encerre a sessão anterior ou solicite reset ao Moderador.",
              });
            }
          }
        }

        const token = signJwt({ userId: user.id, username: user.openId, role: user.role });

        await db.delete(sessions).where(eq(sessions.userId, user.id));
        await db.insert(sessions).values({
          userId: user.id,
          token,
          deviceIdentifier: input.deviceIdentifier,
        });

        await db.insert(logs).values({
          userId: user.id,
          action: "LOGIN",
          details: `Usuário ${user.openId} (${user.role}) logou com sucesso.`,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return { success: true, role: user.role };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        const db = await getDb();
        if (db) {
          await db.delete(sessions).where(eq(sessions.userId, ctx.user.id));
          await db.insert(logs).values({
            userId: ctx.user.id,
            action: "LOGOUT",
            details: `Usuário ID ${ctx.user.id} saiu da plataforma.`,
          });
        }
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    registerModerator: publicProcedure
      .input(
        z.object({
          username: z.string(),
          password: z.string(),
          secretKey: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        if (input.secretKey !== "MOD_SETUP_2026") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Chave secreta de configuração incorreta." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

        const exists = await db.select().from(users).where(eq(users.openId, input.username)).limit(1);
        const passHash = hashPassword(input.password);

        if (exists.length > 0) {
          await db.update(users).set({ role: "moderator", passwordHash: passHash as any }).where(eq(users.openId, input.username));
        } else {
          await db.insert(users).values({
            openId: input.username,
            role: "moderator",
            passwordHash: passHash as any,
            credits: 9999,
            isActive: true,
          });
        }
        return { success: true };
      }),
  }),

  moderator: router({
    dashboardStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { totalClients: 0, totalResellers: 0, totalKeys: 0, usedKeys: 0, activeSessions: 0 };

      const clientsRes = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "client"));
      const resellersRes = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "reseller"));
      const keysRes = await db.select({ count: sql`count(*)` }).from(keys);
      const usedKeysRes = await db.select({ count: sql`count(*)` }).from(keys).where(eq(keys.isUsed, true));
      const sessionsRes = await db.select({ count: sql`count(*)` }).from(sessions);

      return {
        totalClients: Number(clientsRes[0]?.count || 0),
        totalResellers: Number(resellersRes[0]?.count || 0),
        totalKeys: Number(keysRes[0]?.count || 0),
        usedKeys: Number(usedKeysRes[0]?.count || 0),
        activeSessions: Number(sessionsRes[0]?.count || 0),
      };
    }),

    listResellers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];

      const resellers = await db.select().from(users).where(eq(users.role, "reseller"));
      const result = [];
      for (const r of resellers) {
        const clientCountRes = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.resellerId, r.id));
        result.push({
          id: r.id,
          username: r.openId,
          credits: r.credits,
          isActive: r.isActive,
          clientCount: Number(clientCountRes[0]?.count || 0),
        });
      }
      return result;
    }),

    createReseller: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string(), credits: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const passHash = hashPassword(input.password);
        await db.insert(users).values({
          openId: input.username,
          role: "reseller",
          passwordHash: passHash as any,
          credits: input.credits,
          isActive: true,
        });

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "CREATE_RESELLER",
          details: `Moderador criou revendedor ${input.username} com ${input.credits} créditos.`,
        });

        return { success: true };
      }),

    updateResellerCredits: protectedProcedure
      .input(z.object({ resellerId: z.number(), credits: z.number(), action: z.enum(["add", "remove"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const resellerRes = await db.select().from(users).where(eq(users.id, input.resellerId)).limit(1);
        if (resellerRes.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
        const reseller = resellerRes[0];

        let newCredits = reseller.credits;
        if (input.action === "add") newCredits += input.credits;
        else newCredits = Math.max(0, newCredits - input.credits);

        await db.update(users).set({ credits: newCredits }).where(eq(users.id, input.resellerId));

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "UPDATE_CREDITS",
          details: `Moderador ${input.action === "add" ? "adicionou" : "removeu"} ${input.credits} créditos do revendedor ${reseller.openId}. Saldo final: ${newCredits}`,
        });

        return { success: true, newCredits };
      }),

    listClients: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];

      const clients = await db.select().from(users).where(eq(users.role, "client"));
      const result = [];
      for (const c of clients) {
        let keyValue = "Nenhuma";
        if (c.keyId) {
          const kRes = await db.select().from(keys).where(eq(keys.id, c.keyId)).limit(1);
          if (kRes.length > 0) keyValue = kRes[0].keyValue;
        }
        let resellerName = "Sistema / Direto";
        if (c.resellerId) {
          const rRes = await db.select().from(users).where(eq(users.id, c.resellerId)).limit(1);
          if (rRes.length > 0) resellerName = rRes[0].openId;
        }

        result.push({
          id: c.id,
          username: c.openId,
          isActive: c.isActive,
          keyValue,
          resellerName,
        });
      }
      return result;
    }),

    toggleUserStatus: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const uRes = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (uRes.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
        const u = uRes[0];

        const newStatus = !u.isActive;
        await db.update(users).set({ isActive: newStatus }).where(eq(users.id, input.userId));

        if (!newStatus) {
          await db.delete(sessions).where(eq(sessions.userId, u.id));
        }

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "TOGGLE_USER_STATUS",
          details: `Moderador alterou status de ${u.openId} para ${newStatus ? "Ativo" : "Bloqueado"}.`,
        });

        return { success: true };
      }),

    resetUserSession: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.delete(sessions).where(eq(sessions.userId, input.userId));
        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "RESET_SESSION",
          details: `Moderador resetou a sessão do usuário ID ${input.userId}.`,
        });

        return { success: true };
      }),

    resetUserPassword: protectedProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const passHash = hashPassword(input.newPassword);
        await db.update(users).set({ passwordHash: passHash as any }).where(eq(users.id, input.userId));

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "RESET_PASSWORD",
          details: `Moderador resetou a senha do usuário ID ${input.userId}.`,
        });

        return { success: true };
      }),

    deleteUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const uRes = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (uRes.length > 0 && uRes[0].keyId) {
          await db.update(keys).set({ isUsed: false }).where(eq(keys.id, uRes[0].keyId));
        }

        await db.delete(sessions).where(eq(sessions.userId, input.userId));
        await db.delete(users).where(eq(users.id, input.userId));

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "DELETE_USER",
          details: `Moderador excluiu o usuário ID ${input.userId}.`,
        });

        return { success: true };
      }),

    listKeys: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(keys).orderBy(desc(keys.id));
    }),

    addKey: protectedProcedure
      .input(z.object({ keyValue: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.insert(keys).values({ keyValue: input.keyValue });
        return { success: true };
      }),

    importKeysBatch: protectedProcedure
      .input(z.object({ keysList: z.array(z.string()) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        let added = 0;
        for (const k of input.keysList) {
          const trimmed = k.trim();
          if (trimmed) {
            try {
              await db.insert(keys).values({ keyValue: trimmed });
              added++;
            } catch (e) {}
          }
        }
        return { success: true, added };
      }),

    toggleKeyStatus: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const kRes = await db.select().from(keys).where(eq(keys.id, input.keyId)).limit(1);
        if (kRes.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
        const k = kRes[0];

        await db.update(keys).set({ isActive: !k.isActive }).where(eq(keys.id, input.keyId));
        return { success: true };
      }),

    deleteKey: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.delete(keys).where(eq(keys.id, input.keyId));
        return { success: true };
      }),

    listDownloads: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(downloads).orderBy(desc(downloads.id));
    }),

    addDownload: protectedProcedure
      .input(z.object({ title: z.string(), description: z.string().optional(), version: z.string(), fileUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.insert(downloads).values({
          title: input.title,
          description: input.description || null,
          version: input.version,
          fileUrl: input.fileUrl,
        });
        return { success: true };
      }),

    updateDownload: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string(), description: z.string().optional(), version: z.string(), fileUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.update(downloads).set({
          title: input.title,
          description: input.description || null,
          version: input.version,
          fileUrl: input.fileUrl,
        }).where(eq(downloads.id, input.id));

        return { success: true };
      }),

    deleteDownload: protectedProcedure
      .input(z.object({ downloadId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.delete(downloads).where(eq(downloads.id, input.downloadId));
        return { success: true };
      }),

    listLogs: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(logs).orderBy(desc(logs.id)).limit(100);
    }),

    listTutorials: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(tutorials).orderBy(desc(tutorials.id));
    }),

    addTutorial: protectedProcedure
      .input(z.object({ title: z.string(), description: z.string().optional(), videoUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.insert(tutorials).values({
          title: input.title,
          description: input.description || null,
          videoUrl: input.videoUrl,
        });
        return { success: true };
      }),

    deleteTutorial: protectedProcedure
      .input(z.object({ tutorialId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.delete(tutorials).where(eq(tutorials.id, input.tutorialId));
        return { success: true };
      }),
  }),

  reseller: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "reseller") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { credits: 0, clientsCount: 0, clients: [] };

      const resellerRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const reseller = resellerRes[0];

      const clientsList = await db.select().from(users).where(eq(users.resellerId, ctx.user.id));

      return {
        credits: reseller.credits,
        clientsCount: clientsList.length,
        clients: clientsList.map((c) => ({
          id: c.id,
          username: c.openId,
          isActive: c.isActive,
        })),
      };
    }),

    createClient: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const resRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const reseller = resRes[0];
        if (reseller.credits < 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Créditos insuficientes para criar cliente." });
        }

        const availableKey = await db.select().from(keys).where(and(eq(keys.isUsed, false), eq(keys.isActive, true))).limit(1);
        if (availableKey.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não há Keys disponíveis ou ativas no sistema." });
        }
        const key = availableKey[0];

        const passHash = hashPassword(input.password);

        await db.insert(users).values({
          openId: input.username,
          role: "client",
          passwordHash: passHash as any,
          resellerId: ctx.user.id,
          keyId: key.id,
          credits: 0,
          isActive: true,
        });

        await db.update(keys).set({ isUsed: true }).where(eq(keys.id, key.id));
        await db.update(users).set({ credits: reseller.credits - 1 }).where(eq(users.id, reseller.id));

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "RESELLER_CREATE_CLIENT",
          details: `Revendedor ${reseller.openId} criou o cliente ${input.username} com a Key ${key.keyValue}.`,
        });

        return { success: true, createdUsername: input.username, createdPassword: input.password };
      }),

    editClientPassword: protectedProcedure
      .input(z.object({ clientId: z.number(), newPassword: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const clientRes = await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.resellerId, ctx.user.id))).limit(1);
        if (clientRes.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });

        const passHash = hashPassword(input.newPassword);
        await db.update(users).set({ passwordHash: passHash as any }).where(eq(users.id, input.clientId));

        return { success: true };
      }),

    deleteClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const clientRes = await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.resellerId, ctx.user.id))).limit(1);
        if (clientRes.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

        const client = clientRes[0];
        if (client.keyId) {
          await db.update(keys).set({ isUsed: false }).where(eq(keys.id, client.keyId));
        }

        await db.delete(sessions).where(eq(sessions.userId, client.id));
        await db.delete(users).where(eq(users.id, client.id));

        return { success: true };
      }),
  }),

  clientPanel: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "client") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { username: ctx.user.username, keyValue: "N/A", downloads: [] };

      const clientRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const client = clientRes[0];

      let keyValue: string | null = null;
      if (client.keyId) {
        const kRes = await db.select().from(keys).where(eq(keys.id, client.keyId)).limit(1);
        if (kRes.length > 0) keyValue = kRes[0].keyValue;
      }

      const allDownloads = await db.select().from(downloads).orderBy(desc(downloads.id));
      const allTutorials = await db.select().from(tutorials).orderBy(desc(tutorials.id));

      return {
        username: client.openId,
        keyValue,
        downloads: allDownloads,
        tutorials: allTutorials,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
