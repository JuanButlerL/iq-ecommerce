"use client";

import { useEffect, useState } from "react";

export type PostalCodeInfo = { status: "idle" | "loading" | "found" | "unknown"; province: string | null; localities: string[] };

// Busca provincia y localidades del CP en la tabla de logística (para no pedirle la provincia al cliente).
export function usePostalCodeInfo(postalCode: string): PostalCodeInfo {
  const cp = (postalCode ?? "").replace(/\D/g, "").slice(0, 4);
  const [info, setInfo] = useState<PostalCodeInfo>({ status: "idle", province: null, localities: [] });

  useEffect(() => {
    if (cp.length !== 4) {
      setInfo({ status: "idle", province: null, localities: [] });
      return;
    }
    const controller = new AbortController();
    setInfo((current) => ({ ...current, status: "loading" }));
    fetch(`/api/shipping/postal-code?cp=${cp}`, { signal: controller.signal })
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ok || !payload.data?.found) {
          setInfo({ status: "unknown", province: null, localities: [] });
          return;
        }
        setInfo({ status: "found", province: payload.data.province ?? null, localities: payload.data.localities ?? [] });
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setInfo({ status: "unknown", province: null, localities: [] });
      });
    return () => controller.abort();
  }, [cp]);

  return info;
}
