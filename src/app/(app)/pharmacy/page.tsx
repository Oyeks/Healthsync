import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
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
import { DispenseForm } from "./dispense-form";

export default async function PharmacyPage() {
  const session = await requireSession();
  authorize(session, "pharmacy:read");

  const [dispensations, patients, pendingPrescriptions] = await Promise.all([
    prisma.dispensation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { patient: true, pharmacist: true },
    }),
    prisma.patient.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, mrn: true },
    }),
    prisma.medicalRecord.findMany({
      where: {
        prescriptions: { not: null },
        signedAt: { not: null },
      },
      orderBy: { visitDate: "desc" },
      take: 10,
      include: { patient: true, doctor: true },
    }),
  ]);

  const recentPrescriptions = pendingPrescriptions
    .map((r) => {
      try {
        const rxList = JSON.parse(r.prescriptions ?? "[]") as {
          drug: string;
          dose: string;
          frequency: string;
          duration: string;
        }[];
        return rxList.map((rx) => ({
          ...rx,
          patient: r.patient,
          doctor: r.doctor,
          visitDate: r.visitDate,
          recordId: r.id,
        }));
      } catch {
        return [];
      }
    })
    .flat();

  return (
    <>
      <PageHeader
        title="Pharmacy"
        subtitle="Medication dispensing and prescription tracking"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent prescriptions"
              subtitle="From signed medical records"
            />
            {recentPrescriptions.length === 0 ? (
              <EmptyState message="No recent prescriptions." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentPrescriptions.map((rx, i) => (
                  <li key={`${rx.recordId}-${i}`} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {rx.drug}{" "}
                          <span className="font-normal text-ink-500">
                            {rx.dose} &middot; {rx.frequency} &middot;{" "}
                            {rx.duration}
                          </span>
                        </p>
                        <p className="text-xs text-ink-500">
                          {fullName(rx.patient)} ({rx.patient.mrn}) &middot;
                          Prescribed by {rx.doctor.fullName}
                        </p>
                      </div>
                      <Badge tone="amber">Awaiting dispensing</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Dispensation log"
              subtitle={`${dispensations.length} records`}
            />
            {dispensations.length === 0 ? (
              <EmptyState message="No medications dispensed yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-ink-500">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Drug</th>
                      <th className="px-5 py-3">Dose</th>
                      <th className="px-5 py-3">Qty</th>
                      <th className="px-5 py-3">Pharmacist</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dispensations.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 whitespace-nowrap">
                          {formatDateTime(d.createdAt)}
                        </td>
                        <td className="px-5 py-3">{fullName(d.patient)}</td>
                        <td className="px-5 py-3 font-medium text-ink-900">
                          {d.drug}
                        </td>
                        <td className="px-5 py-3">{d.dose}</td>
                        <td className="px-5 py-3">{d.quantity}</td>
                        <td className="px-5 py-3">{d.pharmacist.fullName}</td>
                        <td className="px-5 py-3">
                          <Badge
                            tone={
                              d.status === "dispensed"
                                ? "green"
                                : d.status === "rejected"
                                  ? "red"
                                  : "amber"
                            }
                          >
                            {d.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          {can(session.role, "pharmacy:dispense") && (
            <Card>
              <CardHeader title="Dispense medication" />
              <DispenseForm patients={patients} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
