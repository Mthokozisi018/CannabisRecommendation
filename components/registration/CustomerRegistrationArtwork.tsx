import styles from "./CustomerRegistrationArtwork.module.css";

export function CustomerRegistrationArtwork({ onLight = false }: { onLight?: boolean }) {
  return (
    <div className={`${styles.artwork} ${onLight ? styles.onLight : ""}`} aria-hidden="true">
      <svg viewBox="0 150 2172 430" focusable="false">
        <image href="/images/registration/customer-registration-heading.png" width="2172" height="724" />
      </svg>
    </div>
  );
}
