import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";
import type { SessionUser } from "./auth";

/**
 * Records a compliance audit entry. Every create/update on clinical or patient
 * data must call this — the spec requires a full audit trail.
 */
export async function audit(
  actor: SessionUser,
  action: string,
  entityType: string,
  entityId?: string,
  detail?: Record<string, unknown>,
) {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headerList.get("x-real-ip") ??
    null;

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      entityType,
      entityId: entityId ?? null,
      ipAddress: ip,
      detail: detail ? JSON.stringify(detail) : null,
    },
  });
}
