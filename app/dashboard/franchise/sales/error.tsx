"use client";

import { useEffect } from "react";
import { notifySalesLoading, salesLoadingFailed, salesLoadingStart } from "@/components/franchise/sales-loading-events";
import styles from "@/components/franchise/Franchise.module.css";

export default function SalesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { notifySalesLoading(salesLoadingFailed); }, [error]);
  return (
    <section role="alert" className={styles.panel}>
      <h1 className={styles.heading}>Sales Performance could not be loaded</h1>
      <p className={styles.muted}>Please try loading your sales report again.</p>
      <button className={styles.button} onClick={() => {
        notifySalesLoading(salesLoadingStart);
        retry();
      }}>Try again</button>
    </section>
  );
}
