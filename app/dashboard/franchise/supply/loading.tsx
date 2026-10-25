"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import styles from "@/components/master-supply/MasterSupply.module.css";

export default function SupplyLoading() {
  const router=useRouter();
  const [timedOut,setTimedOut]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const timer=setTimeout(()=>setTimedOut(true),45_000);
    return ()=>clearTimeout(timer);
  },[attempt]);
  if(timedOut) return <div className="greenchoice-loader-overlay"><section className={styles.panel} role="alert">
    <h2>Supply Management is taking longer than expected</h2>
    <p>Please try loading the dashboard again.</p>
    <button className={styles.button} onClick={()=>{setTimedOut(false);setAttempt(value=>value+1);router.refresh();}}>Try again</button>
  </section></div>;
  return <LoadingOverlay label="Loading Master Supply Management" />;
}
