import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { users, keys, downloads, tutorials, sessions, logs, announcements } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, signJwt } from "./auth";
import { TRPCError } from "@trpc/server";

const ALL_PRODUCT_TYPES = ["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"] as const;
const productTypeSchema = z.enum(ALL_PRODUCT_TYPES);

function getEnabledProducts(value: unknown): string[] {
  if (!value) return [...ALL_PRODUCT_TYPES];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((p): p is string => ALL_PRODUCT_TYPES.includes(p as any)) : [...ALL_PRODUCT_TYPES];
  } catch {
    return [...ALL_PRODUCT_TYPES];
  }
}

async function resolveMediaFireUrl(videoUrl: string): Promise<string> {
  try {
    const parsed = new URL(videoUrl);
    if (!parsed.hostname.toLowerCase().endsWith("mediafire.com")) return videoUrl;
    const response = await fetch(videoUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) return videoUrl;
    const html = await response.text();
    const match = html.match(/href="(https:\/\/download[^" ]+)"/i);
    return match?.[1]?.replace(/&amp;/g, "&") || videoUrl;
  } catch {
    return videoUrl;
  }
}

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
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
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
      if (!db) return { totalClients: 0, totalResellers: 0, totalKeys: 0, usedKeys: 0, activeSessions: 0, stock: {} };

      const clientsRes = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "client"));
      const resellersRes = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "reseller"));
      const keysRes = await db.select({ count: sql`count(*)` }).from(keys);
      const usedKeysRes = await db.select({ count: sql`count(*)` }).from(keys).where(eq(keys.isUsed, true));
      const sessionsRes = await db.select({ count: sql`count(*)` }).from(sessions);
      const availableKeys = await db.select({ type: keys.type }).from(keys).where(and(eq(keys.isActive, true), eq(keys.isUsed, false), eq(keys.isBanned, false)));
      const stock = availableKeys.reduce((acc: Record<string, number>, key) => {
        acc[key.type] = (acc[key.type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalClients: Number(clientsRes[0]?.count || 0),
        totalResellers: Number(resellersRes[0]?.count || 0),
        totalKeys: Number(keysRes[0]?.count || 0),
        usedKeys: Number(usedKeysRes[0]?.count || 0),
        activeSessions: Number(sessionsRes[0]?.count || 0),
        stock,
      };
    }),

    keyAuditByReseller: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];

      const resellerRows = await db.select({ id: users.id, username: users.openId, isPremium: users.isPremium }).from(users).where(eq(users.role, "reseller"));
      const clientRows = await db.select({ id: users.id, username: users.openId, resellerId: users.resellerId, keyId: users.keyId, createdAt: users.createdAt }).from(users).where(eq(users.role, "client"));
      const keyRows = await db.select().from(keys);
      const keyById = new Map(keyRows.map((key) => [key.id, key]));
      const deletionLogs = await db.select().from(logs).where(eq(logs.action, "RESELLER_DELETE_CLIENT"));
      const deletedByReseller = new Map<number, any[]>();
      for (const log of deletionLogs) {
        if (!log.userId || !log.details) continue;
        const match = log.details.match(/clientId=(\d+)\|clientUsername=([^|]*)\|keyId=([^|]*)\|keyValue=([^|]*)\|keyType=([^|]*)/);
        if (!match) continue;
        const [, clientId, clientUsername, keyId, keyValue, keyType] = match;
        const list = deletedByReseller.get(log.userId) || [];
        list.push({ clientId: Number(clientId), clientUsername, keyId: keyId === "null" ? null : Number(keyId), keyValue, keyType, keyIsUsed: true, keyIsBanned: false, keyUsedAt: null, clientCreatedAt: log.createdAt, deletedAt: log.createdAt, isDeleted: true });
        deletedByReseller.set(log.userId, list);
      }

      return resellerRows.map((reseller) => {
        const assigned = clientRows.filter((client) => client.resellerId === reseller.id && client.keyId);
        const details = assigned.map((client) => {
          const key = keyById.get(client.keyId as number);
          return {
            clientId: client.id,
            clientUsername: client.username,
            keyId: client.keyId,
            keyValue: key?.keyValue || "Key não encontrada",
            keyType: key?.type || "unknown",
            keyIsUsed: key?.isUsed || false,
            keyIsBanned: key?.isBanned || false,
            keyUsedAt: key?.usedAt || null,
            clientCreatedAt: client.createdAt,
          };
        });
        const historical = deletedByReseller.get(reseller.id) || [];
        const allDetails = [...details, ...historical];
        const counts = allDetails.reduce((acc: Record<string, number>, item) => {
          acc[item.keyType] = (acc[item.keyType] || 0) + 1;
          return acc;
        }, {});
        return {
          resellerId: reseller.id,
          resellerUsername: reseller.username,
          resellerIsPremium: reseller.isPremium || false,
          totalKeys: allDetails.length,
          counts,
          keys: allDetails,
        };
      });
    }),

    listResellers: protectedProcedure.query(async ({ ctx }) => {
      const isMod = ctx.user.role === "moderator";
      const isPremiumReseller = ctx.user.role === "reseller";
      
      if (!isMod && !isPremiumReseller) throw new TRPCError({ code: "FORBIDDEN" });
      
      const db = await getDb();
      if (!db) return [];

      const query = isMod || isPremiumReseller
        ? db.select().from(users).where(eq(users.role, "reseller"))
        : db.select().from(users).where(and(eq(users.role, "reseller"), eq(users.resellerId, ctx.user.id)));

      const resellers = await query;
      const result = [];
      for (const r of resellers) {
        const clientCountRes = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.resellerId, r.id));
        
        result.push({
          id: r.id,
          username: r.openId,
          credits: {
            basic: r.creditsBasic || 0,
            advanced: r.creditsAdvanced || 0,
            ios: r.creditsIos || 0,
            panel_ios: r.creditsPanelIos || 0,
            panel_legitimo: r.creditsPanelLegitimo || 0,
            panel_android: r.creditsPanelAndroid || 0,
            ios_ipa: r.creditsIosIpa || 0,
          },
          enabledProducts: getEnabledProducts(r.enabledProducts),
          isActive: r.isActive,
          isPremium: r.isPremium || false,
          clientCount: Number(clientCountRes[0]?.count || 0),
        });
      }
      return result;
    }),

    createClient: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string(), type: z.enum(["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"]), maxDevices: z.number().default(1) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN", message: "Somente o Moderador pode usar esta rota." });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cleanUsername = input.username.trim();
        const existing = await db.select().from(users).where(eq(users.openId, cleanUsername)).limit(1);
        if (existing.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Este nome de usuário já está em uso." });
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        let keyId: number | null = null;
        let keyValue = "";
        if (input.type === "ios") {
          const found = await db.select().from(keys).where(and(eq(keys.type, "ios"), eq(keys.isActive, true))).orderBy(desc(keys.id)).limit(1);
          if (!found.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre uma Key ativa do Proxy iOS." });
          keyId = found[0].id; keyValue = found[0].keyValue;
        } else if (input.type === "ios_ipa") {
          const found = await db.select().from(keys).where(and(eq(keys.type, "ios_ipa"), eq(keys.isActive, true), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (!found.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há Key IPA disponível. Cadastre uma Key IPA nova e não utilizada." });
          keyId = found[0].id; keyValue = found[0].keyValue;
          await db.update(keys).set({ isUsed: true, isBanned: true, usedAt: now }).where(eq(keys.id, keyId));
        } else if (input.type === "panel_ios" || input.type === "panel_legitimo" || input.type === "panel_android") {
          const found = await db.select().from(keys).where(and(eq(keys.type, input.type), eq(keys.isActive, true), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (found.length) {
            keyId = found[0].id; keyValue = found[0].keyValue;
            await db.update(keys).set({ isUsed: true, usedAt: now }).where(eq(keys.id, keyId));
          } else if (input.type === "panel_legitimo") {
            keyValue = `KEY-PANEL-LEGITIMO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            await db.insert(keys).values({ keyValue, type: input.type, isActive: true, isUsed: true, usedAt: now });
            const inserted = await db.select().from(keys).where(eq(keys.keyValue, keyValue)).limit(1);
            if (inserted.length) keyId = inserted[0].id;
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre uma Key panel_ios nova e não usada." });
          }
        } else {
          const found = await db.select().from(keys).where(and(eq(keys.type, input.type), eq(keys.isActive, true), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (!found.length) throw new TRPCError({ code: "BAD_REQUEST", message: `Cadastre uma Key ${input.type} nova e não usada.` });
          keyId = found[0].id; keyValue = found[0].keyValue;
          await db.update(keys).set({ isUsed: true, isBanned: true, usedAt: now }).where(eq(keys.id, keyId));
        }
        await db.insert(users).values({ openId: cleanUsername, role: "client", passwordHash: hashPassword(input.password) as any, resellerId: null, keyId, maxDevices: input.maxDevices || 1, credits: 0, isActive: true, expiresAt });
        await db.insert(logs).values({ userId: ctx.user.id, action: "MODERATOR_CREATE_CLIENT", details: `Moderador ${ctx.user.username} criou ${cleanUsername} (${input.type}) com a Key ${keyValue}.` });
        return { success: true, createdUsername: cleanUsername, createdPassword: input.password };
      }),

    createReseller: protectedProcedure
      .input(z.object({ 
        username: z.string(), 
        password: z.string(), 
        creditsBasic: z.number().default(0), 
        creditsAdvanced: z.number().default(0), 
        creditsIos: z.number().default(0),
        creditsPanelIos: z.number().default(0),
        creditsPanelLegitimo: z.number().default(0),
        creditsIosIpa: z.number().default(0),
        isPremium: z.boolean().default(false) 
      }))
      .mutation(async ({ input, ctx }) => {
        const isMod = ctx.user.role === "moderator";

        // A criação de revendedores permanece exclusiva do Moderador.
        if (!isMod) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Somente o Moderador pode criar revendedores." });
        }
        
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const actorRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const actor = actorRes[0];

        if (!isMod) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const passHash = hashPassword(input.password);
        await db.insert(users).values({
          openId: input.username,
          role: "reseller",
          passwordHash: passHash as any,
          resellerId: null,
          isActive: true,
          isPremium: input.isPremium,
          creditsBasic: input.creditsBasic,
          creditsAdvanced: input.creditsAdvanced,
          creditsIos: input.creditsIos,
          creditsPanelIos: input.creditsPanelIos,
          creditsPanelLegitimo: input.creditsPanelLegitimo,
          creditsIosIpa: input.creditsIosIpa,
        });

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "CREATE_RESELLER",
          details: `${ctx.user.role} ${ctx.user.username} criou revendedor ${input.username}.`,
        });

        return { success: true };
      }),

    updateResellerCredits: protectedProcedure
      .input(z.object({ resellerId: z.number(), amount: z.number(), type: z.enum(["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"]), action: z.enum(["add", "remove"]) }))
      .mutation(async ({ input, ctx }) => {
        const isMod = ctx.user.role === "moderator";
        const isReseller = ctx.user.role === "reseller";
        
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const targetResellerRes = await db.select().from(users).where(eq(users.id, input.resellerId)).limit(1);
        if (targetResellerRes.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
        const sub = targetResellerRes[0];

        const actorRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const actor = actorRes[0];

        const colMap: any = { basic: "creditsBasic", advanced: "creditsAdvanced", ios: "creditsIos", panel_ios: "creditsPanelIos", panel_legitimo: "creditsPanelLegitimo", panel_android: "creditsPanelAndroid", ios_ipa: "creditsIosIpa" };
        const col = colMap[input.type];

        if (isReseller) {
          if (!actor.isPremium) throw new TRPCError({ code: "FORBIDDEN", message: "Somente revendedores Premium podem gerenciar créditos de outros revendedores." });
          if (input.type === "panel_ios" || input.type === "panel_legitimo" || input.type === "panel_android") throw new TRPCError({ code: "FORBIDDEN", message: "Revendedores Premium não podem distribuir créditos de Painéis." });
          if (sub.role !== "reseller" || sub.isPremium) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Revendedor Premium só pode adicionar ou remover créditos de revendedores Basic." });
          }
          
          if (input.action === "add") {
            const parentAmount = (actor as any)[col] || 0;
            if (parentAmount < input.amount) throw new TRPCError({ code: "BAD_REQUEST", message: "Saldo insuficiente." });
            
            await db.update(users).set({ [col]: parentAmount - input.amount }).where(eq(users.id, actor.id));
          }
        } else if (!isMod) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const currentSubAmount = (sub as any)[col] || 0;
        const newAmount = input.action === "add" ? currentSubAmount + input.amount : Math.max(0, currentSubAmount - input.amount);
        
        await db.update(users).set({ [col]: newAmount }).where(eq(users.id, sub.id));

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: `UPDATE_CREDITS_${input.type.toUpperCase()}`,
          details: `${ctx.user.role} ${input.action === "add" ? "adicionou" : "removeu"} ${input.amount} créditos ${input.type} do revendedor ${sub.openId}.`,
        });

        return { success: true, newCredits: newAmount };
            }),
    updateResellerProducts: protectedProcedure
      .input(z.object({ resellerId: z.number(), products: z.array(productTypeSchema) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const resellerRes = await db.select().from(users).where(and(eq(users.id, input.resellerId), eq(users.role, "reseller"))).limit(1);
        if (!resellerRes.length) throw new TRPCError({ code: "NOT_FOUND", message: "Revendedor não encontrado." });
        const products = Array.from(new Set(input.products));
        await db.update(users).set({ enabledProducts: JSON.stringify(products) }).where(eq(users.id, input.resellerId));
        await db.insert(logs).values({ userId: ctx.user.id, action: "UPDATE_RESELLER_PRODUCTS", details: `Moderador configurou os produtos do revendedor ${resellerRes[0].openId}: ${products.join(", ") || "nenhum"}.` });
        return { success: true, products };
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
          keyType: c.keyId ? ((await db.select({ type: keys.type }).from(keys).where(eq(keys.id, c.keyId)).limit(1))[0]?.type || "advanced") : "advanced",
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
          const actorRes = await db.select({ id: users.id, isPremium: users.isPremium }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
          const actor = actorRes[0];
          if (!actor) throw new TRPCError({ code: "FORBIDDEN" });

          const targetRes = await db.select({ id: users.id, role: users.role, resellerId: users.resellerId, isPremium: users.isPremium }).from(users).where(eq(users.id, input.userId)).limit(1);
          const target = targetRes[0];
          if (!target || target.role === "moderator") throw new TRPCError({ code: "FORBIDDEN", message: "Esse usuário não pode ter a sessão resetada por um revendedor." });

          if (actor.isPremium) {
            if (target.role === "reseller" && target.isPremium) {
              throw new TRPCError({ code: "FORBIDDEN", message: "Revendedor Premium não pode resetar outro revendedor Premium." });
            }
            // Premium pode resetar qualquer cliente e qualquer revendedor Basic.
          } else if (target.role !== "client" || target.resellerId !== actor.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Somente Premium pode resetar usuários de outros painéis." });
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
      .input(z.object({ keyValue: z.string(), type: z.enum(["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const keyValue = input.keyValue.trim();
        if (!keyValue) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma Key válida." });
        const existing = await db.select({ id: keys.id }).from(keys).where(and(eq(keys.keyValue, keyValue), eq(keys.type, input.type))).limit(1);
        if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Esta Key já está cadastrada neste tipo." });
        await db.insert(keys).values({ keyValue, type: input.type });
        return { success: true };
      }),

    importKeysBatch: protectedProcedure
      .input(z.object({ keysList: z.array(z.string()), type: z.enum(["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        let added = 0;
        let skipped = 0;
        const normalizedKeys = input.keysList.flatMap((value) => value.split(/\r?\n/).map((key) => key.trim())).filter(Boolean);
        for (const trimmed of normalizedKeys) {
          const exists = await db.select({ id: keys.id }).from(keys).where(and(eq(keys.keyValue, trimmed), eq(keys.type, input.type))).limit(1);
          if (exists.length > 0) {
            skipped++;
            continue;
          }
          await db.insert(keys).values({ keyValue: trimmed, type: input.type });
          added++;
        }
        return { success: true, added, skipped, received: normalizedKeys.length };
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
        const existing = await db.select({ id: keys.id }).from(keys).where(eq(keys.id, input.keyId)).limit(1);
        if (!existing.length) throw new TRPCError({ code: "NOT_FOUND", message: "Key não encontrada." });
        await db.delete(keys).where(eq(keys.id, input.keyId));
        return { success: true };
      }),

    deleteAndroidKey: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const existing = await db.select({ id: keys.id }).from(keys).where(and(eq(keys.id, input.keyId), eq(keys.type, "panel_android"))).limit(1);
        if (!existing.length) throw new TRPCError({ code: "NOT_FOUND", message: "Key do Painel Android não encontrada." });
        await db.delete(keys).where(and(eq(keys.id, input.keyId), eq(keys.type, "panel_android")));
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
      .input(z.object({ title: z.string(), description: z.string().nullable().optional(), version: z.string(), fileUrl: z.string(), type: z.string() }))
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
      .input(z.object({ id: z.number(), title: z.string(), description: z.string().nullable().optional(), version: z.string(), fileUrl: z.string(), type: z.string() }))
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

    listResellerLogs: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      const resellerRows = await db.select({ id: users.id, username: users.openId, isPremium: users.isPremium }).from(users).where(eq(users.role, "reseller"));
      const resellerMap = new Map(resellerRows.map((r) => [r.id, r]));
      const allLogs = await db.select().from(logs).orderBy(desc(logs.id)).limit(500);
      return allLogs
        .filter((log) => log.userId !== null && resellerMap.has(log.userId))
        .map((log) => {
          const reseller = resellerMap.get(log.userId as number)!;
          return { ...log, resellerUsername: reseller.username, resellerIsPremium: reseller.isPremium || false };
        });
    }),

    listAnnouncements: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(announcements).orderBy(desc(announcements.id));
    }),

    addAnnouncement: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1).max(255),
        message: z.string().trim().min(1),
        productType: z.enum(["all", ...ALL_PRODUCT_TYPES]),
        durationSeconds: z.number().int().min(1).max(300),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(announcements).values(input);
        return { success: true };
      }),

    toggleAnnouncement: protectedProcedure
      .input(z.object({ announcementId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(announcements).set({ isActive: input.isActive }).where(eq(announcements.id, input.announcementId));
        return { success: true };
      }),

    deleteAnnouncement: protectedProcedure
      .input(z.object({ announcementId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(announcements).where(eq(announcements.id, input.announcementId));
        return { success: true };
      }),

    listTutorials: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(tutorials).orderBy(desc(tutorials.id));
    }),

    addTutorial: protectedProcedure
      .input(z.object({ title: z.string(), description: z.string().nullable().optional(), videoUrl: z.string(), type: z.string() }))
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

    updateTutorialType: protectedProcedure
      .input(z.object({ tutorialId: z.number(), type: productTypeSchema }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(tutorials).set({ type: input.type }).where(eq(tutorials.id, input.tutorialId));
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
    resetClientSession: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const actorRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const actor = actorRes[0];
        if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });

        const clientRes = await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.role, "client"))).limit(1);
        const client = clientRes[0];
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });

        if (!actor.isPremium && client.resellerId !== actor.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence ao seu painel." });
        }

        await db.delete(sessions).where(eq(sessions.userId, client.id));
        await db.insert(logs).values({
          userId: actor.id,
          action: "RESET_SESSION",
          details: `Revendedor ${actor.openId} resetou a sessão do cliente ${client.openId}.`,
        });
        return { success: true };
      }),

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
        let ownerIsPremium = false;
        let ownerId: number | null = c.resellerId || null;
        let ownerRole: string | null = null;
        if (c.resellerId) {
          const ownerRes = await db.select({ id: users.id, isPremium: users.isPremium, role: users.role }).from(users).where(eq(users.id, c.resellerId)).limit(1);
          ownerId = ownerRes[0]?.id || null;
          ownerIsPremium = ownerRes[0]?.isPremium || false;
          ownerRole = ownerRes[0]?.role || null;
        }
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
          keyType: c.keyId ? ((await db.select({ type: keys.type }).from(keys).where(eq(keys.id, c.keyId)).limit(1))[0]?.type || null) : null,
          expiresAt: c.expiresAt ? new Date(c.expiresAt).getTime() : null,
          usedAt: usedAt ? new Date(usedAt).getTime() : null,
          ownerIsPremium,
          ownerId,
          ownerRole,
        });
      }

        return {
          resellerId: reseller.id,
          credits: {
          basic: reseller.creditsBasic || 0,
          advanced: reseller.creditsAdvanced || 0,
          ios: reseller.creditsIos || 0,
          panel_ios: reseller.creditsPanelIos || 0,
          panel_legitimo: reseller.creditsPanelLegitimo || 0,
          panel_android: reseller.creditsPanelAndroid || 0,
          ios_ipa: reseller.creditsIosIpa || 0,
        },
        enabledProducts: getEnabledProducts(reseller.enabledProducts),
        isPremium,
        clientsCount: clientsFormatted.length,
        clients: clientsFormatted,
      };
    }),

    createClient: protectedProcedure
      .input(z.object({ username: z.string(), password: z.string(), type: z.enum(["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"]), maxDevices: z.number().default(1) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller" && ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const cleanUsername = input.username.trim();
        const existingUser = await db.select().from(users).where(eq(users.openId, cleanUsername)).limit(1);
        if (existingUser.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este nome de usuário já está em uso." });
        }

        const actorRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const actor = actorRes[0];

        const colMap: any = { basic: "creditsBasic", advanced: "creditsAdvanced", ios: "creditsIos", panel_ios: "creditsPanelIos", panel_legitimo: "creditsPanelLegitimo", panel_android: "creditsPanelAndroid", ios_ipa: "creditsIosIpa" };
        const col = colMap[input.type];

        if (ctx.user.role === "reseller" && !getEnabledProducts(actor.enabledProducts).includes(input.type)) {
          throw new TRPCError({ code: "FORBIDDEN", message: `O produto ${input.type.toUpperCase()} não está habilitado para este revendedor.` });
        }

        if (ctx.user.role === "reseller") {
          const currentAmount = (actor as any)[col] || 0;
          if (currentAmount < 1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Créditos insuficientes de ${input.type.toUpperCase()}.` });
          }
        }

        let keyId: number | null = null;
        let keyValueUsed = "DEFAULT-KEY-" + input.type.toUpperCase();

        const now = new Date();
        const expiresAtDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas

        if (input.type === "ios") {
          // Proxy iOS comum usa a última Key ativa cadastrada.
          const latestProxyKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, "ios"))).orderBy(desc(keys.id)).limit(1);
          if (latestProxyKey.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há Key ativa do Proxy iOS cadastrada." });
          keyId = latestProxyKey[0].id;
          keyValueUsed = latestProxyKey[0].keyValue;
        } else if (input.type === "ios_ipa") {
          // Proxy iOS IPA usa uma Key exclusiva não utilizada por cliente.
          const unusedIpaKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, "ios_ipa"), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (unusedIpaKey.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há Key IPA disponível. Cadastre uma Key IPA nova e não utilizada." });
          keyId = unusedIpaKey[0].id;
          keyValueUsed = unusedIpaKey[0].keyValue;
          await db.update(keys).set({ isUsed: true, isBanned: true, usedAt: now }).where(eq(keys.id, keyId));
        } else if (input.type === "panel_ios" || input.type === "panel_legitimo" || input.type === "panel_android") {
          const panelType = input.type;
          const unusedPanelKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, panelType), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (unusedPanelKey.length === 0) {
            if (ctx.user.role !== "moderator" || panelType !== "panel_legitimo") throw new TRPCError({ code: "BAD_REQUEST", message: `Não há Key exclusiva disponível para ${panelType === "panel_ios" ? "o Painel iOS" : panelType === "panel_android" ? "o Painel Android" : "o Painel Legítimo"}. Cadastre uma Key ${panelType} nova.` });
            keyValueUsed = `KEY-PANEL-LEGITIMO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            await db.insert(keys).values({ keyValue: keyValueUsed, type: panelType, isActive: true, isUsed: true, usedAt: now });
            const inserted = await db.select().from(keys).where(eq(keys.keyValue, keyValueUsed)).limit(1);
            if (inserted.length > 0) keyId = inserted[0].id;
          } else {
            keyId = unusedPanelKey[0].id;
          keyValueUsed = unusedPanelKey[0].keyValue;
            await db.update(keys).set({ isUsed: true, usedAt: now }).where(eq(keys.id, keyId));
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
            throw new TRPCError({ code: "BAD_REQUEST", message: `Não há Key ${input.type.toUpperCase()} disponível. Cadastre uma Key nova e não usada no painel do Moderador.` });
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
          const currentAmount = (actor as any)[col] || 0;
          await db.update(users).set({ [col]: Math.max(0, currentAmount - 1) }).where(eq(users.id, ctx.user.id));
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
        const clientKey = client.keyId ? (await db.select().from(keys).where(eq(keys.id, client.keyId)).limit(1))[0] : null;
        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "RESELLER_DELETE_CLIENT",
          details: `clientId=${client.id}|clientUsername=${client.openId}|keyId=${client.keyId || "null"}|keyValue=${clientKey?.keyValue || "Nenhuma"}|keyType=${clientKey?.type || "unknown"}`,
        });
        if (client.keyId) {
          await db.update(keys).set({ isUsed: false }).where(eq(keys.id, client.keyId));
        }

        await db.delete(sessions).where(eq(sessions.userId, client.id));
        await db.delete(users).where(eq(users.id, client.id));

        return { success: true };
      }),

    renewClient: protectedProcedure
      .input(z.object({ clientId: z.number(), type: z.enum(["basic", "advanced", "ios", "panel_ios", "panel_legitimo", "panel_android", "ios_ipa"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller" && ctx.user.role !== "moderator") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const actorRes = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const actor = actorRes[0];
        if (!actor) throw new TRPCError({ code: "FORBIDDEN" });

        let clientRes;
        if (ctx.user.role === "moderator") {
          clientRes = await db.select().from(users).where(eq(users.id, input.clientId)).limit(1);
        } else if (actor.isPremium) {
          // Premium pode localizar clientes próprios e clientes de revendedores Basic;
          // a validação abaixo impede clientes pertencentes a outro Premium.
          clientRes = await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.role, "client"))).limit(1);
        } else {
          clientRes = await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.role, "client"), eq(users.resellerId, ctx.user.id))).limit(1);
        }
        if (clientRes.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado ou não autorizado." });
        const client = clientRes[0];

        // O Premium pode renovar qualquer cliente listado, inclusive expirado.
        // O Basic continua restrito aos próprios clientes pela consulta acima.

        const colMap: any = { basic: "creditsBasic", advanced: "creditsAdvanced", ios: "creditsIos", panel_ios: "creditsPanelIos", panel_legitimo: "creditsPanelLegitimo", panel_android: "creditsPanelAndroid", ios_ipa: "creditsIosIpa" };
        const col = colMap[input.type];

        if (ctx.user.role === "reseller" && !getEnabledProducts(actor.enabledProducts).includes(input.type)) {
          throw new TRPCError({ code: "FORBIDDEN", message: `O produto ${input.type.toUpperCase()} não está habilitado para este revendedor.` });
        }

        if (ctx.user.role === "reseller") {
          const currentAmount = (actor as any)[col] || 0;
          if (currentAmount < 1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Créditos insuficientes de ${input.type.toUpperCase()} para renovação.` });
          }
        }

        let newKeyId: number | null = null;
        let newKeyValue = "";

        const renewalNow = new Date();
        const newExpiresAt = new Date(renewalNow.getTime() + 24 * 60 * 60 * 1000);

        if (input.type === "ios") {
          // Proxy iOS comum troca para a última Key ativa.
          const latestProxyKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, "ios"))).orderBy(desc(keys.id)).limit(1);
          if (latestProxyKey.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há Key ativa do Proxy iOS cadastrada." });
          newKeyId = latestProxyKey[0].id;
          newKeyValue = latestProxyKey[0].keyValue;
        } else if (input.type === "ios_ipa") {
          // Proxy iOS IPA troca para uma Key exclusiva não utilizada.
          const unusedIpaKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, "ios_ipa"), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (unusedIpaKey.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há Key IPA disponível. Cadastre uma Key IPA nova e não utilizada." });
          newKeyId = unusedIpaKey[0].id;
          newKeyValue = unusedIpaKey[0].keyValue;
          await db.update(keys).set({ isUsed: true, isBanned: true, usedAt: renewalNow }).where(eq(keys.id, newKeyId));
        } else if (input.type === "panel_ios" || input.type === "panel_legitimo" || input.type === "panel_android") {
          const panelType = input.type;
          const unusedPanelKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, panelType), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (unusedPanelKey.length > 0) {
            newKeyId = unusedPanelKey[0].id;
            newKeyValue = unusedPanelKey[0].keyValue;
            await db.update(keys).set({ isUsed: true, usedAt: renewalNow }).where(eq(keys.id, newKeyId));
          } else if (client.keyId) {
            const currentClientKey = await db.select().from(keys).where(and(eq(keys.id, client.keyId), eq(keys.type, panelType))).limit(1);
            if (currentClientKey.length > 0) {
              newKeyId = currentClientKey[0].id;
              newKeyValue = currentClientKey[0].keyValue;
            } else {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Não há Key disponível para ${panelType}. Cadastre uma Key nova no painel do Moderador.` });
            }
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Não há Key disponível para ${panelType}. Cadastre uma Key nova no painel do Moderador.` });
          }
        } else {
          // Basic e Advanced usam uma Key nova quando existe; se o estoque acabar,
          // a renovação mantém a Key atual do próprio cliente.
          const unusedKey = await db.select().from(keys).where(and(eq(keys.isActive, true), eq(keys.type, input.type), eq(keys.isUsed, false), eq(keys.isBanned, false))).orderBy(keys.id).limit(1);
          if (unusedKey.length > 0) {
            newKeyId = unusedKey[0].id;
            newKeyValue = unusedKey[0].keyValue;
            await db.update(keys).set({ isUsed: true, isBanned: true, usedAt: renewalNow }).where(eq(keys.id, newKeyId));
          } else if (client.keyId) {
            const currentClientKey = await db.select().from(keys).where(and(eq(keys.id, client.keyId), eq(keys.type, input.type))).limit(1);
            if (currentClientKey.length > 0) {
              newKeyId = currentClientKey[0].id;
              newKeyValue = currentClientKey[0].keyValue;
            } else {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Não há Key ${input.type.toUpperCase()} disponível. Cadastre uma Key nova no painel do Moderador.` });
            }
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Não há Key ${input.type.toUpperCase()} disponível. Cadastre uma Key nova no painel do Moderador.` });
          }
        }

        // Atualizar cliente com a nova key mais recente e renovar validade por 24h
        await db.update(users).set({ keyId: newKeyId, expiresAt: newExpiresAt, isActive: true }).where(eq(users.id, client.id));

        // Descontar crédito apenas se for revendedor
        if (ctx.user.role === "reseller") {
          const currentAmount = (actor as any)[col] || 0;
          await db.update(users).set({ [col]: Math.max(0, currentAmount - 1) }).where(eq(users.id, ctx.user.id));
        }

        // Deletar sessões ativas do cliente para forçar novo login/atualização
        await db.delete(sessions).where(eq(sessions.userId, client.id));

        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "RESELLER_RENEW_CLIENT",
          details: `Revendedor ${actor.openId} renovou o cliente ${client.openId} (${input.type}) com nova Key ${newKeyValue}.`,
        });

        return { success: true, newKeyValue };
      }),

    addHours: protectedProcedure
      .input(z.object({ clientId: z.number(), hours: z.number().int().min(1).max(8760) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "reseller" && ctx.user.role !== "moderator") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const clientRes = ctx.user.role === "moderator"
          ? await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.role, "client"))).limit(1)
          : await db.select().from(users).where(and(eq(users.id, input.clientId), eq(users.role, "client"), eq(users.resellerId, ctx.user.id))).limit(1);

        if (clientRes.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado ou não pertence ao seu painel." });
        }

        const client = clientRes[0];
        const now = Date.now();
        const currentExpiry = client.expiresAt ? new Date(client.expiresAt).getTime() : 0;
        const baseTime = Math.max(now, currentExpiry);
        const newExpiresAt = new Date(baseTime + input.hours * 60 * 60 * 1000);

        await db.update(users).set({ expiresAt: newExpiresAt, isActive: true }).where(eq(users.id, client.id));
        await db.insert(logs).values({
          userId: ctx.user.id,
          action: "ADD_CLIENT_HOURS",
          details: `${ctx.user.role} adicionou ${input.hours} hora(s) ao cliente ${client.openId}, sem renovar key e sem consumir crédito.`,
        });

        return { success: true, expiresAt: newExpiresAt.getTime() };
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
      const activeAnnouncements = await db.select().from(announcements)
        .where(eq(announcements.isActive, true))
        .orderBy(desc(announcements.id));

      const filteredDownloads = allDownloads.filter(d => targetTypes.includes(d.type || "advanced"));
      const filteredTutorials = allTutorials.filter(t => targetTypes.includes(t.type || "advanced"));
      const resolvedTutorials = await Promise.all(filteredTutorials.map(async (tutorial) => ({
        ...tutorial,
        videoUrl: await resolveMediaFireUrl(tutorial.videoUrl),
      })));

      return {
        username: client.openId,
        keyValue,
        keyType,
        keyUsedAt,
        expiresAt: client.expiresAt || null,
        downloads: filteredDownloads,
        tutorials: resolvedTutorials,
        announcements: activeAnnouncements.filter(a => a.productType === "all" || a.productType === keyType),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
