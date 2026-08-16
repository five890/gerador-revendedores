-- Shelby Panel database schema and migrations snapshot
-- Generated from drizzle schema and SQL migrations; production row data requires a database dump.
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
  // Saldo independente do Painel Legítimo (tipo panel_legitimo)
  creditsPanelLegitimo: int("creditsPanelLegitimo").default(0).notNull(),
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


-- Migration: drizzle/0000_simple_sleepwalker.sql
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

-- Migration: drizzle/0001_flawless_scourge.sql
CREATE TABLE `downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`version` varchar(50) NOT NULL,
	`fileUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `downloads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyValue` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`isUsed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `keys_keyValue_unique` UNIQUE(`keyValue`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`details` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`deviceIdentifier` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `lastSignedIn` TO `username`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('moderator','reseller','client') NOT NULL DEFAULT 'client';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `username` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `credits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `resellerId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `keyId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `email`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;
-- Migration: drizzle/0002_outgoing_silhouette.sql
ALTER TABLE `users` DROP INDEX `users_username_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('moderator','reseller','client','user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `openId` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `loginMethod` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `lastSignedIn` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_openId_unique` UNIQUE(`openId`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `username`;
-- Migration: drizzle/0003_greedy_logan.sql
CREATE TABLE `tutorials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`videoUrl` text NOT NULL,
	`type` enum('basic','advanced','ios') NOT NULL DEFAULT 'advanced',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `downloads` ADD `type` enum('basic','advanced','ios') DEFAULT 'advanced' NOT NULL;--> statement-breakpoint
ALTER TABLE `keys` ADD `type` enum('basic','advanced','ios') DEFAULT 'advanced' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `creditsBasic` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `creditsAdvanced` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `creditsIos` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `maxDevices` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isPremium` boolean DEFAULT false NOT NULL;
-- Migration: drizzle/0004_heavy_venus.sql
ALTER TABLE `keys` ADD `usedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `expiresAt` timestamp;
-- Migration: drizzle/0005_separate_panel_ios_credits.sql
ALTER TABLE `users` ADD `creditsPanelIos` int DEFAULT 0 NOT NULL;

-- Migration: drizzle/0006_panel_legitimo.sql
ALTER TABLE `users` ADD `creditsPanelLegitimo` int DEFAULT 0 NOT NULL;
