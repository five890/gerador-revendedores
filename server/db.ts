import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, keys, downloads, sessions, logs, InsertUser, User, Key, Download, Session, Log } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
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
