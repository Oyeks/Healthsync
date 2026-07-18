import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  statusTone,
} from "@/components/ui";
import { formatDateTime, fullName } from "@/lib/format";
import { AdmitForm } from "./admit-form";
import { dischargePatient } from "./actions";

export default async function WardsPage() {
  const session = await requireSession();
  authorize(session, "admission:write");

  const [beds, admissions, patients] = await Promise.all([
    prisma.bed.findMany({ orderBy: { code: "asc" } }),
    prisma.admission.findMany({
      where: { status: "active" },
      include: { patient: true, bed: true },
      orderBy: { admittedAt: "desc" },
    }),
    prisma.patient.findMany({
      where: { status: { not: "admitted" } },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, mrn: true },
    }),
  ]);

  const wards = [...new Set(beds.map((b) => b.ward))];
  const occupied = beds.filter((b) => b.status === "occupied").length;
  const usable = beds.filter((b) => b.status !== "maintenance").length;

  return (
    <>
      <PageHeader
        title="Wards & beds"
        subtitle={`${occupied} of ${usable} usable beds occupied · ${beds.length} total`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {wards.map((ward) => {
            const wardBeds = beds.filter((b) => b.ward === ward);
            return (
              <Card key={ward}>
                <CardHeader
                  title={ward}
                  subtitle={`${wardBeds.filter((b) => b.status === "occupied").length} of ${wardBeds.length} occupied`}
                />
                <div className="grid grid-cols-3 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-6">
                  {wardBeds.map((bed) => {
                    const admission = admissions.find(
                      (a) => a.bedId === bed.id,
                    );
                    return (
                      <div
                        key={bed.id}
                        className={`rounded-lg border p-3 text-center ${
                          bed.status === "occupied"
                            ? "border-brand-300 bg-brand-50"
                            : bed.status === "maintenance"
                              ? "border-amber-300 bg-amber-50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="text-xs font-semibold text-ink-900">
                          {bed.code}
                        </p>
                        {admission ? (
                          <Link
                            href={`/patients/${admission.patientId}`}
                            className="mt-1 block truncate text-[11px] text-brand-700 hover:underline"
                          >
                            {fullName(admission.patient)}
                          </Link>
                        ) : (
                          <p className="mt-1 text-[11px] capitalize text-ink-500">
                            {bed.status}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Admit patient" />
            <div className="p-5">
              <AdmitForm
                patients={patients.map((p) => ({
                  id: p.id,
                  label: `${fullName(p)} — ${p.mrn}`,
                }))}
                beds={beds
                  .filter((b) => b.status === "available")
                  .map((b) => ({ id: b.id, label: `${b.code} · ${b.ward}` }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Current inpatients"
              subtitle={`${admissions.length} active`}
            />
            {admissions.length === 0 ? (
              <EmptyState message="No active admissions." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {admissions.map((admission) => (
                  <li key={admission.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/patients/${admission.patientId}`}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          {fullName(admission.patient)}
                        </Link>
                        <p className="text-xs text-ink-500">
                          {admission.bed.code} ·{" "}
                          {formatDateTime(admission.admittedAt)}
                        </p>
                      </div>
                      <Badge tone={statusTone(admission.status)}>
                        {admission.status}
                      </Badge>
                    </div>
                    {admission.reason && (
                      <p className="mt-1 text-xs text-ink-700">
                        {admission.reason}
                      </p>
                    )}
                    <form action={dischargePatient} className="mt-2">
                      <input
                        type="hidden"
                        name="admissionId"
                        value={admission.id}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-slate-50"
                      >
                        Discharge
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
