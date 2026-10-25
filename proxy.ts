import { NextResponse, type NextRequest } from "next/server";
import { isCustomerExperienceEnabled } from "@/lib/feature-flags";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const legacyRoutePrefixes = [
  "/account",
  "/admin",
  "/browse",
  "/carts",
  "/products",
  "/dashboard/owner"
];

const supabaseSessionPrefixes = [
  "/dashboard",
  "/manager/",
  "/staff/",
  "/customer",
  "/auth/callback",
  "/update-password",
  "/api/auth/access-decision",
  "/api/auth/customer-",
  "/api/auth/password-update",
  "/api/customer/"
];

const customerPagePrefixes = ["/customer", "/forgot-account", "/auth/callback"];
const customerApiPrefixes = ["/api/customer/", "/api/auth/customer-"];
const retiredRoutePrefixes = ["/staff/invitation"];

function attachCsrfCookie(response: NextResponse, request: NextRequest) {
  if (!request.cookies.get("csrf_token")) {
    response.cookies.set("csrf_token", crypto.randomUUID(), { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  }
  return response;
}

function requestHeadersWithSecurityContext(request: NextRequest, requestId: string, nonce: string) {
  const headers = new Headers(request.headers);
  headers.set("x-greenchoice-pathname", request.nextUrl.pathname);
  headers.set("x-request-id", requestId);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  return headers;
}

function configuredOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredSentryOrigin() {
  const dsnOrigin = configuredOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN);
  return dsnOrigin ?? "https://o4511845984305152.ingest.de.sentry.io";
}

function contentSecurityPolicy(nonce: string) {
  const supabaseOrigin = configuredOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const connectSources = ["'self'", configuredSentryOrigin()];
  const imageSources = ["'self'", "data:", "blob:"];
  if (supabaseOrigin) {
    connectSources.push(supabaseOrigin, supabaseOrigin.replace(/^http/, "ws"));
    imageSources.push(supabaseOrigin);
  }

  const scriptSources = ["'self'", `'nonce-${nonce}'`];
  if (process.env.NODE_ENV === "production") {
    scriptSources.push("'strict-dynamic'");
  } else {
    scriptSources.push("'unsafe-eval'", "https://va.vercel-scripts.com");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : [])
  ].join("; ");
}

function secureResponse(response: NextResponse, request: NextRequest, requestId: string, nonce: string) {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", `${request.nextUrl.pathname.startsWith("/register/") ? "camera=(self)" : "camera=()"}, microphone=(), geolocation=(self), payment=(), usb=()`);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/manager/") ||
    pathname.startsWith("/staff/") ||
    pathname.startsWith("/customer") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/") ||
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/forgot-account" ||
    pathname === "/update-password"
  ) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    const vary = new Set(
      `${response.headers.get("Vary") ?? ""},Cookie,Authorization`
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
    response.headers.set("Vary", Array.from(vary).join(", "));
  }
  if (pathname.startsWith("/register") || pathname.startsWith("/api/registration/")) response.headers.set("Referrer-Policy", "no-referrer");
  return attachCsrfCookie(response, request);
}

function loginRedirect(request: NextRequest, requestId: string, nonce: string, error?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = error ? `?error=${encodeURIComponent(error)}` : "";
  return secureResponse(NextResponse.redirect(url), request, requestId, nonce);
}

function unavailableResponse(request: NextRequest, requestId: string, nonce: string) {
  return secureResponse(
    new NextResponse("Authentication is temporarily unavailable. Please try again.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "5"
      }
    }),
    request,
    requestId,
    nonce
  );
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

function isProtectedWorkstationPath(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/manager/") || pathname.startsWith("/staff/");
}

function shouldRefreshSupabaseSession(pathname: string) {
  return supabaseSessionPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function createNextResponse(request: NextRequest, requestId: string, nonce: string) {
  return NextResponse.next({
    request: { headers: requestHeadersWithSecurityContext(request, requestId, nonce) }
  });
}

async function protectedWorkstationResponse(request: NextRequest, requestId: string, nonce: string) {
  const refreshed = await refreshSupabaseSession(request, () => createNextResponse(request, requestId, nonce));
  if (refreshed.status === "unavailable") {
    return copyResponseCookies(refreshed.response, unavailableResponse(request, requestId, nonce));
  }
  if (!refreshed.authenticated) {
    const error = refreshed.reason === "invalid_session" ? "session-expired" : undefined;
    return copyResponseCookies(refreshed.response, loginRedirect(request, requestId, nonce, error));
  }
  return secureResponse(refreshed.response, request, requestId, nonce);
}

async function nextResponseWithSession(request: NextRequest, requestId: string, nonce: string) {
  const createResponse = () => createNextResponse(request, requestId, nonce);
  if (!shouldRefreshSupabaseSession(request.nextUrl.pathname)) return createResponse();
  return (await refreshSupabaseSession(request, createResponse)).response;
}

function isCustomerPage(pathname: string) {
  return customerPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCustomerApi(pathname: string) {
  return customerApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) || crypto.randomUUID();
  const nonce = btoa(crypto.randomUUID());
  const isLegacyRoute = pathname === "/" || legacyRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (retiredRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return secureResponse(new NextResponse("Not found.", { status: 404 }), request, requestId, nonce);
  }

  if (!isCustomerExperienceEnabled()) {
    if (isCustomerApi(pathname)) {
      return secureResponse(
        NextResponse.json({ error: "Not found." }, { status: 404 }),
        request,
        requestId,
        nonce
      );
    }
    if (isCustomerPage(pathname)) return loginRedirect(request, requestId, nonce);
  }

  if (isLegacyRoute) {
    return loginRedirect(request, requestId, nonce);
  }

  if (isProtectedWorkstationPath(pathname)) {
    return protectedWorkstationResponse(request, requestId, nonce);
  }

  const response = await nextResponseWithSession(request, requestId, nonce);
  return secureResponse(response, request, requestId, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|placeholder-images/|backgrounds/|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|pdf|css|js|map|txt)$).*)"]
};
