"use client";
import styles from "@/components/franchise/Franchise.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className={styles.panel}>
      <h1 className={styles.heading}>This page could not be loaded</h1>
      <p className={styles.muted}>
        The record may be unavailable or outside your franchise. Please retry or
        return to your dashboard.
      </p>
      <div className={`${styles.actions} mt-6`}>
        <button className={styles.button} onClick={reset}>
          Try again
        </button>
      </div>
    </section>
  );
}
