import styles from "./Franchise.module.css";

export function FranchiseSalesHeading({ storePerformance }: { storePerformance: boolean }) {
  const title = storePerformance ? "Individual Store Performance" : "Franchise Sales Overview";
  const source = storePerformance
    ? "/images/franchise/individual-store-performance-heading.png"
    : "/images/franchise/franchise-sales-overview-heading.png";

  return (
    <h1 className={styles.salesImageHeading} aria-label={title}>
      {/* Frame the artwork with a small safety inset, excluding empty canvas.
          The original PNG, its proportions, glow and underline are preserved. */}
      <svg
        className={styles.salesHeadingImage}
        viewBox={storePerformance ? "65 108 2055 530" : "0 225 2172 333"}
        role="img"
        aria-label={title}
      >
        <image href={source} width="2172" height="724" />
      </svg>
    </h1>
  );
}
