/**
 * Flat-top hexes on axial coordinates. Hexes are deliberately smaller than a
 * standard unit: a standard piece covers a hex and its ring of neighbours, so
 * unit size is expressed as a footprint radius rather than a single cell.
 */
export type Hex = { q: number; r: number };

export const hexKey = (hex: Hex): string => `${hex.q},${hex.r}`;

export function parseHex(key: string): Hex | null {
  const match = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!match) return null;
  return { q: Number(match[1]), r: Number(match[2]) };
}

export const hexEquals = (a: Hex, b: Hex): boolean =>
  a.q === b.q && a.r === b.r;

/** Cube distance, which is the number of steps between two hexes. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

const directions: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hexNeighbours = (hex: Hex): Hex[] =>
  directions.map((step) => ({ q: hex.q + step.q, r: hex.r + step.r }));

/** Every hex within `radius` of the centre, including the centre itself. */
export function hexesWithin(centre: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    const low = Math.max(-radius, -q - radius);
    const high = Math.min(radius, -q + radius);
    for (let r = low; r <= high; r++)
      out.push({ q: centre.q + q, r: centre.r + r });
  }
  return out;
}

/**
 * The hexes a unit of the given size occupies when anchored here. Size 0 is a
 * single hex, size 1 is a standard piece at seven hexes, size 2 is nineteen.
 */
export const footprint = (anchor: Hex, size: number): Hex[] =>
  hexesWithin(anchor, Math.max(0, size));

/** The hexes along the straight line between two hexes, endpoints included. */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const steps = hexDistance(a, b);
  if (steps === 0) return [{ ...a }];
  const out: Hex[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Interpolate in cube space, then round back to a whole hex.
    const q = a.q + (b.q - a.q) * t;
    const r = a.r + (b.r - a.r) * t;
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    out.push({ q: rq, r: rr });
  }
  return out;
}

/** Pixel centre of a flat-top hex, for rendering only. */
export function hexToPixel(hex: Hex, radius: number): { x: number; y: number } {
  return {
    x: radius * 1.5 * hex.q,
    y: radius * Math.sqrt(3) * (hex.r + hex.q / 2),
  };
}
