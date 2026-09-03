import crypto from "crypto";

/**
 * Activation and password-reset tokens follow the same pattern:
 * a random token is sent to the user (would be emailed in a future phase;
 * for now it is returned to the admin/dev to deliver manually — see
 * README "Creating an employee"), while only its SHA-256 hash is persisted.
 * This means a leaked database never yields a usable token.
 */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
