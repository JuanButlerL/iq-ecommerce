"use client";

import { useEffect } from "react";

export function HashScrollHandler() {
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.slice(1);

      if (!id) {
        return;
      }

      window.requestAnimationFrame(() => {
        const target = document.getElementById(id);

        if (!target) {
          return;
        }

        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);

    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return null;
}
