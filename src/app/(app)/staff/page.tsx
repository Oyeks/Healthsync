import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/enums";
import { permissionsFor } from "@/lib/rbac";
import { formatDate } from "@/lib/format";

export default async function StaffPage() {
  const session = await requireSession();
  authorize(session, "staff:manage");

  const staff = await prisma.user.findMany({
    where: { role: { not: "patient" } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Staff & access"
        subtitle="User accounts and the permissions each role carries"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Staff accounts" subtitle={`${staff.length} users`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-ink-500">{user.email}</p>
                      {user.specialty && (
                        <p className="text-xs text-ink-500">
                          {user.specialty}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Badge tone="blue">
                        {ROLE_LABELS[user.role as Role]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={user.active ? "green" : "red"}>
                        {user.active ? "active" : "disabled"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Permission matrix"
            subtitle="What each role is authorised to do"
          />
          <div className="space-y-4 p-5">
            {ROLES.filter((role) => role !== "patient").map((role) => (
              <div key={role}>
                <p className="text-sm font-semibold text-ink-900">
                  {ROLE_LABELS[role]}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {permissionsFor(role).map((permission) => (
                    <Badge
                      key={permission}
                      tone={permission === "prescribe" ? "green" : "neutral"}
                    >
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            <p className="border-t border-slate-200 pt-4 text-xs text-ink-500">
              Patients hold no staff permissions — the portal scopes every query
              to their own record.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
