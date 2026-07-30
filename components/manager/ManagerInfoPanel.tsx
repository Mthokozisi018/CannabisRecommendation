import Image from "next/image";
import { Leaf, LogOut, Sprout } from "lucide-react";
import { logoutGreenChoiceStaffAction } from "@/app/actions";

const managerPanels = {
  addProducts: {
    src: "/images/manager/panels/add-products-panel-dark.png",
    alt: "Product setup panel with supported categories and quick reminders."
  },
  manageInventory: {
    src: "/images/manager/panels/manage-inventory-panel-dark.png",
    alt: "Add Stock panel explaining stock updates, search, history, and low stock alerts."
  },
  viewInventory: {
    src: "/images/manager/panels/view-inventory-panel-dark.png",
    alt: "View Inventory panel explaining read-only stock levels and filters."
  },
  createStaff: {
    src: "/images/manager/panels/create-staff-panel-dark.png",
    alt: "Create Staff Account panel explaining secure receptionist account creation."
  },
  manageStaffAccounts: {
    src: "/images/manager/panels/manage-staff-accounts-panel-dark.png",
    alt: "Manage Staff Accounts panel explaining account updates, password resets, and access changes."
  }
} as const;

export type ManagerInfoPanelKind = keyof typeof managerPanels;

export function ManagerDashboardTopBar({ profileLabel = "Manager profile" }: { profileLabel?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-14 place-items-center rounded-full bg-[radial-gradient(circle,rgba(131,230,83,0.28),transparent_70%)] text-lime-300">
          <Leaf size={38} fill="currentColor" />
        </span>
        <p className="text-[28px] font-extrabold leading-none text-white">
          Green<span className="text-[#72d943]">Choice</span>
        </p>
      </div>
      <div className="flex w-fit items-center gap-3 rounded-full border border-lime-400/35 bg-black/25 px-4 py-3 text-sm font-semibold text-white/90 shadow-[0_0_30px_rgba(115,215,70,0.16)] backdrop-blur-xl">
        <span className="grid size-11 place-items-center rounded-full bg-lime-400/15 text-lime-200"><Sprout size={24} /></span>
        <span>{profileLabel}</span>
        <form action={logoutGreenChoiceStaffAction}>
          <button type="submit" aria-label="Log out" className="grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white">
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </header>
  );
}

export function ManagerInfoPanel({ panel, className = "" }: { panel: ManagerInfoPanelKind; className?: string }) {
  const image = managerPanels[panel];

  return (
    <section className={`mx-auto mb-6 w-full overflow-hidden rounded-[24px] border border-lime-400/35 bg-black/45 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.32),0_0_28px_rgba(108,220,67,0.09)] backdrop-blur-xl ${className}`}>
      <div className="relative h-[clamp(190px,25vw,380px)] w-full overflow-hidden rounded-[20px] bg-black/70">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="(min-width: 1536px) 1500px, calc(100vw - 2rem)"
          className="object-contain object-top"
        />
      </div>
    </section>
  );
}
