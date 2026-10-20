"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, Phone, UserRound } from "lucide-react";
import type { FranchiseStaff, FranchiseStore } from "@/lib/franchise/types";
import { Empty, Status, StoreImage } from "./UI";
import { notifyStoresLoading, storesLoadingReady } from "./stores-loading-events";
import styles from "./Franchise.module.css";
export function StoreDirectory({
  stores,
  staff,
}: {
  stores: FranchiseStore[];
  staff: FranchiseStaff[];
}) {
  useEffect(() => { notifyStoresLoading(storesLoadingReady); }, [stores, staff]);
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const managementQuery = new URLSearchParams();
  if (search) managementQuery.set("q", search);
  const query = search.toLocaleLowerCase("en-ZA").trim();
  const visible = stores.filter((s) =>
    [
      s.name,
      s.physical_store_address,
      s.city,
      s.province,
      ...staff
        .filter((p) => p.store_id === s.id && p.role === "manager")
        .map((p) => p.full_name?.trim() || p.email),
    ].some((v) => v?.toLocaleLowerCase("en-ZA").includes(query)),
  );
  return (
    <>
      <div className={`${styles.titleRow} ${styles.storeDirectoryHeader}`}>
        <div>
          <h1 className={styles.heading}>Manage Stores</h1>
        </div>
        <input
          className={styles.search}
          type="search"
          aria-label="Search stores by name, manager or location"
          placeholder="Search stores by name, manager or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {visible.length ? (
        <div className={styles.storeGrid}>
          {visible.map((store) => (
            <article
              className={`${styles.panel} ${styles.storeCard}`}
              key={store.id}
            >
              <StoreImage store={store} />
              <div className={styles.storeCardBody}>
                <div className={styles.storeCardHeading}>
                  <h2>{store.name}</h2>
                  <Status
                    active={
                      store.is_active && store.store_access_status === "active"
                    }
                  />
                </div>
                <p className={`${styles.muted} ${styles.storeCardInfo}`}>
                  <MapPin size={16} aria-hidden="true" />
                  <span>{[store.physical_store_address, store.city, store.province, store.postal_code]
                    .filter(Boolean)
                    .join(", ") || "Address not recorded"}</span>
                </p>
                <p className={`${styles.muted} ${styles.storeCardInfo}`}>
                  <UserRound size={16} aria-hidden="true" />
                  <span>{staff
                    .filter(
                      (p) => p.store_id === store.id && p.role === "manager",
                    )
                    .map((p) => p.full_name?.trim() || p.email)
                    .join(", ") || "No managers assigned"}</span>
                </p>
                <p className={`${styles.muted} ${styles.storeCardInfo}`}>
                  <Phone size={16} aria-hidden="true" />
                  <span>{store.store_phone_number || "No phone recorded"}</span>
                </p>
                <Link
                  href={`/dashboard/franchise/stores/${store.id}${managementQuery.size ? `?${managementQuery}` : ""}` as never}
                  className={`${styles.button} ${styles.storeCardManage}`}
                >
                  Manage Store →
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.panel}>
          <Empty>
            {stores.length
              ? "No stores match your search."
              : "No stores yet. Add your first store to get started."}
          </Empty>
          <Link
            className={styles.button}
            href={"/dashboard/franchise/stores/new" as never}
          >
            Add Store
          </Link>
        </section>
      )}
    </>
  );
}
