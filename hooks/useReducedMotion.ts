"use client";
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

export function useIsWide(min = 860): boolean | null {
  const [w, setW] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia(`(min-width: ${min}px) and (min-aspect-ratio: 1/1)`);
    setW(m.matches);
    const on = () => setW(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [min]);
  return w;
}
