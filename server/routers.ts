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
        isPremium: u.isPremium || false,
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

        const cleanUsername = input.username.trim();
        const userRes = await db.select().from(users).where(eq(users.openId, cleanUsername)).limit(1);
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

        // Verificar se a conta expirou (24h de uso)
        if (user.role === "client" && user.expiresAt) {
          if (new Date().getTime() > new Date(user.expiresAt).getTime()) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Seu login e sua key expirou, contate o suporte ou compre outra key.",
            });
          }
        }

        // Restrição de limite de dispositivos (maxDevices) para Reseller e Client (Moderador isento)
        if (user.role === "reseller" || user.role === "client") {
          const activeSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
          const maxAllowed = user.maxDevices || 1;
          const isAlreadyRegistered = activeSessions.some(s => s.deviceIdentifier === input.deviceIdentifier);

          if (!isAlreadyRegistered) {
            if (activeSessions.length >= maxAllowed) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `Limite excedido: Esta conta permite no máximo ${maxAllowed} dispositivo(s) conectado(s). Encerre a sessão em outro dispositivo ou solicite ao moderador/revendedor.`,
              });
            }
          }
        }

        const token = signJwt({ userId: user.id, username: user.openId, role: user.role });

        // Registrar sessão se não existir para este device
        const existingForDevice = await db.select().from(sessions).where(and(eq(sessions.userId, user.id), eq(sessions.deviceIdentifier, input.deviceIdentifier)));
        if (existingForDevice.length === 0) {
          await db.insert(sessions).values({
            userId: user.id,
            token,
            deviceIdentifier: input.deviceIdentifier,
          });
        }

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
          creditsBasic: r.creditsBasic || 0,
          creditsAdvanced: r.creditsAdvanced || 0,
          creditsIos: r.creditsIos || 0,
          isActive: r.isActive,
          isPremium: r.isPremium || false,
          clientCount: Number(clientCountRes[0]?.count || 0),
        });
      }
      return result;
    }),

    createReseller: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string(), creditsBasic: z.number(), creditsAdvanced: z.number(), creditsIos: z.number().default(0), isPremium: z.boolean().default(false) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const passHash = hashPassword(input.password);
        await db.insert(users).values({
          openId: input.username,
          role: "reseller",
          passwordHash: passHash as any,
          creditsBasic: input.creditsBasic,
          creditsAdvanced: input.creditsAdvanced,
          creditsIos: input.creditsIos,
          isActive: true,
          isPremium: input.isPremium,
        });

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "CREATE_RESELLER",
          details: `Moderador criou revendedor ${input.username} (${input.isPremium ? "Premium" : "Comum"}) com ${input.creditsBasic} Basic, ${input.creditsAdvanced} Advanced e ${input.creditsIos} iOS.`,
        });

        return { success: true };
      }),

    updateResellerCredits: protectedProcedure
      .input(z.object({ resellerId: z.number(), amount: z.number(), type: z.enum(["basic", "advanced", "ios"]), action: z.enum(["add", "remove"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const resellerRes = await db.select().from(users).where(eq(users.id, input.resellerId)).limit(1);
        if (resellerRes.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
        const reseller = resellerRes[0];

        if (input.type === "basic") {
          let newCredits = reseller.creditsBasic;
          if (input.action === "add") newCredits += input.amount;
          else newCredits = Math.max(0, newCredits - input.amount);
          await db.update(users).set({ creditsBasic: newCredits }).where(eq(users.id, input.resellerId));
          await db.insert(logs).values({
            userId: ctx.user.id,
            action: "UPDATE_CREDITS_BASIC",
            details: `Moderador ${input.action === "add" ? "adicionou" : "removeu"} ${input.amount} créditos Basic do revendedor ${reseller.openId}. Saldo final: ${newCredits}`,
          });
          return { success: true, newCredits };
        } else if (input.type === "advanced") {
          let newCredits = reseller.creditsAdvanced;
          if (input.action === "add") newCredits += input.amount;
          else newCredits = Math.max(0, newCredits - input.amount);
          await db.update(users).set({ creditsAdvanced: newCredits }).where(eq(users.id, input.resellerId));
          await db.insert(logs).values({
            userId: ctx.user.id,
            action: "UPDATE_CREDITS_ADVANCED",
            details: `Moderador ${input.action === "add" ? "adicionou" : "removeu"} ${input.amount} créditos Advanced do revendedor ${reseller.openId}. Saldo final: ${newCredits}`,
          });
          return { success: true, newCredits };
        } else {
          let newCredits = reseller.creditsIos;
          if (input.action === "add") newCredits += input.amount;
          else newCredits = Math.max(0, newCredits - input.amount);
          await db.update(users).set({ creditsIos: newCredits }).where(eq(users.id, input.resellerId));
          await db.insert(logs).values({
            userId: ctx.user.id,
            action: "UPDATE_CREDITS_IOS",
            details: `Moderador ${input.action === "add" ? "adicionou" : "removeu"} ${input.amount} créditos iOS do revendedor ${reseller.openId}. Saldo final: ${newCredits}`,
          });
          return { success: true, newCredits };
        }
      }),

    toggleResellerPremium: protectedProcedure
      .input(z.object({ resellerId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const resellerRes = await db.select().from(users).where(eq(users.id, input.resellerId)).limit(1);
        if (resellerRes.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
        const reseller = resellerRes[0];
        const newStatus = !reseller.isPremium;

        await db.update(users).set({ isPremium: newStatus }).where(eq(users.id, input.resellerId));
        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "TOGGLE_RESELLER_PREMIUM",
          details: `Moderador alterou status Premium do revendedor ${reseller.openId} para ${newStatus ? "Ativo" : "Inativo"}.`,
        });

        return { success: true, isPremium: newStatus };
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

        let usedAt = null;
        if (c.keyId) {
          const kRes = await db.select().from(keys).where(eq(keys.id, c.keyId)).limit(1);
          if (kRes.length > 0) usedAt = kRes[0].usedAt;
        }

        result.push({
          id: c.id,
          username: c.openId,
          isActive: c.isActive,
          maxDevices: c.maxDevices || 1,
          keyValue,
          resellerName,
          expiresAt: c.expiresAt ? new Date(c.expiresAt).getTime() : null,
          usedAt: usedAt ? new Date(usedAt).getTime() : null,
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
        if (ctx.user.role !== "moderator" && ctx.user.role !== "reseller") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        if (ctx.user.role === "reseller") {
          // Verifica se o revendedor é o dono ou se é premium
          const resRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
          const isPremium = resRes[0]?.isPremium || false;
          if (!isPremium) {
            const clientRes = await db.select().from(users).where(and(eq(users.id, input.userId), eq(users.resellerId, ctx.user.id))).limit(1);
            if (clientRes.length === 0) throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence ao seu painel." });
          }
        }

        await db.delete(sessions).where(eq(sessions.userId, input.userId));
        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "RESET_SESSION",
          details: `Usuário ${ctx.user.id} resetou a sessão do cliente ID ${input.userId}.`,
        });

        return { success: true };
      }),

    updateClientMaxDevices: protectedProcedure
      .input(z.object({ clientId: z.number(), maxDevices: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator" && ctx.user.role !== "reseller") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        if (ctx.user.role === "reseller") {
          const clientRes = await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.resellerId, ctx.user.id))).limit(1);
          if (clientRes.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        }

        await db.update(users).set({ maxDevices: input.maxDevices }).where(eq(users.id, input.clientId));
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
      // Retorna todas para a aba de banidas/histórico, mas as tabelas ativas podem filtrar isBanned !== true
      return await db.select().from(keys).orderBy(desc(keys.id));
    }),

    addKey: protectedProcedure
      .input(z.object({ keyValue: z.string(), type: z.enum(["basic", "advanced", "ios"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.insert(keys).values({ keyValue: input.keyValue, type: input.type });
        return { success: true };
      }),

    importKeysBatch: protectedProcedure
      .input(z.object({ keysList: z.array(z.string()), type: z.enum(["basic", "advanced", "ios"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        let added = 0;
        for (const k of input.keysList) {
          const trimmed = k.trim();
          if (trimmed) {
            try {
              await db.insert(keys).values({ keyValue: trimmed, type: input.type });
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

    deleteHgKeys: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const allKeys = await db.select().from(keys);
        let deletedCount = 0;
        for (const k of allKeys) {
          if (k.keyValue.toLowerCase().startsWith("hg")) {
            await db.delete(keys).where(eq(keys.id, k.id));
            deletedCount++;
          }
        }
        return { success: true, deletedCount };
      }),

    deleteExpiredKeys: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Apenas apagar chaves usadas com mais de 24h que NÃO estejam vinculadas a nenhum usuário ativo
        const now = new Date().getTime();
        const allKeys = await db.select().from(keys);
        const allClients = await db.select().from(users).where(eq(users.role, "client"));
        const activeKeyIds = new Set(allClients.map(c => c.keyId).filter(Boolean));

        let deletedCount = 0;
        for (const k of allKeys) {
          if (k.isUsed && k.usedAt && !activeKeyIds.has(k.id)) {
            const usedTime = new Date(k.usedAt).getTime();
            if (now - usedTime > 24 * 60 * 60 * 1000) {
              await db.delete(keys).where(eq(keys.id, k.id));
              deletedCount++;
            }
          }
        }
        return { success: true, deletedCount };
      }),

    listDownloads: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(downloads).orderBy(desc(downloads.id));
    }),

    addDownload: protectedProcedure
      .input(z.object({ title: z.string(), description: z.string().optional(), version: z.string(), fileUrl: z.string(), type: z.enum(["basic", "advanced", "ios"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.insert(downloads).values({
          title: input.title,
          description: input.description || null,
          version: input.version,
          fileUrl: input.fileUrl,
          type: input.type,
        });
        return { success: true };
      }),

    updateDownload: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string(), description: z.string().optional(), version: z.string(), fileUrl: z.string(), type: z.enum(["basic", "advanced", "ios"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.update(downloads).set({
          title: input.title,
          description: input.description || null,
          version: input.version,
          fileUrl: input.fileUrl,
          type: input.type,
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

    forceRotateIos: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const availableIosKeys = await db.select().from(keys).where(and(eq(keys.type, "ios"), eq(keys.isUsed, false), eq(keys.isActive, true)));
        const lowStock = availableIosKeys.length < 3;

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "MANUAL_IOS_ROTATION",
          details: `Moderador forçou rotação manual de chaves iOS. Keys livres disponíveis: ${availableIosKeys.length}. ${lowStock ? "ALERTA: Estoque abaixo de 3 keys!" : "Estoque normal."}`,
        });

        return { success: true, availableCount: availableIosKeys.length, lowStock };
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
      .input(z.object({ title: z.string(), description: z.string().optional(), videoUrl: z.string(), type: z.enum(["basic", "advanced", "ios"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.insert(tutorials).values({
          title: input.title,
          description: input.description || null,
          videoUrl: input.videoUrl,
          type: input.type,
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
      if (!db) return { creditsBasic: 0, creditsAdvanced: 0, clientsCount: 0, clients: [] };

      const resellerRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const reseller = resellerRes[0];

      const isPremium = reseller.isPremium || false;
      // Se for premium, vê todos os clientes do sistema; senão, apenas os seus
      const clientsList = isPremium
        ? await db.select().from(users).where(eq(users.role, "client"))
        : await db.select().from(users).where(eq(users.resellerId, ctx.user.id));

      const clientsFormatted = [];
      for (const c of clientsList) {
        let keyValue = "Nenhuma";
        if (c.keyId) {
          const kRes = await db.select().from(keys).where(eq(keys.id, c.keyId)).limit(1);
          if (kRes.length > 0) keyValue = kRes[0].keyValue;
        }
        let usedAt = null;
        if (c.keyId) {
          const kRes = await db.select().from(keys).where(eq(keys.id, c.keyId)).limit(1);
          if (kRes.length > 0) usedAt = kRes[0].usedAt;
        }

        clientsFormatted.push({
          id: c.id,
          username: c.openId,
          isActive: c.isActive,
          maxDevices: c.maxDevices || 1,
          keyValue,
          expiresAt: c.expiresAt ? new Date(c.expiresAt).getTime() : null,
          usedAt: usedAt ? new Date(usedAt).getTime() : null,
        });
      }

      return {
        creditsBasic: reseller.creditsBasic || 0,
        creditsAdvanced: reseller.creditsAdvanced || 0,
        creditsIos: reseller.creditsIos || 0,
        isPremium,
        clientsCount: clientsFormatted.length,
        clients: clientsFormatted,
      };
    }),

    createClient: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string(), type: z.enum(["basic", "advanced", "ios", "ios_basic", "ios_advanced"]), maxDevices: z.number().default(1) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller" && ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const cleanUsername = input.username.trim();
        const existingUser = await db.select().from(users).where(eq(users.openId, cleanUsername)).limit(1);
        if (existingUser.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este nome de usuário já está em uso." });
        }

        const resRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const actor = resRes[0];

        if (ctx.user.role === "reseller") {
          if (input.type === "basic") {
            if ((actor.creditsBasic || 0) < 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Créditos insuficientes de Proxy Basic." });
            }
          } else if (input.type === "advanced") {
            if ((actor.creditsAdvanced || 0) < 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Créditos insuficientes de Proxy Advanced." });
            }
          } else {
            if ((actor.creditsIos || 0) < 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Créditos insuficientes de Proxy iOS." });
            }
          }
        }

        let keyId: number | null = null;
        let keyValueUsed = "DEFAULT-KEY-" + input.type.toUpperCase();

        const now = new Date();
        const expiresAtDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas

        if (input.type === "ios") {
          // iOS compartilha a chave ativa mais recente
          const latestKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, "ios"))).orderBy(desc(keys.id)).limit(1);
          if (latestKey.length > 0) {
            keyId = latestKey[0].id;
            keyValueUsed = latestKey[0].keyValue;
            await db.update(keys).set({ isUsed: true, usedAt: now }).where(eq(keys.id, keyId));
          } else {
            await db.insert(keys).values({ keyValue: keyValueUsed, type: "ios", isActive: true, isUsed: true, usedAt: now });
            const inserted = await db.select().from(keys).where(eq(keys.keyValue, keyValueUsed)).limit(1);
            if (inserted.length > 0) keyId = inserted[0].id;
          }
        } else {
          // Basic e Advanced puxam obrigatoriamente uma chave NÃO UTILIZADA (isUsed = false)
          const unusedKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, input.type), eq(keys.isUsed, false))).orderBy(keys.id).limit(1);
          if (unusedKey.length > 0) {
            keyId = unusedKey[0].id;
            keyValueUsed = unusedKey[0].keyValue;
            // Ao ser usada em Basic/Advanced, a chave é banida/removida do estoque ativo, mas preservada no usuário
            await db.update(keys).set({ isUsed: true, isBanned: true, usedAt: now }).where(eq(keys.id, keyId));
          } else {
            // Se o estoque acabou, gera uma nova chave exclusiva que já nasce usada/banida do estoque ativo
            keyValueUsed = "KEY-" + input.type.toUpperCase() + "-" + Math.random().toString(36).substring(2, 10).toUpperCase();
            await db.insert(keys).values({ keyValue: keyValueUsed, type: input.type, isActive: true, isUsed: true, isBanned: true, usedAt: now });
            const inserted = await db.select().from(keys).where(eq(keys.keyValue, keyValueUsed)).limit(1);
            if (inserted.length > 0) keyId = inserted[0].id;
          }
        }

        const passHash = hashPassword(input.password);

        await db.insert(users).values({
          openId: cleanUsername,
          role: "client",
          passwordHash: passHash as any,
          resellerId: ctx.user.id,
          keyId: keyId,
          maxDevices: input.maxDevices || 1,
          credits: 0,
          isActive: true,
          expiresAt: expiresAtDate,
        });

        // already handled above

        if (ctx.user.role === "reseller") {
          if (input.type === "basic") {
            await db.update(users).set({ creditsBasic: (actor.creditsBasic || 0) - 1 }).where(eq(users.id, actor.id));
          } else if (input.type === "advanced") {
            await db.update(users).set({ creditsAdvanced: (actor.creditsAdvanced || 0) - 1 }).where(eq(users.id, actor.id));
          } else {
            await db.update(users).set({ creditsIos: (actor.creditsIos || 0) - 1 }).where(eq(users.id, actor.id));
          }
        }

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: ctx.user.role === "moderator" ? "MODERATOR_CREATE_CLIENT" : "RESELLER_CREATE_CLIENT",
          details: `${ctx.user.role === "moderator" ? "Moderador" : "Revendedor"} ${actor.openId} criou o cliente ${input.username} (${input.type}) com a Key ${keyValueUsed}.`,
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

    renewClient: protectedProcedure
      .input(z.object({ clientId: z.number(), type: z.enum(["basic", "advanced", "ios", "ios_basic", "ios_advanced"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller" && ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        let clientRes;
        if (ctx.user.role === "moderator") {
          clientRes = await db.select().from(users).where(eq(users.id, input.clientId)).limit(1);
        } else {
          clientRes = await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.resellerId, ctx.user.id))).limit(1);
        }
        if (clientRes.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        const client = clientRes[0];

        const targetType = input.type;

        // Liberar key antiga do cliente se houver
        if (client.keyId) {
          await db.update(keys).set({ isUsed: false }).where(eq(keys.id, client.keyId));
        }

        // Verificar créditos do ator (se for revendedor)
        const resRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const reseller = resRes[0];

        if (ctx.user.role === "reseller") {
          if (targetType === "basic") {
            if ((reseller.creditsBasic || 0) < 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Créditos insuficientes de Proxy Basic para renovação." });
            }
          } else if (targetType === "advanced") {
            if ((reseller.creditsAdvanced || 0) < 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Créditos insuficientes de Proxy Advanced para renovação." });
            }
          } else {
            if ((reseller.creditsIos || 0) < 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Créditos insuficientes de Proxy iOS para renovação." });
            }
          }
        }

        let newKeyId: number | null = null;
        let newKeyValue = "DEFAULT-KEY-" + targetType.toUpperCase();

        if (targetType === "ios") {
          const latestKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, "ios"))).orderBy(desc(keys.id)).limit(1);
          if (latestKey.length > 0) {
            newKeyId = latestKey[0].id;
            newKeyValue = latestKey[0].keyValue;
          } else {
            await db.insert(keys).values({ keyValue: newKeyValue, type: "ios", isActive: true });
            const inserted = await db.select().from(keys).where(eq(keys.keyValue, newKeyValue)).limit(1);
            if (inserted.length > 0) newKeyId = inserted[0].id;
          }
        } else {
          const unusedKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, targetType), eq(keys.isUsed, false))).orderBy(keys.id).limit(1);
          if (unusedKey.length > 0) {
            newKeyId = unusedKey[0].id;
            newKeyValue = unusedKey[0].keyValue;
            await db.update(keys).set({ isUsed: true, isBanned: true }).where(eq(keys.id, newKeyId));
          } else {
            newKeyValue = "KEY-" + targetType.toUpperCase() + "-" + Math.random().toString(36).substring(2, 10).toUpperCase();
            await db.insert(keys).values({ keyValue: newKeyValue, type: targetType, isActive: true, isUsed: true, isBanned: true });
            const inserted = await db.select().from(keys).where(eq(keys.keyValue, newKeyValue)).limit(1);
            if (inserted.length > 0) newKeyId = inserted[0].id;
          }
        }

        const renewalNow = new Date();
        const newExpiresAt = new Date(renewalNow.getTime() + 24 * 60 * 60 * 1000);

        if (newKeyId) {
          await db.update(keys).set({ isUsed: true, isBanned: targetType !== "ios", usedAt: renewalNow }).where(eq(keys.id, newKeyId));
        }

        // Atualizar cliente com a nova key mais recente e renovar validade por 24h
        await db.update(users).set({ keyId: newKeyId, expiresAt: newExpiresAt, isActive: true }).where(eq(users.id, client.id));

        // Descontar crédito apenas se for revendedor
        if (ctx.user.role === "reseller") {
          if (targetType === "basic") {
            await db.update(users).set({ creditsBasic: (reseller.creditsBasic || 0) - 1 }).where(eq(users.id, reseller.id));
          } else if (targetType === "advanced") {
            await db.update(users).set({ creditsAdvanced: (reseller.creditsAdvanced || 0) - 1 }).where(eq(users.id, reseller.id));
          } else {
            await db.update(users).set({ creditsIos: (reseller.creditsIos || 0) - 1 }).where(eq(users.id, reseller.id));
          }
        }

        // Deletar sessões ativas do cliente para forçar novo login/atualização
        await db.delete(sessions).where(eq(sessions.userId, client.id));

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "RESELLER_RENEW_CLIENT",
          details: `Revendedor ${reseller.openId} renovou o cliente ${client.openId} (${targetType}) com nova Key ${newKeyValue}.`,
        });

        return { success: true, newKeyValue };
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
      let keyType = "advanced";
      let keyUsedAt: Date | null = null;
      if (client.keyId) {
        const kRes = await db.select().from(keys).where(eq(keys.id, client.keyId)).limit(1);
        if (kRes.length > 0) {
          keyValue = kRes[0].keyValue;
          keyType = kRes[0].type || "advanced";
          keyUsedAt = kRes[0].usedAt || null;
        }
      }

      // Se for ios_basic ou ios_advanced, permite buscar também downloads de 'ios' caso não haja específicos cadastrados
      const targetTypes = [keyType];
      if (keyType === "ios_basic" || keyType === "ios_advanced") {
        targetTypes.push("ios");
      }

      const allDownloads = await db.select().from(downloads).orderBy(desc(downloads.id));
      const allTutorials = await db.select().from(tutorials).orderBy(desc(tutorials.id));

      const filteredDownloads = allDownloads.filter(d => targetTypes.includes(d.type || "advanced"));
      const filteredTutorials = allTutorials.filter(t => targetTypes.includes(t.type || "advanced"));

      return {
        username: client.openId,
        keyValue,
        keyType,
        keyUsedAt,
        expiresAt: client.expiresAt || null,
        downloads: filteredDownloads,
        tutorials: filteredTutorials,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
