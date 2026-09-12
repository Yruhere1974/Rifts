import { useEffect, useState } from "react";

/**
 * Shared motion vocabulary. The rules are server-authoritative, so every
 * animation here is a reveal of a decided outcome, never a decision: a die
 * scramble must land on the value that already arrived, and nothing may gate
 * input, because rounds are simultaneous and another specialist can act mid
 * animation.
 *
 * Keep these values in step with the `--motion-*` custom properties in
 * game.css; they describe the same scale for JS-driven and CSS-driven motion.
 */
export const MOTION = {
  /** Acknowledging a click: selection, toggles. */
  instant: 90,
  /** Spending a component, seating a marker. */
  quick: 180,
  /** Arriving and coming to rest: dice landing, cards dealt. */
  settle: 320,
  /** Covering ground: a unit crossing hexes, per leg. */
  travel: 520,
  /** Looping, ambient states such as rising risk. */
  ambient: 1600,
  /** Delay between siblings in a cascade. */
  stagger: 40,
  /** Cap the cascade so a full hand never feels slow. */
  staggerLimit: 6,
} as const;

export const staggerDelay = (index: number): number =>
  Math.min(index, MOTION.staggerLimit) * MOTION.stagger;

/**
 * Honour the reader's motion preference in JS-driven animation. Pure CSS gets
 * this for free from the global reduce block in game.css.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** The value from the previous render, for diffing whole view snapshots. */
export function usePrevious<T>(value: T): T | undefined {
  const [tracked, setTracked] = useState<{
    current: T;
    previous: T | undefined;
  }>(() => ({ current: value, previous: undefined }));
  if (!Object.is(tracked.current, value))
    setTracked({ current: value, previous: tracked.current });
  return tracked.previous;
}

/**
 * Ids present now that were not present last render. The client re-renders
 * from whole snapshots, so this is how a console knows a die was just rolled
 * or a token was just drawn rather than merely being on screen.
 */
export function useArrivals(ids: readonly string[]): ReadonlySet<string> {
  const key = ids.join("|");
  const [tracked, setTracked] = useState(() => ({
    key,
    seen: new Set<string>(ids),
    fresh: new Set<string>(),
  }));
  if (tracked.key !== key) {
    const current = new Set(ids);
    setTracked({
      key,
      seen: current,
      fresh: new Set([...current].filter((id) => !tracked.seen.has(id))),
    });
  }
  return tracked.fresh;
}

/**
 * A token that changes whenever `value` does. Use it as a React `key` on the
 * animated element to replay a one-shot animation, which is cheaper and more
 * reliable than toggling a class on a timer.
 */
export function usePulse(value: unknown): number {
  const [tracked, setTracked] = useState(() => ({ value, token: 0 }));
  if (!Object.is(tracked.value, value))
    setTracked({ value, token: tracked.token + 1 });
  return tracked.token;
}
