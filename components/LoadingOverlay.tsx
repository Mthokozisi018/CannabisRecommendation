import Image from "next/image";

type LoadingOverlayProps = {
  active?: boolean;
  label?: string;
};

export function LoadingOverlay({ active = true, label = "Loading" }: LoadingOverlayProps) {
  if (!active) return null;

  return (
    <div className="greenchoice-loader-overlay" role="status" aria-label={label} aria-live="polite" aria-busy="true">
      <div className="greenchoice-loader-shell" aria-hidden="true">
        <span className="greenchoice-loader-ring" />
        <span className="greenchoice-loader-ring greenchoice-loader-ring-soft" />
        <span className="greenchoice-loader-logo-frame">
          <Image className="greenchoice-loader-logo" src="/images/greenchoice-loading.png" alt="" width={96} height={96} priority sizes="56px" />
        </span>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
