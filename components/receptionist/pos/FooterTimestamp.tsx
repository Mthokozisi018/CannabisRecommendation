"use client";

import { useEffect, useState } from "react";

export function FooterTimestamp() {
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    const formatTimestamp = () => {
      setTimestamp(new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date()));
    };
    formatTimestamp();
    const intervalId = window.setInterval(formatTimestamp, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return <p>{timestamp}</p>;
}
