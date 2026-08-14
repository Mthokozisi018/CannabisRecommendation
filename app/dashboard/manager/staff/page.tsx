import { ManageStaffAccountsScreen } from "@/components/manager/ManageStaffFlow";
import { getReceptionistSlotUsage, listCompletedReceptionistAccounts } from "@/lib/manager/data";

export const dynamic = "force-dynamic";

export default async function ManagerStaffPage() {
  const [accounts, slotUsage] = await Promise.all([
    listCompletedReceptionistAccounts(),
    getReceptionistSlotUsage()
  ]);
  return <ManageStaffAccountsScreen accounts={accounts} slotUsage={slotUsage} />;
}
