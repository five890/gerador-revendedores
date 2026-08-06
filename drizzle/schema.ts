import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["moderator", "reseller", "client"]).default("client").notNull(),
  credits: int("credits").default(0).notNull(),
  resellerId: int("resellerId"), // ID do revendedor que criou este cliente (se for cliente)
  keyId: int("keyId"), // ID da key atribuída (se for cliente)
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const keys = mysqlTable("keys", {
  id: int("id").autoincrement().primaryKey(),
  keyValue: varchar("keyValue", { length: 255 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  isUsed: boolean("isUsed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const downloads = mysqlTable("downloads", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  version: varchar("version", { length: 50 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
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
export type Session = typeof sessions.$inferSelect;
export type Log = typeof logs.$inferSelect;
