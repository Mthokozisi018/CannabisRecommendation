import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get("csrf_token")) {
    response.cookies.set("csrf_token", crypto.randomUUID(), { httpOnly: false, sameSite: "lax", secure: true, path: "/" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
