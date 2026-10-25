"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import styles from "./Franchise.module.css";

type Manager = { id: string; name: string };

export function LoggedInManagers({ managers, activeManagers }: { managers: Manager[]; activeManagers: number }) {
  const [index, setIndex] = useState(0);
  const currentIndex = Math.min(index, Math.max(managers.length - 1, 0));

  return (
    <div className={styles.compact}>
      <div className={styles.managerHeading}>
        <Users className={styles.accent} size={20} aria-hidden="true" />
        <p>Managers Logged In Today</p>
        <b className={styles.accent}>{managers.length}</b>
        {managers.length > 1 && (
          <div className={styles.managerControls} role="group" aria-label="Browse managers logged in today">
            <button type="button" aria-label="Previous manager" disabled={currentIndex === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
              <ChevronUp size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next manager" disabled={currentIndex === managers.length - 1} onClick={() => setIndex((value) => Math.min(managers.length - 1, value + 1))}>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div className={styles.loginList} aria-live="polite" aria-atomic="true">
        {managers.length ? (
          <p title={managers[currentIndex].name}>{managers[currentIndex].name}</p>
        ) : (
          <p className={styles.muted}>No manager logins recorded today</p>
        )}
      </div>
      <p className={`${styles.muted} ${styles.section}`}>
        Total Active Managers <b className={styles.accent}>{activeManagers}</b>
      </p>
    </div>
  );
}
