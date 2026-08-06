import { publicProcedure, router } from "./trpc";
import { z } from "zod";

export const systemRouter = router({
  healthCheck: publicProcedure.query(() => ({ status: "ok", timestamp: Date.now() })),
});
