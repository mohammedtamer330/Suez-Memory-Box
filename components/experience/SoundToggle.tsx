"use client";
import { useSyncExternalStore } from "react";
import type { SoundEngine } from "@/lib/sound";

export function SoundToggle({ sound, visible }: { sound: SoundEngine; visible: boolean }) {
  const muted = useSyncExternalStore((cb) => sound.subscribe(cb), () => sound.muted, () => false);
  return (
    <button
      type="button"
      className={`sound-toggle ${visible ? "is-on" : ""}`}
      aria-pressed={!muted}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      onClick={() => { sound.unlock(); sound.setMuted(!muted); }}
      tabIndex={visible ? 0 : -1}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <><path d="M15.5 9a4.2 4.2 0 010 6" /><path d="M18 6.6a7.6 7.6 0 010 10.8" /></>}
      </svg>
    </button>
  );
}
