"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import type { Role } from "@/lib/enums";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    const minutes = Math.ceil((retryAfterMs ?? 0) / 60_000);
    await audit(
      { id: "system", email: "system", fullName: "System", role: "admin" as Role, patientId: null },
      "auth.rate_limited",
      "security",
      undefined,
      { ip },
    );
    return {
      error: `Too many login attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  const invalid = { error: "Invalid email or password" };
  if (!user || !user.active) return invalid;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid;

  resetRateLimit(ip);

  const sessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as Role,
    patientId: user.patientId,
  };

  await createSession(sessionUser);
  await audit(sessionUser, "auth.login", "user", user.id);

  redirect(user.role === "patient" ? "/portal" : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
