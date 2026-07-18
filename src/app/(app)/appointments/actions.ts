"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { findConflict, SLOT_MINUTES } from "@/lib/services/appointments";
import { APPOINTMENT_TYPES } from "@/lib/enums";

const bookSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().min(1, "Select a doctor"),
  date: z.string().min(1, "Select a date"),
  time: z.string().min(1, "Select a time"),
  type: z.enum(APPOINTMENT_TYPES),
  reason: z.string(),
});

export type AppointmentState = { error?: string };

export async function bookAppointment(
  _prev: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  const session = await requireSession();
  authorize(session, "appointment:write");

  const parsed = bookSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const startTime = new Date(`${data.date}T${data.time}:00`);
  if (Number.isNaN(startTime.getTime())) {
    return { error: "Invalid appointment date or time" };
  }
  if (startTime < new Date()) {
    return { error: "Appointments cannot be booked in the past" };
  }
  const endTime = new Date(startTime.getTime() + SLOT_MINUTES * 60_000);

  // Enforces the spec's "no double-booking" acceptance criterion.
  const conflict = await findConflict(data.doctorId, startTime, endTime);
  if (conflict) {
    return {
      error:
        "That slot is already booked for this doctor. Choose another time.",
    };
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId: data.patientId,
      doctorId: data.doctorId,
      startTime,
      endTime,
      type: data.type,
      reason: data.reason || null,
      status: "booked",
    },
  });

  await audit(session, "appointment.create", "appointment", appointment.id, {
    patientId: data.patientId,
    doctorId: data.doctorId,
    startTime: startTime.toISOString(),
  });

  revalidatePath("/appointments");
  redirect("/appointments");
}

const cancelSchema = z.object({
  appointmentId: z.string().min(1),
  cancelReason: z.string().min(3, "A cancellation reason is required"),
});

export async function cancelAppointment(
  _prev: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  const session = await requireSession();
  authorize(session, "appointment:write");

  const parsed = cancelSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const appointment = await prisma.appointment.update({
    where: { id: parsed.data.appointmentId },
    data: { status: "cancelled", cancelReason: parsed.data.cancelReason },
  });

  await audit(session, "appointment.cancel", "appointment", appointment.id, {
    reason: parsed.data.cancelReason,
  });

  revalidatePath("/appointments");
  return {};
}

export async function completeAppointment(formData: FormData) {
  const session = await requireSession();
  authorize(session, "appointment:write");

  const id = String(formData.get("appointmentId") ?? "");
  if (!id) return;

  await prisma.appointment.update({
    where: { id },
    data: { status: "completed" },
  });
  await audit(session, "appointment.complete", "appointment", id);

  revalidatePath("/appointments");
}
