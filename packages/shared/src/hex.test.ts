import { describe, expect, it } from "vitest";
import {
  footprint,
  hexDistance,
  hexKey,
  hexNeighbours,
  hexesWithin,
  parseHex,
} from "./hex.js";

describe("hex geometry", () => {
  it("measures distance symmetrically and counts steps", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    for (const n of hexNeighbours({ q: 0, r: 0 }))
      expect(hexDistance({ q: 0, r: 0 }, n)).toBe(1);
    expect(hexDistance({ q: 3, r: -1 }, { q: 0, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
  });
  it("sizes footprints so a standard piece spans several hexes", () => {
    expect(footprint({ q: 2, r: 2 }, 0)).toHaveLength(1);
    expect(footprint({ q: 2, r: 2 }, 1)).toHaveLength(7);
    expect(footprint({ q: 2, r: 2 }, 2)).toHaveLength(19);
    // A footprint is exactly the hexes within its radius, with no duplicates.
    const cells = footprint({ q: -1, r: 4 }, 2).map(hexKey);
    expect(new Set(cells).size).toBe(cells.length);
    for (const cell of hexesWithin({ q: -1, r: 4 }, 2))
      expect(cells).toContain(hexKey(cell));
  });
  it("round-trips hex keys and rejects malformed ones", () => {
    expect(parseHex(hexKey({ q: -3, r: 7 }))).toEqual({ q: -3, r: 7 });
    for (const bad of ["", "1", "a,b", "1,2,3", "1, 2", "1.5,2"])
      expect(parseHex(bad)).toBeNull();
  });
});
