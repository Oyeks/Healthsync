import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { fullName } from "@/lib/format";
import { BookingForm } from "./booking-form";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const session = await requireSession();
  authorize(session, "appointment:write");
  const { patientId } = await searchParams;

  const [patients, doctors] = await Promise.all([
    prisma.patient.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, mrn: true },
    }),
    prisma.user.findMany({
      where: { role: "doctor", active: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, specialty: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Book appointment"
        subtitle="Availability updates as you pick a doctor and date"
      />
      <BookingForm
        patients={patients.map((p) => ({
          id: p.id,
          label: `${fullName(p)} — ${p.mrn}`,
        }))}
        doctors={doctors.map((d) => ({
          id: d.id,
          label: d.specialty ? `${d.fullName} (${d.specialty})` : d.fullName,
        }))}
        defaultPatientId={patientId}
      />
    </div>
  );
}
