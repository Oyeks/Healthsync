"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { bookAppointment, type AppointmentState } from "../actions";
import { Button, Card, CardHeader, ErrorBanner } from "@/components/ui";

type Option = { id: string; label: string };
type Slot = { time: string; available: boolean };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Booking…" : "Confirm booking"}
    </Button>
  );
}

export function BookingForm({
  patients,
  doctors,
  defaultPatientId,
}: {
  patients: Option[];
  doctors: Option[];
  defaultPatientId?: string;
}) {
  const [state, formAction] = useActionState<AppointmentState, FormData>(
    bookAppointment,
    {},
  );

  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  // Refresh the slot grid whenever the doctor or date changes.
  useEffect(() => {
    if (!doctorId || !date) return;
    const controller = new AbortController();
    setLoading(true);
    setTime("");

    fetch(`/api/availability?doctorId=${doctorId}&date=${date}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data: { slots?: Slot[] }) => setSlots(data.slots ?? []))
      .catch((error) => {
        if (error.name !== "AbortError") setSlots([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [doctorId, date]);

  const control =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="time" value={time} />

      <ErrorBanner message={state.error} />

      <Card>
        <CardHeader title="Appointment details" />
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              Patient <span className="text-red-600">*</span>
            </span>
            <select
              name="patientId"
              required
              defaultValue={defaultPatientId}
              className={control}
            >
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              Doctor <span className="text-red-600">*</span>
            </span>
            <select
              name="doctorId"
              required
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className={control}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Date <span className="text-red-600">*</span>
              </span>
              <input
                type="date"
                name="date"
                required
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className={control}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-700">Type</span>
              <select name="type" defaultValue="consultation" className={control}>
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-up</option>
                <option value="emergency">Emergency</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-ink-700">Reason</span>
            <textarea
              name="reason"
              rows={2}
              placeholder="Presenting complaint or purpose of visit"
              className={control}
            />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Available slots"
          subtitle="30-minute slots, 09:00–17:00. Booked and past slots are disabled."
        />
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-ink-500">Checking availability…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-ink-500">
              No slots for this day. Try another date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setTime(slot.time)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    time === slot.time
                      ? "border-brand-600 bg-brand-600 text-white"
                      : slot.available
                        ? "border-slate-300 bg-white text-ink-700 hover:border-brand-400"
                        : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Submit disabled={!time} />
        <Link
          href="/appointments"
          className="text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          Cancel
        </Link>
        {!time && (
          <span className="text-sm text-ink-500">Select a time slot above.</span>
        )}
      </div>
    </form>
  );
}
