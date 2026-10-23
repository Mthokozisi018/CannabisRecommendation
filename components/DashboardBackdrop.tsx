export function DashboardBackdrop(_props: { variant?: "manager" | "receptionist" | "admin"; image?: string }) {
  const variant = _props.variant ?? "manager";
  const background = _props.image ?? {
    admin: "/images/admin-dashboard-wallpaper.png",
    manager: "/images/manager-dashboard/new-manager-wallpaper.png",
    receptionist: "/images/backgrounds/receptionist-pos-wallpaper.png"
  }[variant];
  const manager = variant === "manager";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050909]">
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${manager ? "opacity-100 saturate-110" : variant === "receptionist" ? "opacity-[0.62] saturate-125" : "opacity-62 saturate-125"}`}
        style={{ backgroundImage: manager ? `url(${background})` : `linear-gradient(120deg,rgba(0,0,0,0.48),rgba(0,0,0,0.2)),url(${background})` }}
      />
      {manager ? <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.56),rgba(0,0,0,0.24)_48%,rgba(0,0,0,0.58)),linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.68))]" /> : null}
      {!manager ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_8%,rgba(127,255,74,0.08),transparent_28%),linear-gradient(180deg,rgba(2,8,7,0.28),rgba(0,0,0,0.55))]" /> : null}
      {!manager ? <div className="absolute -left-28 -top-24 size-[430px] rounded-full bg-[radial-gradient(circle,rgba(109,210,75,0.3),transparent_68%)] blur-3xl" /> : null}
      {!manager ? <div className="absolute bottom-[-140px] right-[-120px] size-[560px] rounded-full bg-[radial-gradient(circle,rgba(93,186,70,0.34),transparent_70%)] blur-3xl" /> : null}
    </div>
  );
}

