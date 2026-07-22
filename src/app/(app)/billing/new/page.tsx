import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "../invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; appointmentId?: string }>;
}) {
  const session = await requireSession();
  authorize(session, "billing:write");
  const { patientId, appointmentId } = await searchParams;

  const patients = await prisma.patient.findMany({
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, mrn: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New invoice" subtitle="Add one or more line items" />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <InvoiceForm
          patients={patients}
          defaultPatientId={patientId}
          defaultAppointmentId={appointmentId}
        />
      </div>
    </div>
  );
}
