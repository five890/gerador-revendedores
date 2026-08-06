import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { verifyJwt } from "../auth";
import { getUserById } from "../db";

export type TrpcContext = {
  user: any | null;
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: any = null;
  try {
    const cookies = parseCookie(opts.req.headers.cookie || "");
    const token = cookies[COOKIE_NAME];
    if (token) {
      const payload = verifyJwt(token);
      if (payload && payload.userId) {
        user = await getUserById(payload.userId);
      }
    }
  } catch (err) {
    // ignore
  }

  return {
    user,
    req: opts.req,
    res: opts.res,
  };
}
