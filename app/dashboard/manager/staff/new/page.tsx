import { CreateStaffScreen } from "@/components/manager/ManageStaffFlow";
import { getReceptionistSlotUsage } from "@/lib/manager/data";

export const dynamic = "force-dynamic";

export default async function CreateStaffPage() {
  const slotUsage = await getReceptionistSlotUsage();
  return <CreateStaffScreen slotUsage={slotUsage} />;
}
