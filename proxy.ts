import { NextResponse, type NextRequest } from "next/server";

const legacyRoutePrefixes = [
  "/account",
  "/admin",
  "/browse",
  "/carts",
  "/products",
  "/register",
  "/dashboard/admin",
  "/dashboard/owner"
];

function attachCsrfCookie(response: NextResponse, request: NextRequest) {
  if (!request.cookies.get("csrf_token")) {
    response.cookies.set("csrf_token", crypto.randomUUID(), { httpOnly: false, sameSite: "lax", secure: true, path: "/" });
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLegacyRoute = pathname === "/" || legacyRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isLegacyRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return attachCsrfCookie(NextResponse.redirect(url), request);
  }

  const response = NextResponse.next();
  return attachCsrfCookie(response, request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
