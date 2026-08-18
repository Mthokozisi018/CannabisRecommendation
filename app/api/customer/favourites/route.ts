import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/customer/auth";
import { verifyOrigin } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({ targetType: z.enum(["store", "product"]), targetId: z.string().uuid() }).strict();
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization" };

export async function POST(request: Request) {
  try {
    await verifyOrigin();
    const session = await getCustomerSession();
    if (!session || session.profile.status !== "active") return NextResponse.json({ error: "Customer authentication required." }, { status: 401, headers: privateHeaders });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid saved item." }, { status: 400, headers: privateHeaders });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Saved items are temporarily unavailable." }, { status: 503, headers: privateHeaders });
    const column = parsed.data.targetType === "store" ? "store_id" : "product_id";
    const table = parsed.data.targetType === "store" ? "stores" : "products";
    const { data: target } = await admin.from(table).select("id").eq("id", parsed.data.targetId).maybeSingle();
    if (!target) return NextResponse.json({ error: "This item is no longer available." }, { status: 404, headers: privateHeaders });
    const { data: existing, error: readError } = await admin.from("customer_favourites").select("id").eq("user_id", session.user.id).eq(column, parsed.data.targetId).maybeSingle();
    if (readError) throw readError;
    if (existing) {
      const { error } = await admin.from("customer_favourites").delete().eq("id", existing.id).eq("user_id", session.user.id);
      if (error) throw error;
      return NextResponse.json({ saved: false }, { headers: privateHeaders });
    }
    const { error } = await admin.from("customer_favourites").insert({ user_id: session.user.id, [column]: parsed.data.targetId });
    if (error) throw error;
    return NextResponse.json({ saved: true }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "We could not update your saved items." }, { status: 500, headers: privateHeaders });
  }
}

