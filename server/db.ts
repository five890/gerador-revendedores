import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, keys, downloads, sessions, logs, User, InsertUser } from "../drizzle/schema";
import { hashPassword } from "./auth";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
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
