import { NextResponse, type NextRequest } from "next/server";

const legacyRoutePrefixes = [
  "/account",
  "/admin",
  "/browse",
  "/carts",
  "/products",
  "/register",
  "/dashboard/owner"
];

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

function contentSecurityPolicy(nonce: string) {
  const supabaseOrigin = configuredOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const connectSources = ["'self'"];
  const imageSources = ["'self'", "data:", "blob:"];
  if (supabaseOrigin) {
    connectSources.push(supabaseOrigin, supabaseOrigin.replace(/^http/, "ws"));
    imageSources.push(supabaseOrigin);
  }

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (process.env.NODE_ENV !== "production") scriptSources.push("'unsafe-eval'");

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
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
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
  return attachCsrfCookie(response, request);
}

function loginRedirect(request: NextRequest, requestId: string, nonce: string, error?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = error ? `?error=${encodeURIComponent(error)}` : "";
  return secureResponse(NextResponse.redirect(url), request, requestId, nonce);
}

async function protectedDashboardResponse(request: NextRequest, requestId: string, nonce: string) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/dashboard/manager") && !pathname.startsWith("/dashboard/receptionist")) return null;

  const headers = requestHeadersWithSecurityContext(request, requestId, nonce);
  const response = NextResponse.next({ request: { headers } });
  return secureResponse(response, request, requestId, nonce);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) || crypto.randomUUID();
  const nonce = btoa(crypto.randomUUID());
  const isLegacyRoute = pathname === "/" || legacyRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isLegacyRoute) {
    return loginRedirect(request, requestId, nonce);
  }

  const dashboardResponse = await protectedDashboardResponse(request, requestId, nonce);
  if (dashboardResponse) return dashboardResponse;

  const response = NextResponse.next({
    request: { headers: requestHeadersWithSecurityContext(request, requestId, nonce) }
  });
  return secureResponse(response, request, requestId, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|placeholder-images/|backgrounds/|legal/|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|pdf|css|js|map|txt)$).*)"]
};
