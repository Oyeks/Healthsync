# HealthSync — Enterprise Hospital Management System

Implementation of the HealthSync specification (`Health Sync.docx`) and business
case (`HealthSync_Master_Business_Case_v1.docx`).

## What is built

This is a **working vertical slice**, not a set of screens. The modules below are
functional end to end — data model, server-side authorisation, business rules,
audit trail and UI:

| Spec module | Status | What works |
|---|---|---|
| 1 — Patient Registration & Management | **Built** | MRN auto-generation (`HS-YYYY-XXXXX`), multi-criteria search (name/MRN/phone), masked national ID, insurance capture, ADT with bed allocation |
| 2 — Appointment & Scheduling | **Built** | Live availability grid, enforced no-double-booking, colour-coded day view, cancellation with mandatory logged reason |
| 3 — EHR / EMR | **Built** | SOAP notes, ICD-10 diagnoses, prescriptions, digital signature, vitals, allergy red flags, clinical decision support |
| 6 — Staff & User Management | **Built** | Six roles, granular permission matrix, enforced server-side |
| 7 — Patient Portal | **Built** | Own appointments, signed records, care plans, medication, latest observations |
| 8 — Analytics & Dashboards | **Partial** | Role-scoped KPI dashboard (patients, appointments, occupancy, admissions). No exports or charts yet |
| 10 — Administration & Compliance | **Built** | Full audit log with actor, action, entity, IP and filtering |
| 4 — Lab / Pharmacy / Theatre | **Not built** | — |
| 5 — Billing & Revenue Cycle | **Not built** | — |
| 9 — Inventory & Supply Chain | **Not built** | — |

Modules 4, 5 and 9 are deliberately absent rather than stubbed. See
[Roadmap](#roadmap).

## Quick start

```bash
npm install
npx prisma migrate dev     # creates dev.db and applies migrations
npx prisma db seed         # loads demo hospital data
npm run dev                # http://localhost:3000
```

### Demo accounts

All accounts use the password `Password123!`.

| Role | Email | Sees |
|---|---|---|
| Administrator | `admin@healthsync.io` | Everything except clinical authoring |
| Doctor | `doctor@healthsync.io` | Own clinic, can write notes and prescribe |
| Doctor (Cardiology) | `bello@healthsync.io` | As above |
| Nurse | `nurse@healthsync.io` | Vitals only — cannot prescribe |
| Front Desk | `frontdesk@healthsync.io` | Registration and scheduling |
| Billing | `billing@healthsync.io` | Read-only patient and appointment access |
| Patient | `patient@healthsync.io` | Portal only — own record |

## Verifying it works

```bash
npx tsx scripts/verify.ts
```

Checks the spec's acceptance criteria directly against the database and the
business-rule modules — MRN format and uniqueness, absence of double-booked
slots, the RBAC matrix, CDS alerting, audit completeness and ADT referential
integrity. 21 checks, all passing.

### Try the clinical safety path

1. Sign in as `doctor@healthsync.io`.
2. Open **Amina Yusuf** (recorded severe penicillin allergy).
3. **New encounter** → prescribe `Amoxicillin | 500 mg | Three times daily | 7 days`.

A critical allergy alert appears as you type. Submitting without ticking the
override is **rejected by the server**, and the record is not created. The
override, when used, is written to the audit log.

To see role separation, repeat as `nurse@healthsync.io`: the vitals form is
available, the encounter action is not, and navigating directly to
`/patients/<id>/encounter` returns Access denied.

## Architecture

```
src/
  app/
    login/                 Authentication (staff/patient toggle)
    (app)/                 Staff workspace — sidebar shell, RBAC-filtered nav
      dashboard/           Role-scoped KPIs
      patients/            Index, registration, record view, encounter
      appointments/        Day calendar, booking
      wards/               Bed board, admit/discharge
      staff/               Accounts and permission matrix
      audit/               Compliance log
    portal/                Patient-facing portal
    api/availability/      Slot availability for the booking form
  lib/
    auth.ts                JWT sessions in httpOnly cookies
    rbac.ts                Permission matrix and authorize()
    audit.ts               Audit trail writer
    mrn.ts                 MRN allocation
    errors.ts              AuthError (kept free of server-only imports)
    services/
      appointments.ts      Overlap detection, slot generation
      cds.ts               Allergy and drug-interaction screening
  components/              Logo, UI primitives, nav
```

### Security model

- Sessions are signed JWTs in `httpOnly`, `sameSite=lax` cookies, 8-hour expiry.
- Passwords are bcrypt hashed (cost 10).
- **Every** server action and page calls `requireSession()` then `authorize()`.
  Hiding a button is never the control — server actions are directly POST-able,
  so authorisation is re-checked server-side on every mutation.
- The CDS screen is re-run on the server so a crafted request cannot bypass a
  critical allergy alert.
- National IDs are truncated to the last 4 digits at the point of capture.
- Login returns an identical message for unknown email and wrong password.
- Every mutation writes an audit entry with actor, action, entity and IP.

## Database

SQLite via Prisma for zero-setup local development. The schema is written to be
PostgreSQL-portable, as the spec requires.

**Switching to PostgreSQL:**

1. `prisma/schema.prisma` → change `provider = "sqlite"` to `"postgresql"`.
2. Swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` in
   `src/lib/db.ts` and `prisma/seed.ts`.
3. Point `DATABASE_URL` at your Postgres instance and run `npx prisma migrate dev`.
4. Optionally convert the documented string columns to native `enum` types and
   the JSON-bearing columns to `jsonb` — the values are already valid JSON.

Enum-valued columns are `String` because SQLite has no enum type; the permitted
values live in `src/lib/enums.ts` and are enforced by Zod at every entry point.

## Known limitations

These are real gaps, stated up front rather than discovered later:

- **The CDS drug rules are illustrative.** `src/lib/services/cds.ts` contains a
  small hand-written interaction table so the alerting pathway is real and
  testable. **It is not clinically complete and must not be relied on for
  patient care.** Production requires a licensed drug database (First Databank,
  RxNorm + DrugBank or equivalent).
- Insurance eligibility is captured but not verified — no payer integration.
- No SMS/email reminders; the spec's Twilio notification path is not wired up.
- No FHIR/HL7 export endpoints yet. The data model is FHIR-shaped
  (patient, encounter, observation, medication-request) but no serialiser exists.
- Signed notes are immutable by convention — the UI offers no edit path, but the
  database does not yet enforce append-only versioning.
- No rate limiting on the login endpoint.
- No automated test suite beyond `scripts/verify.ts`; there are no unit tests.
- Search is unpaginated beyond a 50-row cap.

## Roadmap

Suggested next increments, in dependency order:

1. **Billing & Revenue Cycle (Module 5)** — charge capture hangs off the
   encounter records that already exist, so this is the highest-value next step.
2. **Lab & Pharmacy (Module 4)** — orders extend the encounter model; pharmacy
   dispensing reuses the prescription structures already stored.
3. **Inventory (Module 9)** — depends on pharmacy dispensing for consumption data.
4. **FHIR export** — serialise the existing model; no schema change required.
5. Notifications, reporting exports, and a real drug-interaction database.

## Standards alignment

Diagnoses are stored as ICD-10 code/description pairs. Clinical documents follow
SOAP structure. The data model maps onto FHIR resources without restructuring.
Actual HL7/FHIR wire-format support is future work.
