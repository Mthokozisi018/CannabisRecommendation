import { Banknote, Cannabis, UsersRound } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { LoggedInStaffSummary } from "@/lib/manager/dashboard-summary";

type ManagerWelcomePanelProps = {
  greeting: string;
  managerName?: string;
  roleLabel?: string;
  totalSalesToday?: number;
  loggedInToday?: LoggedInStaffSummary[];
  summaryLoading?: boolean;
};

function cleanDisplayValue(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function fittedFontSize(text: string, maxWidth: number, maxSize: number, minSize: number, widthFactor = 0.48) {
  return Math.max(minSize, Math.min(maxSize, Math.floor(maxWidth / Math.max(text.length * widthFactor, 1))));
}

function rand(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value).replace(/\s?R/, "R ");
}

function InfoCard({
  icon,
  heading,
  children,
  className = ""
}: {
  icon: ReactNode;
  heading: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`flex min-h-[78px] items-center gap-3.5 rounded-[16px] border border-white/12 bg-black/24 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_34px_rgba(0,0,0,0.22)] ${className}`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#72ef54]/12 text-[#77ef54] shadow-[0_0_30px_rgba(119,239,84,0.12)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white/72 sm:text-base">{heading}</p>
        {children}
      </div>
    </article>
  );
}

function roleLabel(role: LoggedInStaffSummary["role"]) {
  return role === "manager" ? "Manager" : "Receptionist";
}

function formatLoginTime(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}

function StaffLoginList({ staff, loading = false }: { staff: LoggedInStaffSummary[]; loading?: boolean }) {
  const visibleStaff = staff.slice(0, 3);
  const remaining = staff.length - visibleStaff.length;

  return (
    <div className="mt-2.5 border-t border-white/10">
      {loading ? (
        <p className="py-3 text-sm font-medium text-white/60">Loading staff activity...</p>
      ) : visibleStaff.length === 0 ? (
        <p className="py-3 text-sm font-medium text-white/60">No staff logins recorded today.</p>
      ) : (
        visibleStaff.map((member) => (
          <div key={member.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-2.5 border-b border-white/10 py-1.5 last:border-b-0">
            <span className="grid size-8 place-items-center rounded-full bg-[#77ef54]/14 text-sm font-extrabold text-white shadow-[0_0_18px_rgba(119,239,84,0.1)]">
              {member.initials.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold leading-tight text-white">{member.name}</span>
              <span className="block text-xs font-medium text-white/58">{roleLabel(member.role)}</span>
            </span>
            <span className="text-right">
              <span className="block text-xs font-extrabold text-[#77ef54]">{formatLoginTime(member.signedInAt)}</span>
              <span className="block text-xs font-bold text-[#77ef54]">Active</span>
            </span>
          </div>
        ))
      )}
      {remaining > 0 ? <p className="pt-3 text-right text-sm font-bold text-white/74">+ {remaining} more</p> : null}
    </div>
  );
}

export function ManagerWelcomePanel({ greeting, managerName, roleLabel, totalSalesToday = 0, loggedInToday = [], summaryLoading = false }: ManagerWelcomePanelProps) {
  const safeManagerName = cleanDisplayValue(managerName, "Manager");
  const safeRoleLabel = cleanDisplayValue(roleLabel, "Store Manager");
  const managerFontSize = fittedFontSize(safeManagerName, 520, 60, 32);
  const managerMobileFontSize = fittedFontSize(safeManagerName, 300, 42, 26);

  return (
    <section
      aria-labelledby="manager-welcome-heading"
      className="relative mx-auto w-full max-w-[980px] overflow-hidden rounded-[24px] border border-white/26 bg-black/32 px-4 py-4 shadow-[0_22px_72px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-18px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:px-5 sm:py-4 lg:px-6"
      style={{
        "--manager-name-size": `${managerFontSize}px`,
        "--manager-name-mobile-size": `${managerMobileFontSize}px`
      } as CSSProperties}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,0.09),transparent_32%,rgba(255,255,255,0.035))]" />
      <div aria-hidden="true" className="absolute inset-0 bg-black/18" />

      <div className="relative grid gap-4 lg:grid-cols-[1.05fr_1px_0.95fr] lg:items-stretch lg:gap-5">
        <div className="flex min-w-0 flex-col justify-center sm:flex-row sm:items-center sm:gap-5 lg:py-2">
          <span className="grid size-14 shrink-0 place-items-center rounded-full border border-[#77ef54]/70 bg-[#77ef54]/8 text-[#77ef54] shadow-[0_0_30px_rgba(119,239,84,0.16)] sm:size-16">
            <Cannabis aria-hidden="true" size={34} strokeWidth={1.8} />
          </span>

          <div className="mt-3 min-w-0 sm:mt-0">
            <p className="text-lg font-extrabold leading-tight text-[#77ef54] drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)] sm:text-xl">
              {greeting}
            </p>
            <h1
              id="manager-welcome-heading"
              className="mt-2.5 max-w-full break-words text-[var(--manager-name-mobile-size)] font-extrabold leading-[0.94] text-white drop-shadow-[0_8px_18px_rgba(0,0,0,0.52)] sm:text-[min(3.75rem,var(--manager-name-size))]"
            >
              {safeManagerName}
            </h1>
            <p className="mt-3 text-base font-medium leading-6 text-white/90 sm:text-lg">
              You&apos;re logged in as <span className="font-bold text-[#77ef54]">{safeRoleLabel}</span>
            </p>
          </div>
        </div>

        <div aria-hidden="true" className="hidden w-px bg-white/18 lg:block" />

        <div className="grid gap-3">
          <InfoCard heading="Total Sales Today" icon={<Banknote aria-hidden="true" size={30} strokeWidth={2.1} />}>
            <p className="mt-1 break-words text-2xl font-extrabold leading-tight text-white drop-shadow-[0_7px_16px_rgba(0,0,0,0.5)] sm:text-[1.7rem]">
              {summaryLoading ? "Loading sales..." : rand(totalSalesToday)}
            </p>
          </InfoCard>

          <article className="overflow-hidden rounded-[16px] border border-white/12 bg-black/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_34px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <UsersRound aria-hidden="true" className="shrink-0 text-[#77ef54]" size={25} strokeWidth={2.1} />
                <p className="truncate text-base font-extrabold text-white">Who&apos;s Logged In Today</p>
              </div>
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#77ef54]/16 text-base font-extrabold text-[#77ef54]">
                {summaryLoading ? "..." : loggedInToday.length}
              </span>
            </div>
            <div className="px-4 pb-2.5">
              <StaffLoginList staff={loggedInToday} loading={summaryLoading} />
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-xs font-medium text-white/58 sm:text-sm">Total Active Staff</span>
                <span className="text-lg font-extrabold text-[#77ef54]">{summaryLoading ? "..." : loggedInToday.length}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
