/**
 * Appointment no-show risk scoring (AI recommendation doc §15, "predict
 * no-shows"). A deterministic, explainable heuristic — not a trained model —
 * weighted mostly by the patient's own attendance history, with smaller
 * adjustments for lead time and appointment type. Every score comes with
 * the reasons behind it so staff can judge whether to act on it.
 */

export type NoShowRisk = {
  score: number; // 0–100
  band: "low" | "medium" | "high";
  reasons: string[];
  recommendedAction: string;
};

type PastAppointment = { status: string };

export function scoreNoShowRisk(
  appointment: { type: string; startTime: Date; createdAt: Date },
  patientHistory: PastAppointment[],
): NoShowRisk {
  const reasons: string[] = [];

  const total = patientHistory.length;
  const noShows = patientHistory.filter((a) => a.status === "no_show").length;
  const cancellations = patientHistory.filter((a) => a.status === "cancelled").length;

  // Patient history is the dominant signal. New patients get a documented
  // baseline rather than an artificially confident 0%.
  let historyRate: number;
  if (total === 0) {
    historyRate = 0.15;
    reasons.push("No appointment history — baseline risk applied");
  } else {
    historyRate = (noShows + cancellations * 0.5) / total;
    if (noShows > 0) {
      reasons.push(`${noShows} prior no-show${noShows > 1 ? "s" : ""} on record`);
    }
    if (cancellations > 0) {
      reasons.push(`${cancellations} prior cancellation${cancellations > 1 ? "s" : ""}`);
    }
    if (noShows === 0 && cancellations === 0) {
      reasons.push("Consistent attendance history");
    }
  }

  const leadTimeDays =
    (appointment.startTime.getTime() - appointment.createdAt.getTime()) / 86_400_000;
  let leadTimeFactor = 0;
  if (leadTimeDays > 14) {
    leadTimeFactor = 0.15;
    reasons.push("Booked more than 2 weeks in advance");
  } else if (leadTimeDays > 7) {
    leadTimeFactor = 0.08;
  }

  let typeFactor = 0;
  if (appointment.type === "emergency") {
    typeFactor = -0.1;
  } else if (appointment.type === "follow_up") {
    typeFactor = 0.05;
  }

  const hour = appointment.startTime.getHours();
  const timeFactor = hour >= 15 ? 0.05 : 0;
  if (timeFactor > 0) reasons.push("Late-afternoon slot");

  const raw = historyRate * 0.65 + leadTimeFactor + typeFactor + timeFactor;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

  let band: NoShowRisk["band"] = "low";
  let recommendedAction = "Standard automated reminder";
  if (score >= 40) {
    band = "high";
    recommendedAction = "Call to confirm 24–48h ahead";
  } else if (score >= 20) {
    band = "medium";
    recommendedAction = "Send an SMS reminder the day before";
  }

  return { score, band, reasons, recommendedAction };
}
