import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { fullName, age, parseJson, type Allergy } from "@/lib/format";
import { EncounterForm } from "./encounter-form";

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  authorize(session, "record:write");
  const { id } = await params;

  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const allergies = parseJson<Allergy[]>(patient.allergies, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New clinical encounter"
        subtitle={`${fullName(patient)} · ${patient.mrn} · ${age(patient.dob)}y ${patient.gender}`}
      />

      {allergies.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">
            <span className="font-bold uppercase">Allergies: </span>
            {allergies.map((a) => a.substance).join(", ")}
          </p>
        </div>
      )}

      <EncounterForm
        patientId={patient.id}
        patientName={fullName(patient)}
        patientSex={patient.gender}
        allergiesJson={patient.allergies}
        canPrescribe={can(session.role, "prescribe")}
        clinicalContext={{
          ageYears: age(patient.dob),
          egfr: patient.egfr,
          hepaticImpairment: patient.hepaticImpairment,
          pregnant: patient.pregnant,
        }}
      />
    </div>
  );
}
