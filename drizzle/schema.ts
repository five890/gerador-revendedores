import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["moderator", "reseller", "client", "user", "admin"]).default("user").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  credits: int("credits").default(0).notNull(), // general / legacy
  creditsBasic: int("creditsBasic").default(0).notNull(),
  creditsAdvanced: int("creditsAdvanced").default(0).notNull(),
  // Saldo do Proxy iOS existente (tipo ios)
  creditsIos: int("creditsIos").default(0).notNull(),
  // Saldo independente do novo Painel iOS (tipo panel_ios)
  creditsPanelIos: int("creditsPanelIos").default(0).notNull(),
  creditsAndroid: int("creditsAndroid").default(0).notNull(),
  resellerId: int("resellerId"),
  keyId: int("keyId"),
  maxDevices: int("maxDevices").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isPremium: boolean("isPremium").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const keys = mysqlTable("keys", {
  id: int("id").autoincrement().primaryKey(),
  keyValue: varchar("keyValue", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 50 }).default("advanced").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isUsed: boolean("isUsed").default(false).notNull(),
  isBanned: boolean("isBanned").default(false).notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const downloads = mysqlTable("downloads", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  version: varchar("version", { length: 50 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  type: varchar("type", { length: 50 }).default("advanced").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tutorials = mysqlTable("tutorials", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("videoUrl").notNull(),
  type: varchar("type", { length: 50 }).default("advanced").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});



export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 512 }).notNull(),
  deviceIdentifier: varchar("deviceIdentifier", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const logs = mysqlTable("logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});



export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Key = typeof keys.$inferSelect;
export type Download = typeof downloads.$inferSelect;
export type Tutorial = typeof tutorials.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Log = typeof logs.$inferSelect;

