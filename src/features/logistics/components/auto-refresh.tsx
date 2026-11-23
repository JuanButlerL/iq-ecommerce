"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Vuelve a pedir la página cada `seconds` segundos, como mucho `times` veces (ej. esperando el seguimiento).
export function AutoRefresh({ seconds, times }: { seconds: number; times: number }) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= times) window.clearInterval(timer);
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds, times]);
  return null;
}
