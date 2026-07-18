/**
 * Verification harness for the spec's key acceptance criteria.
 * Run with: npx tsx scripts/verify.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { can } from "../src/lib/rbac";
import { screenPrescriptions } from "../src/lib/services/cds";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("\nHealthSync acceptance checks\n");

  // --- MRN format and uniqueness ---
  console.log("Patient registration (Module 1)");
  const patients = await prisma.patient.findMany();
  const mrnPattern = /^HS-\d{4}-\d{5}$/;
  check(
    "MRNs match HS-YYYY-XXXXX",
    patients.every((p) => mrnPattern.test(p.mrn)),
  );
  check(
    "MRNs are unique",
    new Set(patients.map((p) => p.mrn)).size === patients.length,
  );
  check(
    "National ID stored masked (max 4 digits)",
    patients.every((p) => !p.nationalIdLast4 || p.nationalIdLast4.length <= 4),
  );

  // --- Double booking ---
  console.log("\nAppointments (Module 2)");
  const appointments = await prisma.appointment.findMany({
    where: { status: { in: ["booked", "completed"] } },
  });
  let overlaps = 0;
  for (let i = 0; i < appointments.length; i++) {
    for (let j = i + 1; j < appointments.length; j++) {
      const a = appointments[i];
      const b = appointments[j];
      if (
        a.doctorId === b.doctorId &&
        a.startTime < b.endTime &&
        a.endTime > b.startTime
      ) {
        overlaps++;
      }
    }
  }
  check("No double-booked slots for any doctor", overlaps === 0, `${overlaps} overlaps`);

  const cancelled = await prisma.appointment.findMany({
    where: { status: "cancelled" },
  });
  check(
    "Every cancellation has a logged reason",
    cancelled.every((a) => Boolean(a.cancelReason)),
  );

  // --- RBAC ---
  console.log("\nRBAC (Module 6)");
  check("Doctor can prescribe", can("doctor", "prescribe"));
  check("Nurse cannot prescribe", !can("nurse", "prescribe"));
  check("Nurse can record vitals", can("nurse", "vitals:write"));
  check("Front desk cannot write clinical records", !can("frontdesk", "record:write"));
  check("Billing cannot write patient data", !can("billing", "patient:write"));
  check("Only admin reads the audit log", can("admin", "audit:read") && !can("doctor", "audit:read"));
  check("Patient role holds no staff permissions", !can("patient", "patient:read"));

  // --- Clinical decision support ---
  console.log("\nClinical decision support (Module 3)");
  const penicillinAllergy = JSON.stringify([
    { substance: "penicillin", reaction: "Urticaria", severity: "severe" },
  ]);
  const allergyAlerts = screenPrescriptions(
    [{ drug: "Amoxicillin", dose: "500mg", frequency: "TDS", duration: "7d" }],
    penicillinAllergy,
  );
  check(
    "Amoxicillin flagged for penicillin-allergic patient",
    allergyAlerts.some((a) => a.severity === "critical"),
  );

  const safeAlerts = screenPrescriptions(
    [{ drug: "Paracetamol", dose: "1g", frequency: "QDS", duration: "5d" }],
    penicillinAllergy,
  );
  check("Safe drug produces no alert", safeAlerts.length === 0);

  const interactionAlerts = screenPrescriptions(
    [
      { drug: "Warfarin", dose: "5mg", frequency: "OD", duration: "30d" },
      { drug: "Aspirin", dose: "75mg", frequency: "OD", duration: "30d" },
    ],
    null,
  );
  check(
    "Warfarin + aspirin interaction detected",
    interactionAlerts.some((a) => a.severity === "critical"),
  );

  // --- Audit trail ---
  console.log("\nAudit & compliance (Module 10)");
  const logs = await prisma.auditLog.findMany();
  check("Audit log has entries", logs.length > 0);
  check(
    "Every entry records an actor and action",
    logs.every((l) => Boolean(l.actorEmail && l.action)),
  );

  // --- Referential integrity ---
  console.log("\nData integrity");
  const admissions = await prisma.admission.findMany({
    where: { status: "active" },
    include: { bed: true, patient: true },
  });
  check(
    "Active admissions occupy an occupied bed",
    admissions.every((a) => a.bed.status === "occupied"),
  );
  check(
    "Admitted patients are marked admitted",
    admissions.every((a) => a.patient.status === "admitted"),
  );

  const records = await prisma.medicalRecord.findMany();
  check(
    "Signed notes record who signed them",
    records.every((r) => !r.signedAt || Boolean(r.signedBy)),
  );
  check(
    "No record was created for the blocked allergy prescription",
    !records.some((r) =>
      (r.prescriptions ?? "").toLowerCase().includes("amoxicillin"),
    ),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
