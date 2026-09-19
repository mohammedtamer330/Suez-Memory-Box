"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExperienceData } from "@/lib/types";
import { MemoryPool } from "@/lib/memory-pool";
import { getSound } from "@/lib/sound";
import { useIsWide, useReducedMotion } from "@/hooks/useReducedMotion";
import { ExperienceContext, type ExperienceCtx, type OpenPhotoOpts } from "./context";
import { GroupPhotoCollection, type TableHandle } from "./GroupPhotoCollection";
import { PhotoViewer, type ViewerState } from "./PhotoViewer";
import { FlashLayer, type FlashHandle } from "./FlashLayer";
import { SoundToggle } from "./SoundToggle";
import { StickerDefs } from "./CitySticker";
import { OpeningExperience } from "./OpeningExperience";
import { MemoryPullExperience } from "./MemoryPullExperience";
import { MemoryBookCollection } from "./MemoryBookCollection";
import { MemoryBook, type BookState } from "./MemoryBook";
import { CityStickers } from "./CityStickers";
import { ClosingExperience } from "./ClosingExperience";

export function Experience({ data }: { data: ExperienceData }) {
  const { people, group, settings } = data;
  const wide = useIsWide();
  const reduced = useReducedMotion();
  const sound = useMemo(() => getSound(), []);
  const pool = useMemo(() => new MemoryPool(group.map((g) => g.id)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tableRef = useRef<TableHandle>(null);
  const flashRef = useRef<FlashHandle>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [book, setBook] = useState<BookState | null>(null);
  const [soundVisible, setSoundVisible] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const onIntroDone = useCallback(() => setIntroDone(true), []);

  useEffect(() => { pool.sync(group.map((g) => g.id)); }, [group, pool]);
  useEffect(() => { sound.setMusic(settings.musicUrl); }, [sound, settings.musicUrl]);
  useEffect(() => { const t = setTimeout(() => setSoundVisible(true), 400); return () => clearTimeout(t); }, []);

  const heroId = useMemo(() => {
    if (settings.heroPhotoId && group.some((g) => g.id === settings.heroPhotoId)) return settings.heroPhotoId;
    return (group.find((g) => g.priority) ?? group[0])?.id ?? null;
  }, [group, settings.heroPhotoId]);

  const openPhoto = useCallback((o: OpenPhotoOpts) => {
    if (o.mode === "peek") pool.open(o.id);
    setViewer({ id: o.id, mode: o.mode, origin: o.origin ?? null });
  }, [pool]);
  const openBook = useCallback((personId: string, origin: HTMLElement | null) => setBook({ personId, origin }), []);
  const flash = useCallback(() => flashRef.current?.fire() ?? Promise.resolve(), []);

  const ctx: ExperienceCtx = useMemo(() => ({ people, group, settings, sound, reduced, pool, openPhoto, openBook, flash }), [people, group, settings, sound, reduced, pool, openPhoto, openBook, flash]);

  return (
    <ExperienceContext.Provider value={ctx}>
      <StickerDefs />
      <main className="stage">
        <div className="stage-shade" aria-hidden />
        {group.length > 0 && wide !== null && (
          <GroupPhotoCollection ref={tableRef} photos={group} seed={settings.groupLayoutSeed} heroId={heroId} wide={wide} landInFirst={false} />
        )}
        {group.length > 0 && <MemoryPullExperience />}
        <MemoryBookCollection />
        <CityStickers />
        <ClosingExperience heroId={heroId} />
      </main>
      {wide !== null && <OpeningExperience table={tableRef} heroId={heroId} onDone={onIntroDone} />}
      <PhotoViewer state={viewer} onClose={() => setViewer(null)} />
      <MemoryBook state={book} onClose={() => setBook(null)} />
      <FlashLayer ref={flashRef} sound={sound} reduced={reduced} />
      <SoundToggle sound={sound} visible={soundVisible} />
    </ExperienceContext.Provider>
  );
}
