// SQLite has no native enums, so the schema stores these as strings and the
// application constrains them here. These lists are the single source of truth
// for validation and for the Postgres enum definitions.

export const ROLES = [
  "admin",
  "doctor",
  "nurse",
  "frontdesk",
  "billing",
  "patient",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  doctor: "Doctor",
  nurse: "Nurse",
  frontdesk: "Front Desk",
  billing: "Billing Officer",
  patient: "Patient",
};

export const APPOINTMENT_STATUSES = [
  "booked",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = [
  "consultation",
  "follow_up",
  "emergency",
] as const;

export const PATIENT_STATUSES = [
  "outpatient",
  "admitted",
  "discharged",
] as const;

export const BED_STATUSES = ["available", "occupied", "maintenance"] as const;

export const GENDERS = ["male", "female", "other"] as const;
