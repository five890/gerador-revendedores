import { appRouter } from "./routers.ts";
import { getDb } from "./db.ts";

const db = await getDb();
if (!db) {
  console.error("Database not connected in smoke test!");
  process.exit(1);
}

const ctx = {
  user: undefined,
  req: { protocol: "https", headers: {} },
  res: {
    cookie: (name, val, opts) => console.log("Cookie set:", name),
    clearCookie: () => {}
  }
};

const caller = appRouter.createCaller(ctx);

try {
  const result = await caller.auth.login({
    username: "murillo",
    password: "300530",
    deviceIdentifier: "test_device_123"
  });
  console.log("LOGIN SMOKE TEST SUCCESS:", result);
} catch (err) {
  console.error("LOGIN SMOKE TEST FAILED:", err);
}

process.exit(0);
