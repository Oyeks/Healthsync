import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "./patient-form";

export default async function NewPatientPage() {
  const session = await requireSession();
  authorize(session, "patient:write");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Register patient"
        subtitle="Capture demographics, contact and insurance details"
      />
      <PatientForm />
    </div>
  );
}
