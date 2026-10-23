"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { FranchiseStoresLoadingContext } from "@/components/franchise/FranchiseStoresNavigation";
import { notifyStoresLoading, storesLoadingReady } from "@/components/franchise/stores-loading-events";
import styles from "@/components/franchise/Franchise.module.css";

export default function FranchiseStoresLoading() {
  const managed = useContext(FranchiseStoresLoadingContext);
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // A full refresh can render this fallback before navigation listeners mount.
  // Its own failure timer bounds that load without delaying successful responses.
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 120_000);
    return () => clearTimeout(timer);
  }, [attempt]);
  useEffect(() => () => notifyStoresLoading(storesLoadingReady), []);
  if (managed) return null;
  if (timedOut) return <div className="greenchoice-loader-overlay">
    <section role="alert" className={styles.panel}>
      <h2>Manage Stores is taking longer than expected</h2>
      <p className={styles.muted}>The page could not finish loading. Please try again.</p>
      <button className={styles.button} onClick={() => {
        setTimedOut(false);
        setAttempt(value => value + 1);
        router.refresh();
      }}>Try again</button>
    </section>
  </div>;
  return <LoadingOverlay label="Loading Franchise Manage Stores" />;
}
