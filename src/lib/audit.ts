import { prisma } from "./db";

export type AuditAction =
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_DEACTIVATED"
  | "EMPLOYEE_ACTIVATED"
  | "EMPLOYEE_LOGIN"
  | "EMPLOYEE_LOGIN_FAILED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "ACCOUNT_ACTIVATED"
  | "MODULE_CREATED"
  | "MODULE_UPDATED"
  | "MODULE_PUBLISHED"
  | "MODULE_UNPUBLISHED"
  | "LESSON_CREATED"
  | "LESSON_UPDATED"
  | "VIDEO_UPLOADED"
  | "VIDEO_REPLACED"
  | "VIDEO_DELETED"
  | "VIDEO_PUBLISHED"
  | "VIDEO_UNPUBLISHED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DELETED"
  | "ASSESSMENT_CREATED"
  | "ASSESSMENT_UPDATED"
  | "ASSESSMENT_SUBMITTED"
  | "CERTIFICATE_GENERATED"
  | "EMPLOYEE_STATUS_CHANGED";

export async function recordAuditLog(params: {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata as never,
      ipAddress: params.ipAddress ?? undefined,
    },
  });
}

/** Best-effort client IP extraction behind typical reverse proxies. */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip");
}
