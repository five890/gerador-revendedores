import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, signJwt, verifyJwt } from "./auth";

describe("Auth & Security Utilities", () => {
  it("should hash and verify password correctly", () => {
    const password = "securepassword123";
    const hashed = hashPassword(password);
    expect(hashed).not.toBe(password);
    expect(verifyPassword(password, hashed)).toBe(true);
    expect(verifyPassword("wrongpassword", hashed)).toBe(false);
  });

  it("should sign and verify JWT correctly", () => {
    const payload = { userId: 1, username: "moderator", role: "moderator" };
    const token = signJwt(payload);
    expect(token).toBeTypeOf("string");

    const decoded = verifyJwt(token);
    expect(decoded).toMatchObject({
      userId: 1,
      username: "moderator",
      role: "moderator",
    });
  });

  it("should return null for invalid JWT", () => {
    const decoded = verifyJwt("invalid.token.string");
    expect(decoded).toBeNull();
  });
});
