// SOLMARA tuning constants: world size, road grid, physics, police and economy.
// One place for every number the other modules share.

export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const CITY_SEED = 20261120;

// Road grid: vertical roads at these x, horizontal at these y. Blocks sit between them.
export const ROAD_XS = [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300];
export const ROAD_YS = [300, 600, 900, 1200, 1500, 1800, 2100, 2400];
export const ROAD_W = 72;
export const LANE = 19; // lane offset from a road centreline (right-hand traffic)

// Beach and sea along the south edge.
export const BEACH_Y = 2520;
export const SEA_Y = 2620;

// Player on foot.
export const WALK_SPEED = 175;
export const SPRINT_SPEED = 265;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;

// Driving (arcade velocity-vector physics, see vehicles.js).
export const CAR_GRIP = 6.5; // how fast velocity aligns with heading (1/s)
export const CAR_DRAG = 0.55;
export const CAR_ROLL = 0.35;

// Wanted level.
export const MAX_STARS = 5;
export const EVADE_DIST = 620; // no cop within this range counts as unseen
export const EVADE_TIME = 5; // seconds unseen before the heat starts falling
export const BUST_TIME = 4; // seconds pinned by a cop at near-zero speed
export const BUST_DIST = 70;

// Money.
export const START_MONEY = 50;
export const BUST_FINE = 200;
export const WASTED_FINE = 100;

// Sun-soaked palette for the renderer.
export const PALETTE = {
  ground: '#c9b489',
  groundAlt: '#c2ad82',
  beach: '#e8d5a3',
  sea: '#2e7f9e',
  seaDeep: '#256d8c',
  road: '#3a3f4a',
  roadEdge: '#2c303a',
  sidewalk: '#b7ad96',
  lane: '#e8dd9a',
  buildingRoofs: ['#c96f4a', '#d9a05b', '#7fb069', '#5b8da8', '#b56576', '#e0c084', '#8a7ca8', '#d97b6c'],
  buildingEdge: 'rgba(0,0,0,0.25)',
  park: '#7fae5f',
  tree: '#3f7d44',
  treeDark: '#2f6234',
  trunk: '#6b4a2f',
  plaza: '#cbb98f',
};
