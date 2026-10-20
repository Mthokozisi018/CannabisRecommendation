import { requireFranchiseAdmin } from "@/lib/franchise/auth";
import { StoreForm } from "@/components/franchise/Forms";
import styles from "@/components/franchise/Franchise.module.css";
export default async function NewStorePage() {
  const { session } = await requireFranchiseAdmin();
  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.heading}>Add Store</h1>
        </div>
      </div>
      <StoreForm creationScope={session.authUserId} />
    </>
  );
}
