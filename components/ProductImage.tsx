export function ProductImage({ slug, name, large = false }: { slug: string; name: string; large?: boolean }) {
  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-[#152018] via-[#23322a] to-[#11100d] ${large ? "min-h-[420px]" : "aspect-[4/3]"}`}>
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(45deg,rgba(255,255,255,.05)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.05)_50%,rgba(255,255,255,.05)_75%,transparent_75%,transparent)] [background-size:24px_24px]" />
      <div className="relative grid size-32 place-items-center rounded-full border border-mint/25 bg-mint/10 text-center text-sm font-semibold text-mint shadow-glow">
        {slug.split("-").slice(0, 2).join(" ")}
      </div>
      <span className="sr-only">{name}</span>
    </div>
  );
}
