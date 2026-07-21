import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Demo password for every seeded account.
const PASSWORD = "Password123!";

function at(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dob(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  console.log("Seeding HealthSync…");

  // Clear in dependency order so the seed is repeatable.
  await prisma.auditLog.deleteMany();
  await prisma.labResult.deleteMany();
  await prisma.therapySession.deleteMany();
  await prisma.imagingOrder.deleteMany();
  await prisma.dispensation.deleteMany();
  await prisma.vital.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.user.deleteMany();
  await prisma.patient.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ---- Staff ---------------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      email: "admin@healthsync.io",
      passwordHash,
      fullName: "Adaeze Nwosu",
      role: "admin",
    },
  });

  const drOkafor = await prisma.user.create({
    data: {
      email: "doctor@healthsync.io",
      passwordHash,
      fullName: "Dr. Chidi Okafor",
      role: "doctor",
      specialty: "General Medicine",
    },
  });

  const drBello = await prisma.user.create({
    data: {
      email: "bello@healthsync.io",
      passwordHash,
      fullName: "Dr. Fatima Bello",
      role: "doctor",
      specialty: "Cardiology",
    },
  });

  const nurse = await prisma.user.create({
    data: {
      email: "nurse@healthsync.io",
      passwordHash,
      fullName: "Grace Adeyemi",
      role: "nurse",
    },
  });

  await prisma.user.create({
    data: {
      email: "frontdesk@healthsync.io",
      passwordHash,
      fullName: "Tunde Salami",
      role: "frontdesk",
    },
  });

  await prisma.user.create({
    data: {
      email: "billing@healthsync.io",
      passwordHash,
      fullName: "Ngozi Eze",
      role: "billing",
    },
  });

  const pharmacist = await prisma.user.create({
    data: {
      email: "pharmacist@healthsync.io",
      passwordHash,
      fullName: "Olumide Bankole",
      role: "pharmacist",
      specialty: "Clinical Pharmacy",
    },
  });

  const radiologist = await prisma.user.create({
    data: {
      email: "radiologist@healthsync.io",
      passwordHash,
      fullName: "Dr. Nkechi Umeh",
      role: "radiologist",
      specialty: "Diagnostic Radiology",
    },
  });

  const physio = await prisma.user.create({
    data: {
      email: "physio@healthsync.io",
      passwordHash,
      fullName: "Babatunde Ajayi",
      role: "physiotherapist",
      specialty: "Musculoskeletal Physiotherapy",
    },
  });

  // ---- Beds ----------------------------------------------------------------
  const wards = [
    { ward: "Medical Ward A", count: 8 },
    { ward: "Surgical Ward B", count: 6 },
    { ward: "Maternity", count: 4 },
    { ward: "ICU", count: 4 },
  ];
  const beds = [];
  for (const [wardIndex, w] of wards.entries()) {
    for (let i = 1; i <= w.count; i++) {
      beds.push(
        await prisma.bed.create({
          data: {
            code: `W${wardIndex + 1}-B${String(i).padStart(2, "0")}`,
            ward: w.ward,
            status: "available",
          },
        }),
      );
    }
  }

  // ---- Patients ------------------------------------------------------------
  const year = new Date().getFullYear();
  let sequence = 0;
  const nextMrn = () => `HS-${year}-${String(++sequence).padStart(5, "0")}`;

  const amina = await prisma.patient.create({
    data: {
      mrn: nextMrn(),
      firstName: "Amina",
      lastName: "Yusuf",
      dob: dob(1984, 3, 12),
      gender: "female",
      phone: "+234 803 415 2210",
      email: "amina.yusuf@example.com",
      address: "14 Awolowo Road, Ikoyi, Lagos",
      bloodGroup: "O+",
      nationalIdLast4: "4417",
      emergencyContactName: "Musa Yusuf",
      emergencyContactPhone: "+234 803 415 2211",
      insurance: JSON.stringify({
        provider: "AXA Mansard HMO",
        policyNumber: "AXA-99213387",
        plan: "Gold",
        eligibility: "active",
      }),
      // Drives a live CDS alert if penicillin-class drugs are prescribed.
      allergies: JSON.stringify([
        {
          substance: "penicillin",
          reaction: "Urticaria and facial swelling",
          severity: "severe",
        },
      ]),
      status: "outpatient",
    },
  });

  const emeka = await prisma.patient.create({
    data: {
      mrn: nextMrn(),
      firstName: "Emeka",
      lastName: "Obi",
      dob: dob(1957, 11, 2),
      gender: "male",
      phone: "+234 706 220 8890",
      email: "emeka.obi@example.com",
      address: "8 Zik Avenue, Enugu",
      bloodGroup: "A+",
      nationalIdLast4: "8032",
      emergencyContactName: "Chioma Obi",
      emergencyContactPhone: "+234 706 220 8891",
      insurance: JSON.stringify({
        provider: "Hygeia HMO",
        policyNumber: "HYG-4402118",
        plan: "Standard",
        eligibility: "active",
      }),
      allergies: JSON.stringify([]),
      status: "admitted",
      // Drives the medication dose-adjustment warning for renally-cleared
      // drugs (e.g. gentamicin, digoxin) in the encounter form.
      egfr: 42,
    },
  });

  const zainab = await prisma.patient.create({
    data: {
      mrn: nextMrn(),
      firstName: "Zainab",
      lastName: "Ibrahim",
      dob: dob(1996, 6, 25),
      gender: "female",
      phone: "+234 815 771 0043",
      email: "zainab.ibrahim@example.com",
      address: "22 Ahmadu Bello Way, Abuja",
      bloodGroup: "B-",
      nationalIdLast4: "1195",
      emergencyContactName: "Halima Ibrahim",
      emergencyContactPhone: "+234 815 771 0044",
      insurance: JSON.stringify({
        provider: "Self-pay",
        policyNumber: "—",
        eligibility: "n/a",
      }),
      allergies: JSON.stringify([
        {
          substance: "sulfa",
          reaction: "Rash",
          severity: "moderate",
        },
      ]),
      status: "outpatient",
      // Drives the pregnancy-related dose-adjustment warnings (NSAIDs,
      // ACE inhibitors) and the ectopic-pregnancy differential in the
      // symptom assessment tool for her abdominal pain presentation.
      pregnant: true,
    },
  });

  const tobi = await prisma.patient.create({
    data: {
      mrn: nextMrn(),
      firstName: "Tobi",
      lastName: "Adewale",
      dob: dob(2015, 1, 30),
      gender: "male",
      phone: "+234 802 990 1177",
      address: "5 Bode Thomas, Surulere, Lagos",
      bloodGroup: "O-",
      emergencyContactName: "Bisi Adewale",
      emergencyContactPhone: "+234 802 990 1178",
      insurance: JSON.stringify({
        provider: "Reliance HMO",
        policyNumber: "REL-7781200",
        plan: "Family",
        eligibility: "active",
      }),
      allergies: JSON.stringify([]),
      status: "outpatient",
    },
  });

  // Patient portal login, scoped to Amina's record.
  await prisma.user.create({
    data: {
      email: "patient@healthsync.io",
      passwordHash,
      fullName: "Amina Yusuf",
      role: "patient",
      patientId: amina.id,
    },
  });

  // ---- Admission (Emeka occupies an ICU bed) -------------------------------
  const icuBed = beds.find((b) => b.ward === "ICU")!;
  await prisma.admission.create({
    data: {
      patientId: emeka.id,
      bedId: icuBed.id,
      admittedAt: at(-2, 14, 20),
      reason: "Decompensated heart failure — for stabilisation and monitoring",
      status: "active",
    },
  });
  await prisma.bed.update({
    where: { id: icuBed.id },
    data: { status: "occupied" },
  });

  // A second occupied bed so occupancy isn't a trivial number.
  const wardBed = beds.find((b) => b.ward === "Medical Ward A")!;
  await prisma.bed.update({
    where: { id: wardBed.id },
    data: { status: "maintenance" },
  });

  // ---- Appointments --------------------------------------------------------
  const past = await prisma.appointment.create({
    data: {
      patientId: amina.id,
      doctorId: drOkafor.id,
      startTime: at(-7, 10, 0),
      endTime: at(-7, 10, 30),
      status: "completed",
      type: "consultation",
      reason: "Persistent headache and fatigue",
    },
  });

  await prisma.appointment.create({
    data: {
      patientId: amina.id,
      doctorId: drOkafor.id,
      startTime: at(1, 11, 0),
      endTime: at(1, 11, 30),
      status: "booked",
      type: "follow_up",
      reason: "Review blood pressure control",
    },
  });

  await prisma.appointment.create({
    data: {
      patientId: zainab.id,
      doctorId: drOkafor.id,
      startTime: at(0, 14, 0),
      endTime: at(0, 14, 30),
      status: "booked",
      type: "consultation",
      reason: "Lower abdominal pain",
    },
  });

  await prisma.appointment.create({
    data: {
      patientId: emeka.id,
      doctorId: drBello.id,
      startTime: at(0, 9, 30),
      endTime: at(0, 10, 0),
      status: "booked",
      type: "follow_up",
      reason: "Cardiology review while admitted",
    },
  });

  await prisma.appointment.create({
    data: {
      patientId: tobi.id,
      doctorId: drOkafor.id,
      startTime: at(-3, 15, 0),
      endTime: at(-3, 15, 30),
      status: "cancelled",
      type: "consultation",
      reason: "Routine immunisation",
      cancelReason: "Guardian unavailable — rescheduling next week",
    },
  });

  // ---- Clinical records ----------------------------------------------------
  await prisma.medicalRecord.create({
    data: {
      patientId: amina.id,
      doctorId: drOkafor.id,
      appointmentId: past.id,
      visitDate: at(-7, 10, 5),
      subjective:
        "40-year-old woman reports a four-week history of intermittent frontal headache with fatigue. No visual disturbance, no vomiting. Sleeping poorly.",
      objective:
        "Alert and oriented. BP 152/96 seated, repeated 148/94. Pulse 84 regular. Chest clear. Neurological examination normal. Fundoscopy unremarkable.",
      assessment:
        "Newly identified stage 2 hypertension. Headache likely secondary. No end-organ damage evident on examination.",
      plan: "Commence amlodipine 5mg daily. Reduce salt intake, advise home BP diary. Baseline U&E, lipids, ECG. Review in one week.",
      diagnoses: JSON.stringify([
        {
          code: "I10",
          system: "ICD-10",
          description: "Essential (primary) hypertension",
        },
        { code: "R51", system: "ICD-10", description: "Headache" },
      ]),
      prescriptions: JSON.stringify([
        {
          drug: "Amlodipine",
          dose: "5 mg",
          frequency: "Once daily",
          duration: "28 days",
        },
      ]),
      version: 1,
      signedAt: at(-7, 10, 40),
      signedBy: drOkafor.fullName,
    },
  });

  await prisma.medicalRecord.create({
    data: {
      patientId: emeka.id,
      doctorId: drBello.id,
      visitDate: at(-2, 15, 0),
      subjective:
        "67-year-old man with known heart failure, presenting with three days of worsening breathlessness and ankle swelling. Orthopnoea, now sleeping on three pillows.",
      objective:
        "Dyspnoeic at rest. BP 104/68. Pulse 96 irregular. JVP elevated 6cm. Bibasal crepitations. Pitting oedema to mid-shin bilaterally. SpO2 92% on air.",
      assessment:
        "Acute decompensated heart failure, NYHA class IV. Likely precipitated by dietary sodium and missed diuretic doses.",
      plan: "Admit to ICU. IV furosemide 40mg BD, strict fluid balance, daily weights. Repeat echo. Cardiology review daily.",
      diagnoses: JSON.stringify([
        {
          code: "I50.9",
          system: "ICD-10",
          description: "Heart failure, unspecified",
        },
      ]),
      prescriptions: JSON.stringify([
        {
          drug: "Furosemide",
          dose: "40 mg",
          frequency: "Twice daily (IV)",
          duration: "5 days",
        },
        {
          drug: "Lisinopril",
          dose: "2.5 mg",
          frequency: "Once daily",
          duration: "Ongoing",
        },
      ]),
      version: 1,
      signedAt: at(-2, 15, 45),
      signedBy: drBello.fullName,
    },
  });

  // ---- Vitals --------------------------------------------------------------
  await prisma.vital.createMany({
    data: [
      {
        patientId: amina.id,
        recordedById: nurse.id,
        systolic: 152,
        diastolic: 96,
        heartRate: 84,
        temperature: 36.7,
        spo2: 99,
        respiratoryRate: 16,
        weightKg: 74.5,
        heightCm: 165,
        recordedAt: at(-7, 9, 50),
      },
      {
        patientId: amina.id,
        recordedById: nurse.id,
        systolic: 138,
        diastolic: 88,
        heartRate: 78,
        temperature: 36.5,
        spo2: 99,
        respiratoryRate: 15,
        weightKg: 74.1,
        heightCm: 165,
        recordedAt: at(-1, 9, 15),
      },
      {
        patientId: emeka.id,
        recordedById: nurse.id,
        systolic: 104,
        diastolic: 68,
        heartRate: 96,
        temperature: 36.9,
        spo2: 92,
        respiratoryRate: 24,
        weightKg: 81.2,
        heightCm: 172,
        onOxygen: true,
        recordedAt: at(-2, 14, 30),
      },
      {
        patientId: emeka.id,
        recordedById: nurse.id,
        systolic: 112,
        diastolic: 72,
        heartRate: 88,
        temperature: 36.6,
        spo2: 95,
        respiratoryRate: 20,
        weightKg: 79.4,
        heightCm: 172,
        onOxygen: true,
        recordedAt: at(0, 7, 30),
      },
      {
        patientId: zainab.id,
        recordedById: nurse.id,
        systolic: 118,
        diastolic: 74,
        heartRate: 72,
        temperature: 37.8,
        spo2: 98,
        respiratoryRate: 17,
        weightKg: 61.0,
        heightCm: 168,
        recordedAt: at(0, 13, 45),
      },
    ],
  });

  // ---- Lab Results (Laboratory) --------------------------------------------
  // Interpretation summaries are computed the same way the live app does —
  // see src/lib/services/labs.ts — so these mirror what a real order would show.
  await prisma.labResult.create({
    data: {
      patientId: emeka.id,
      orderedById: drBello.id,
      panel: "Urea & Electrolytes",
      results: JSON.stringify([
        { name: "Sodium", value: 138, unit: "mmol/L", refLow: 135, refHigh: 145, flag: "normal" },
        { name: "Potassium", value: 5.3, unit: "mmol/L", refLow: 3.5, refHigh: 5.1, flag: "high" },
        { name: "Urea", value: 9.8, unit: "mmol/L", refLow: 2.5, refHigh: 7.8, flag: "high" },
        { name: "Creatinine", value: 165, unit: "µmol/L", refLow: 60, refHigh: 110, flag: "high" },
        { name: "eGFR", value: 42, unit: "mL/min/1.73m²", refLow: 90, refHigh: 999, flag: "low" },
      ]),
      summary:
        "Moderate renal impairment — review nephrotoxic and renally-cleared drug doses. Hyperkalaemia.",
      status: "reviewed",
      createdAt: at(-2, 15, 30),
    },
  });

  await prisma.labResult.create({
    data: {
      patientId: amina.id,
      orderedById: drOkafor.id,
      panel: "Lipid Profile",
      results: JSON.stringify([
        { name: "Total Cholesterol", value: 6.1, unit: "mmol/L", refLow: 0, refHigh: 5.2, flag: "high" },
        { name: "LDL", value: 4.0, unit: "mmol/L", refLow: 0, refHigh: 3.4, flag: "high" },
        { name: "HDL", value: 1.1, unit: "mmol/L", refLow: 1.0, refHigh: 999, flag: "normal" },
        { name: "Triglycerides", value: 1.5, unit: "mmol/L", refLow: 0, refHigh: 1.7, flag: "normal" },
      ]),
      summary: "Elevated LDL — cardiovascular risk factor.",
      status: "reviewed",
      createdAt: at(-6, 9, 0),
    },
  });

  await prisma.labResult.create({
    data: {
      patientId: amina.id,
      orderedById: drOkafor.id,
      panel: "Urea & Electrolytes",
      results: JSON.stringify([
        { name: "Sodium", value: 140, unit: "mmol/L", refLow: 135, refHigh: 145, flag: "normal" },
        { name: "Potassium", value: 4.1, unit: "mmol/L", refLow: 3.5, refHigh: 5.1, flag: "normal" },
        { name: "Urea", value: 5.2, unit: "mmol/L", refLow: 2.5, refHigh: 7.8, flag: "normal" },
        { name: "Creatinine", value: 78, unit: "µmol/L", refLow: 60, refHigh: 110, flag: "normal" },
        { name: "eGFR", value: 95, unit: "mL/min/1.73m²", refLow: 90, refHigh: 999, flag: "normal" },
      ]),
      summary: "All values within reference range.",
      status: "reviewed",
      createdAt: at(-6, 9, 0),
    },
  });

  // ---- Dispensations (Pharmacy) ---------------------------------------------
  await prisma.dispensation.createMany({
    data: [
      {
        patientId: amina.id,
        pharmacistId: pharmacist.id,
        drug: "Amlodipine",
        dose: "5 mg",
        quantity: 28,
        prescribedBy: drOkafor.fullName,
        status: "dispensed",
        notes: "28-day supply as per prescription",
      },
      {
        patientId: emeka.id,
        pharmacistId: pharmacist.id,
        drug: "Furosemide",
        dose: "40 mg",
        quantity: 10,
        prescribedBy: drBello.fullName,
        status: "dispensed",
        notes: "IV formulation for inpatient use",
      },
      {
        patientId: emeka.id,
        pharmacistId: pharmacist.id,
        drug: "Lisinopril",
        dose: "2.5 mg",
        quantity: 30,
        prescribedBy: drBello.fullName,
        status: "dispensed",
      },
    ],
  });

  // ---- Imaging Orders (Radiology) ------------------------------------------
  await prisma.imagingOrder.create({
    data: {
      patientId: emeka.id,
      requestedById: drBello.id,
      radiologistId: radiologist.id,
      modality: "xray",
      bodyPart: "Chest PA and lateral",
      clinicalInfo: "Heart failure — assess cardiomegaly and pulmonary oedema",
      priority: "urgent",
      status: "completed",
      findings:
        "Cardiomegaly with cardiothoracic ratio of 0.62. Bilateral upper lobe pulmonary venous distension. Small bilateral pleural effusions. No consolidation.",
      impression: "Findings consistent with congestive cardiac failure.",
      completedAt: at(-2, 16, 30),
    },
  });

  await prisma.imagingOrder.create({
    data: {
      patientId: zainab.id,
      requestedById: drOkafor.id,
      modality: "ultrasound",
      bodyPart: "Abdomen and pelvis",
      clinicalInfo: "Lower abdominal pain — rule out appendicitis, ovarian pathology",
      priority: "routine",
      status: "requested",
    },
  });

  await prisma.imagingOrder.create({
    data: {
      patientId: amina.id,
      requestedById: drOkafor.id,
      radiologistId: radiologist.id,
      modality: "ct",
      bodyPart: "Brain non-contrast",
      clinicalInfo: "New hypertension with persistent headache — exclude secondary causes",
      priority: "routine",
      status: "completed",
      findings:
        "No intracranial haemorrhage, mass lesion or midline shift. Ventricles and sulci are normal for age. No evidence of cerebral oedema.",
      impression: "Normal CT brain. No acute intracranial pathology.",
      completedAt: at(-5, 11, 0),
    },
  });

  // ---- Therapy Sessions (Physiotherapy) ------------------------------------
  await prisma.therapySession.create({
    data: {
      patientId: emeka.id,
      therapistId: physio.id,
      sessionType: "initial_assessment",
      diagnosis: "Deconditioning secondary to prolonged ICU admission for heart failure",
      treatmentPlan:
        "Graded mobility programme: bed mobility → sitting balance → standing → walking. Respiratory physiotherapy. Goal: independent ward mobility within 5 days.",
      notes:
        "Patient cooperative but easily fatigued. SpO2 drops to 90% on exertion. Sitting balance fair. Unable to stand unassisted currently.",
      painLevelBefore: 3,
      painLevelAfter: 2,
      exercisesGiven: JSON.stringify([
        { name: "Ankle pumps", details: "3x10 bilateral, hourly while awake" },
        { name: "Seated marching", details: "2x10, with rest breaks" },
        { name: "Deep breathing exercises", details: "5 cycles, 3x daily" },
      ]),
      nextSessionDate: at(1, 10, 0),
      status: "completed",
    },
  });

  await prisma.therapySession.create({
    data: {
      patientId: emeka.id,
      therapistId: physio.id,
      sessionType: "treatment",
      diagnosis: "Deconditioning secondary to prolonged ICU admission for heart failure",
      treatmentPlan: "Progress to standing and supported walking if haemodynamically stable",
      nextSessionDate: at(2, 10, 0),
      status: "scheduled",
    },
  });

  await prisma.therapySession.create({
    data: {
      patientId: tobi.id,
      therapistId: physio.id,
      sessionType: "follow_up",
      diagnosis: "Developmental coordination delay — gross motor skills",
      treatmentPlan: "Balance and coordination exercises, ball skills, playground activities",
      notes: "Good progress. Able to hop on one foot for 5 seconds (was 0 at initial). Continue home programme.",
      painLevelBefore: 0,
      painLevelAfter: 0,
      exercisesGiven: JSON.stringify([
        { name: "Single leg stand", details: "3x30s each side" },
        { name: "Tandem walking", details: "10m x 3" },
        { name: "Ball catch and throw", details: "5 minutes" },
      ]),
      status: "completed",
    },
  });

  // ---- Seed audit trail ----------------------------------------------------
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: "system.seed",
      entityType: "system",
      detail: JSON.stringify({ note: "Initial demo dataset loaded" }),
    },
  });

  console.log(`Seeded: 10 users, 4 patients, ${beds.length} beds, 5 appointments, 3 dispensations, 3 imaging orders, 3 therapy sessions, 3 lab results.`);
  console.log(`All accounts use password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
