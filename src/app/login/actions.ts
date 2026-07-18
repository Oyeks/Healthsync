"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
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

  // Same message for unknown email and wrong password so the form doesn't
  // reveal which accounts exist.
  const invalid = { error: "Invalid email or password" };
  if (!user || !user.active) return invalid;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid;

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
