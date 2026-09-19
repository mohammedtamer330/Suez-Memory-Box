import { shuffle } from "./rng";

/**
 * Memory pool for "Pull a memory".
 *
 *   AVAILABLE — not yet shown this cycle (already shuffled)
 *   CURRENT   — the memory on screen right now
 *   SEEN      — shown earlier this cycle
 *
 * Guarantees: stable ids, no immediate repeat, no repeat until every other memory has been shown,
 * reshuffle on exhaustion (the memory that was just shown can never come first in the next cycle),
 * and a manually opened photograph is recorded without ever going through the random draw.
 */
export interface PoolState {
  available: string[];
  current: string | null;
  seen: string[];
}

export class MemoryPool {
  private ids: string[];
  private rnd: () => number;
  state: PoolState;
  private subs = new Set<() => void>();
  /** Notified after every draw / manual open / sync, so the physical stack can re-render its thickness. */
  subscribe(fn: () => void): () => void { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  private emit() { this.subs.forEach((f) => f()); }
  version = 0;

  constructor(ids: readonly string[], rnd: () => number = Math.random) {
    this.ids = Array.from(new Set(ids));
    this.rnd = rnd;
    this.state = { available: shuffle(this.ids, rnd), current: null, seen: [] };
  }

  get size() { return this.ids.length; }

  /** 0..1 — how much of the stack is left. Drives the visual thickness of the physical stack. */
  get remainingRatio(): number {
    return this.ids.length ? this.state.available.length / this.ids.length : 0;
  }

  /** Random draw. Returns null only when the pool is empty. */
  draw(): string | null {
    const s = this.state;
    if (!this.ids.length) return null;
    if (s.available.length === 0) this.recycle();
    const next = s.available.shift() ?? null;
    if (next === null) return s.current; // single-item pool: nothing else to show
    if (s.current !== null) s.seen.push(s.current);
    s.current = next;
    this.version++; this.emit();
    return next;
  }

  /** Manual pick (tapping a visible photograph). Deterministic — never randomised. */
  open(id: string): void {
    if (!this.ids.includes(id)) return;
    const s = this.state;
    if (s.current === id) return;
    s.available = s.available.filter((x) => x !== id);
    s.seen = s.seen.filter((x) => x !== id);
    if (s.current !== null) s.seen.push(s.current);
    s.current = id;
    this.version++; this.emit();
  }

  /** Replace the underlying set (admin added/removed photos) without losing progress. */
  sync(ids: readonly string[]): void {
    const next = Array.from(new Set(ids));
    const set = new Set(next);
    const s = this.state;
    const known = new Set([...s.available, ...s.seen, ...(s.current ? [s.current] : [])]);
    s.available = s.available.filter((x) => set.has(x));
    s.seen = s.seen.filter((x) => set.has(x));
    if (s.current && !set.has(s.current)) s.current = null;
    const fresh = next.filter((x) => !known.has(x));
    s.available = shuffle([...s.available, ...fresh], this.rnd);
    this.ids = next;
    this.version++; this.emit();
  }

  private recycle() {
    const s = this.state;
    const pool = [...s.seen];
    if (pool.length === 0) return; // only `current` exists
    let next = shuffle(pool, this.rnd);
    // `current` stays out of the fresh cycle until the next exhaustion, so it can't repeat immediately.
    s.available = next;
    s.seen = [];
  }

  recent(n: number): string[] {
    const list = [...this.state.seen, ...(this.state.current ? [this.state.current] : [])];
    return list.slice(-n);
  }
}
