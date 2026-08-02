import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, ShoppingCart, UsersRound, type LucideIcon } from "lucide-react";

type CardTone = "green" | "purple" | "blue" | "amber";
type ManagerActionKey = "products" | "inventory" | "staff" | "serve";

type ManagerCard = {
  key: ManagerActionKey;
  title: string;
  href: string;
  icon: LucideIcon;
  tone: CardTone;
};

const cards: ManagerCard[] = [
  {
    key: "products",
    title: "Add Stock",
    href: "/dashboard/manager/inventory/manage",
    icon: Boxes,
    tone: "green"
  },
  {
    key: "inventory",
    title: "Manage Inventory",
    href: "/dashboard/manager/inventory",
    icon: ClipboardList,
    tone: "purple"
  },
  {
    key: "staff",
    title: "Manage Staff",
    href: "/dashboard/manager/staff",
    icon: UsersRound,
    tone: "blue"
  },
  {
    key: "serve",
    title: "Serve Customers",
    href: "/dashboard/receptionist",
    icon: ShoppingCart,
    tone: "amber"
  }
];

const toneStyles: Record<CardTone, { card: string; iconRing: string; icon: string; underline: string; arrow: string }> = {
  green: {
    card: "border-[#62e25b]/45 bg-[linear-gradient(145deg,rgba(18,71,31,0.72),rgba(3,17,12,0.94))] shadow-[0_24px_62px_rgba(33,130,42,0.22)] hover:border-[#7cf76b]/70",
    iconRing: "border-[#66ed5e]/80 shadow-[0_0_32px_rgba(102,237,94,0.18)]",
    icon: "text-[#72f06a]",
    underline: "bg-[#72f06a]",
    arrow: "border-[#72f06a]/35 bg-[#72f06a]/18 text-white shadow-[0_0_28px_rgba(114,240,106,0.24)]"
  },
  purple: {
    card: "border-[#9d55ff]/45 bg-[linear-gradient(145deg,rgba(41,27,65,0.76),rgba(12,10,23,0.95))] shadow-[0_24px_62px_rgba(112,59,205,0.2)] hover:border-[#b46bff]/75",
    iconRing: "border-[#9d55ff]/80 shadow-[0_0_32px_rgba(157,85,255,0.2)]",
    icon: "text-[#a867ff]",
    underline: "bg-[#a867ff]",
    arrow: "border-[#a867ff]/35 bg-[#a867ff]/18 text-white shadow-[0_0_28px_rgba(168,103,255,0.24)]"
  },
  blue: {
    card: "border-[#3c9dff]/45 bg-[linear-gradient(145deg,rgba(9,42,63,0.78),rgba(3,13,23,0.95))] shadow-[0_24px_62px_rgba(42,143,245,0.18)] hover:border-[#50adff]/75",
    iconRing: "border-[#3c9dff]/80 shadow-[0_0_32px_rgba(60,157,255,0.2)]",
    icon: "text-[#4da8ff]",
    underline: "bg-[#4da8ff]",
    arrow: "border-[#4da8ff]/35 bg-[#4da8ff]/18 text-white shadow-[0_0_28px_rgba(77,168,255,0.24)]"
  },
  amber: {
    card: "border-[#e5ad2f]/45 bg-[linear-gradient(145deg,rgba(70,45,10,0.72),rgba(18,13,6,0.95))] shadow-[0_24px_62px_rgba(213,145,20,0.18)] hover:border-[#ffc84b]/75",
    iconRing: "border-[#e5ad2f]/80 shadow-[0_0_32px_rgba(229,173,47,0.2)]",
    icon: "text-[#ffc64a]",
    underline: "bg-[#ffc64a]",
    arrow: "border-[#ffc64a]/35 bg-[#ffc64a]/18 text-white shadow-[0_0_28px_rgba(255,198,74,0.24)]"
  }
};

function ManagerActionCard({ href, icon: Icon, title, tone }: Omit<ManagerCard, "key">) {
  const styles = toneStyles[tone];
  const prefetch = href === "/dashboard/receptionist";

  return (
    <Link
      href={href as never}
      prefetch={prefetch}
      aria-label={title}
      className={`group relative flex h-[230px] w-full max-w-[176px] flex-col items-center justify-between overflow-hidden rounded-[18px] border px-5 py-8 text-center text-white backdrop-blur-xl transition duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-[252px] sm:max-w-[190px] lg:h-[270px] lg:max-w-[200px] ${styles.card}`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.11),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.11),transparent_30%,rgba(255,255,255,0.03))]" />
      <span className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-white/8" />

      <span className={`relative grid size-[78px] place-items-center rounded-full border bg-black/24 ${styles.iconRing} sm:size-[86px]`}>
        <Icon aria-hidden="true" className={styles.icon} size={42} strokeWidth={1.75} />
      </span>

      <span className="relative flex min-h-[64px] flex-col items-center justify-center">
        <span className="block max-w-[150px] text-[1.08rem] font-extrabold leading-tight text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.5)] sm:text-[1.16rem]">
          {title}
        </span>
        <span className={`mt-5 block h-0.5 w-9 rounded-full ${styles.underline}`} />
      </span>

      <span className={`relative grid size-9 place-items-center rounded-full border transition duration-300 group-hover:translate-x-1 ${styles.arrow}`}>
        <ArrowRight aria-hidden="true" size={18} strokeWidth={2.6} />
      </span>
    </Link>
  );
}

export function ManagerDashboardActions({
  hrefOverrides,
  titleOverrides
}: {
  hrefOverrides?: Partial<Record<ManagerActionKey, string>>;
  titleOverrides?: Partial<Record<ManagerActionKey, string>>;
}) {
  return (
    <nav aria-label="Manager dashboard actions" className="mx-auto mt-8 grid w-full max-w-[884px] grid-cols-1 justify-items-center gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-5">
      {cards.map(({ key, ...card }) => (
        <ManagerActionCard
          key={key}
          {...card}
          href={hrefOverrides?.[key] ?? card.href}
          title={titleOverrides?.[key] ?? card.title}
        />
      ))}
    </nav>
  );
}
