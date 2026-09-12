import { describe, expect, it } from "vitest";
import {
  footprint,
  hexDistance,
  hexKey,
  hexNeighbours,
  hexOutline,
  hexRegionPath,
  hexToPixel,
  hexesWithin,
  parseHex,
  pixelToHex,
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

describe("outline geometry", () => {
  it("keeps only the edges where open ground meets rock", () => {
    // A lone hex shows all six sides; adding a neighbour hides the shared one.
    expect(hexOutline([{ q: 0, r: 0 }], 10)).toHaveLength(6);
    expect(
      hexOutline(
        [
          { q: 0, r: 0 },
          { q: 1, r: 0 },
        ],
        10,
      ),
    ).toHaveLength(10);
    // A hex ringed by neighbours contributes nothing: it is all interior.
    const ring = hexesWithin({ q: 0, r: 0 }, 1);
    expect(hexOutline(ring, 10)).toHaveLength(18);
  });

  it("draws one closed subpath per hex", () => {
    const path = hexRegionPath(hexesWithin({ q: 0, r: 0 }, 1), 8);
    expect(path.match(/M/g)).toHaveLength(7);
    expect(path.match(/Z/g)).toHaveLength(7);
  });

  it("inverts hexToPixel across the whole map range", () => {
    for (let q = -20; q <= 20; q++)
      for (let r = -20; r <= 20; r++)
        expect(hexKey(pixelToHex(hexToPixel({ q, r }, 11), 11))).toBe(
          hexKey({ q, r }),
        );
  });
});
