import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrigin } from "@/lib/security";
import { requireRateLimit, trustedClientIp, RateLimitExceededError, rateLimitHeaders } from "@/lib/rate-limit";
import { registrationSchema, maskPhone, MAX_REGISTRATION_UPLOAD_BYTES } from "@/lib/registration/validation";
import { submitQRRegistration, RegistrationError, RegistrationServiceError } from "@/lib/registration/submit";
import { VerificationError } from "@/lib/registration/provider";
import { signRegistrationReceipt } from "@/lib/registration/receipt";
import { logServerEvent } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    try { await verifyOrigin(); } catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers }); }
    // Limit BEFORE multipart parsing and independent of browser-chosen token, phone or request ID.
    await requireRateLimit({ namespace: "store-qr-register-ip", identifiers: [trustedClientIp(request.headers)], limit: 10, windowMs: 3_600_000 });
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return NextResponse.json({ error: "Submit the registration form with a document image." }, { status: 415, headers });
    const length = Number(request.headers.get("content-length"));
    if (length > MAX_REGISTRATION_UPLOAD_BYTES + 32_768) return NextResponse.json({ error: "Choose an image under 4 MB.", field: "image" }, { status: 413, headers });
    // Bound chunked requests too; don't rely on Content-Length.
    const stream = request.body?.getReader();
    if (!stream) throw new RegistrationError("Invalid request.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await stream.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_REGISTRATION_UPLOAD_BYTES + 32_768) throw new RegistrationError("Choose an image under 4 MB.", "image", 413);
        chunks.push(chunk.value);
      }
    } finally { await stream.cancel(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    // Reject alternate stores, forged verification and unexpected fields.
    if ([...form.keys()].some(key => key !== "details" && key !== "image") || form.getAll("details").length !== 1 || form.getAll("image").length !== 1) throw new RegistrationError("Invalid registration request.", "");
    const details = form.get("details");
    const file = form.get("image");
    if (typeof details !== "string" || details.length > 16_384 || !(file instanceof File)) throw new RegistrationError("Provide your details and document image.", "image");
    let raw: unknown;
    try { raw = JSON.parse(details); } catch { throw new RegistrationError("Invalid registration details.", ""); }
    const input = registrationSchema.parse(raw);
    const { token } = await context.params;
    // Prepare signing configuration BEFORE the transaction commits.
    signRegistrationReceipt("", "");
    const result = await submitQRRegistration(token, input, file);
    const response = NextResponse.json({ redirectTo: "/register/success", checks: ["Document number matched", "Age requirement confirmed"] }, { status: 201, headers });
    response.cookies.set("gc_registration_receipt", signRegistrationReceipt(result.storeName, maskPhone(result.phoneDisplay)), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/register", maxAge: 900
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message, field: error.issues[0]?.path[0] }, { status: 400, headers });
    if (error instanceof RegistrationError) return NextResponse.json({ error: error.message, field: error.field }, { status: error.status, headers });
    if (error instanceof RegistrationServiceError) {
      await logServerEvent("warn", "qr_registration_unavailable", { stage: error.stage });
      return NextResponse.json({ error: error.message, code: error.code, field: "" }, { status: 503, headers });
    }
    if (error instanceof VerificationError) return NextResponse.json({ error: error.message, code: error.code, field: error.code === "unreadable" ? "image" : "documentNumber" }, { status: error.code === "unavailable" ? 503 : 422, headers });
    if (error instanceof RateLimitExceededError) return NextResponse.json({ error: error.message }, { status: 429, headers: { ...headers, ...rateLimitHeaders(error.result) } });
    // Never send raw DB, image or provider exceptions to logs/telemetry.
    await logServerEvent("error", "qr_registration_unexpected_failure", { category: "server_exception" });
    return NextResponse.json({ error: "Registration is temporarily unavailable. Please try again or ask the store for assistance." }, { status: 503, headers });
  }
}
