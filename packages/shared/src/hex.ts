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

/** The six corners of a flat-top hex, clockwise from the eastern vertex. */
export function hexCorners(
  hex: Hex,
  radius: number,
): { x: number; y: number }[] {
  const centre = hexToPixel(hex, radius);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return {
      x: centre.x + radius * Math.cos(angle),
      y: centre.y + radius * Math.sin(angle),
    };
  });
}

/**
 * Which two corners bound the edge shared with each neighbour, indexed to
 * match `hexNeighbours`. Neighbour normals sit at the edge midpoints, so the
 * edge for direction i spans the corners thirty degrees either side of it.
 */
const edgeCorners: readonly (readonly [number, number])[] = [
  [0, 1],
  [5, 0],
  [4, 5],
  [3, 4],
  [2, 3],
  [1, 2],
];

export type HexEdge = { x1: number; y1: number; x2: number; y2: number };

/**
 * The silhouette of a set of hexes: every edge with open ground on one side
 * and rock on the other. Interior edges are omitted, so a contiguous region
 * draws as one shape rather than as a grid.
 */
export function hexOutline(hexes: Iterable<Hex>, radius: number): HexEdge[] {
  const open = new Set<string>();
  const list: Hex[] = [];
  for (const hex of hexes) {
    const key = hexKey(hex);
    if (open.has(key)) continue;
    open.add(key);
    list.push(hex);
  }
  const edges: HexEdge[] = [];
  for (const hex of list) {
    const corners = hexCorners(hex, radius);
    hexNeighbours(hex).forEach((neighbour, index) => {
      if (open.has(hexKey(neighbour))) return;
      const pair = edgeCorners[index];
      const a = pair && corners[pair[0]];
      const b = pair && corners[pair[1]];
      if (a && b) edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    });
  }
  return edges;
}

/** Every hex as a closed subpath, for filling a region as one shape. */
export function hexRegionPath(hexes: Iterable<Hex>, radius: number): string {
  const parts: string[] = [];
  for (const hex of hexes) {
    const corners = hexCorners(hex, radius);
    const start = corners[0];
    if (!start) continue;
    parts.push(
      `M${start.x.toFixed(2)} ${start.y.toFixed(2)}` +
        corners
          .slice(1)
          .map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join("") +
        "Z",
    );
  }
  return parts.join("");
}

/** The hex containing a pixel, inverting `hexToPixel`. Rendering only. */
export function pixelToHex(
  point: { x: number; y: number },
  radius: number,
): Hex {
  const q = point.x / (radius * 1.5);
  const r = point.y / (radius * Math.sqrt(3)) - q / 2;
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}
