import { getDb } from './server/db.ts';
import { keys } from './drizzle/schema.ts';
import { or, like } from 'drizzle-orm';

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("Database not connected");
    process.exit(1);
  }
  
  await db.update(keys)
    .set({ type: 'basic' })
    .where(or(like(keys.keyValue, 'HG%'), like(keys.keyValue, 'hg%')));
    
  console.log("SUCCESS: HG keys migrated to basic.");
  process.exit(0);
}

run().catch(err => {
  console.error("Error migrating HG keys:", err);
  process.exit(1);
});
