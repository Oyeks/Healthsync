"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { generateMrn } from "@/lib/mrn";
import { sanitizeFormData } from "@/lib/sanitize";
import { GENDERS } from "@/lib/enums";

const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(GENDERS),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  address: z.string(),
  bloodGroup: z.string(),
  nationalId: z.string(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string(),
  insuranceProvider: z.string(),
  insurancePolicyNumber: z.string(),
  allergies: z.string(),
});

export type PatientFormState = { error?: string };

export async function registerPatient(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const session = await requireSession();
  authorize(session, "patient:write");

  const raw = sanitizeFormData(
    Object.fromEntries(formData) as Record<string, string>,
  );
  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const dob = new Date(data.dob);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    return { error: "Date of birth must be a valid past date" };
  }

  // Free-text allergies are split one-per-line into structured entries.
  const allergies = data.allergies
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((substance) => ({
      substance,
      reaction: "Not specified",
      severity: "moderate" as const,
    }));

  const mrn = await generateMrn();

  const patient = await prisma.patient.create({
    data: {
      mrn,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      dob,
      gender: data.gender,
      phone: data.phone.trim(),
      email: data.email || null,
      address: data.address || null,
      bloodGroup: data.bloodGroup || null,
      // Only the last 4 digits of the national ID are retained.
      nationalIdLast4: data.nationalId
        ? data.nationalId.replace(/\D/g, "").slice(-4)
        : null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      insurance: data.insuranceProvider
        ? JSON.stringify({
            provider: data.insuranceProvider,
            policyNumber: data.insurancePolicyNumber,
            eligibility: "pending_check",
          })
        : null,
      allergies: JSON.stringify(allergies),
    },
  });

  await audit(session, "patient.create", "patient", patient.id, { mrn });

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

const vitalsSchema = z.object({
  patientId: z.string().min(1),
  systolic: z.coerce.number().int().min(40).max(300).optional(),
  diastolic: z.coerce.number().int().min(20).max(200).optional(),
  heartRate: z.coerce.number().int().min(20).max(250).optional(),
  temperature: z.coerce.number().min(30).max(45).optional(),
  spo2: z.coerce.number().int().min(50).max(100).optional(),
  respiratoryRate: z.coerce.number().int().min(4).max(80).optional(),
});

export async function recordVitals(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const session = await requireSession();
  authorize(session, "vitals:write");

  const raw = Object.fromEntries(formData) as Record<string, string>;
  // Blank inputs are omitted rather than coerced to 0.
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== ""),
  );

  const parsed = vitalsSchema.safeParse(cleaned);
  if (!parsed.success) {
    return { error: `Invalid reading: ${parsed.error.issues[0].message}` };
  }
  const { patientId, ...readings } = parsed.data;

  if (Object.values(readings).every((v) => v === undefined)) {
    return { error: "Enter at least one reading" };
  }

  const vital = await prisma.vital.create({
    data: { patientId, recordedById: session.id, ...readings },
  });

  await audit(session, "vitals.create", "vital", vital.id, { patientId });

  revalidatePath(`/patients/${patientId}`);
  return {};
}
