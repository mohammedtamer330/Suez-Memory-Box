"use client";
import { createContext, useContext } from "react";
import type { SoundEngine } from "@/lib/sound";
import type { GroupPhoto, PersonWithPhotos, Settings } from "@/lib/types";
import type { MemoryPool } from "@/lib/memory-pool";

export interface OpenPhotoOpts {
  id: string;
  /** 'peek' = picked up from the table; 'reveal' = drawn from the stack after the flash */
  mode: "peek" | "reveal";
  origin?: HTMLElement | null;
}
export interface ExperienceCtx {
  people: PersonWithPhotos[];
  group: GroupPhoto[];
  settings: Settings;
  sound: SoundEngine;
  reduced: boolean;
  pool: MemoryPool;
  openPhoto: (o: OpenPhotoOpts) => void;
  openBook: (personId: string, origin: HTMLElement | null) => void;
  /** Full-screen camera flash; resolves at the brightest moment so callers can swap content underneath. */
  flash: () => Promise<void>;
}
export const ExperienceContext = createContext<ExperienceCtx | null>(null);
export function useExperience(): ExperienceCtx {
  const c = useContext(ExperienceContext);
  if (!c) throw new Error("useExperience must be used inside <Experience>");
  return c;
}
