import { Download, History, MailCheck, PencilLine, ShieldCheck, Trash2 } from "lucide-react";
import { submitPrivacyRequestAction } from "@/app/actions";
import { consentRecords, customerContext, privacyRequests } from "@/lib/account-data";
import { assertPermission } from "@/lib/authorization";
import { GlassPanel } from "@/components/AccountChrome";

const actions = [
  { type: "download", label: "Download my data", icon: Download },
  { type: "correction", label: "Request correction", icon: PencilLine },
  { type: "deletion", label: "Request deletion", icon: Trash2 },
  { type: "marketing", label: "Manage marketing", icon: MailCheck }
];

export default function PrivacyCenterPage() {
  assertPermission(customerContext, "privacy.manage_self", { ownerUserId: customerContext.userId });
  return (
    <main className="mx-auto max-w-[1300px] px-4 py-8">
      <h1 className="text-4xl font-bold">Privacy <span className="text-lime-400">Center</span></h1>
      <p className="mt-3 max-w-3xl text-white/68">Manage profile data, privacy requests, consent history, sessions and security activity. Every submission is auditable.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <GlassPanel>
          <h2 className="text-2xl font-semibold">My profile data</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["Account state", customerContext.accountState],
              ["Adult access", customerContext.ageVerificationStatus],
              ["Jurisdiction", "South Africa"],
              ["Marketing", "Not opted in"]
            ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4"><dt className="text-sm text-white/50">{label}</dt><dd className="mt-1 font-semibold text-lime-400">{value}</dd></div>)}
          </dl>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {actions.map((item) => {
              const Icon = item.icon;
              return (
                <form action={submitPrivacyRequestAction} key={item.type}>
                  <input type="hidden" name="requestType" value={item.type} />
                  <button className="flex h-20 w-full items-center gap-3 rounded-lg border border-white/12 bg-black/20 px-4 text-left font-semibold transition hover:border-lime-400/50">
                    <Icon className="text-lime-400" />
                    {item.label}
                  </button>
                </form>
              );
            })}
          </div>
        </GlassPanel>
        <GlassPanel>
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><History className="text-lime-400" />Request status</h2>
          <div className="mt-5 space-y-3">
            {privacyRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex justify-between gap-3"><span className="font-semibold">{request.type}</span><span className="text-lime-400">{request.status}</span></div>
                <p className="mt-1 text-sm text-white/55">{request.id} submitted {request.submitted}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
      <GlassPanel className="mt-6" id="consents">
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck className="text-lime-400" />Consent records</h2>
        <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-white/60"><tr><th className="p-3">Policy</th><th>Status</th><th>Date</th><th>Version</th></tr></thead>
            <tbody>{consentRecords.map((record) => <tr key={record.version} className="border-t border-white/10"><td className="p-3">{record.label}</td><td className="text-lime-400">{record.status}</td><td>{record.date}</td><td>{record.version}</td></tr>)}</tbody>
          </table>
        </div>
      </GlassPanel>
    </main>
  );
}
