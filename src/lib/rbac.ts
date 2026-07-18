import type { Role } from "./enums";
import type { SessionUser } from "./auth";
import { AuthError } from "./errors";

// Granular permissions per the spec: "Doctor can prescribe, Nurse cannot."
export const PERMISSIONS = [
  "patient:read",
  "patient:write",
  "appointment:read",
  "appointment:write",
  "record:read",
  "record:write",
  "record:sign",
  "prescribe",
  "vitals:write",
  "admission:write",
  "staff:manage",
  "audit:read",
  "dashboard:view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Permission[]> = {
  admin: [
    "patient:read",
    "patient:write",
    "appointment:read",
    "appointment:write",
    "record:read",
    "admission:write",
    "staff:manage",
    "audit:read",
    "dashboard:view",
  ],
  doctor: [
    "patient:read",
    "patient:write",
    "appointment:read",
    "appointment:write",
    "record:read",
    "record:write",
    "record:sign",
    "prescribe",
    "vitals:write",
    "admission:write",
    "dashboard:view",
  ],
  nurse: [
    "patient:read",
    "appointment:read",
    "record:read",
    "vitals:write",
    "admission:write",
    "dashboard:view",
  ],
  frontdesk: [
    "patient:read",
    "patient:write",
    "appointment:read",
    "appointment:write",
    "admission:write",
    "dashboard:view",
  ],
  billing: ["patient:read", "appointment:read", "dashboard:view"],
  // Patients reach their own data through the portal routes, which scope every
  // query by session.patientId rather than granting a broad read permission.
  patient: [],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}

/** Throws 403 unless the session holds the permission. */
export function authorize(session: SessionUser, permission: Permission) {
  if (!can(session.role, permission)) {
    throw new AuthError(
      `Role "${session.role}" lacks permission "${permission}"`,
      403,
    );
  }
}
