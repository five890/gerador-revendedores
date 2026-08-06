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
        resellerId INT,
        keyId INT,
        isActive BOOLEAN DEFAULT TRUE NOT NULL,
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
      "ALTER TABLE users ADD COLUMN resellerId INT",
      "ALTER TABLE users ADD COLUMN keyId INT",
      "ALTER TABLE users ADD COLUMN isActive BOOLEAN DEFAULT TRUE",
      "ALTER TABLE \`keys\` ADD COLUMN type VARCHAR(32) DEFAULT 'advanced'",
      "ALTER TABLE downloads ADD COLUMN type VARCHAR(32) DEFAULT 'advanced'",
      "ALTER TABLE tutorials ADD COLUMN type VARCHAR(32) DEFAULT 'advanced'"
    ];
    for (const aq of alterQueries) {
      try {
        await connection.query(aq);
      } catch (e) {}
    }

    // Update existing keys / downloads / tutorials to advanced if not set or if they were basic by default
    try {
      await connection.query("UPDATE \`keys\` SET type = 'advanced' WHERE type = 'basic' OR type IS NULL");
    } catch (e) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`keys\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        keyValue VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(32) DEFAULT 'advanced' NOT NULL,
        isActive BOOLEAN DEFAULT TRUE NOT NULL,
        isUsed BOOLEAN DEFAULT FALSE NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
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
