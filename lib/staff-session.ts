import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { STORE } from "@/lib/data";
import type { StaffDTO, StaffRole } from "@/lib/types";

const cookieName = "greenchoice_staff";

type StaffSession = {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  exp: number;
};

function secret() {
  const configured = process.env.STAFF_SESSION_SIGNING_SECRET || process.env.SESSION_SIGNING_SECRET || process.env.CSRF_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("STAFF_SESSION_SIGNING_SECRET must be configured with at least 32 characters.");
  }
  return "local-development-staff-session-secret-only";
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: StaffSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value?: string): StaffSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StaffSession;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function djangoRoleToStaffRole(role: string): StaffRole | null {
  if (role === "MANAGER") return "manager";
  if (role === "RECEPTIONIST") return "employee_receptionist";
  return null;
}

export async function setStaffSession(staff: Omit<StaffSession, "exp">) {
  const store = await cookies();
  store.set(cookieName, encode({ ...staff, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function getStaffSession(): Promise<StaffDTO | null> {
  const store = await cookies();
  const session = decode(store.get(cookieName)?.value);
  if (!session) return null;

  return {
    id: session.id,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
    storeId: STORE.id,
    memberships: [{ storeId: STORE.id, storeSlug: STORE.slug, storeName: STORE.name, role: session.role }]
  };
}
