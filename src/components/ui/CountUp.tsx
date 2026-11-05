"use client";

import { useEffect, useState } from "react";
import { formatBRL, formatInt } from "@/lib/format";

/** Número que "conta" de 0 até o valor (respeita prefers-reduced-motion). */
export function CountUp({ value, format = "int", duration = 1200 }: { value: number | null; format?: "brl" | "int"; duration?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (value === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (value === null) return <>—</>;
  return <>{format === "brl" ? formatBRL(Math.round(shown * 100) / 100) : formatInt(Math.round(shown))}</>;
}
