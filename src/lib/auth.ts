import "server-only";
import { cookies } from "next/headers";
import { unauthorized } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "./enums";

const SESSION_COOKIE = "healthsync_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours — one clinical shift.

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  if (
    process.env.NODE_ENV === "production" &&
    (value.length < 32 || value.includes("dev-secret"))
  ) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters and not contain 'dev-secret' in production",
    );
  }
  return new TextEncoder().encode(value);
}

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  patientId: string | null;
};

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as Role,
      patientId: (payload.patientId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Returns the session, or interrupts with unauthorized.tsx — for routes that require any login. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) unauthorized();
  return session;
}
