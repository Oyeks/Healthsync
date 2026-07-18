"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";
import { Button, ErrorBanner } from "@/components/ui";

const DEMO_ACCOUNTS = {
  staff: [
    { role: "Administrator", email: "admin@healthsync.io" },
    { role: "Doctor", email: "doctor@healthsync.io" },
    { role: "Nurse", email: "nurse@healthsync.io" },
    { role: "Front Desk", email: "frontdesk@healthsync.io" },
    { role: "Billing", email: "billing@healthsync.io" },
  ],
  patient: [{ role: "Patient", email: "patient@healthsync.io" }],
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});
  const [mode, setMode] = useState<"staff" | "patient">("staff");
  const [email, setEmail] = useState("admin@healthsync.io");

  function switchMode(next: "staff" | "patient") {
    setMode(next);
    setEmail(DEMO_ACCOUNTS[next][0].email);
  }

  return (
    <div className="space-y-5">
      {/* Staff vs Patient toggle, per the wireframe spec. */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {(["staff", "patient"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => switchMode(option)}
            className={`rounded-md px-3 py-2 text-sm font-semibold capitalize transition-colors ${
              mode === option
                ? "bg-white text-brand-700 shadow-sm"
                : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-4">
        <ErrorBanner message={state.error} />

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Email</span>
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            name="password"
            type="password"
            required
            defaultValue="Password123!"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500"
          />
        </label>

        <SubmitButton />
      </form>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-ink-700">
          Demo accounts — password{" "}
          <code className="rounded bg-white px-1 py-0.5">Password123!</code>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS[mode].map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => setEmail(account.email)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                email === account.email
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-ink-500 hover:border-slate-300"
              }`}
            >
              {account.role}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
