import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentSession, type SessionPayload } from "./session";

/**
 * Server-side authorization guards. Every protected Server Component and
 * Route Handler must call one of these — client-side route hiding is a UX
 * nicety, never the authorization boundary.
 */

export async function requireSession(): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(role: Role): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) redirect("/unauthorized");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole("ADMIN" as Role);
}

export async function requireEmployee(): Promise<SessionPayload> {
  return requireRole("EMPLOYEE" as Role);
}

/** Non-redirecting variant for API route handlers, which return JSON errors. */
export async function getAuthorizedSession(
  allowedRoles?: Role[]
): Promise<{ session: SessionPayload } | { error: string; status: number }> {
  const session = await getCurrentSession();
  if (!session) return { error: "Not authenticated", status: 401 };
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return { error: "Forbidden", status: 403 };
  }
  return { session };
}
