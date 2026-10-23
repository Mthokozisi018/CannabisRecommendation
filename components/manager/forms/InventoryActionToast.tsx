"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import styles from "./InventoryActionToast.module.css";

type Notice = { id: number; tone: "success" | "error"; title: string; description: string; closing: boolean };

export function useInventoryActionToast() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const nextId = useRef(0);
  const show = useCallback((tone: Notice["tone"], title: string, description: string) => {
    setNotice({ id: ++nextId.current, tone, title, description, closing: false });
  }, []);
  const dismiss = useCallback((id: number) => {
    setNotice(current => current?.id === id ? { ...current, closing: true } : current);
  }, []);

  useEffect(() => {
    if (!notice || notice.closing) return;
    const timer = window.setTimeout(() => dismiss(notice.id), 6000);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss]);

  useEffect(() => {
    if (!notice?.closing) return;
    const timer = window.setTimeout(() => setNotice(current => current?.id === notice.id ? null : current), 180);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return { notice, show, dismiss };
}

export function InventoryActionToast({ notice, onDismiss }: { notice: Notice | null; onDismiss: (id: number) => void }) {
  if (!notice) return null;
  const Icon = notice.tone === "success" ? Check : CircleAlert;
  return <div className={`${styles.toast} ${notice.tone === "error" ? styles.error : ""} ${notice.closing ? styles.closing : ""}`}
    role={notice.tone === "success" ? "status" : "alert"} aria-live={notice.tone === "success" ? "polite" : "assertive"}>
    <span className={styles.icon}><Icon size={21} aria-hidden="true" /></span>
    <div className={styles.copy}><strong>{notice.title}</strong><p>{notice.description}</p></div>
    <button type="button" className={styles.close} aria-label="Dismiss notification" onClick={() => onDismiss(notice.id)}><X size={18} aria-hidden="true" /></button>
  </div>;
}
