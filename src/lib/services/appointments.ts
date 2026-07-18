import "server-only";
import { prisma } from "../db";

export const SLOT_MINUTES = 30;
const CLINIC_START_HOUR = 9;
const CLINIC_END_HOUR = 17;

/**
 * Checks whether a doctor already has a live appointment overlapping the range.
 * Two ranges overlap when each starts before the other ends. Cancelled
 * appointments are ignored so a freed slot becomes bookable again.
 */
export async function findConflict(
  doctorId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string,
) {
  return prisma.appointment.findFirst({
    where: {
      doctorId,
      status: { in: ["booked", "completed"] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
  });
}

export type Slot = { start: Date; end: Date; available: boolean };

/** Builds the day's slot grid for a doctor, marking each as free or taken. */
export async function availabilityFor(
  doctorId: string,
  date: Date,
): Promise<Slot[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ["booked", "completed"] },
      startTime: { gte: dayStart, lt: dayEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const slots: Slot[] = [];
  const cursor = new Date(dayStart);
  cursor.setHours(CLINIC_START_HOUR, 0, 0, 0);
  const closing = new Date(dayStart);
  closing.setHours(CLINIC_END_HOUR, 0, 0, 0);

  const now = new Date();
  while (cursor < closing) {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
    const taken = booked.some((b) => b.startTime < end && b.endTime > start);
    slots.push({ start, end, available: !taken && start > now });
    cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
  }

  return slots;
}

export class BookingConflictError extends Error {
  constructor(message = "That slot is already booked for this doctor") {
    super(message);
  }
}
