// Solmara itself: a seeded grid city with roads, blocks, buildings, parks,
// a beach and a road graph that traffic and police drive on.

import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_W, BEACH_Y, SEA_Y, CITY_SEED, PALETTE } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

export const DISTRICTS = [
  { name: 'Marina', x0: 0, y0: 0, x1: 900, y1: 900 },
  { name: 'Old Town', x0: 900, y0: 0, x1: 2100, y1: 900 },
  { name: 'Downtown', x0: 2100, y0: 0, x1: 3600, y1: 1200 },
  { name: 'Palm Heights', x0: 0, y0: 900, x1: 1200, y1: 2100 },
  { name: 'The Docks', x0: 1200, y0: 1200, x1: 2400, y1: 2520 },
  { name: 'Sunset Beach', x0: 0, y0: 2100, x1: 3600, y1: 2700 },
  { name: 'Coral Flats', x0: 2400, y0: 1200, x1: 3600, y1: 2520 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmara';
}

// Landmark spots the missions use (all on or beside roads).
export const LANDMARKS = {
  safehouse: { x: 300, y: 450, label: 'Safehouse' },
  marinaPickup: { x: 300, y: 750, label: 'Marina pickup' },
  grandHotel: { x: 3150, y: 300, label: 'Grand Sol Hotel' },
  docksMeet: { x: 1500, y: 2250, label: 'Docks meeting' },
  showroom: { x: 2850, y: 1500, label: 'Showroom lot' },
  garage: { x: 900, y: 1950, label: "Deacon's Garage" },
  dockYard: { x: 1800, y: 2450, label: 'Dockyard' },
  bank: { x: 2550, y: 600, label: 'Solmara Trust' },
  hospital: { x: 900, y: 1050, label: 'Solmara General' },
  policeHQ: { x: 2100, y: 1050, label: 'Solmara PD HQ' },
};

export class City {
  constructor() {
    const rng = mulberry32(CITY_SEED);
    this.buildings = [];
    this.trees = [];
    this.parks = [];
    this.lots = [];
    this.buildingsByBlock = new Map();

    // Blocks: the rectangles between neighbouring roads.
    const xs = [0, ...ROAD_XS, WORLD_W];
    const ys = [0, ...ROAD_YS, WORLD_H];
    for (let bi = 0; bi < xs.length - 1; bi += 1) {
      for (let bj = 0; bj < ys.length - 1; bj += 1) {
        const x0 = xs[bi] + (bi === 0 ? 0 : ROAD_W / 2 + 14);
        const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 0 : ROAD_W / 2 + 14);
        const y0 = ys[bj] + (bj === 0 ? 0 : ROAD_W / 2 + 14);
        const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 0 : ROAD_W / 2 + 14);
        if (x1 - x0 < 60 || y1 - y0 < 60) continue;
        if (y1 > BEACH_Y) continue; // sand and sea stay clear of buildings
        const roll = rng();
        if (roll < 0.14) {
          this.parks.push({ x0, y0, x1, y1 });
          const n = rangeInt(rng, 5, 10);
          for (let t = 0; t < n; t += 1) {
            this.trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 14) });
          }
        } else if (roll < 0.24) {
          this.lots.push({ x0, y0, x1, y1 });
        } else {
          const cols = rangeInt(rng, 1, 2);
          const rows = rangeInt(rng, 1, 2);
          const bw = (x1 - x0) / cols;
          const bh = (y1 - y0) / rows;
          for (let c = 0; c < cols; c += 1) {
            for (let r = 0; r < rows; r += 1) {
              const bx0 = x0 + c * bw + 8;
              const by0 = y0 + r * bh + 8;
              const bx1 = x0 + (c + 1) * bw - 8;
              const by1 = y0 + (r + 1) * bh - 8;
              if (bx1 - bx0 < 40 || by1 - by0 < 40) continue;
              this.buildings.push({
                x0: bx0, y0: by0, x1: bx1, y1: by1,
                roof: pick(rng, PALETTE.buildingRoofs),
                tall: rng() < 0.3,
              });
            }
          }
        }
        // Street trees along the block edges.
        const edgeTrees = rangeInt(rng, 0, 3);
        for (let t = 0; t < edgeTrees; t += 1) {
          this.trees.push({ x: range(rng, x0, x1), y: y0 + 6, r: range(rng, 8, 11) });
        }
      }
    }

    // Palm rows along the beach.
    for (let x = 80; x < WORLD_W; x += 90) {
      this.trees.push({ x: x + range(rng, -20, 20), y: BEACH_Y + 26, r: range(rng, 10, 14), palm: true });
    }

    // Intersections of the road graph.
    this.intersections = [];
    for (const x of ROAD_XS) {
      for (const y of ROAD_YS) {
        this.intersections.push({ x, y });
      }
    }
  }

  // Nearest intersection to a point (traffic and police route through these).
  nearestIntersection(x, y) {
    let best = this.intersections[0];
    let bestD = Infinity;
    for (const p of this.intersections) {
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // Neighbour intersections one road away (4-connected grid).
  neighbours(p) {
    const out = [];
    const ix = ROAD_XS.indexOf(p.x);
    const iy = ROAD_YS.indexOf(p.y);
    if (ix > 0) out.push({ x: ROAD_XS[ix - 1], y: p.y });
    if (ix < ROAD_XS.length - 1) out.push({ x: ROAD_XS[ix + 1], y: p.y });
    if (iy > 0) out.push({ x: p.x, y: ROAD_YS[iy - 1] });
    if (iy < ROAD_YS.length - 1) out.push({ x: p.x, y: ROAD_YS[iy + 1] });
    return out;
  }

  isOnRoad(x, y) {
    for (const rx of ROAD_XS) if (Math.abs(x - rx) < ROAD_W / 2 + 6) return true;
    for (const ry of ROAD_YS) if (Math.abs(y - ry) < ROAD_W / 2 + 6) return true;
    return false;
  }

  isInSea(x, y) {
    return y > SEA_Y;
  }

  // Circle vs building AABBs: returns the building hit, or null.
  buildingHit(x, y, r) {
    for (const b of this.buildings) {
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cy = Math.max(b.y0, Math.min(y, b.y1));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  // Push a circle out of buildings and the world edge; returns true on a hit.
  collideCircle(body, r) {
    let hit = false;
    for (const b of this.buildings) {
      const cx = Math.max(b.x0, Math.min(body.x, b.x1));
      const cy = Math.max(b.y0, Math.min(body.y, b.y1));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          body.x = cx + (dx / d) * r;
          body.y = cy + (dy / d) * r;
        } else {
          body.x += r;
        }
      }
    }
    if (body.y > SEA_Y + 10) {
      body.y = SEA_Y + 10;
      hit = true;
    }
    body.x = Math.max(r, Math.min(WORLD_W - r, body.x));
    body.y = Math.max(r, Math.min(WORLD_H - r, body.y));
    return hit;
  }
}
