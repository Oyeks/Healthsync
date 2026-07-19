"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { THERAPY_SESSION_TYPES } from "@/lib/enums";

export type TherapyState = { error?: string };

const sessionSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  sessionType: z.enum(THERAPY_SESSION_TYPES),
  diagnosis: z.string(),
  treatmentPlan: z.string(),
  notes: z.string(),
  painLevelBefore: z.coerce.number().int().min(0).max(10).optional(),
  painLevelAfter: z.coerce.number().int().min(0).max(10).optional(),
  exercisesGiven: z.string(),
  nextSessionDate: z.string(),
  status: z.enum(["scheduled", "completed"]),
});

export async function createTherapySession(
  _prev: TherapyState,
  formData: FormData,
): Promise<TherapyState> {
  const session = await requireSession();
  authorize(session, "therapy:write");

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== ""),
  );

  const parsed = sessionSchema.safeParse(cleaned);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const exercises = data.exercisesGiven
    ? data.exercisesGiven
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, ...rest] = line.split("|").map((s) => s.trim());
          return { name, details: rest.join(" | ") || "" };
        })
    : [];

  const therapySession = await prisma.therapySession.create({
    data: {
      patientId: data.patientId,
      therapistId: session.id,
      sessionType: data.sessionType,
      diagnosis: data.diagnosis || null,
      treatmentPlan: data.treatmentPlan || null,
      notes: data.notes || null,
      painLevelBefore: data.painLevelBefore ?? null,
      painLevelAfter: data.painLevelAfter ?? null,
      exercisesGiven: exercises.length > 0 ? JSON.stringify(exercises) : null,
      nextSessionDate: data.nextSessionDate
        ? new Date(data.nextSessionDate)
        : null,
      status: data.status,
    },
  });

  await audit(
    session,
    "therapy.create",
    "therapy_session",
    therapySession.id,
    { patientId: data.patientId, sessionType: data.sessionType },
  );

  revalidatePath("/physiotherapy");
  return {};
}

export async function completeTherapySession(formData: FormData) {
  const session = await requireSession();
  authorize(session, "therapy:write");

  const id = String(formData.get("sessionId") ?? "");
  if (!id) return;

  await prisma.therapySession.update({
    where: { id },
    data: { status: "completed" },
  });

  await audit(session, "therapy.complete", "therapy_session", id);
  revalidatePath("/physiotherapy");
}
