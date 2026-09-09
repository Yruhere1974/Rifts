import { describe, expect, it } from "vitest";
import { hexKey, hexesWithin, type Hex } from "@rifts/shared";
import { missionMap, siteHexes } from "./map.js";

/** Anchors a unit of this footprint radius can stand on and walk between. */
function reachable(size: number): Set<string> {
  const open = new Set(missionMap.open);
  const fits = (h: Hex) =>
    hexesWithin(h, size).every((cell) => open.has(hexKey(cell)));
  if (!fits(siteHexes.relay)) return new Set();
  const seen = new Set([hexKey(siteHexes.relay)]);
  const queue: Hex[] = [siteHexes.relay];
  while (queue.length) {
    const here = queue.shift()!;
    for (const next of hexesWithin(here, 1)) {
      const key = hexKey(next);
      if (!seen.has(key) && fits(next)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("mission map", () => {
  it("lets a standard unit reach every site", () => {
    const anchors = reachable(missionMap.sizes.standard);
    for (const [name, hex] of Object.entries(siteHexes))
      expect(anchors.has(hexKey(hex)), name).toBe(true);
  });
  it("denies a large unit the narrow side passages", () => {
    const large = reachable(missionMap.sizes.large);
    // The main hall carries it to the objective it exists to defend.
    expect(large.has(hexKey(siteHexes.relay))).toBe(true);
    expect(large.has(hexKey(siteHexes.rift))).toBe(true);
    // The side passages are too tight, so route choice depends on unit size.
    expect(large.has(hexKey(siteHexes.gate))).toBe(false);
    expect(large.has(hexKey(siteHexes.archive))).toBe(false);
    expect(large.size).toBeLessThan(reachable(missionMap.sizes.standard).size);
  });
});
