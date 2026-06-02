import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

const cookieName = "greenchoice_session";

type SessionState = {
  activeStoreId?: string;
  activeCartId?: string;
};

function secret() {
  return process.env.SESSION_SIGNING_SECRET || process.env.CSRF_SECRET || "local-dev-session-secret";
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(state: SessionState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value?: string): SessionState {
  if (!value) return {};
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return {};
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return {};
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionState;
  } catch {
    return {};
  }
}

export async function getSessionState() {
  const store = await cookies();
  return decode(store.get(cookieName)?.value);
}

export async function setSessionState(next: SessionState) {
  const store = await cookies();
  store.set(cookieName, encode(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function updateSessionState(patch: SessionState) {
  const current = await getSessionState();
  const next = { ...current, ...patch };
  await setSessionState(next);
  return next;
}
