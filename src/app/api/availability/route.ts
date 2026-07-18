import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { availabilityFor } from "@/lib/services/appointments";

/** Returns a doctor's slot grid for a date. Used by the booking form. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!can(session.role, "appointment:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");

  if (!doctorId || !date) {
    return NextResponse.json(
      { error: "doctorId and date are required" },
      { status: 400 },
    );
  }

  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const slots = await availabilityFor(doctorId, parsedDate);

  return NextResponse.json({
    slots: slots.map((slot) => ({
      time: slot.start.toTimeString().slice(0, 5),
      available: slot.available,
    })),
  });
}
