import { drizzle } from "drizzle-orm/mysql2";
import dotenv from "dotenv";
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
console.log("Connecting to:", dbUrl ? dbUrl.replace(/:[^:@]*@/, ":***@") : "undefined");

try {
  const db = drizzle(dbUrl);
  const res = await db.execute("SELECT 1 as test");
  console.log("DB connection test SUCCESS:", res);
} catch (err) {
  console.error("DB connection test FAILED:", err);
}
