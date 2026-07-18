import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  Card,
  PageHeader,
  ButtonLink,
  Badge,
  EmptyState,
  statusTone,
} from "@/components/ui";
import { age, formatDate, fullName } from "@/lib/format";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  authorize(session, "patient:read");

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // Multi-criteria search per the spec: name, MRN or phone.
  const patients = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { mrn: { contains: query } },
            { phone: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Master patient index — search by name, MRN or phone number"
        action={
          can(session.role, "patient:write") ? (
            <ButtonLink href="/patients/new">Register patient</ButtonLink>
          ) : undefined
        }
      />

      <Card>
        <form className="border-b border-slate-200 p-4">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name, MRN (HS-2026-00001) or phone…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500"
          />
        </form>

        {patients.length === 0 ? (
          <EmptyState
            message={
              query
                ? `No patients match “${query}”.`
                : "No patients registered yet."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">MRN</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Age / Sex</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Registered</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-500">
                      {patient.mrn}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {fullName(patient)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-700">
                      {age(patient.dob)}y · {patient.gender}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-700">
                      {patient.phone}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-500">
                      {formatDate(patient.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(patient.status)}>
                        {patient.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
