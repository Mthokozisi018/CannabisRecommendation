import { Bell } from "lucide-react";
import { CustomerAlertItem } from "@/components/customer/CustomerAlertItem";
import { CustomerEmptyState } from "@/components/customer/CustomerEmptyState";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { listCustomerAlerts } from "@/lib/customer/alerts";

export const metadata = { title: "Alerts | GreenChoice" };

export default async function CustomerAlertsPage() {
  const alerts = await listCustomerAlerts();
  return <main className="min-h-screen"><CustomerHeader /><section className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><h1 className="text-3xl font-black">Alerts</h1><p className="mb-6 mt-2 text-[#aab4ac]">Order updates and collection reminders. Open an update for the latest order details.</p>{alerts.length ? <div className="grid gap-3">{alerts.map((alert) => <CustomerAlertItem key={alert.id} alert={alert} />)}</div> : <CustomerEmptyState Icon={Bell} title="No alerts yet" message="Your order updates will appear here after you place an order." href="/customer/shop" action="Browse stores" />}</section></main>;
}
