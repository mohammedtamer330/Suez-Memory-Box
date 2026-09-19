"use client";
import { forwardRef, useImperativeHandle, useRef } from "react";
import gsap from "gsap";
import type { SoundEngine } from "@/lib/sound";

export interface FlashHandle { fire: () => Promise<void> }

/** A camera flash. Resolves at the brightest moment so callers can swap content underneath it. */
export const FlashLayer = forwardRef<FlashHandle, { sound: SoundEngine; reduced: boolean }>(function FlashLayer({ sound, reduced }, ref) {
  const el = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    fire: () => new Promise<void>((resolve) => {
      const node = el.current;
      if (!node) return resolve();
      sound.play("shutter"); sound.play("flash");
      gsap.killTweensOf(node);
      // reduced motion: a soft, low-contrast dip instead of a bright strobe
      const peak = reduced ? 0.35 : 0.94;
      gsap.timeline()
        .set(node, { opacity: 0 })
        .to(node, { opacity: peak, duration: reduced ? 0.25 : 0.09, ease: "power1.out", onComplete: resolve })
        .to(node, { opacity: peak, duration: reduced ? 0.05 : 0.06 })
        .to(node, { opacity: 0, duration: reduced ? 0.4 : 0.9, ease: "power2.out" });
    }),
  }), [sound, reduced]);
  return <div ref={el} className="flash" aria-hidden />;
});
