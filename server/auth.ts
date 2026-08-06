import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "netflix-saas-super-secret-key-2026";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function signJwt(payload: { userId: number; username: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): { userId: number; username: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch (err) {
    return null;
  }
}
