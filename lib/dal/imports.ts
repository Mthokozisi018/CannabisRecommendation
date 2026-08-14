import "server-only";
import { productImportRowSchema } from "@/lib/schemas/shared";
import { requireStaff } from "./auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ImportResult = {
  jobId?: string;
  validRows: number;
  errors: { rowNumber: number; field?: string; message: string }[];
};

function parseRows(json: string) {
  const payload = JSON.parse(json) as unknown;
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) {
    throw new Error("Import payload must contain a products array.");
  }
  return (payload as { products: unknown[] }).products.slice(0, 500);
}

export async function validateProductImport(input: { json: string; mode: "dry_run" | "commit" }): Promise<ImportResult> {
  const staff = await requireStaff(["admin", "catalog_manager"]);
  const rows = parseRows(input.json);
  const errors: ImportResult["errors"] = [];
  const validRows = rows.flatMap((row, index) => {
    const parsed = productImportRowSchema.safeParse(row);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => errors.push({ rowNumber: index + 1, field: issue.path.join("."), message: issue.message }));
      return [];
    }
    return [parsed.data];
  });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { validRows: validRows.length, errors };

  const { data: job, error } = await supabase
    .from("import_jobs")
    .insert({
      store_id: staff.storeId,
      actor_user_id: staff.id,
      mode: input.mode,
      status: errors.length ? "validation_failed" : input.mode === "dry_run" ? "validated" : "committed",
      row_count: rows.length,
      valid_row_count: validRows.length,
      error_count: errors.length
    })
    .select("id")
    .single();
  if (error || !job) throw new Error("Unable to record import job.");

  if (errors.length) {
    await supabase.from("import_job_errors").insert(errors.map((item) => ({
      import_job_id: job.id,
      row_number: item.rowNumber,
      field_path: item.field ?? null,
      message: item.message
    })));
  }

  return { jobId: job.id, validRows: validRows.length, errors };
}
