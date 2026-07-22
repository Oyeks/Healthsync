import type { Role } from "./enums";
import type { SessionUser } from "./auth";
import { AuthError } from "./errors";

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
  "pharmacy:read",
  "pharmacy:dispense",
  "imaging:read",
  "imaging:write",
  "imaging:report",
  "therapy:read",
  "therapy:write",
  "lab:read",
  "lab:write",
  "analytics:read",
  "engagement:read",
  "billing:read",
  "billing:write",
  "inventory:read",
  "inventory:write",
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
    "pharmacy:read",
    "imaging:read",
    "therapy:read",
    "lab:read",
    "analytics:read",
    "engagement:read",
    "billing:read",
    "inventory:read",
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
    "imaging:read",
    "imaging:write",
    "therapy:read",
    "lab:read",
    "lab:write",
    "engagement:read",
  ],
  nurse: [
    "patient:read",
    "appointment:read",
    "record:read",
    "vitals:write",
    "admission:write",
    "dashboard:view",
    "lab:read",
    "lab:write",
    "engagement:read",
  ],
  pharmacist: [
    "patient:read",
    "appointment:read",
    "record:read",
    "pharmacy:read",
    "pharmacy:dispense",
    "dashboard:view",
    "lab:read",
    "inventory:read",
    "inventory:write",
  ],
  radiologist: [
    "patient:read",
    "record:read",
    "imaging:read",
    "imaging:report",
    "dashboard:view",
  ],
  physiotherapist: [
    "patient:read",
    "record:read",
    "therapy:read",
    "therapy:write",
    "dashboard:view",
  ],
  frontdesk: [
    "patient:read",
    "patient:write",
    "appointment:read",
    "appointment:write",
    "admission:write",
    "dashboard:view",
    "analytics:read",
    "engagement:read",
  ],
  billing: [
    "patient:read",
    "appointment:read",
    "dashboard:view",
    "billing:read",
    "billing:write",
  ],
  patient: [],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}

export function authorize(session: SessionUser, permission: Permission) {
  if (!can(session.role, permission)) {
    throw new AuthError(
      `Role "${session.role}" lacks permission "${permission}"`,
      403,
    );
  }
}
