"use client";
import { useEffect } from "react";

let locks = 0;
export function lockScroll() { locks++; document.documentElement.classList.add("is-locked"); }
export function unlockScroll() { locks = Math.max(0, locks - 1); if (locks === 0) document.documentElement.classList.remove("is-locked"); }

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return () => unlockScroll();
  }, [active]);
}
