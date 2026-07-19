// SQLite has no native enums, so the schema stores these as strings and the
// application constrains them here. These lists are the single source of truth
// for validation and for the Postgres enum definitions.

export const ROLES = [
  "admin",
  "doctor",
  "nurse",
  "pharmacist",
  "radiologist",
  "physiotherapist",
  "frontdesk",
  "billing",
  "patient",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  doctor: "Doctor",
  nurse: "Nurse",
  pharmacist: "Pharmacist",
  radiologist: "Radiologist",
  physiotherapist: "Physiotherapist",
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

export const IMAGING_MODALITIES = [
  "xray",
  "ct",
  "mri",
  "ultrasound",
] as const;

export const IMAGING_MODALITY_LABELS: Record<string, string> = {
  xray: "X-Ray",
  ct: "CT Scan",
  mri: "MRI",
  ultrasound: "Ultrasound",
};

export const THERAPY_SESSION_TYPES = [
  "initial_assessment",
  "treatment",
  "follow_up",
  "discharge",
] as const;

export const THERAPY_SESSION_TYPE_LABELS: Record<string, string> = {
  initial_assessment: "Initial Assessment",
  treatment: "Treatment",
  follow_up: "Follow-up",
  discharge: "Discharge",
};
