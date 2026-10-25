import Link from "next/link";
import { StoreSupply } from "@/components/master-supply/StoreSupply";
import { getManagerSupplySnapshot } from "@/lib/master-supply/data";
import styles from "@/components/master-supply/MasterSupply.module.css";

export const dynamic = "force-dynamic";
export default async function Page() {
  const snapshot = await getManagerSupplySnapshot();
  return <main className={styles.page}><Link className={styles.back} href="/dashboard/manager/suppliers">Back to Suppliers</Link><div className={styles.heading}><div><h1>Store Supply</h1><p>Track deliveries and confirm receipt for {snapshot.context.store_name}.</p></div></div><StoreSupply snapshot={snapshot} /></main>;
}
