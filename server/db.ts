import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users, keys, downloads, tutorials, sessions, logs, User, InsertUser } from "../drizzle/schema";
import { hashPassword } from "./auth";

let _db: ReturnType<typeof drizzle> | null = null;

async function ensureTables(dbUrl: string) {
  try {
    const connection = await mysql.createConnection(dbUrl);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        openId VARCHAR(64) NOT NULL UNIQUE,
        name TEXT,
        email VARCHAR(320),
        loginMethod VARCHAR(64),
        role VARCHAR(32) DEFAULT 'client' NOT NULL,
        passwordHash VARCHAR(255),
        credits INT DEFAULT 0 NOT NULL,
        creditsBasic INT DEFAULT 0 NOT NULL,
        creditsAdvanced INT DEFAULT 0 NOT NULL,
        creditsIos INT DEFAULT 0 NOT NULL,
        creditsPanelIos INT DEFAULT 0 NOT NULL,
        creditsPanelLegitimo INT DEFAULT 0 NOT NULL,
        creditsAndroid INT DEFAULT 0 NOT NULL,
        creditsPanelAndroid INT DEFAULT 0 NOT NULL,
        creditsProxyAndroidClientes INT DEFAULT 0 NOT NULL,
        creditsIosIpa INT DEFAULT 0 NOT NULL,
        enabledProducts TEXT NULL,
        resellerDisplayName VARCHAR(120) NULL,
        resellerDiscordUrl VARCHAR(512) NULL,
        resellerColor VARCHAR(7) NULL,
        resellerBannerUrl VARCHAR(1024) NULL,
        resellerBannerVideoUrl VARCHAR(1024) NULL,
        moderatorBannerUrl VARCHAR(1024) NULL,
        moderatorBannerVideoUrl VARCHAR(1024) NULL,
        resellerId INT,
        keyId INT,
        isActive BOOLEAN DEFAULT TRUE NOT NULL,
        isPremium BOOLEAN DEFAULT FALSE NOT NULL,
        maxDevices INT DEFAULT 1 NOT NULL,
        expiresAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);



    const alterQueries = [
      "ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255)",
      "ALTER TABLE users ADD COLUMN credits INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsBasic INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsAdvanced INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsIos INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsPanelIos INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsPanelLegitimo INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsPanelAndroid INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsProxyAndroidClientes INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsIosIpa INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN enabledProducts TEXT NULL",
      "ALTER TABLE users ADD COLUMN resellerDisplayName VARCHAR(120) NULL",
      "ALTER TABLE users ADD COLUMN resellerDiscordUrl VARCHAR(512) NULL",
      "ALTER TABLE users ADD COLUMN resellerColor VARCHAR(7) NULL",
      "ALTER TABLE users ADD COLUMN resellerBannerUrl VARCHAR(1024) NULL",
      "ALTER TABLE users ADD COLUMN resellerBannerVideoUrl VARCHAR(1024) NULL",
      "ALTER TABLE users ADD COLUMN moderatorBannerUrl VARCHAR(1024) NULL",
      "ALTER TABLE users ADD COLUMN moderatorBannerVideoUrl VARCHAR(1024) NULL",
      "ALTER TABLE users ADD COLUMN creditsIosBasic INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsIosAdvanced INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN creditsAndroid INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN resellerId INT",
      "ALTER TABLE users ADD COLUMN keyId INT",
      "ALTER TABLE users ADD COLUMN isActive BOOLEAN DEFAULT TRUE",
      "ALTER TABLE users ADD COLUMN isPremium BOOLEAN DEFAULT FALSE",
      "ALTER TABLE users ADD COLUMN maxDevices INT DEFAULT 1",
      "ALTER TABLE users ADD COLUMN expiresAt TIMESTAMP NULL",
      "ALTER TABLE \`keys\` ADD COLUMN type VARCHAR(32) DEFAULT 'advanced'",
      "ALTER TABLE \`keys\` ADD COLUMN isActive BOOLEAN DEFAULT TRUE",
      "ALTER TABLE \`keys\` ADD COLUMN isUsed BOOLEAN DEFAULT FALSE",
      "ALTER TABLE \`keys\` ADD COLUMN usedAt TIMESTAMP NULL",
      "ALTER TABLE \`keys\` ADD COLUMN isBanned BOOLEAN DEFAULT FALSE",
      "ALTER TABLE \`keys\` ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE downloads ADD COLUMN type VARCHAR(32) DEFAULT 'advanced'",
      "ALTER TABLE tutorials ADD COLUMN type VARCHAR(32) DEFAULT 'advanced'",
      "ALTER TABLE announcements ADD COLUMN productType VARCHAR(50) DEFAULT 'all'",
      "ALTER TABLE announcements ADD COLUMN durationSeconds INT DEFAULT 5",
      "ALTER TABLE announcements ADD COLUMN isActive BOOLEAN DEFAULT TRUE",
      "ALTER TABLE products ADD COLUMN link TEXT",
      "ALTER TABLE products ADD COLUMN tutorialUrl TEXT",
      "ALTER TABLE products ADD COLUMN type VARCHAR(50) DEFAULT 'advanced'"
    ];
    for (const aq of alterQueries) {
      try {
        await connection.query(aq);
      } catch (e) {}
    }

    // Apenas define advanced caso seja null ou vazio
    try {
      await connection.query("UPDATE \`keys\` SET type = 'advanced' WHERE type IS NULL");
    } catch (e) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`keys\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        keyValue VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(32) DEFAULT 'advanced' NOT NULL,
        isActive BOOLEAN DEFAULT TRUE NOT NULL,
        isUsed BOOLEAN DEFAULT FALSE NOT NULL,
        isBanned BOOLEAN DEFAULT FALSE NOT NULL,
        usedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    // Keys IPA já atribuídas a clientes não podem permanecer disponíveis no estoque.
    try {
      await connection.query(`
        UPDATE keys k
        INNER JOIN users u ON u.keyId = k.id
        SET k.isUsed = TRUE,
            k.isBanned = TRUE,
            k.usedAt = COALESCE(k.usedAt, u.updatedAt, CURRENT_TIMESTAMP)
        WHERE k.type = 'ios_ipa' AND u.role = 'client'
      `);
    } catch (e) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        version VARCHAR(50) NOT NULL,
        fileUrl TEXT NOT NULL,
        type VARCHAR(32) DEFAULT 'basic' NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tutorials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        videoUrl TEXT NOT NULL,
        type VARCHAR(32) DEFAULT 'basic' NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        productType VARCHAR(50) DEFAULT 'all' NOT NULL,
        durationSeconds INT DEFAULT 5 NOT NULL,
        isActive BOOLEAN DEFAULT TRUE NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        token VARCHAR(512) NOT NULL,
        deviceIdentifier VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        ipAddress VARCHAR(45),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await connection.end();
    console.log("[Database] Tables and columns verified and ensured successfully.");
  } catch (err) {
    console.error("[Database] Failed to ensure tables:", err);
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      await ensureTables(process.env.DATABASE_URL);
      _db = drizzle(process.env.DATABASE_URL);
      await seedDefaultModerator(_db);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function seedDefaultModerator(dbInstance: ReturnType<typeof drizzle>) {
  try {
    const existing = await dbInstance.select().from(users).where(eq(users.openId, "murillo")).limit(1);
    const passHash = hashPassword("300530");
    if (existing.length === 0) {
      await dbInstance.insert(users).values({
        openId: "murillo",
        role: "moderator",
        passwordHash: passHash as any,
        credits: 9999,
        isActive: true,
      });
      console.log("[Database] Default moderator 'murillo' seeded successfully.");
    } else {
      await dbInstance.update(users).set({
        role: "moderator",
        passwordHash: passHash as any,
        isActive: true,
      }).where(eq(users.openId, "murillo"));
    }
  } catch (err) {
    console.error("[Database] Seed moderator error:", err);
  }
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLog(userId: number | null, action: string, details?: string, ipAddress?: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(logs).values({
      userId,
      action,
      details: details || null,
      ipAddress: ipAddress || null,
    });
  } catch (err) {
    console.error("[Database] Failed to create log:", err);
  }
}


