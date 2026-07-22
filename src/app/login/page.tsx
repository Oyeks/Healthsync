import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LogoMark, Wordmark } from "@/components/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    if (session.role !== "patient") redirect("/dashboard");

    // A patient session's cookie can outlive the patient record it points
    // to (e.g. a database reset in development). Verify before trusting it
    // — otherwise this page and /portal would redirect to each other forever.
    const patientExists = await prisma.patient.findUnique({
      where: { id: session.patientId ?? "" },
      select: { id: true },
    });
    if (patientExists) redirect("/portal");
  }

  return (
    <main className="flex min-h-screen">
      {/* Brand panel — hidden on small screens where the form takes priority. */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-ink-900 p-12 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/60 via-transparent to-sync-900/40" />
        <div className="relative">
          <LogoMark className="h-14 w-14" />
        </div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight text-white">
            One record.
            <br />
            Every department.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            HealthSync connects registration, scheduling, clinical care,
            pharmacy, wards and billing into a single secure platform.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {[
              ["99.9%", "Uptime target"],
              ["HL7 / FHIR", "Standards ready"],
              ["Full audit", "Every access logged"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-lg font-semibold text-sync-300">{value}</dt>
                <dd className="mt-1 text-xs text-slate-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative text-xs text-slate-500">
          Protected health information. Authorised access only.
        </p>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <div>
              <Wordmark className="text-2xl" />
              <p className="text-xs text-ink-500">
                Hospital Management System
              </p>
            </div>
          </div>
          <h2 className="text-xl font-bold text-ink-900">Sign in</h2>
          <p className="mb-6 mt-1 text-sm text-ink-500">
            Use your hospital credentials to continue.
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
