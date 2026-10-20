import styles from "./Franchise.module.css";
export function HomeSkeleton() {
  return (
    <section
      className={`${styles.panel} ${styles.welcome}`}
      role="status"
      aria-label="Loading franchise summary"
    >
      <div aria-hidden="true">
        <div className={styles.skeleton} style={{ width: "60%", height: 38 }} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
      <div aria-hidden="true">
        <div className={styles.compact}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} style={{ height: 28 }} />
        </div>
        <div className={styles.compact}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      </div>
      <span className={styles.visuallyHidden}>Loading franchise summary</span>
    </section>
  );
}
export function ReportSkeleton({
  compact = false,
}: { compact?: boolean } = {}) {
  return (
    <div
      role="status"
      aria-label="Loading franchise performance"
      aria-busy="true"
    >
      <div className={compact ? styles.salesHeading : styles.titleRow}>
        <div
          className={styles.skeleton}
          style={{
            width: 260,
            maxWidth: "100%",
            height: 32,
            marginInline: compact ? "auto" : undefined,
          }}
        />
      </div>
      <div
        className={`${styles.kpis} ${compact ? styles.kpisCompact : ""}`}
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${styles.panel} ${styles.kpi}`}>
            <div>
              <div className={styles.skeleton} style={{ width: 100 }} />
              <div
                className={styles.skeleton}
                style={{ width: 120, height: 28 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.charts} aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className={styles.panel}>
            <div className={styles.skeleton} />
            <div className={styles.skeletonChart} />
          </div>
        ))}
      </div>
      <div className={styles.panel} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} style={{ height: 32 }} />
        ))}
      </div>
      <span className={styles.visuallyHidden}>
        Loading franchise performance
      </span>
    </div>
  );
}
