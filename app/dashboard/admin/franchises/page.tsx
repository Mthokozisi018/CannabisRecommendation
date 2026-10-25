import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/franchise/data";
import type { Franchise } from "@/lib/franchise/types";
import { AdminPageShell } from "@/components/admin/AdminDashboardUI";
import { Empty, dateLabel } from "@/components/franchise/UI";
import styles from "@/components/franchise/Franchise.module.css";
export default async function FranchisesPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Franchises are unavailable.");
  const [franchises, admins] = await Promise.all([
    readAll<Franchise>((o) =>
      supabase
        .from("franchises")
        .select(
          "id,name,registration_number,contact_email,phone,address,created_at",
        )
        .order("created_at")
        .range(o, o + 499),
    ),
    readAll<{ franchise_id: string; full_name: string; email: string }>((o) =>
      supabase
        .from("staff_profiles")
        .select("franchise_id,full_name,email")
        .eq("role", "franchise_admin")
        .neq("account_status", "deleted")
        .order("id")
        .range(o, o + 499),
    ),
  ]);
  return (
    <AdminPageShell>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Franchises</h1>
        <Link
          href={"/dashboard/admin/franchises/new" as never}
          className={styles.button}
        >
          Register New Franchise
        </Link>
      </div>
      <section className={styles.panel}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Franchise</th>
                <th>Contact</th>
                <th>Administrator</th>
                <th>Registered</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {franchises.map((f) => {
                const admin = admins.find((a) => a.franchise_id === f.id);
                return (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>{f.contact_email}</td>
                    <td>{admin?.full_name || "Pending registration"}</td>
                    <td>{dateLabel(f.created_at)}</td>
                    <td>
                      {!admin ? (
                        <Link
                          href={
                            `/dashboard/admin/franchises/new?franchiseId=${f.id}` as never
                          }
                        >
                          Register Administrator
                        </Link>
                      ) : (
                        admin.email
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!franchises.length ? (
          <Empty>No franchises registered yet.</Empty>
        ) : null}
      </section>
    </AdminPageShell>
  );
}
