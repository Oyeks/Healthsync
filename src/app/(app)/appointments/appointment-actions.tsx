"use client";

import { useActionState, useState } from "react";
import {
  cancelAppointment,
  completeAppointment,
  type AppointmentState,
} from "./actions";

export function AppointmentActions({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [state, formAction] = useActionState<AppointmentState, FormData>(
    async (prev, formData) => {
      const result = await cancelAppointment(prev, formData);
      if (!result.error) setCancelling(false);
      return result;
    },
    {},
  );

  if (cancelling) {
    return (
      <form action={formAction} className="flex flex-col items-end gap-1">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <div className="flex items-center gap-1">
          <input
            name="cancelReason"
            required
            autoFocus
            placeholder="Reason for cancellation"
            className="w-52 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setCancelling(false)}
            className="px-1.5 text-xs text-ink-500 hover:text-ink-900"
          >
            Back
          </button>
        </div>
        {state.error && (
          <p className="text-xs text-red-600">{state.error}</p>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <form action={completeAppointment}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-slate-50"
        >
          Complete
        </button>
      </form>
      <button
        type="button"
        onClick={() => setCancelling(true)}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-slate-50"
      >
        Cancel
      </button>
    </div>
  );
}
