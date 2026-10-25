"use client";

import { useEffect } from "react";
import { notifyStoresLoading, storesLoadingFailed, storesLoadingStart } from "@/components/franchise/stores-loading-events";
import styles from "@/components/franchise/Franchise.module.css";

export default function StoresError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { notifyStoresLoading(storesLoadingFailed); }, [error]);
  return (
    <section role="alert" className={styles.panel}>
      <h1 className={styles.heading}>Manage Stores could not be loaded</h1>
      <p className={styles.muted}>Please try loading your store information again.</p>
      <button className={styles.button} onClick={() => {
        notifyStoresLoading(storesLoadingStart);
        retry();
      }}>Try again</button>
    </section>
  );
}
