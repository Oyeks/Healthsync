export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export function age(dob: Date) {
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    years--;
  }
  return years;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** Safely parses a JSON column, returning the fallback on null/invalid data. */
export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type Allergy = {
  substance: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
};

export type Diagnosis = { code: string; system: string; description: string };

export type Prescription = {
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
};

export type Insurance = {
  provider: string;
  policyNumber: string;
  plan?: string;
  eligibility?: string;
};
