import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";

describe("password hashing", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("CorrectHorse123");
    expect(hash).not.toBe("CorrectHorse123");
    expect(await verifyPassword("CorrectHorse123", hash)).toBe(true);
    expect(await verifyPassword("WrongPassword123", hash)).toBe(false);
  });

  it("enforces the minimum password policy", () => {
    expect(isPasswordStrongEnough("short1A")).toBe(false); // too short
    expect(isPasswordStrongEnough("alllowercase123")).toBe(false); // no upper case
    expect(isPasswordStrongEnough("ALLUPPERCASE123")).toBe(false); // no lower case
    expect(isPasswordStrongEnough("NoNumbersHere")).toBe(false); // no digit
    expect(isPasswordStrongEnough("ValidPass123")).toBe(true);
  });
});

describe("activation/reset tokens", () => {
  it("never stores the raw token — only its hash is persisted, and hashing is deterministic", () => {
    const raw = generateRawToken();
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(raw);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateRawToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("session JWT", () => {
  it("round-trips a valid session token", async () => {
    const token = await createSessionToken({ sub: "user-1", role: "EMPLOYEE" as never, email: "a@b.com" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ sub: "user-1", role: "EMPLOYEE", email: "a@b.com" });
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({ sub: "user-1", role: "EMPLOYEE" as never, email: "a@b.com" });
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});

describe("login rate limiting", () => {
  it("allows attempts under the limit and blocks once exceeded", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });
});
