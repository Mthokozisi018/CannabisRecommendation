"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/components/master-supply/MasterSupply.module.css";

export default function SupplyError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router=useRouter();
  return <div className={styles.page}><section className={styles.panel} role="alert">
    <h1>Supply Management could not be loaded</h1>
    <p>Please try again. If the problem continues, return to the Franchise Admin dashboard.</p>
    <div className={styles.inline}><button className={styles.button} onClick={()=>{router.refresh();reset();}}>Try again</button><Link className={styles.button} href={"/dashboard/franchise" as never}>Back to dashboard</Link></div>
  </section></div>;
}
