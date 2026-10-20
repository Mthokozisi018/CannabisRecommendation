"use client";
import { useState } from "react";
import type {
  FranchiseStaff,
  FranchiseStore,
  LoginRecord,
} from "@/lib/franchise/types";
import { Empty, Kpis, Status, StoreBanner } from "./UI";
import {
  StaffCreateForm,
  StaffEditForm,
  StoreForm,
  StoreImageForm,
} from "./Forms";
import { ManagerLoginHistory } from "./ManagerLoginHistory";
import type { ManagerLoginPage } from "@/lib/franchise/manager-login-history";
import styles from "./Franchise.module.css";
export function StoreManagement({
  store,
  staff,
  logins,
  managerHistory,
}: {
  store: FranchiseStore;
  staff: FranchiseStaff[];
  logins: LoginRecord[];
  managerHistory: ManagerLoginPage;
}) {
  const [tab, setTab] = useState("Manager Login History"),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<FranchiseStaff | null>(null),
    [creating, setCreating] = useState<"manager" | "receptionist" | null>(null);
  const [search, setSearch] = useState(""),
    [role, setRole] = useState("all"),
    [status, setStatus] = useState("all");
  const managers = staff.filter((s) => s.role === "manager"),
    receptionists = staff.filter(
      (s) =>
        s.role === "receptionist" &&
        ["active", "restricted"].includes(s.account_status),
    );
  const visible = staff.filter(
    (s) =>
      (role === "all" || s.role === role) &&
      (status === "all" || s.account_status === status) &&
      [s.full_name, s.email, s.phone_number, s.mobile_number].some((v) =>
        v?.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  function switchTab(value: string) {
    setTab(value);
    setEditing(false);
    setSelected(null);
    setCreating(null);
  }
  return (
    <>
      <StoreBanner store={store} />
      <div role="tablist" aria-label="Store management" className={styles.tabs}>
        {["Manager Login History", "Staff Management", "Store Settings"].map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t.replaceAll(" ", "-")}`}
            aria-controls="store-tab-panel"
            aria-selected={t === tab}
            tabIndex={t === tab ? 0 : -1}
            onKeyDown={(event) => {
              const tabs = ["Manager Login History", "Staff Management", "Store Settings"];
              const index = tabs.indexOf(t);
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              switchTab(tabs[next]);
              document.getElementById(`tab-${tabs[next].replaceAll(" ", "-")}`)?.focus();
            }}
            onClick={() => switchTab(t)}
            className={styles.tab}
          >
            {t}
          </button>
        ))}
      </div>
      <section
        id="store-tab-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`}
      >
        {tab === "Manager Login History" ? (
          <ManagerLoginHistory key={store.id} storeId={store.id} managers={managers} initialPage={managerHistory} />
        ) : null}
        {tab === "Staff Management" ? (
          <>
            <Kpis
              values={[
                { label: "Total Managers", value: managers.length },
                {
                  label: "Total Receptionists",
                  value: staff.filter((s) => s.role === "receptionist").length,
                },
                {
                  label: "Active Staff",
                  value: staff.filter((s) => s.account_status === "active")
                    .length,
                },
                {
                  label: "Restricted Staff",
                  value: staff.filter((s) => s.account_status === "restricted")
                    .length,
                },
              ]}
            />
            <section className={styles.panel}>
              <div className={styles.titleRow}>
                <h2>Staff Directory</h2>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setCreating("manager");
                      setSelected(null);
                    }}
                    disabled={managers.length >= 3 || !store.is_active}
                  >
                    Assign Manager
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setCreating("receptionist");
                      setSelected(null);
                    }}
                    disabled={receptionists.length >= 5 || !store.is_active}
                  >
                    Add Receptionist ({receptionists.length}/5)
                  </button>
                </div>
              </div>
              <div className={styles.titleRow}>
                <input
                  className={styles.search}
                  aria-label="Search staff"
                  type="search"
                  placeholder="Search staff…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className={styles.actions}>
                  <label className={styles.field}>
                    Role
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="all">All roles</option>
                      <option value="manager">Manager</option>
                      <option value="receptionist">Receptionist</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    Status
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      {["active", "restricted", "deactivated"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {[
                        "Staff Name",
                        "Role",
                        "Email",
                        "Phone",
                        "Status",
                        "Latest Recorded Login",
                        "Actions",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => (
                      <tr key={s.id}>
                        <td>{s.full_name?.trim() || "Setup pending"}</td>
                        <td>{s.role}</td>
                        <td>{s.email}</td>
                        <td>{s.phone_number || s.mobile_number || "—"}</td>
                        <td>
                          <Status
                            active={s.account_status === "active"}
                            label={s.account_status}
                          />
                        </td>
                        <td>
                          {logins.find((l) => l.user_id === s.auth_user_id)
                            ?.created_at
                            ? new Date(
                                logins.find(
                                  (l) => l.user_id === s.auth_user_id,
                                )!.created_at,
                              ).toLocaleString("en-ZA", {
                                timeZone: "Africa/Johannesburg",
                              })
                            : "Not recorded in recent history"}
                        </td>
                        <td>
                          <button
                            className={styles.button}
                            onClick={() => {
                              setSelected(s);
                              setCreating(null);
                            }}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visible.length ? (
                <Empty>No matching staff accounts.</Empty>
              ) : null}
            </section>
          </>
        ) : null}
        {tab === "Store Settings" ? (
          <>
            {editing ? (
              <>
                <StoreForm store={store} onCancel={() => setEditing(false)} />
                <div className={styles.section}>
                  <StoreImageForm storeId={store.id} />
                </div>
              </>
            ) : (
              <section className={styles.panel}>
                <div className={styles.titleRow}>
                  <h2>Store Settings</h2>
                  <button
                    className={styles.button}
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </button>
                </div>
                <dl className={styles.detailList}>
                  {[
                    ["Store name", store.name],
                    ["Address", store.physical_store_address],
                    ["City", store.city],
                    ["Province", store.province],
                    ["Postal code", store.postal_code],
                    ["Phone", store.store_phone_number],
                    ["Email", store.store_contact_email],
                    [
                      "Status",
                      store.is_active && store.store_access_status === "active"
                        ? "Active"
                        : "Inactive",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "Not recorded"}</dd>
                    </div>
                  ))}
                </dl>
                <h2 className={styles.section}>Operating hours</h2>
                {Object.keys(store.opening_hours || {}).length ? (
                  Object.entries(store.opening_hours || {}).map(([day, h]) => (
                    <p className={styles.muted} key={day}>
                      {day}:{" "}
                      {h.closed
                        ? "Closed"
                        : `${h.open || "—"} – ${h.close || "—"}`}
                    </p>
                  ))
                ) : (
                  <p className={styles.muted}>No operating hours recorded.</p>
                )}
              </section>
            )}
          </>
        ) : null}
        {tab === "Staff Management" && creating ? (
          <div className={styles.section}>
            <StaffCreateForm
              key={creating}
              storeId={store.id}
              role={creating}
              atLimit={
                creating === "manager"
                  ? managers.length >= 3
                  : receptionists.length >= 5
              }
            />
          </div>
        ) : null}
        {tab === "Staff Management" && selected ? (
          <div className={styles.section}>
            <StaffEditForm
              key={selected.id}
              person={selected}
              onCancel={() => setSelected(null)}
            />
          </div>
        ) : null}

      </section>
    </>
  );
}
