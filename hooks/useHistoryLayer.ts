"use client";
import { useEffect, useRef } from "react";

/**
 * Makes an overlay (photo, memory book) a real history entry so the browser/Android back gesture
 * closes just that overlay and returns to the previous composition — it never ejects the visitor.
 *
 * - opening pushes one entry
 * - browser Back → `onPop` (caller animates the close and sets active=false)
 * - closing from the UI → we silently pop our own entry
 */
export function useHistoryLayer(active: boolean, onPop: () => void) {
  const pushed = useRef(false);
  const ignore = useRef(false);
  const cb = useRef(onPop);
  cb.current = onPop;

  useEffect(() => {
    if (active && !pushed.current) {
      // keep Next.js' own history state so its popstate handler recognises our entry
      window.history.pushState({ ...(window.history.state || {}), s26Layer: true }, "");
      pushed.current = true;
    } else if (!active && pushed.current) {
      pushed.current = false;
      if (window.history.state?.s26Layer) {
        ignore.current = true;
        window.history.back();
      }
    }
  }, [active]);

  useEffect(() => {
    const onPopState = () => {
      if (ignore.current) { ignore.current = false; return; }
      if (pushed.current) { pushed.current = false; cb.current(); }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
