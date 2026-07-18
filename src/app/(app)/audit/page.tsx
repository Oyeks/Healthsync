import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

const ACTION_TONES: Record<string, "blue" | "green" | "red" | "amber"> = {
  create: "green",
  sign: "blue",
  cancel: "red",
  discharge: "amber",
  login: "blue",
};

function toneFor(action: string) {
  const verb = action.split(".")[1] ?? "";
  return ACTION_TONES[verb] ?? "neutral";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  authorize(session, "audit:read");

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const logs = await prisma.auditLog.findMany({
    where: query
      ? {
          OR: [
            { action: { contains: query } },
            { actorEmail: { contains: query } },
            { entityType: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Immutable record of access and changes across the system"
      />

      <Card>
        <form className="border-b border-slate-200 p-4">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Filter by action, user or entity…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500"
          />
        </form>

        {logs.length === 0 ? (
          <EmptyState message="No audit entries match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Entity</th>
                  <th className="px-5 py-3 font-medium">IP</th>
                  <th className="px-5 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-700">
                      {log.actorEmail}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Badge tone={toneFor(log.action)}>{log.action}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-700">
                      {log.entityType}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-500">
                      {log.ipAddress ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-5 py-3 font-mono text-xs text-ink-500">
                      {log.detail ?? "—"}
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
