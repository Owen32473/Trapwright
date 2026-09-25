'use strict';

// --- Themes ------------------------------------------------------------
//
// A theme is a look (tile art, background, player colors — see
// THEME_TILE_TEXTURES in sprites.js) plus the traps its campaign levels
// use. Trap *rules* never depend on the theme: a level's `theme` field only
// picks how it's drawn and what shared traps are called. A level with no
// `theme` (every shared link made before themes existed) is lava.

const THEMES = ['lava', 'ice', 'grass'];

const THEME_INFO = {
  lava: { name: 'Volcanic Depths', short: 'Lava' },
  ice: { name: 'Frozen Caverns', short: 'Ice' },
  grass: { name: 'Overgrown Ruins', short: 'Grass' },
};

function normalizeTheme(theme) {
  return THEMES.includes(theme) ? theme : 'lava';
}

function levelTheme(level) {
  return normalizeTheme(level && level.theme);
}

// Every trap a theme's levels (and its Daily Puzzle builder palette) use,
// as palette types — rotatable families listed once in a default facing.
// Walls, start and goal are available everywhere (see PALETTE_BASICS).
const THEME_TRAPS = {
  lava: [
    'spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left',
    'portal-a', 'portal-b', 'ice', 'current-right', 'turret-right', 'vent-right', 'imp-h', 'bomb',
  ],
  ice: [
    'spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left',
    'portal-a', 'portal-b', 'ice', 'turret-right', 'thinice', 'frost', 'icicle',
  ],
  grass: [
    'spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left',
    'portal-a', 'portal-b', 'current-right', 'vines', 'mushroom', 'snapjaw', 'boar-h',
  ],
};

// --- Creative mode config ------------------------------------------------

const BUILDER_GRID_SIZE = 8;
// Trap *points*, not a raw tile count — see TRAP_COSTS.
const TRAP_BUDGET = 10;

// Placeable block/trap types shown as draggable items in the Creative Mode
// side panel, grouped under headings. 'empty' isn't listed — clearing a
// tile back to empty is done via the trash can instead of a palette entry.
// Rotatable types (turret/vent/current/imp/boar) appear once, in a default
// facing; clicking a placed one in the grid rotates it (see rotateTileType).
// A trap shared by several themes appears once, under the first theme that
// has it, and is named for whichever look the map uses (see trapLabel).
const PALETTE_BASICS = ['wall', 'start', 'goal'];
const PALETTE_GROUPS = [
  { title: 'Basics', types: PALETTE_BASICS },
  {
    title: 'Every theme',
    types: ['spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left', 'portal-a', 'portal-b'],
  },
  { title: 'Lava', types: ['bomb', 'turret-right', 'vent-right', 'imp-h', 'ice', 'current-right'] },
  { title: 'Ice', types: ['thinice', 'frost', 'icicle'] },
  { title: 'Grass', types: ['vines', 'mushroom', 'snapjaw', 'boar-h'] },
];
const BUILDER_PALETTE_TYPES = PALETTE_GROUPS.flatMap((group) => group.types);

// A trap's display name. Shared traps are named per theme (a spike is an
// "Icicle Spike" in an ice room); everything else has one name.
const TRAP_NAMES = {
  wall: 'Wall',
  start: 'Start',
  goal: 'Goal',
  spike: { lava: 'Spike', ice: 'Icicle Spike', grass: 'Thorn Spike' },
  timedspike: { lava: 'Timed Spike', ice: 'Frost Spike', grass: 'Snapping Thorns' },
  hiddenspike: { lava: 'Hidden Spike', ice: 'Buried Spike', grass: 'Covered Pit' },
  oneway: { lava: 'One-Way', ice: 'Frosted One-Way', grass: 'Vine One-Way' },
  'portal-a': { lava: 'Portal (Orange)', ice: 'Aurora Portal (Cyan)', grass: 'Fairy Ring (Gold)' },
  'portal-b': { lava: 'Portal (Violet)', ice: 'Aurora Portal (Pink)', grass: 'Fairy Ring (Blue)' },
  ice: { lava: 'Obsidian Ice', ice: 'Slick Ice', grass: 'Obsidian Ice' },
  turret: { lava: 'Lava Turret', ice: 'Frost Cannon', grass: 'Lava Turret' },
  current: { lava: 'Lava Current', ice: 'Lava Current', grass: 'Stream' },
  bomb: 'Bomb',
  vent: 'Flame Vent',
  imp: 'Fire Imp',
  thinice: 'Thin Ice',
  frost: 'Frostbite Patch',
  icicle: 'Falling Icicle',
  vines: 'Grabbing Vines',
  mushroom: 'Mushroom Pad',
  snapjaw: 'Snapjaw',
  boar: 'Wild Boar',
};

const ONEWAY_ARROWS = { up: '↑', right: '→', down: '↓', left: '←' };

function trapLabel(type, theme = 'lava') {
  const entry = TRAP_NAMES[type] || TRAP_NAMES[tileFamily(type)];
  if (!entry) return type;
  const name = typeof entry === 'string' ? entry : entry[normalizeTheme(theme)];
  return tileFamily(type) === 'oneway' ? `${name} ${ONEWAY_ARROWS[type.split('-')[1]]}` : name;
}

// One-line "what does it do" text, shown on the new-trap card before a
// campaign level and in Creative Mode's palette tooltips.
const TRAP_DESCRIPTIONS = {
  spike: 'Deadly to touch.',
  timedspike: 'Deadly for 2 beats, safe for 2. Wait for them to drop.',
  hiddenspike: 'Looks exactly like floor — until it gets you. Once found, it stays visible.',
  oneway: 'Can only be entered in the direction of its arrow.',
  portal: 'Step in to warp to the portal of the same color.',
  ice: "Keeps you sliding the way you stepped on. Hit something and you glance off to the side.",
  current: 'Shoves you one extra tile the way it flows.',
  turret: 'Fires down its line every 3 beats. The shot travels a tile per beat.',
  vent: 'Glows, then erupts every 5 beats, burning itself and 2 tiles ahead.',
  imp: 'Paces its row or column, one tile per beat.',
  bomb: 'Stepping on it lights a 3-beat fuse, then it blasts in a plus shape. Get clear!',
  thinice: 'Cracks under you and breaks the moment you step off. Cross each tile once. A slide stops dead on it.',
  frost: "Safe to cross, but freezes you if you're still on it a second beat later. Keep moving.",
  icicle: 'Walk under it and it shakes loose, crashing 3 beats later. The fallen ice is solid: it blocks you, slides and shots.',
  vines: 'Grabs you and holds you in place for 2 beats. Stops slides and pushes.',
  mushroom: 'Bounces you 2 tiles on, hopping over whatever is between — but not over walls.',
  snapjaw: 'A solid plant. Every 6 beats it rustles, then bites all 4 tiles next to it.',
  boar: 'Charges back and forth along its row or column, 2 tiles per beat. Both tiles it crosses are deadly.',
};

function trapDescription(type) {
  return TRAP_DESCRIPTIONS[type] || TRAP_DESCRIPTIONS[tileFamily(type)] || '';
}

// --- Tile families, directions, and trap costs ----------------------------

// Directional/variant types are '<family>-<variant>' ('turret-up', 'imp-h',
// 'portal-a'); everything else is its own family. Rules that don't care
// which way a tile faces key off the family.
function tileFamily(type) {
  return type.split('-')[0];
}

const DIRECTION_DELTAS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const DIRECTION_ORDER = ['up', 'right', 'down', 'left'];
const DIRECTIONAL_FAMILIES = new Set(['oneway', 'turret', 'vent', 'current']);

// [dx, dy] a directional tile faces, or null for non-directional types.
function tileDirection(type) {
  const [family, dir] = type.split('-');
  return DIRECTIONAL_FAMILIES.has(family) ? DIRECTION_DELTAS[dir] || null : null;
}

// The type a builder click turns this tile into: directional families step
// clockwise, imps and boars flip between horizontal and vertical patrols.
// null means "not rotatable" (the click is a no-op).
function rotateTileType(type) {
  const [family, variant] = type.split('-');
  if (family === 'imp' || family === 'boar') return `${family}-${variant === 'h' ? 'v' : 'h'}`;
  if (!DIRECTIONAL_FAMILIES.has(family)) return null;
  const next = DIRECTION_ORDER[(DIRECTION_ORDER.indexOf(variant) + 1) % DIRECTION_ORDER.length];
  return `${family}-${next}`;
}

// How many trap points each lethal family costs against the trap budget.
// Movement tiles (ice, currents, portals, one-ways, mushrooms) are free:
// they reshape the route but never kill on their own. Vines don't kill
// either, but holding you still is what makes everything else deadly, so
// they cost a point. The heavier traps cost 2 since they threaten several
// tiles at once (or, for icicles, permanently reshape the room).
const TRAP_COSTS = {
  spike: 1, timedspike: 1, hiddenspike: 1, vent: 1,
  thinice: 1, frost: 1, vines: 1,
  bomb: 2, turret: 2, imp: 2, icicle: 2, snapjaw: 2, boar: 2,
};

function trapCost(type) {
  return TRAP_COSTS[tileFamily(type)] || 0;
}

function isTrapType(type) {
  return trapCost(type) > 0;
}

function countTrapPoints(level) {
  return level.tiles.reduce((sum, type) => sum + trapCost(type), 0);
}

// Hard caps independent of the budget: portals only make sense as pairs,
// and every bomb, icicle and thin-ice tile carries its own state that
// multiplies the solver's search space (see solveBFS).
const MAX_PORTALS_PER_COLOR = 2;
const MAX_BOMBS = 4;
const MAX_ICICLES = 4;
const MAX_THIN_ICE = 16;
const TYPE_CAPS = { bomb: MAX_BOMBS, icicle: MAX_ICICLES, thinice: MAX_THIN_ICE };

// --- Level helpers (pure — no DOM access, reusable outside the browser) --

function createEmptyLevel(size) {
  return {
    size,
    start: null,
    goal: null,
    tiles: new Array(size * size).fill('empty'),
  };
}

// Whether tile (x, y) may be set to newType right now. Trap types are
// limited by trap points (defaults to TRAP_BUDGET, but a caller building
// against a different budget — e.g. a Daily Puzzle builder challenge's own
// constraints — can pass one explicitly). Only the *net* cost change counts,
// so swapping a trap for an equal-or-cheaper one is always allowed.
function canPlaceTileType(level, x, y, newType, trapBudget = TRAP_BUDGET) {
  const current = level.tiles[y * level.size + x];
  if (current === newType) return true;

  const countOf = (type) => level.tiles.filter((t) => t === type).length;
  if (tileFamily(newType) === 'portal' && countOf(newType) >= MAX_PORTALS_PER_COLOR) return false;
  if (TYPE_CAPS[newType] && countOf(newType) >= TYPE_CAPS[newType]) return false;

  const delta = trapCost(newType) - trapCost(current);
  if (delta <= 0) return true;
  return countTrapPoints(level) + delta <= trapBudget;
}

// --- Hazard timing ----------------------------------------------------------
//
// Every timed hazard runs off one shared "tick" counter (a move-counted turn
// in solveBFS, a HAZARD_TICK_MS slice of real time in solver mode — see
// startSolverMode). Each trap family deliberately uses a *different* cycle
// length so they drift in and out of sync with each other instead of all
// pulsing together — a gap that lines up once won't line up the same way
// next time around.

const mod = (a, n) => ((a % n) + n) % n;

// Timed spike: deadly 2 ticks, safe 2 ticks (4-tick cycle). Turn 0 is
// always active. Unchanged from before the new traps, so old shared rooms
// behave exactly as they did.
const TIMED_SPIKE_PHASE_LENGTH = 2;
function isTimedSpikeActiveAtTurn(turn) {
  return Math.floor(turn / TIMED_SPIKE_PHASE_LENGTH) % 2 === 0;
}

// Flame vent: 5-tick cycle — dormant 2, warning glow 1, erupting 2. Fire
// covers the vent itself plus VENT_RANGE tiles in the direction it faces.
const VENT_PERIOD = 5;
const VENT_ON_TICKS = 2;
const VENT_RANGE = 2;
function isVentActiveAtTurn(turn) {
  return mod(turn, VENT_PERIOD) >= VENT_PERIOD - VENT_ON_TICKS;
}
function isVentWarningAtTurn(turn) {
  return mod(turn, VENT_PERIOD) === VENT_PERIOD - VENT_ON_TICKS - 1;
}

// Lava turret: fires every 3 ticks; each fireball moves 1 tile per tick
// down the turret's line of fire until something solid stops it. A tile d
// steps from the turret holds a fireball on every tick where
// (tick - d) is a multiple of TURRET_PERIOD.
const TURRET_PERIOD = 3;
function isTurretChargedAtTurn(turn) {
  return mod(turn, TURRET_PERIOD) === 0;
}

// Bomb: stepping on it lights a BOMB_FUSE_TICKS fuse; it then explodes for
// one tick in a plus shape (itself + 4 neighbors) and is gone. A blast that
// reaches another bomb sets it off on the next tick (chain reaction).
const BOMB_FUSE_TICKS = 3;
// Per-bomb state values. 1..BOMB_FUSE_TICKS in between = lit, ticks left.
const BOMB_ARMED = 0;
const BOMB_EXPLODING = BOMB_FUSE_TICKS + 1;
const BOMB_GONE = BOMB_FUSE_TICKS + 2;

// Fire imps move 1 tile every tick, pacing back and forth along their row
// ('imp-h') or column ('imp-v') between whatever blocks them. Wild boars
// ('boar-h'/'boar-v') patrol the same way at 2 tiles per tick, and both
// tiles a boar crosses in a tick are deadly.
const BOAR_SPEED = 2;

// Thin ice: intact until the player steps *off* it, then broken (open
// water, deadly) for the rest of the life. Resets on death like bombs.
const THIN_ICE_INTACT = 0;
const THIN_ICE_BROKEN = 1;

// Falling icicle: walking under it (the tile itself) shakes it loose; it
// crashes ICICLE_DROP_TICKS later (deadly on its tile for that one tick),
// then lies there as a solid block of ice until the room resets. Mirrors
// the bomb's fuse states: 1..ICICLE_DROP_TICKS in between = shaking.
const ICICLE_DROP_TICKS = 3;
const ICICLE_HANGING = 0;
const ICICLE_CRASHING = ICICLE_DROP_TICKS + 1;
const ICICLE_FALLEN = ICICLE_DROP_TICKS + 2;

// Grabbing vines hold the player in place for this many ticks after they
// step onto them (and stop any slide/push there).
const VINE_HOLD_TICKS = 2;

// Frostbite patch: safe to arrive on, but deadly to still be standing on
// FROSTBITE_TICKS ticks after arriving — i.e. you can never wait on it.
const FROSTBITE_TICKS = 2;

// Mushroom pad: bounces you this many tiles on in the direction you were
// moving, hopping over the tile(s) in between.
const MUSHROOM_HOP = 2;

// Snapjaw: 6-tick cycle — idle 4, rustling warning 1, biting 1. The bite
// covers the 4 tiles next to it.
const SNAPJAW_PERIOD = 6;
function isSnapjawBitingAtTurn(turn) {
  return mod(turn, SNAPJAW_PERIOD) === SNAPJAW_PERIOD - 1;
}
function isSnapjawWarningAtTurn(turn) {
  return mod(turn, SNAPJAW_PERIOD) === SNAPJAW_PERIOD - 2;
}

// One-way walls ('oneway-up'/'down'/'left'/'right') can only be entered
// while moving in the direction they point; from any other direction they
// block like a plain wall. Non-oneway tile types are direction-agnostic.
const ONEWAY_DELTAS = {
  'oneway-up': [0, -1],
  'oneway-down': [0, 1],
  'oneway-left': [-1, 0],
  'oneway-right': [1, 0],
};
function isOnewayPassable(tileType, dx, dy) {
  const delta = ONEWAY_DELTAS[tileType];
  if (!delta) return true;
  return delta[0] === dx && delta[1] === dy;
}

// Solid to the player: walls, turret housings and snapjaws. (A fallen
// icicle is solid too, but that depends on the room's live state — see
// isSolidAt.)
function isSolidTile(type) {
  return type === 'wall' || type === 'snapjaw' || tileFamily(type) === 'turret';
}

// Stops fire, fireballs, imps, and bomb blasts. Start and goal count as
// safe zones — no moving hazard ever enters them, so the player can never
// be killed while respawning.
function blocksHazards(type) {
  return isSolidTile(type) || tileFamily(type) === 'oneway' || type === 'start' || type === 'goal';
}

// Sets tile (x, y) to newType, keeping level.start/level.goal consistent:
// moving start or goal onto a new tile clears their previous tile back to
// 'empty', and overwriting a tile that used to be start/goal clears the
// stale coordinates rather than leaving two things pointing at one cell.
function setTileType(level, x, y, newType) {
  const idx = y * level.size + x;
  const oldType = level.tiles[idx];

  if (oldType === 'start') level.start = null;
  if (oldType === 'goal') level.goal = null;

  if (newType === 'start') {
    if (level.start) {
      const [ox, oy] = level.start;
      level.tiles[oy * level.size + ox] = 'empty';
    }
    level.start = [x, y];
  }

  if (newType === 'goal') {
    if (level.goal) {
      const [ox, oy] = level.goal;
      level.tiles[oy * level.size + ox] = 'empty';
    }
    level.goal = [x, y];
  }

  level.tiles[idx] = newType;
}

// --- Hazard context: per-level precomputation ------------------------------
//
// Everything about a level's moving hazards that doesn't depend on time —
// which tiles each vent's fire covers, how far each tile sits down a turret's
// line of fire, each imp's and boar's patrol route, each snapjaw's bite,
// each bomb's blast area, portal pairings — worked out once. hazardAt/
// resolveMove then answer "what's here at tick t" cheaply. Built fresh by
// solveBFS (builder levels mutate in place) and once per run by solver mode
// (where the level never changes).
//
// The parts of a room that *do* change as you play — bombs, thin ice,
// falling icicles — are "objects": each gets a slot in one flat array of
// small integers (bombs first, then thin ice, then icicles), passed around
// as `states`. Being a plain array of single digits is what lets solveBFS
// fold it into its visited-state key.

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a, b) {
  return (a / gcd(a, b)) * b;
}

function buildHazardContext(level) {
  const { size, tiles } = level;
  const inBounds = (x, y) => x >= 0 && x < size && y >= 0 && y < size;
  const hazardPassable = (x, y) => inBounds(x, y) && !blocksHazards(tiles[y * size + x]);
  // Patrol routes are fixed up front, so imps and boars never walk under a
  // hanging icicle (they couldn't react to it falling).
  const patrolPassable = (x, y) => hazardPassable(x, y) && tiles[y * size + x] !== 'icicle';

  // Pass 1: object slots, so line-of-fire precomputation below can refer to
  // the icicles along the way.
  const bombs = [];
  const thinIce = [];
  const icicles = [];
  tiles.forEach((type, i) => {
    if (type === 'bomb') bombs.push({ idx: i });
    else if (type === 'thinice') thinIce.push({ idx: i });
    else if (type === 'icicle') icicles.push({ idx: i });
  });
  const slotAt = new Map();
  const bombIndexAt = new Map();
  [...bombs, ...thinIce, ...icicles].forEach((obj, slot) => {
    obj.slot = slot;
    slotAt.set(obj.idx, slot);
  });
  bombs.forEach((bomb) => bombIndexAt.set(bomb.idx, bomb.slot));

  // A fallen icicle stops fire and fireballs, so every cell on a line of
  // fire remembers which icicle slots sit between it and its source.
  const walkLine = (x, y, dx, dy, maxSteps, visit) => {
    const blockers = [];
    for (let d = 1; d <= maxSteps; d++) {
      const fx = x + dx * d;
      const fy = y + dy * d;
      if (!hazardPassable(fx, fy)) break;
      const idx = fy * size + fx;
      if (tiles[idx] === 'icicle') blockers.push(slotAt.get(idx));
      visit(idx, d, blockers.slice());
    }
  };

  const patrolRoute = (x, y, dx, dy) => {
    let lo = 0;
    while (patrolPassable(x + dx * (lo - 1), y + dy * (lo - 1))) lo--;
    let hi = 0;
    while (patrolPassable(x + dx * (hi + 1), y + dy * (hi + 1))) hi++;
    const path = [];
    for (let k = lo; k <= hi; k++) path.push((y + dy * k) * size + (x + dx * k));
    // period is in patrol *steps* (one tile each).
    return { path, originIndex: -lo, period: path.length > 1 ? 2 * (path.length - 1) : 1 };
  };

  const flameCells = new Map(); // tile idx -> [blocker slot lists, one per vent reaching it]
  const fireballDistances = new Map(); // tile idx -> [{ d, blockers }, one per turret reaching it]
  const imps = [];
  const boars = [];
  const biteCells = new Set();
  const portalsByType = {};
  const periods = [];
  let hasTimedSpike = false;
  let hasSnapjaw = false;

  tiles.forEach((type, i) => {
    const x = i % size;
    const y = Math.floor(i / size);
    const family = tileFamily(type);

    if (type === 'timedspike') hasTimedSpike = true;

    if (family === 'vent') {
      const [dx, dy] = tileDirection(type);
      const addFlame = (idx, blockers) => {
        if (!flameCells.has(idx)) flameCells.set(idx, []);
        flameCells.get(idx).push(blockers);
      };
      addFlame(i, []);
      walkLine(x, y, dx, dy, VENT_RANGE, (idx, d, blockers) => addFlame(idx, blockers));
    }

    if (family === 'turret') {
      const [dx, dy] = tileDirection(type);
      walkLine(x, y, dx, dy, Infinity, (idx, d, blockers) => {
        if (!fireballDistances.has(idx)) fireballDistances.set(idx, []);
        fireballDistances.get(idx).push({ d, blockers });
      });
    }

    if (family === 'imp' || family === 'boar') {
      const [dx, dy] = type.endsWith('-h') ? [1, 0] : [0, 1];
      const route = patrolRoute(x, y, dx, dy);
      if (family === 'imp') {
        imps.push(route);
        periods.push(route.period);
      } else {
        boars.push(route);
        periods.push(route.period / gcd(route.period, BOAR_SPEED));
      }
    }

    if (type === 'snapjaw') {
      hasSnapjaw = true;
      for (const [dx, dy] of Object.values(DIRECTION_DELTAS)) {
        if (hazardPassable(x + dx, y + dy)) biteCells.add((y + dy) * size + (x + dx));
      }
    }

    if (type === 'bomb') {
      const bomb = bombs.find((b) => b.idx === i);
      bomb.blast = [i];
      for (const [dx, dy] of Object.values(DIRECTION_DELTAS)) {
        if (hazardPassable(x + dx, y + dy)) bomb.blast.push((y + dy) * size + (x + dx));
      }
    }

    if (family === 'portal') (portalsByType[type] = portalsByType[type] || []).push(i);
  });

  const portalPartner = new Map();
  Object.values(portalsByType).forEach((cells) => {
    if (cells.length !== 2) return; // an unpaired portal is just floor
    portalPartner.set(cells[0], cells[1]);
    portalPartner.set(cells[1], cells[0]);
  });

  if (hasTimedSpike) periods.push(TIMED_SPIKE_PHASE_LENGTH * 2);
  if (flameCells.size) periods.push(VENT_PERIOD);
  if (fireballDistances.size) periods.push(TURRET_PERIOD);
  if (hasSnapjaw) periods.push(SNAPJAW_PERIOD);

  return {
    size, tiles, flameCells, fireballDistances, imps, boars, biteCells,
    bombs, thinIce, icicles, slotAt, bombIndexAt, portalPartner,
    objectCount: bombs.length + thinIce.length + icicles.length,
    hasVines: tiles.includes('vines'),
    // Every timed hazard repeats after this many ticks, so solveBFS can fold
    // tick numbers modulo it without losing information.
    cycleLength: periods.reduce(lcm, 1),
  };
}

// Where a patroller (imp or boar) stands after `step` patrol steps: ping-
// pongs along its path, starting from where it was placed and heading
// right/down first.
function patrolPositionAt(patrol, step) {
  if (patrol.period === 1) return patrol.path[0];
  const s = mod(patrol.originIndex + step, patrol.period);
  return patrol.path[s < patrol.path.length ? s : patrol.period - s];
}

// Imps take one step per tick.
function impPositionAt(imp, tick) {
  return patrolPositionAt(imp, tick);
}

// Boars take BOAR_SPEED steps per tick; every tile covered during the tick
// is dangerous. The first entry is where the boar ends the tick.
function boarCellsAt(boar, tick) {
  const cells = [];
  for (let k = 0; k < BOAR_SPEED; k++) cells.push(patrolPositionAt(boar, BOAR_SPEED * tick - k));
  return cells;
}

// Whether any icicle in `blockers` has fallen (and so stops the fire/shot).
function lineBlocked(blockers, states) {
  return !!states && blockers.some((slot) => states[slot] === ICICLE_FALLEN);
}

function isFlameAt(ctx, idx, tick, states) {
  const sources = ctx.flameCells.get(idx);
  return !!sources && isVentActiveAtTurn(tick) && sources.some((blockers) => !lineBlocked(blockers, states));
}

function isFireballAt(ctx, idx, tick, states) {
  const shots = ctx.fireballDistances.get(idx);
  return !!shots && shots.some(({ d, blockers }) => mod(tick - d, TURRET_PERIOD) === 0 && !lineBlocked(blockers, states));
}

// Every object starts in state 0: bombs armed, thin ice intact, icicles
// hanging.
function initialObjectStates(ctx) {
  return new Array(ctx.objectCount).fill(0);
}

function objectState(ctx, idx, states) {
  return states ? states[ctx.slotAt.get(idx)] : undefined;
}

// Tiles covered by bombs exploding right now.
function blastCellsFor(ctx, states) {
  const cells = new Set();
  ctx.bombs.forEach((bomb) => {
    if (states[bomb.slot] === BOMB_EXPLODING) bomb.blast.forEach((i) => cells.add(i));
  });
  return cells;
}

// Advances every object by one tick (returns a new array): burning fuses
// tick down and explode at zero, last tick's explosions burn out, any bomb
// caught in a new blast is set to go off next tick, and shaking icicles
// count down, crash, and settle. Thin ice only changes when the player
// moves (see applyMoveToObjects).
function advanceObjects(ctx, states) {
  const next = states.slice();
  ctx.bombs.forEach(({ slot }) => {
    const s = states[slot];
    if (s === BOMB_EXPLODING) next[slot] = BOMB_GONE;
    else if (s >= 1 && s <= BOMB_FUSE_TICKS) next[slot] = s === 1 ? BOMB_EXPLODING : s - 1;
  });
  const blast = blastCellsFor(ctx, next);
  if (blast.size) {
    ctx.bombs.forEach((bomb) => {
      const s = next[bomb.slot];
      const waiting = s === BOMB_ARMED || (s > 1 && s <= BOMB_FUSE_TICKS);
      if (waiting && blast.has(bomb.idx)) next[bomb.slot] = 1;
    });
  }
  ctx.icicles.forEach(({ slot }) => {
    const s = states[slot];
    if (s === ICICLE_CRASHING) next[slot] = ICICLE_FALLEN;
    else if (s >= 1 && s <= ICICLE_DROP_TICKS) next[slot] = s === 1 ? ICICLE_CRASHING : s - 1;
  });
  return next;
}

// What a move (see resolveMove) does to the room's objects: bombs it
// stepped on start their fuses, icicles it passed under start shaking, and
// thin ice it left behind breaks. Returns a new array.
function applyMoveToObjects(states, move) {
  if (!move.litBombs.length && !move.litIcicles.length && !move.brokenIce.length) return states;
  const next = states.slice();
  move.litBombs.forEach((slot) => { next[slot] = BOMB_FUSE_TICKS; });
  move.litIcicles.forEach((slot) => { next[slot] = ICICLE_DROP_TICKS; });
  move.brokenIce.forEach((slot) => { next[slot] = THIN_ICE_BROKEN; });
  return next;
}

// What (if anything) kills a player on tile idx during the given tick, as a
// human-readable label, or null if the tile is safe then. The one place
// that defines "deadly" — shared by solveBFS and real gameplay so the two
// can never disagree about what hurts. (Frostbite is the one exception: it
// depends on how long *you* have been standing there, not just the tile and
// tick — see solveBFS and solver mode's advanceWorldTo.)
function hazardAt(ctx, idx, tick, states) {
  const type = ctx.tiles[idx];
  if (type === 'start' || type === 'goal') return null;
  if (type === 'spike') return 'spike';
  if (type === 'hiddenspike') return 'hidden spike';
  if (type === 'timedspike' && isTimedSpikeActiveAtTurn(tick)) return 'timed spike';
  if (type === 'thinice' && objectState(ctx, idx, states) === THIN_ICE_BROKEN) return 'thin ice';
  if (type === 'icicle' && objectState(ctx, idx, states) === ICICLE_CRASHING) return 'falling icicle';
  if (isFlameAt(ctx, idx, tick, states)) return 'flame vent';
  if (isFireballAt(ctx, idx, tick, states)) return 'fireball';
  if (ctx.imps.some((imp) => impPositionAt(imp, tick) === idx)) return 'fire imp';
  if (ctx.boars.some((boar) => boarCellsAt(boar, tick).includes(idx))) return 'wild boar';
  if (isSnapjawBitingAtTurn(tick) && ctx.biteCells.has(idx)) return 'snapjaw';
  if (states && ctx.bombs.some((bomb) => states[bomb.slot] === BOMB_EXPLODING && bomb.blast.includes(idx))) {
    return 'bomb blast';
  }
  return null;
}

// Solid right now: walls, turrets and snapjaws always; an icicle once it
// has fallen.
function isSolidAt(ctx, idx, states) {
  const type = ctx.tiles[idx];
  return isSolidTile(type) || (type === 'icicle' && objectState(ctx, idx, states) === ICICLE_FALLEN);
}

// Whether a single step in direction (dx, dy) may land on (x, y) at all,
// ignoring danger: bounds, solid tiles, and one-way direction.
function canStepOnto(ctx, x, y, dx, dy, states) {
  if (x < 0 || x >= ctx.size || y < 0 || y >= ctx.size) return false;
  const idx = y * ctx.size + x;
  return !isSolidAt(ctx, idx, states) && isOnewayPassable(ctx.tiles[idx], dx, dy);
}

// Which way a player on the ice tile (x, y), sliding in direction
// (dx, dy), keeps going: straight ahead if that's open, otherwise they
// glance off whatever's in the way onto the next tile to the side — down
// then up when sliding horizontally, right then left when sliding
// vertically. null if all three are blocked (the slide stops here).
function iceSlideDirection(ctx, x, y, dx, dy, states) {
  const sideways = dy === 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
  const options = [[dx, dy], ...sideways];
  return options.find(([ox, oy]) => canStepOnto(ctx, x + ox, y + oy, ox, oy, states)) || null;
}

// Plays out one player move starting at (x, y) during the given tick,
// including everything the tile underfoot does next — ice keeps you sliding
// the same way, glancing sideways off anything in the way (see
// iceSlideDirection) until you leave the ice, a current shoves you one tile
// its way, a mushroom bounces you two tiles on, a portal drops you on its
// partner, vines grab you and stop you dead. Every tile passed through is
// checked for danger at this same tick.
//
// Returns null if the very first step is blocked (a no-op, not a move).
// Otherwise { path, final, death, won, grabbed, litBombs, litIcicles,
// brokenIce, hops, teleported }: path is every tile index entered in order,
// final is where the player ends up, death is { label, idx } if something
// killed them on the way, grabbed is true if vines caught them. litBombs/
// litIcicles/brokenIce list the object slots this move affects (see
// applyMoveToObjects), and hops lists the positions in path reached by a
// mushroom bounce rather than a step (for animation).
function resolveMove(ctx, x, y, dx, dy, tick, states) {
  if (!canStepOnto(ctx, x + dx, y + dy, dx, dy, states)) return null;

  const { size, tiles } = ctx;
  const path = [];
  const litBombs = [];
  const litIcicles = [];
  const brokenIce = [];
  const hops = [];
  const seen = new Set();
  let teleported = false;
  // Leaving a thin-ice tile breaks it — including the one you start on and
  // every one you slide or get pushed across.
  const leave = (i) => {
    if (tiles[i] !== 'thinice') return;
    const slot = ctx.slotAt.get(i);
    if (!brokenIce.includes(slot)) brokenIce.push(slot);
  };
  leave(y * size + x);

  let [cx, cy, mdx, mdy] = [x + dx, y + dy, dx, dy];
  const result = (idx, extra) => ({
    path, final: idx, death: null, won: false, grabbed: false,
    litBombs, litIcicles, brokenIce, hops, teleported, ...extra,
  });

  for (;;) {
    const i = cy * size + cx;
    path.push(i);
    const type = tiles[i];
    const brokeThisMove = type === 'thinice' && brokenIce.includes(ctx.slotAt.get(i));
    const label = hazardAt(ctx, i, tick, states) || (brokeThisMove ? 'thin ice' : null);
    if (label) return result(i, { death: { label, idx: i } });

    if (type === 'goal') return result(i, { won: true });

    if (type === 'bomb') {
      const slot = ctx.slotAt.get(i);
      if (states[slot] === BOMB_ARMED && !litBombs.includes(slot)) litBombs.push(slot);
    }
    if (type === 'icicle') {
      const slot = ctx.slotAt.get(i);
      if (states[slot] === ICICLE_HANGING && !litIcicles.includes(slot)) litIcicles.push(slot);
    }
    if (type === 'vines') return result(i, { grabbed: true });

    // Loop guard: currents pointing into each other (or ice feeding a
    // current that feeds the same ice) would otherwise push forever.
    const key = `${i},${mdx},${mdy}`;
    if (seen.has(key)) return result(i);
    seen.add(key);

    if (tileFamily(type) === 'portal' && !teleported && ctx.portalPartner.has(i)) {
      teleported = true;
      const partner = ctx.portalPartner.get(i);
      path.push(partner);
      const partnerLabel = hazardAt(ctx, partner, tick, states);
      if (partnerLabel) return result(partner, { death: { label: partnerLabel, idx: partner } });
      return result(partner);
    }

    if (type === 'mushroom') {
      // Bounce over the next tile (anything but a solid one) onto the one
      // after it, if you could step onto that one moving this way.
      const [mx, my] = [cx + mdx, cy + mdy];
      const [lx, ly] = [cx + mdx * MUSHROOM_HOP, cy + mdy * MUSHROOM_HOP];
      const midOpen = mx >= 0 && mx < size && my >= 0 && my < size && !isSolidAt(ctx, my * size + mx, states);
      if (!midOpen || !canStepOnto(ctx, lx, ly, mdx, mdy, states)) return result(i);
      hops.push(path.length);
      cx = lx;
      cy = ly;
      continue;
    }

    let push = null;
    if (type === 'ice') push = iceSlideDirection(ctx, cx, cy, mdx, mdy, states);
    else if (tileFamily(type) === 'current') push = tileDirection(type);
    if (!push || !canStepOnto(ctx, cx + push[0], cy + push[1], push[0], push[1], states)) return result(i);

    leave(i);
    [mdx, mdy] = push;
    cx += mdx;
    cy += mdy;
  }
}

// How a multi-tile move (ice slide, current push, mushroom bounce, portal
// warp) plays out over time, for animating it: `stops` lists every tile the
// player passes through (starting with fromIdx) and when they arrive there,
// in ms. A stop reached by portal is marked `warp` (it gets a vanish/
// reappear instead of a glide, and takes twice as long); one reached by a
// mushroom bounce (`hops` holds its position in path) is marked `hop` (an
// arc over the tile in between). `durationMs` is the whole move. Pure, so
// solver mode (input lock, deferred death/win) and renderLevel (the
// animation itself) agree on the timing.
const SLIDE_MS_PER_TILE = 85;

function slideTimeline(size, fromIdx, path, hops = []) {
  const stops = [{ idx: fromIdx, t: 0, warp: false, hop: false }];
  let t = 0;
  let prev = fromIdx;
  path.forEach((idx, k) => {
    const hop = hops.includes(k);
    const dist = Math.abs((idx % size) - (prev % size)) + Math.abs(Math.floor(idx / size) - Math.floor(prev / size));
    const warp = !hop && dist !== 1;
    t += warp || hop ? SLIDE_MS_PER_TILE * 2 : SLIDE_MS_PER_TILE;
    stops.push({ idx, t, warp, hop });
    prev = idx;
  });
  return { stops, durationMs: t };
}

// BFS reachability check from start to goal, returning both whether the
// level is solvable and — since BFS explores in turn order — the length of
// the *shortest* solution in turns. Standalone and DOM-free so it can be
// reused by Creative Mode's Validate button, the sharing gate, the campaign
// level checks, and (via its turn count) the Daily Puzzle builder
// challenge's bot-scoring. `isSolvable` below is a thin boolean-only
// wrapper.
//
// Each turn the bot either makes one move (resolved by resolveMove — the
// same function real gameplay uses) or waits in place, and must survive the
// tile it ends on into the next tick too (a hazard can arrive under a
// player who stands still, exactly like solver mode's hazardTick). Two
// player-specific rules sit on top: while vines hold the bot it can only
// wait, and it can never wait on a frostbite patch. State is (tile, tick mod
// cycleLength, every object's state, vine hold left): cycleLength folds all
// the periodic hazards into one repeating window, and object states capture
// the part that doesn't repeat. If a level's hazard cycles are so
// mismatched that their combined cycle exceeds BFS_MAX_CYCLE ticks, ticks
// are tracked exactly up to that horizon instead (conservative: a solution
// needing longer is reported unsolvable).
const BFS_MAX_CYCLE = 720;
const BFS_ACTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];

function solveBFS(level) {
  const { size, tiles, start, goal } = level;
  if (!start || !goal) return { solvable: false, moves: null };

  const [sx, sy] = start;
  const [gx, gy] = goal;
  const inBounds = (x, y) => x >= 0 && x < size && y >= 0 && y < size;
  const isStaticallyWalkable = (x, y) => {
    if (!inBounds(x, y)) return false;
    const t = tiles[y * size + x];
    return !isSolidTile(t) && t !== 'spike' && t !== 'hiddenspike';
  };
  if (!isStaticallyWalkable(sx, sy) || !isStaticallyWalkable(gx, gy)) {
    return { solvable: false, moves: null };
  }

  const ctx = buildHazardContext(level);
  const cycle = ctx.cycleLength <= BFS_MAX_CYCLE ? ctx.cycleLength : null;
  const timeSlots = cycle || BFS_MAX_CYCLE + 1;
  const hasObjects = ctx.objectCount > 0;
  const keyOf = (idx, turn, states, held) => {
    let key = String(idx * timeSlots + (cycle ? turn % cycle : turn));
    if (hasObjects) key += `:${states.join('')}`;
    if (held) key += `h${held}`;
    return key;
  };

  const startIdx = sy * size + sx;
  const startStates = initialObjectStates(ctx);
  const visited = new Set([keyOf(startIdx, 0, startStates, 0)]);
  // Entries are [tile idx, turn, object states, vine hold left]; turn
  // doubles as the number of turns taken so far, since it starts at 0 and
  // rises by 1 per edge.
  const queue = [[startIdx, 0, startStates, 0]];

  for (let head = 0; head < queue.length; head++) {
    const [idx, turn, states, held] = queue[head];
    if (!cycle && turn >= BFS_MAX_CYCLE) continue;
    const x = idx % size;
    const y = Math.floor(idx / size);

    for (const [dx, dy] of BFS_ACTIONS) {
      const waiting = dx === 0 && dy === 0;
      if (held > 0 && !waiting) continue;
      if (waiting && held === 0 && tiles[idx] === 'frost') continue; // frostbite

      let final = idx;
      let nextStates = states;
      let nextHeld = Math.max(0, held - 1);
      if (!waiting) {
        const move = resolveMove(ctx, x, y, dx, dy, turn, states);
        if (!move || move.death) continue;
        if (move.won) return { solvable: true, moves: turn + 1 };
        final = move.final;
        nextHeld = move.grabbed ? VINE_HOLD_TICKS : 0;
        if (hasObjects) nextStates = applyMoveToObjects(states, move);
      }

      if (hasObjects) nextStates = advanceObjects(ctx, nextStates);
      if (hazardAt(ctx, final, turn + 1, nextStates)) continue;

      const key = keyOf(final, turn + 1, nextStates, nextHeld);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([final, turn + 1, nextStates, nextHeld]);
      }
    }
  }

  return { solvable: false, moves: null };
}

function isSolvable(level) {
  return solveBFS(level).solvable;
}

// --- Sharing: level <-> URL-safe string ----------------------------------

// Serializes a level to a compact, URL-safe string: JSON -> UTF-8 bytes ->
// base64 -> base64url (+/ swapped for -_, padding stripped) so it can be
// dropped straight into a query param with no further escaping needed.
function encodeLevel(level) {
  const json = JSON.stringify(level);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Reverses encodeLevel(). Throws on malformed input (bad base64url or JSON)
// — callers decoding untrusted input (e.g. a ?level= query param) should
// wrap this in a try/catch rather than trusting it to return cleanly.
function decodeLevel(encoded) {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

// Minimal shape check for a level decoded from an untrusted URL param —
// just enough to keep solver mode from crashing on garbage input, not full
// validation (that's isSolvable's job).
function isValidLevel(level) {
  return (
    !!level &&
    typeof level.size === 'number' &&
    Array.isArray(level.tiles) &&
    level.tiles.length === level.size * level.size &&
    Array.isArray(level.start) && level.start.length === 2 &&
    Array.isArray(level.goal) && level.goal.length === 2
  );
}

// --- Daily Puzzle ---------------------------------------------------------
//
// Two challenge types, each with three difficulty tiers (easy/medium/hard):
//   - solver:  navigate a fixed, procedurally-generated trap layout.
//   - builder: build a trap layout against the day's size/trap-budget
//              constraints; scored by running solveBFS's shortest-path bot
//              against it and comparing the move count to a per-day target.
// Everything here is derived deterministically from the calendar date (plus
// type/difficulty) via a seeded PRNG, so every player gets the identical
// puzzle on a given day with no backend or database involved — the "seed"
// *is* the shared state. Progress/streaks are tracked purely client-side in
// localStorage (see the stats section below).

const DIFFICULTIES = ['easy', 'medium', 'hard'];

// --- Deterministic seeded PRNG --------------------------------------------

// FNV-1a string hash -> 32-bit unsigned int. Used to turn a human-readable
// seed string (date + type + difficulty) into a numeric seed for mulberry32.
function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A small, fast, deterministic PRNG (public domain algorithm). Given the
// same 32-bit seed it always produces the same sequence of floats in
// [0, 1) — this (not Math.random) is what makes a day's puzzles reproducible
// across every player's browser.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inclusive-inclusive random integer in [min, max] drawn from a seeded rng().
function seededInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function seededChoice(rng, arr) {
  return arr[seededInt(rng, 0, arr.length - 1)];
}

// Today's date as YYYY-MM-DD in the player's local timezone — the seed for
// everything else on this page. Deliberately local (not UTC): the puzzle
// should change at the player's own midnight, matching their intuition of
// "a new day", not an arbitrary UTC cutover.
function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayDateString(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// One seed per (date, type, difficulty) triple, so changing the difficulty
// or switching between solver/builder never affects any other challenge's
// seed — each of the 6 daily challenges is independently reproducible.
function dailySeedFor(dateStr, type, difficulty) {
  return hashStringToSeed(`trap-room-daily:${dateStr}:${type}:${difficulty}`);
}

// --- Solver challenge: fixed procedurally-generated layout ----------------

// Per-cell densities are rolled independently for every interior tile;
// `extras` are exact counts of the heavier traps, placed afterwards on
// random open floor (turrets instead replace a border wall and fire
// inward, so they never eat into the room itself).
const DAILY_SOLVER_PARAMS = {
  // Lava's numbers are unchanged from before themes existed, and every new
  // density/extra below defaults to 0, so a lava day generates exactly the
  // same room it always would have.
  lava: {
    easy: {
      size: 6, wallDensity: 0.10, trapDensity: 0.05, onewayDensity: 0, iceDensity: 0.05, currentDensity: 0,
      timedSpikeShare: 0, hiddenSpikeShare: 0,
      extras: { bomb: 1, turret: 1, vent: 0, imp: 0, portalPairs: 0 },
    },
    medium: {
      size: 8, wallDensity: 0.14, trapDensity: 0.07, onewayDensity: 0.04, iceDensity: 0.05, currentDensity: 0.03,
      timedSpikeShare: 0.4, hiddenSpikeShare: 0.15,
      extras: { bomb: 1, turret: 1, vent: 1, imp: 1, portalPairs: 0 },
    },
    hard: {
      size: 10, wallDensity: 0.15, trapDensity: 0.08, onewayDensity: 0.05, iceDensity: 0.06, currentDensity: 0.04,
      timedSpikeShare: 0.5, hiddenSpikeShare: 0.2,
      extras: { bomb: 2, turret: 2, vent: 2, imp: 2, portalPairs: 1 },
    },
  },
  ice: {
    easy: {
      size: 6, wallDensity: 0.10, trapDensity: 0.05, onewayDensity: 0, iceDensity: 0.12, currentDensity: 0,
      thinIceDensity: 0.10, frostDensity: 0.05,
      timedSpikeShare: 0, hiddenSpikeShare: 0,
      extras: { turret: 1, icicle: 1 },
    },
    medium: {
      size: 8, wallDensity: 0.12, trapDensity: 0.06, onewayDensity: 0.03, iceDensity: 0.12, currentDensity: 0,
      thinIceDensity: 0.09, frostDensity: 0.05,
      timedSpikeShare: 0.4, hiddenSpikeShare: 0.15,
      extras: { turret: 1, icicle: 2 },
    },
    hard: {
      size: 10, wallDensity: 0.13, trapDensity: 0.07, onewayDensity: 0.04, iceDensity: 0.13, currentDensity: 0,
      thinIceDensity: 0.07, frostDensity: 0.06,
      timedSpikeShare: 0.5, hiddenSpikeShare: 0.2,
      extras: { turret: 2, icicle: 3, portalPairs: 1 },
    },
  },
  grass: {
    easy: {
      size: 6, wallDensity: 0.10, trapDensity: 0.06, onewayDensity: 0, iceDensity: 0, currentDensity: 0.04,
      vinesDensity: 0.05, mushroomDensity: 0.05,
      timedSpikeShare: 0.3, hiddenSpikeShare: 0,
      extras: { snapjaw: 1 },
    },
    medium: {
      size: 8, wallDensity: 0.12, trapDensity: 0.07, onewayDensity: 0.03, iceDensity: 0, currentDensity: 0.05,
      vinesDensity: 0.05, mushroomDensity: 0.05,
      timedSpikeShare: 0.4, hiddenSpikeShare: 0.15,
      extras: { snapjaw: 1, boar: 1 },
    },
    hard: {
      size: 10, wallDensity: 0.14, trapDensity: 0.08, onewayDensity: 0.04, iceDensity: 0, currentDensity: 0.05,
      vinesDensity: 0.06, mushroomDensity: 0.05,
      timedSpikeShare: 0.5, hiddenSpikeShare: 0.2,
      extras: { snapjaw: 2, boar: 2, portalPairs: 1 },
    },
  },
};

const ONEWAY_TYPES = ['oneway-up', 'oneway-right', 'oneway-down', 'oneway-left'];
const CURRENT_TYPES = ['current-up', 'current-right', 'current-down', 'current-left'];
const VENT_TYPES = ['vent-up', 'vent-right', 'vent-down', 'vent-left'];

// In-place Fisher-Yates shuffle driven by a seeded rng().
function seededShuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = seededInt(rng, 0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// A bordered room with start pinned near the top-left and goal near the
// bottom-right, every other interior cell rolled independently against the
// difficulty's densities, then the difficulty's `extras` dropped in. Not
// guaranteed solvable on its own — generateDailySolverLevel is what
// retries until it is.
function buildRandomSolverLevel(rng, params) {
  const {
    size, wallDensity, trapDensity, onewayDensity, iceDensity, currentDensity,
    thinIceDensity = 0, frostDensity = 0, vinesDensity = 0, mushroomDensity = 0,
    timedSpikeShare, hiddenSpikeShare,
  } = params;
  const extras = { bomb: 0, turret: 0, vent: 0, imp: 0, portalPairs: 0, icicle: 0, snapjaw: 0, boar: 0, ...params.extras };
  const level = buildFallbackSolverLevel(size);
  const [sx, sy] = level.start;

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (level.tiles[y * size + x] !== 'empty') continue;
      let roll = rng();
      if ((roll -= wallDensity) < 0) {
        setTileType(level, x, y, 'wall');
      } else if ((roll -= trapDensity) < 0) {
        const kind = rng();
        const type = kind < hiddenSpikeShare ? 'hiddenspike'
          : kind < hiddenSpikeShare + timedSpikeShare ? 'timedspike' : 'spike';
        setTileType(level, x, y, type);
      } else if ((roll -= onewayDensity) < 0) {
        setTileType(level, x, y, seededChoice(rng, ONEWAY_TYPES));
      } else if ((roll -= iceDensity) < 0) {
        setTileType(level, x, y, 'ice');
      } else if ((roll -= currentDensity) < 0) {
        setTileType(level, x, y, seededChoice(rng, CURRENT_TYPES));
      } else if ((roll -= thinIceDensity) < 0) {
        if (level.tiles.filter((t) => t === 'thinice').length < MAX_THIN_ICE) setTileType(level, x, y, 'thinice');
      } else if ((roll -= frostDensity) < 0) {
        setTileType(level, x, y, 'frost');
      } else if ((roll -= vinesDensity) < 0) {
        setTileType(level, x, y, 'vines');
      } else if ((roll -= mushroomDensity) < 0) {
        setTileType(level, x, y, 'mushroom');
      }
    }
  }

  // Open floor for the extras, keeping the start tile's neighbors clear so
  // nothing is sitting right on top of the player at the first step.
  const openCells = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const nearStart = Math.abs(x - sx) + Math.abs(y - sy) <= 1;
      if (!nearStart && level.tiles[y * size + x] === 'empty') openCells.push([x, y]);
    }
  }
  seededShuffle(rng, openCells);
  const place = (count, pickType) => {
    for (let n = 0; n < count && openCells.length; n++) {
      const [x, y] = openCells.pop();
      setTileType(level, x, y, pickType());
    }
  };
  place(extras.bomb, () => 'bomb');
  place(extras.vent, () => seededChoice(rng, VENT_TYPES));
  place(extras.imp, () => seededChoice(rng, ['imp-h', 'imp-v']));
  for (let p = 0; p < extras.portalPairs && openCells.length >= 2; p++) {
    place(2, () => (p === 0 ? 'portal-a' : 'portal-b'));
  }
  place(extras.icicle, () => 'icicle');
  place(extras.snapjaw, () => 'snapjaw');
  place(extras.boar, () => seededChoice(rng, ['boar-h', 'boar-v']));

  // Turrets: a random non-corner border wall, facing into the room.
  const borderSlots = [];
  for (let k = 1; k < size - 1; k++) {
    borderSlots.push([k, 0, 'turret-down'], [k, size - 1, 'turret-up'], [0, k, 'turret-right'], [size - 1, k, 'turret-left']);
  }
  seededShuffle(rng, borderSlots);
  for (let n = 0; n < extras.turret; n++) {
    const [x, y, type] = borderSlots[n];
    setTileType(level, x, y, type);
  }

  return level;
}

// An empty bordered room with start and goal placed — always solvable. The
// base buildRandomSolverLevel fills in, and a last-resort fallback if
// generateDailySolverLevel's retries (below) are somehow exhausted.
function buildFallbackSolverLevel(size) {
  const level = createEmptyLevel(size);
  for (let x = 0; x < size; x++) {
    setTileType(level, x, 0, 'wall');
    setTileType(level, x, size - 1, 'wall');
  }
  for (let y = 0; y < size; y++) {
    setTileType(level, 0, y, 'wall');
    setTileType(level, size - 1, y, 'wall');
  }
  setTileType(level, 1, 1, 'start');
  setTileType(level, size - 2, size - 2, 'goal');
  return level;
}

// Which theme a date's Daily Puzzle uses: lava, ice, grass, lava, ... by
// calendar day, so every player gets the same theme on the same date. The
// day number comes from the date string itself (as a UTC calendar date),
// so time zones can't shift it.
function dailyThemeFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNumber = Math.round(Date.UTC(y, m - 1, d) / 86400000);
  return THEMES[mod(dayNumber, THEMES.length)];
}

// Generates the fixed layout for a given date's solver challenge at a given
// difficulty, in that date's theme. Retries with an incrementing (but still
// fully deterministic — same date always retries the same way) nonce mixed
// into the seed until isSolvable() confirms a path exists, since a randomly
// hazard-strewn grid has no solvability guarantee up front. In practice
// this converges within a handful of attempts at these densities.
function generateDailySolverLevel(dateStr, difficulty) {
  const theme = dailyThemeFor(dateStr);
  const params = DAILY_SOLVER_PARAMS[theme][difficulty];
  const baseSeed = dailySeedFor(dateStr, 'solver', difficulty);
  const maxAttempts = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = mulberry32(baseSeed ^ Math.imul(attempt + 1, 2654435761));
    const level = buildRandomSolverLevel(rng, params);
    if (isSolvable(level)) return { ...level, theme };
  }
  return { ...buildFallbackSolverLevel(params.size), theme };
}

// --- Builder challenge: daily constraints + bot scoring --------------------

// Trap budgets are in trap points (see TRAP_COSTS) — roomier than the old
// one-point-per-spike budgets so there's space for the 2-point traps.
const DAILY_BUILDER_PARAMS = {
  easy: { sizeChoices: [6, 7], trapBudgetRange: [4, 6], minBotMovesRange: [6, 10] },
  medium: { sizeChoices: [7, 8], trapBudgetRange: [7, 9], minBotMovesRange: [12, 18] },
  hard: { sizeChoices: [8, 9, 10], trapBudgetRange: [10, 13], minBotMovesRange: [20, 30] },
};

// The day's constraints for a builder challenge: the grid size and trap
// budget the player must build within, and the minimum number of moves the
// bot (solveBFS's shortest-path search) must need to solve the finished
// room for it to count as complete — higher difficulty means a higher bar,
// i.e. the player has to build something more convoluted, not just bigger.
function generateDailyBuilderConstraints(dateStr, difficulty) {
  const params = DAILY_BUILDER_PARAMS[difficulty];
  const rng = mulberry32(dailySeedFor(dateStr, 'builder', difficulty));
  return {
    theme: dailyThemeFor(dateStr),
    size: seededChoice(rng, params.sizeChoices),
    trapBudget: seededInt(rng, params.trapBudgetRange[0], params.trapBudgetRange[1]),
    minBotMoves: seededInt(rng, params.minBotMovesRange[0], params.minBotMovesRange[1]),
  };
}

// --- Save-change hooks (cloud saves) -------------------------------------------
//
// account.js syncs saved progress to the player's account. Every function
// that writes saved progress (campaign progress, daily stats, best scores)
// calls notifySaveChanged() afterwards so it can upload, and the bootstrap
// sets refreshProgressViews so a download can repaint whatever screen is up.

const saveChangeListeners = [];

function notifySaveChanged(change = {}) {
  saveChangeListeners.forEach((listener) => listener(change));
}

let refreshProgressViews = () => {};

// --- Streak/stats persistence (localStorage) -------------------------------
//
// A day's streak is earned by completing 2 of the day's 3 difficulty
// "modes" (easy/medium/hard — completed via *either* solver or builder, or
// both) or by completing hard mode alone (see isDailyStreakEarned). This is
// tracked separately from lifetime stats (best streak, total days, and a
// per-difficulty completion count) so a broken streak doesn't erase history.

const DAILY_STATS_KEY = 'trapRoomDailyStats';

function defaultDailyStats() {
  return {
    currentStreak: 0,
    bestStreak: 0,
    totalDaysCompleted: 0,
    perDifficultyCompletions: { easy: 0, medium: 0, hard: 0 },
    lastStreakDate: null,
    today: { date: null, completed: { solver: {}, builder: {} }, streakEarned: false },
  };
}

// Reads and shallow-merges stored stats onto the defaults so a missing key
// (fresh install) or a shape mismatch (an older/future version's saved
// data) can't crash the Daily Puzzle UI — degrades to defaults instead,
// mirroring readBestScore/writeBestScore's try/catch pattern below.
function loadDailyStats() {
  try {
    const raw = localStorage.getItem(DAILY_STATS_KEY);
    if (!raw) return defaultDailyStats();
    return normalizeDailyStats(JSON.parse(raw));
  } catch (e) {
    return defaultDailyStats();
  }
}

// The shallow merge onto defaults described above, for stats from any
// source (localStorage, or a cloud save — see cloudsave.js).
function normalizeDailyStats(parsed) {
  if (!parsed || typeof parsed !== 'object') return defaultDailyStats();
  const base = defaultDailyStats();
  const parsedCompleted = (parsed.today && parsed.today.completed) || {};
  return {
    ...base,
    ...parsed,
    perDifficultyCompletions: { ...base.perDifficultyCompletions, ...(parsed.perDifficultyCompletions || {}) },
    today: {
      ...base.today,
      ...(parsed.today || {}),
      completed: {
        solver: { ...(parsedCompleted.solver || {}) },
        builder: { ...(parsedCompleted.builder || {}) },
      },
    },
  };
}

function saveDailyStats(stats) {
  try {
    localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    // best-effort persistence, same as best-score tracking above
  }
  notifySaveChanged();
}

// Rolls `stats.today` over to a fresh, all-incomplete state whenever the
// stored date doesn't match dateStr — a new calendar day always starts every
// mode unattempted. Never touches the lifetime counters (currentStreak,
// bestStreak, totalDaysCompleted, perDifficultyCompletions); those persist
// across the rollover regardless of whether yesterday's streak was earned.
function ensureTodayStats(stats, dateStr) {
  if (stats.today.date !== dateStr) {
    stats.today = { date: dateStr, completed: { solver: {}, builder: {} }, streakEarned: false };
  }
  return stats;
}

// completed: { solver: {easy,medium,hard}, builder: {easy,medium,hard} }
// booleans for *today*. A difficulty "mode" counts as done if either
// challenge type completed it — the rule doesn't require both.
function isDailyStreakEarned(completed) {
  const modeDone = (d) => !!(completed.solver[d] || completed.builder[d]);
  if (modeDone('hard')) return true;
  return DIFFICULTIES.filter(modeDone).length >= 2;
}

// Records that (type, difficulty) was completed today, updates the
// per-difficulty lifetime counter the first time either type clears that
// difficulty today, and — if this newly satisfies isDailyStreakEarned and
// today's streak wasn't already counted — advances currentStreak (reset to
// 1 if yesterday wasn't a streak day, else incremented) and bestStreak/
// totalDaysCompleted. Safe to call repeatedly for an already-completed
// challenge (e.g. replaying it): the early return makes re-completion a
// no-op rather than double-counting.
function markDailyChallengeComplete(dateStr, type, difficulty) {
  const stats = ensureTodayStats(loadDailyStats(), dateStr);
  if (stats.today.completed[type][difficulty]) {
    return stats;
  }

  const modeAlreadyDoneToday = !!(stats.today.completed.solver[difficulty] || stats.today.completed.builder[difficulty]);
  stats.today.completed[type][difficulty] = true;
  if (!modeAlreadyDoneToday) {
    stats.perDifficultyCompletions[difficulty] = (stats.perDifficultyCompletions[difficulty] || 0) + 1;
  }

  if (!stats.today.streakEarned && isDailyStreakEarned(stats.today.completed)) {
    stats.today.streakEarned = true;
    const yesterday = yesterdayDateString(dateStr);
    stats.currentStreak = stats.lastStreakDate === yesterday ? stats.currentStreak + 1 : 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    stats.totalDaysCompleted += 1;
    stats.lastStreakDate = dateStr;
  }

  saveDailyStats(stats);
  return stats;
}

// --- Rendering ----------------------------------------------------------

function tileAriaLabel(type, x, y, theme) {
  const name = ['empty', 'wall', 'start', 'goal'].includes(type) ? type : trapLabel(type, theme);
  return `Row ${y + 1}, column ${x + 1}: ${name.replace(/-/g, ' ')}`;
}

// Which texture key (see THEME_TILE_TEXTURES in sprites.js) a tile shows.
// Several types share one tile type but have more than one look: timed
// spikes, vents and snapjaws depend on the turn, and — only during play
// (`world` given) — bombs show their fuse state, thin ice cracks under you
// and breaks behind you, icicles shake and fall, hidden spikes pass for
// plain floor until they've been revealed, and imp/boar tiles show bare
// floor because the creature itself is drawn as a moving overlay (see
// hazardOverlaysFor). Builder/view mode (no `world`) always shows the
// "what is this tile" look instead.
function textureKeyForTile(tileType, turn, world, idx) {
  const family = tileFamily(tileType);
  if (tileType === 'timedspike') {
    return isTimedSpikeActiveAtTurn(turn) ? 'timedspike-active' : 'timedspike-inactive';
  }
  if (!world) return tileType;
  if (family === 'vent' && isVentActiveAtTurn(turn)) return `${tileType}-active`;
  if (tileType === 'snapjaw') {
    if (isSnapjawBitingAtTurn(turn)) return 'snapjaw-shut';
    if (isSnapjawWarningAtTurn(turn)) return 'snapjaw-open';
    return 'snapjaw';
  }
  if (tileType === 'hiddenspike') return world.revealed.has(idx) ? 'spike' : 'empty';
  if (family === 'imp' || family === 'boar') return 'empty';
  const state = objectState(world.ctx, idx, world.states);
  if (tileType === 'bomb') {
    if (state === BOMB_ARMED) return 'bomb';
    return state <= BOMB_FUSE_TICKS ? 'bomb-lit' : 'bomb-gone';
  }
  if (tileType === 'thinice') {
    if (state === THIN_ICE_BROKEN) return 'thinice-broken';
    return world.playerIdx === idx ? 'thinice-cracked' : 'thinice';
  }
  if (tileType === 'icicle') {
    if (state === ICICLE_FALLEN) return 'icicle-fallen';
    return state >= 1 && state <= ICICLE_DROP_TICKS ? 'icicle-shaking' : 'icicle';
  }
  return tileType;
}

// Moving/transient hazards drawn on top of tiles during play, as
// idx -> [kind, ...]. A kind is a HAZARD_TEXTURES key, optionally with a
// '-flip' suffix (a boar charging left); 'dust' (the tile a boar just
// charged across) has no texture of its own, only CSS.
function hazardOverlaysFor(ctx, tick, states) {
  const overlays = new Map();
  const add = (idx, kind) => {
    if (!overlays.has(idx)) overlays.set(idx, []);
    overlays.get(idx).push(kind);
  };
  ctx.flameCells.forEach((_, idx) => {
    if (isFlameAt(ctx, idx, tick, states)) add(idx, 'flame');
  });
  ctx.fireballDistances.forEach((_, idx) => {
    if (isFireballAt(ctx, idx, tick, states)) add(idx, 'fireball');
  });
  ctx.imps.forEach((imp) => add(impPositionAt(imp, tick), 'imp'));
  ctx.boars.forEach((boar) => {
    const [at, ...crossed] = boarCellsAt(boar, tick);
    const from = crossed[crossed.length - 1];
    const headingLeft = at % ctx.size < from % ctx.size;
    crossed.forEach((idx) => { if (idx !== at) add(idx, 'dust'); });
    add(at, headingLeft ? 'boar-flip' : 'boar');
  });
  if (isSnapjawBitingAtTurn(tick)) ctx.biteCells.forEach((idx) => add(idx, 'bite'));
  ctx.icicles.forEach(({ idx, slot }) => {
    if (states[slot] === ICICLE_CRASHING) add(idx, 'icicle-crash');
  });
  blastCellsFor(ctx, states).forEach((idx) => add(idx, 'blast'));
  return overlays;
}

// Web Animations keyframes gliding .player-slide (which sits on tile
// finalIdx) backwards along a slideTimeline: each stop becomes a translate
// back to that tile, measured in whole tiles plus the grid gap between
// them. Warp stops shrink the player out at the portal and pop them back in
// at its partner instead of gliding across the room; hop stops (mushroom
// bounces) arc up and over the tile in between.
function slideKeyframes(size, timeline, finalIdx, gapPx) {
  const fx = finalIdx % size;
  const fy = Math.floor(finalIdx / size);
  const atXY = (dx, dy, scale) =>
    `translate(calc(${dx} * (100% + ${gapPx}px)), calc(${dy} * (100% + ${gapPx}px))) scale(${scale})`;
  const at = (idx, scale) => atXY((idx % size) - fx, Math.floor(idx / size) - fy, scale);
  const { stops, durationMs } = timeline;
  const frames = [{ offset: 0, transform: at(stops[0].idx, 1), opacity: 1 }];
  for (let k = 1; k < stops.length; k++) {
    const { idx, t, warp, hop } = stops[k];
    const prev = stops[k - 1];
    const mid = (prev.t + t) / 2 / durationMs;
    if (warp) {
      frames.push({ offset: mid, transform: at(prev.idx, 0.2), opacity: 0 });
      frames.push({ offset: mid, transform: at(idx, 0.2), opacity: 0 });
    } else if (hop) {
      const mx = ((prev.idx % size) + (idx % size)) / 2 - fx;
      const my = (Math.floor(prev.idx / size) + Math.floor(idx / size)) / 2 - fy - 0.6;
      frames.push({ offset: mid, transform: atXY(mx, my, 1.35), opacity: 1 });
    }
    frames.push({ offset: t / durationMs, transform: at(idx, 1), opacity: 1 });
  }
  return frames;
}

// builderDnD, if given, makes the grid interactive for drag-and-drop tile
// editing (used by Creative Mode). Tiles are rendered as real <button>
// elements (not divs) so they're part of the tab order and get a focus
// outline for free. Non-interactive tiles (view/solver mode) stay plain
// divs since nothing is draggable/droppable there. builderDnD supplies
// dragStart/dragOver/dragLeave/drop/click callbacks (see the bootstrap's
// builderDnD object) — renderLevel itself holds no drag state, so it stays
// reusable outside Creative Mode.
// The level's `theme` picks the art (and the container gets a
// `theme-<name>` class, which scopes the player's per-theme colors — see
// injectSpriteStyles in sprites.js).
// playerPos, if given, draws the animated player sprite on top of tile
// [x, y] — this is purely a rendering overlay and never touches
// level.tiles, so the level's own data stays untouched by the player
// moving around it. playerAnim ({ facing: 'left'|'right', state:
// 'idle'|'walk'|'hit'|'win'|'slide'|'held', elapsedMs }) picks which
// pixel-art pose/animation plays; defaults to facing right, idle when
// playerPos is given without it. elapsedMs resumes a one-shot animation
// part-way through (via a negative animation-delay) so re-rendering the
// grid on a hazard tick doesn't restart the player's walk/hit animation
// from frame one.
// playerAnim.slide ({ fromIdx, path, hops, elapsedMs }), during an ice
// slide / current push / mushroom bounce / portal warp, glides the player
// from fromIdx through every tile in path (see slideTimeline) to
// playerPos, again resuming part-way through on a re-render, and makes
// each ice tile crossed glint as the player passes over it.
// turn picks the look of time-based tiles (timed spikes, vents, turrets,
// snapjaws); defaults to turn 0 for callers that don't track turns, e.g.
// Creative Mode.
// world ({ ctx, states, revealed, playerIdx, held }), given only by solver
// mode, turns on the live-play look: moving hazards drawn as overlays,
// object states (bomb fuses, thin ice, icicles), hidden spikes disguised as
// floor, and vines wrapped round a held player. Solver mode passes the same
// tick its danger checks use, so what's drawn and what kills can never
// disagree.
function renderLevel(level, container, { builderDnD, playerPos, playerAnim, turn = 0, world } = {}) {
  const theme = levelTheme(level);
  container.style.setProperty('--grid-size', level.size);
  THEMES.forEach((t) => container.classList.toggle(`theme-${t}`, t === theme));
  container.innerHTML = '';

  const overlays = world ? hazardOverlaysFor(world.ctx, turn, world.states) : null;
  const slide = playerAnim && playerAnim.slide;
  const timeline = slide ? slideTimeline(level.size, slide.fromIdx, slide.path, slide.hops) : null;
  const glintAt = new Map(); // ice tile idx -> ms when the player crosses it
  if (timeline) {
    timeline.stops.forEach(({ idx, t }) => {
      if (level.tiles[idx] === 'ice') glintAt.set(idx, t);
    });
  }

  level.tiles.forEach((tileType, i) => {
    const x = i % level.size;
    const y = Math.floor(i / level.size);
    const isPlayerTile = playerPos && playerPos[0] === x && playerPos[1] === y;
    const textureKey = textureKeyForTile(tileType, turn, world, i);

    const tileEl = document.createElement(builderDnD ? 'button' : 'div');
    // A disguised hidden spike gets the class of what it's pretending to
    // be, so nothing in the DOM gives it away either.
    const shownType = world && tileType === 'hiddenspike' ? textureKey : tileType;
    tileEl.className = `tile tile-${shownType}`;

    const texture = themeTexture(theme, textureKey);
    if (texture) tileEl.style.backgroundImage = `url("${texture}")`;

    if (builderDnD) {
      tileEl.type = 'button';
      tileEl.classList.add('tile-dropzone');
      tileEl.setAttribute('aria-label', tileAriaLabel(tileType, x, y, theme));
      tileEl.draggable = true;
      tileEl.addEventListener('dragstart', (e) => builderDnD.dragStart(x, y, e));
      tileEl.addEventListener('dragover', (e) => builderDnD.dragOver(x, y, e, tileEl));
      tileEl.addEventListener('dragleave', () => builderDnD.dragLeave(tileEl));
      tileEl.addEventListener('drop', (e) => builderDnD.drop(x, y, e, tileEl));
      tileEl.addEventListener('dragend', () => builderDnD.dragEnd());
      tileEl.addEventListener('click', () => builderDnD.click(x, y));
    }

    if (tileType === 'timedspike') {
      tileEl.classList.add(isTimedSpikeActiveAtTurn(turn) ? 'timedspike-active' : 'timedspike-inactive');
    }

    if (world) {
      const family = tileFamily(tileType);
      if (family === 'vent' && isVentWarningAtTurn(turn)) tileEl.classList.add('vent-warning');
      if (family === 'turret' && isTurretChargedAtTurn(turn)) tileEl.classList.add('turret-charged');
      if (tileType === 'snapjaw' && isSnapjawWarningAtTurn(turn)) tileEl.classList.add('vent-warning');
      if (textureKey === 'icicle-shaking') tileEl.classList.add('icicle-shaking');
      if (tileType === 'frost' && isPlayerTile) tileEl.classList.add('frost-underfoot');
      if (textureKey === 'bomb-lit') {
        tileEl.classList.add('bomb-lit');
        const countdownEl = document.createElement('span');
        countdownEl.className = 'bomb-countdown';
        countdownEl.textContent = String(objectState(world.ctx, i, world.states));
        tileEl.appendChild(countdownEl);
      }
      (overlays.get(i) || []).forEach((kind) => {
        const overlayEl = document.createElement('div');
        overlayEl.className = `hazard-sprite hazard-${kind}`;
        const overlayTexture = themeHazardTexture(theme, kind.replace(/-flip$/, ''));
        if (overlayTexture) overlayEl.style.backgroundImage = `url("${overlayTexture}")`;
        tileEl.appendChild(overlayEl);
      });
    }

    if (glintAt.has(i)) {
      tileEl.classList.add('ice-glint');
      tileEl.style.animationDelay = `${glintAt.get(i) - slide.elapsedMs}ms`;
    }

    if (isPlayerTile) {
      const { facing = 'right', state = 'idle', elapsedMs = 0 } = playerAnim || {};
      // Three layers, each owning one transform: .player-slide moves the
      // player between tiles, .player-sprite flips facing, and
      // .player-sprite-inner runs the pose animation.
      const slideEl = document.createElement('div');
      slideEl.className = 'player-slide';
      const playerEl = document.createElement('div');
      playerEl.className = `player-sprite${facing === 'left' ? ' facing-left' : ''}`;
      const innerEl = document.createElement('div');
      innerEl.className = `player-sprite-inner anim-${state}`;
      if (elapsedMs > 0) innerEl.style.animationDelay = `-${elapsedMs}ms`;
      playerEl.appendChild(innerEl);
      slideEl.appendChild(playerEl);
      tileEl.appendChild(slideEl);

      if (world && world.held) {
        const wrapEl = document.createElement('div');
        wrapEl.className = 'hazard-sprite hazard-vine-wrap';
        wrapEl.style.backgroundImage = `url("${themeHazardTexture(theme, 'vine-wrap')}")`;
        tileEl.appendChild(wrapEl);
      }

      if (timeline && slide.elapsedMs < timeline.durationMs) {
        // Lift this whole tile above its neighbors so the gliding player
        // isn't painted underneath tiles later in the grid.
        tileEl.classList.add('tile-has-slider');
        const animation = slideEl.animate(
          slideKeyframes(level.size, timeline, i, parseFloat(getComputedStyle(container).columnGap) || 0),
          { duration: timeline.durationMs, easing: 'linear', fill: 'both' }
        );
        animation.currentTime = slide.elapsedMs;
      }
    }

    container.appendChild(tileEl);
  });
}

// --- Solver mode ----------------------------------------------------------

// How many real milliseconds one hazard tick lasts during actual gameplay.
// solveBFS reasons in discrete turns (one move or wait per tick) so it can
// prove solvability exactly; real gameplay instead ticks this off a live
// wall-clock (see currentHazardTick in startSolverMode) so every timed
// hazard keeps cycling — and can kill the player — even while they're
// standing still. Both feed the same tick number into the same hazardAt(),
// so the timing *pattern* is identical; a human just has to keep up with it
// in real time (see the Movement section in SPEC.md).
const HAZARD_TICK_MS = 500;

// Maps recognized movement keys to a [dx, dy] step. Both letter cases are
// listed so WASD still works with caps lock/shift held.
const KEY_DELTAS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], W: [0, -1],
  s: [0, 1], S: [0, 1],
  a: [-1, 0], A: [-1, 0],
  d: [1, 0], D: [1, 0],
};

// What killed you, in the room's own words: hazardAt's labels are fixed
// (game logic keys off them), but a spike in the ice is an icicle spike
// and a turret's shot there is an ice shard.
function deathLabelFor(label, theme) {
  const shared = { spike: 'spike', 'hidden spike': 'hiddenspike', 'timed spike': 'timedspike' };
  if (shared[label]) return trapLabel(shared[label], theme).toLowerCase();
  if (label === 'fireball' && theme === 'ice') return 'ice shard';
  return label;
}

// Best scores are kept in localStorage per-level, not as one global value,
// so two different shared rooms never clobber each other's best score.
// Keyed by the level's own share code (the ?level= value) since that's
// already a unique, stable identifier for "this exact room".
function bestScoreKeyFor(levelCode) {
  return `trapRoomBestScore:${levelCode}`;
}

function readBestScore(levelCode) {
  try {
    const raw = localStorage.getItem(bestScoreKeyFor(levelCode));
    return raw === null ? null : Number(raw);
  } catch (e) {
    return null; // localStorage unavailable (private browsing, etc.) — skip it
  }
}

function writeBestScore(levelCode, moves) {
  try {
    localStorage.setItem(bestScoreKeyFor(levelCode), String(moves));
  } catch (e) {
    // best-score tracking is a nice-to-have; fail silently if storage is blocked
  }
  notifySaveChanged();
}

// Formats a duration in milliseconds as m:ss for the live timer and the win
// modal — minutes aren't zero-padded (matches a typical stopwatch), seconds
// always are.
function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// A countdown shows whole seconds left, rounded up, so it reads 0:00 only
// at the very end.
function formatRemaining(ms) {
  return formatElapsed(Math.ceil(Math.max(0, ms) / 1000) * 1000);
}

// Runs a level: player position is tracked as separate local state (never
// written into level.tiles), so replaying, restarting on a trap, or
// re-sharing the same level can't corrupt its data. One keypress = one
// move, resolved by resolveMove (the same function solveBFS uses) so ice
// slides, currents, mushroom bounces and portals play out exactly as the
// solvability check assumed. Blocked moves are no-ops; anything deadly
// resets to start (and counts as a death); the goal wins. Timed hazards
// also advance in real time and can catch a stationary player — see
// advanceWorldTo/hazardTick.
//
// levelCode is used only as the localStorage key for this room's best score
// (see bestScoreKeyFor) — never written back into the level object itself.
// For the `?level=` shared-link flow it's the raw share string; the Daily
// Puzzle hub and the campaign pass synthetic codes instead.
//
// onWin({ moves, deaths, elapsedMs }), if given, is called at the end of a
// successful run (the campaign records progress with it, the Daily Puzzle
// its completion) — startSolverMode itself has no opinion on what winning
// "means" beyond this level's own goal tile.
//
// A level with a `timeLimit` (seconds) is a timed room: the clock counts
// down, and if it runs out the run restarts (hidden spikes already found
// stay found).
//
// Returns a stop() function that removes this run's keydown listener and
// clears its hazard-tick interval, so the next session can start clean.
function startSolverMode(level, {
  grid, controlsEl, solverInfoEl, solverMessageEl, solverStatsEl,
  moveCountEl, deathCountEl, elapsedTimeEl, timeLabelEl, solverResetBtn,
  bestScoreEl, winModalEl, winModalStatsEl, winModalResetBtn, levelCode, onWin,
}) {
  controlsEl.hidden = true;
  solverInfoEl.hidden = false;
  solverStatsEl.hidden = false;

  const theme = levelTheme(level);
  const timeLimitMs = level.timeLimit ? level.timeLimit * 1000 : 0;
  timeLabelEl.textContent = timeLimitMs ? 'Time left:' : 'Time:';

  // The level never changes during a run, so its hazard layout is worked
  // out once up front.
  const ctx = buildHazardContext(level);

  // One-shot player animations settle back to idle after this long (the
  // longest of them, anim-hit, runs 0.45s).
  const ONE_SHOT_ANIM_MS = 500;

  // Declared here (not initialized until resetRun() below) so every
  // function in this closure — including the ones defined above
  // resetRun() — closes over the same mutable bindings.
  //   processedTick — the last hazard tick the world has been advanced to.
  //   states        — every object's state (bombs, thin ice, icicles — see
  //                   advanceObjects); reset on death, so every life starts
  //                   with a fresh room.
  //   revealed      — hidden spikes that have killed the player this run;
  //                   they stay visible across deaths as the player's reward
  //                   for learning the room (but reset on a full Reset).
  //   heldUntilTick — vines hold the player until this tick (see
  //                   VINE_HOLD_TICKS); moves before it are ignored.
  //   arrivedTick   — the tick the player arrived on their current tile,
  //                   for frostbite (see FROSTBITE_TICKS).
  //   pendingFlash  — { idx, className } for the tile that just killed the
  //                   player, applied once by the next render().
  //   slide         — { fromIdx, path, hops, startedAt, durationMs } while
  //                   a multi-tile move is animating.
  //   inputLockedUntil — keypresses are ignored until the slide finishes,
  //                   so the player can't act from a tile they visibly
  //                   haven't reached yet.
  //   outcomeTimer  — a death or win at the end of a slide, deferred until
  //                   the animation actually gets there; dying is true while
  //                   a deferred death is pending.
  let playerPos, won, moveCount, deathCount, facing, animState, animStartedAt, animDurationMs;
  let startTime, timerId, processedTick, states, revealed, pendingFlash;
  let heldUntilTick, arrivedTick;
  let slide, inputLockedUntil, outcomeTimer, dying;

  function currentHazardTick() {
    return Math.floor((Date.now() - startTime) / HAZARD_TICK_MS);
  }

  function playerIdx() {
    return playerPos[1] * level.size + playerPos[0];
  }

  // durationMs: how long a one-shot state (walk/hit/slide) plays before
  // render() settles it back to idle.
  function setAnim(state, durationMs = ONE_SHOT_ANIM_MS) {
    animState = state;
    animStartedAt = Date.now();
    animDurationMs = durationMs;
  }

  function render() {
    let elapsedMs = Date.now() - animStartedAt;
    const held = !won && processedTick < heldUntilTick;
    if (['walk', 'hit', 'slide'].includes(animState) && elapsedMs >= animDurationMs) {
      setAnim(held ? 'held' : 'idle');
      elapsedMs = 0;
    }
    if (animState === 'held' && !held) setAnim('idle');
    if (slide && Date.now() - slide.startedAt >= slide.durationMs) slide = null;
    renderLevel(level, grid, {
      playerPos,
      playerAnim: {
        facing,
        state: animState,
        elapsedMs: ['idle', 'held'].includes(animState) ? 0 : elapsedMs,
        slide: slide && { fromIdx: slide.fromIdx, path: slide.path, hops: slide.hops, elapsedMs: Date.now() - slide.startedAt },
      },
      turn: processedTick,
      world: { ctx, states, revealed, playerIdx: playerIdx(), held: held && !slide },
    });
    moveCountEl.textContent = String(moveCount);
    deathCountEl.textContent = String(deathCount);

    // The tile that just killed the player briefly plays a "triggered"
    // flash. renderLevel just rebuilt the whole grid, so this has to be
    // applied as a one-shot class after the fact.
    if (pendingFlash) {
      const tileEl = grid.children[pendingFlash.idx];
      if (tileEl) tileEl.classList.add(pendingFlash.className);
      pendingFlash = null;
    }
  }

  function setMessage(text, className) {
    solverMessageEl.textContent = text;
    solverMessageEl.className = className || '';
  }

  // Adds a one-shot flash animation to the grid (see .flash-win/.flash-fail
  // in style.css). Removing then re-adding the class forces the animation
  // to restart even if it's triggered again before the previous run ends
  // (e.g. hitting a spike twice in a row).
  function flashGrid(className) {
    grid.classList.remove('flash-win', 'flash-fail');
    void grid.offsetWidth;
    grid.classList.add(className);
  }

  // Shared death handling for every way to die: moving into something
  // deadly (handleKeydown) and something deadly arriving under a player
  // who's standing still (advanceWorldTo). Doesn't render — callers render
  // once after all state changes.
  function killPlayer(label, idx) {
    playerPos = [...level.start];
    slide = null;
    inputLockedUntil = 0;
    dying = false;
    deathCount++;
    setAnim('hit');
    states = initialObjectStates(ctx);
    heldUntilTick = 0;
    arrivedTick = processedTick;
    if (label === 'hidden spike') revealed.add(idx);
    setMessage(`Ouch — ${deathLabelFor(label, theme)}! Back to start.`, 'invalid');
    flashGrid('flash-fail');
    const spikeDeath = label.endsWith('spike');
    pendingFlash = { idx, className: spikeDeath ? 'trap-triggered' : 'hazard-triggered' };
  }

  function updateElapsedDisplay() {
    const elapsed = Date.now() - startTime;
    if (!timeLimitMs) {
      elapsedTimeEl.textContent = formatElapsed(elapsed);
      return;
    }
    const remaining = timeLimitMs - elapsed;
    elapsedTimeEl.textContent = formatRemaining(remaining);
    elapsedTimeEl.classList.toggle('time-low', remaining <= 5000);
  }

  // Steps the world forward one tick at a time up to targetTick (normally
  // a single step; more if the browser throttled the interval), advancing
  // objects (bomb fuses, falling icicles) and killing a player whose tile
  // turns deadly under them — or who has lingered on frostbite. This is the
  // one place in solver mode where the world changes without a keypress
  // driving it — without it, a hazard would only ever be checked at the
  // instant it's stepped onto, letting the player wait out a fatal phase
  // change by simply not moving.
  function advanceWorldTo(targetTick) {
    while (processedTick < targetTick) {
      processedTick++;
      if (ctx.objectCount) states = advanceObjects(ctx, states);
      if (dying) continue; // already doomed — see outcomeTimer
      const idx = playerIdx();
      let label = hazardAt(ctx, idx, processedTick, states);
      if (!label && ctx.tiles[idx] === 'frost' && processedTick >= arrivedTick + FROSTBITE_TICKS) label = 'frostbite';
      if (label) killPlayer(label, idx);
    }
  }

  // Timed rooms: the clock ran out. Start over, keeping any hidden spikes
  // already found (the one thing a timed-out run shouldn't cost you).
  function timeUp() {
    const found = revealed;
    resetRun();
    revealed = found;
    setMessage("⏱ Out of time! The room resets — spikes you've found stay found.", 'invalid');
    flashGrid('flash-fail');
    render();
  }

  // Fires every 100ms to keep the live elapsed-time display current and to
  // advance hazards in real time independently of player input (see
  // advanceWorldTo), re-rendering so they visibly animate even while the
  // player stands still.
  function hazardTick() {
    updateElapsedDisplay();
    if (won) return;
    if (timeLimitMs && Date.now() - startTime >= timeLimitMs) {
      timeUp();
      return;
    }
    const target = currentHazardTick();
    if (target === processedTick) return;
    advanceWorldTo(target);
    render();
  }

  // The live timer is wall-clock time (unlike moveCount, which only
  // advances on accepted moves) — a setInterval tick, not tied to player
  // input, is the only way to keep it (and hazard state) live while idle.
  function startTimer() {
    startTime = Date.now();
    processedTick = 0;
    updateElapsedDisplay();
    clearInterval(timerId);
    timerId = setInterval(hazardTick, 100);
  }

  function hideWinModal() {
    winModalEl.hidden = true;
  }

  function showWinModal(elapsedMs) {
    winModalStatsEl.textContent =
      `Time: ${formatElapsed(elapsedMs)}   ·   Moves: ${moveCount}   ·   Deaths: ${deathCount}`;
    winModalEl.hidden = false;
  }

  // Restarts the run in place: back to the start tile, all counters and the
  // timer zeroed, objects reset, hidden spikes hidden again, modal/messages
  // cleared. Used both for the initial setup (called once below) and for
  // the player-facing Reset button/"Play Again".
  function resetRun() {
    playerPos = [...level.start];
    won = false;
    moveCount = 0;
    deathCount = 0;
    facing = 'right';
    setAnim('idle');
    states = initialObjectStates(ctx);
    revealed = new Set();
    heldUntilTick = 0;
    arrivedTick = 0;
    pendingFlash = null;
    clearTimeout(outcomeTimer);
    slide = null;
    inputLockedUntil = 0;
    dying = false;
    setMessage('', '');
    hideWinModal();
    grid.classList.remove('flash-win', 'flash-fail');
    elapsedTimeEl.classList.remove('time-low');
    startTimer();
    render();
  }

  // elapsedMs is passed in when the win is deferred to the end of a slide,
  // so the clock stops at the keypress rather than when the animation ends.
  function handleWin(elapsedMs = Date.now() - startTime) {
    won = true;
    setAnim('win');
    clearInterval(timerId);
    setMessage(`You win! 🎉 (${moveCount} move${moveCount === 1 ? '' : 's'})`, 'valid');
    flashGrid('flash-win');
    showWinModal(elapsedMs);

    const prevBest = readBestScore(levelCode);
    if (prevBest === null || moveCount < prevBest) {
      writeBestScore(levelCode, moveCount);
      bestScoreEl.textContent = prevBest === null
        ? `New best for this room: ${moveCount} moves!`
        : `New best for this room: ${moveCount} moves! (previous best: ${prevBest})`;
    } else {
      bestScoreEl.textContent = `Best for this room: ${prevBest} moves.`;
    }
    bestScoreEl.hidden = false;

    if (onWin) onWin({ moves: moveCount, deaths: deathCount, elapsedMs });
  }

  function handleKeydown(e) {
    if (won || !winModalEl.hidden) return;

    const delta = KEY_DELTAS[e.key];
    if (!delta) return;
    e.preventDefault();
    if (Date.now() < inputLockedUntil) return;

    // Catch the world up first so the move is judged against the hazards
    // that are actually on screen right now.
    advanceWorldTo(currentHazardTick());

    if (processedTick < heldUntilTick) {
      setMessage('🌿 The vines have you — hold on…', '');
      render();
      return;
    }

    const [dx, dy] = delta;
    const move = resolveMove(ctx, playerPos[0], playerPos[1], dx, dy, processedTick, states);
    if (!move) {
      render();
      return;
    }

    moveCount++;
    if (dx < 0) facing = 'left';
    else if (dx > 0) facing = 'right';

    const fromIdx = playerIdx();
    const endIdx = move.death ? move.death.idx : move.final;
    playerPos = [endIdx % level.size, Math.floor(endIdx / level.size)];

    // A multi-tile move (ice, current, mushroom, portal) glides the player
    // along its path. Whatever happens at the end — dying, winning — waits
    // until the glide actually gets there, and input is locked until then.
    let settleMs = 0;
    if (move.path.length > 1 || move.hops.length) {
      settleMs = slideTimeline(level.size, fromIdx, move.path, move.hops).durationMs;
      slide = { fromIdx, path: move.path, hops: move.hops, startedAt: Date.now(), durationMs: settleMs };
      inputLockedUntil = Date.now() + settleMs;
      setAnim('slide', settleMs);
    } else {
      slide = null;
      setAnim('walk');
    }
    const afterSlide = (fn) => {
      clearTimeout(outcomeTimer);
      if (settleMs) outcomeTimer = setTimeout(fn, settleMs);
      else fn();
    };

    if (move.death) {
      const { label, idx } = move.death;
      dying = true;
      if (settleMs) render();
      afterSlide(() => {
        killPlayer(label, idx);
        render();
      });
      return;
    }

    states = applyMoveToObjects(states, move);
    // Frostbite counts from when the player visibly lands (a long slide
    // shouldn't eat into the time they have to step off again) — only ever
    // more lenient than solveBFS, never less.
    arrivedTick = processedTick + Math.ceil(settleMs / HAZARD_TICK_MS);
    if (move.grabbed) heldUntilTick = processedTick + 1 + VINE_HOLD_TICKS;

    if (move.won) {
      // Freeze input and the clock now; the celebration waits for the
      // player to arrive.
      const elapsedMs = Date.now() - startTime;
      won = true;
      clearInterval(timerId);
      render();
      afterSlide(() => {
        handleWin(elapsedMs);
        render();
      });
      return;
    }

    if (move.grabbed) {
      setMessage('🌿 Grabbed by vines! You’re stuck for a moment.', 'invalid');
    } else if (move.litBombs.length) {
      setMessage('💣 Fuse lit — get clear!', 'invalid');
    } else if (move.litIcicles.length) {
      setMessage('🧊 The icicle above you cracks — move!', 'invalid');
    } else if (move.brokenIce.length) {
      setMessage('The thin ice shatters behind you.', '');
    } else if (move.hops.length) {
      setMessage('Boing!', '');
    } else if (move.teleported) {
      setMessage('Whoosh — through the portal!', '');
    } else if (move.path.length > 1 && ctx.tiles[move.path[0]] === 'ice') {
      setMessage('Whoa — sliding on the ice!', '');
    } else {
      setMessage('', '');
    }

    render();
    // Drop out of the skid pose the moment the glide lands, rather than on
    // the next hazard tick.
    if (settleMs) afterSlide(render);
  }

  document.addEventListener('keydown', handleKeydown);
  solverResetBtn.addEventListener('click', resetRun);
  winModalResetBtn.addEventListener('click', resetRun);

  resetRun();

  return function stop() {
    document.removeEventListener('keydown', handleKeydown);
    solverResetBtn.removeEventListener('click', resetRun);
    winModalResetBtn.removeEventListener('click', resetRun);
    clearInterval(timerId);
    clearTimeout(outcomeTimer);
  };
}

// --- Page bootstrap -------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('grid');
  if (!grid) return; // no game UI on this page (e.g. tests.html)

  injectSpriteStyles();

  const $ = (id) => document.getElementById(id);
  const controlsEl = $('controls');
  const builderToggleBtn = $('builder-toggle');
  const trapCounterEl = $('trap-counter');
  const validateBtn = $('validate-btn');
  const validateResultEl = $('validate-result');
  const shareBtn = $('share-btn');
  const shareOutputEl = $('share-output');
  const shareLinkInput = $('share-link');
  const copyShareBtn = $('copy-share-btn');
  const solverInfoEl = $('solver-info');
  const solverMessageEl = $('solver-message');
  const solverStatsEl = $('solver-stats');
  const moveCountEl = $('move-count');
  const deathCountEl = $('death-count');
  const elapsedTimeEl = $('elapsed-time');
  const timeLabelEl = $('time-label');
  const solverResetBtn = $('solver-reset-btn');
  const bestScoreEl = $('best-score');
  const winModalEl = $('win-modal');
  const winModalStatsEl = $('win-modal-stats');
  const winModalUnlockEl = $('win-modal-unlock');
  const winModalResetBtn = $('win-modal-reset-btn');
  const winModalNextBtn = $('win-modal-next-btn');
  const winModalLevelsBtn = $('win-modal-levels-btn');
  const builderPanelToggleBtn = $('builder-panel-toggle');
  const builderPanelEl = $('builder-panel');
  const creativeThemePickerEl = $('creative-theme-picker');
  const paletteListEl = $('palette-list');
  const trashCanEl = $('trash-can');
  const clearAllBtn = $('clear-all-btn');
  const clearAllConfirmEl = $('clear-all-confirm');
  const clearAllConfirmBtn = $('clear-all-confirm-btn');
  const clearAllCancelBtn = $('clear-all-cancel-btn');
  const dailyToggleBtn = $('daily-toggle');
  const dailyHubEl = $('daily-hub');
  const dailyHubDateEl = $('daily-hub-date');
  const dailyHubThemeEl = $('daily-hub-theme');
  const dailyHubStreakEl = $('daily-hub-streak');
  const dailyHubStatsEl = $('daily-hub-stats');
  const dailyModeBtns = document.querySelectorAll('.daily-mode-btn');
  const dailySolverBackBtn = $('daily-solver-back-btn');
  const winModalDailyBackBtn = $('win-modal-daily-back-btn');
  const dailyBuilderBarEl = $('daily-builder-bar');
  const dailyBuilderTargetEl = $('daily-builder-target');
  const dailyBuilderSubmitBtn = $('daily-builder-submit-btn');
  const dailyBuilderBackBtn = $('daily-builder-back-btn');
  const dailyBuilderResultEl = $('daily-builder-result');
  const levelHeadingEl = $('level-heading');
  const campaignBackBtn = $('campaign-back-btn');
  const themeSelectEl = $('theme-select');
  const themeCardEl = $('theme-card');
  const themePreviewEl = $('theme-preview');
  const themeNameEl = $('theme-name');
  const themeStatusEl = $('theme-status');
  const themeProgressFillEl = $('theme-progress-fill');
  const themeDotsEl = $('theme-dots');
  const themePrevBtn = $('theme-prev');
  const themeNextBtn = $('theme-next');
  const themeLevelsBtn = $('theme-levels-btn');
  const resetProgressBtn = $('reset-progress-btn');
  const resetProgressConfirmEl = $('reset-progress-confirm');
  const resetProgressYesBtn = $('reset-progress-yes-btn');
  const resetProgressNoBtn = $('reset-progress-no-btn');
  const levelSelectEl = $('level-select');
  const levelSelectTitleEl = $('level-select-title');
  const levelSelectSubtitleEl = $('level-select-subtitle');
  const levelGridEl = $('level-grid');
  const levelSelectBackBtn = $('level-select-back-btn');
  const trapIntroModal = $('trap-intro-modal');
  const trapIntroListEl = $('trap-intro-list');
  const trapIntroStartBtn = $('trap-intro-start-btn');

  const titleScreenEl = $('title-screen');
  const titleHowtoModal = $('title-howto-modal');
  const titleCreditsModal = $('title-credits-modal');
  const titleSignTextEl = $('title-sign-text');
  const homeBtn = $('home-btn');

  // Paints the title screen's decorative pixel art (see TITLE_SCREEN_TEXTURES
  // in sprites.js) the same way Creative Mode paints palette icons — a plain
  // inline background-image, no <img> elements. The riveted-plate button
  // texture specifically goes through a CSS custom property instead (read by
  // .title-btn/.pixel-btn in style.css) rather than being set per-element
  // here, since it's shared by every "chrome" button on the game page — see
  // the comment on .pixel-btn in style.css for why that has to be a custom
  // property and not another per-element inline style.
  document.documentElement.style.setProperty('--plate-texture', `url("${TITLE_SCREEN_TEXTURES.button}")`);
  document.querySelectorAll('.title-torch').forEach((el) => { el.style.backgroundImage = `url("${TITLE_SCREEN_TEXTURES.torch}")`; });
  document.querySelectorAll('.title-spike').forEach((el) => { el.style.backgroundImage = `url("${TITLE_SCREEN_TEXTURES.spike}")`; });
  $('title-sign-post').style.backgroundImage = `url("${TITLE_SCREEN_TEXTURES.sign}")`;
  $('trash-icon').style.backgroundImage = `url("${UI_ICON_TEXTURES.trash}")`;

  // Switches the page's backdrop and accent colors (body[data-theme] in
  // style.css) to a theme.
  function applyTheme(theme) {
    const t = normalizeTheme(theme);
    document.body.dataset.theme = t;
    document.body.style.backgroundImage = `url("${PAGE_BACKGROUND_TEXTURES[t]}")`;
  }
  applyTheme('lava');

  // --- Mode state -----------------------------------------------------------

  let builderMode = false;
  let builderLevel = null;
  let panelOpen = true;
  // The look new Creative Mode maps start with (the last one picked).
  let creativeTheme = 'lava';

  // The grid size and trap budget Creative Mode currently builds against.
  // Normal Creative Mode always uses the BUILDER_GRID_SIZE/TRAP_BUDGET
  // constants; a Daily Puzzle builder challenge temporarily overrides both
  // to that day's constraints (see startDailyBuilderChallenge) and resets
  // them back on exit.
  let activeBuilderSize = BUILDER_GRID_SIZE;
  let activeTrapBudget = TRAP_BUDGET;

  // Set while a Daily Puzzle challenge (solver or builder) is in progress.
  let currentDailyChallenge = null;
  // The campaign level being played, if any.
  let currentCampaignId = null;

  // Teardown for the currently-running startSolverMode session, if any —
  // every session adds a document-level keydown listener and an interval,
  // so the previous one must be stopped before another starts.
  let activeSolverStop = null;

  function stopSolver() {
    if (activeSolverStop) {
      activeSolverStop();
      activeSolverStop = null;
    }
  }

  function solverDom() {
    return {
      grid, controlsEl, solverInfoEl, solverMessageEl, solverStatsEl,
      moveCountEl, deathCountEl, elapsedTimeEl, timeLabelEl, solverResetBtn,
      bestScoreEl, winModalEl, winModalStatsEl, winModalResetBtn,
    };
  }

  // Drag state lives here (not in renderLevel) so it survives the grid being
  // torn down and rebuilt by renderBuilder() on every edit. Exactly one of
  // the two is set while a drag is in progress: draggedPaletteType while
  // dragging a block/trash item from the panel, draggedFromTile while
  // dragging an existing grid tile toward the trash can.
  let draggedPaletteType = null;
  let draggedFromTile = null;

  function resetDragState() {
    draggedPaletteType = null;
    draggedFromTile = null;
    grid.querySelectorAll('.tile-drag-over-valid, .tile-drag-over-invalid').forEach((el) => {
      el.classList.remove('tile-drag-over-valid', 'tile-drag-over-invalid');
    });
    trashCanEl.classList.remove('trash-drag-over');
  }

  function clearMessages() {
    [validateResultEl, solverMessageEl, dailyBuilderResultEl].forEach((el) => {
      el.textContent = '';
      el.className = '';
    });
  }

  // The one place that tears down whatever is on screen — a solver run
  // (campaign, daily or shared link), Creative Mode, the Daily Puzzle hub,
  // the theme/level screens — back to a blank page. Every mode's entry
  // function starts by calling this, so no mode can leak UI (or a running
  // solver's keydown listener) into another.
  function hideAllModes() {
    stopSolver();
    builderMode = false;
    builderLevel = null;
    currentDailyChallenge = null;
    currentCampaignId = null;
    activeBuilderSize = BUILDER_GRID_SIZE;
    activeTrapBudget = TRAP_BUDGET;
    resetDragState();
    hideClearAllConfirm();
    hideResetProgressConfirm();

    [
      controlsEl, trapCounterEl, validateBtn, shareBtn, shareOutputEl,
      builderPanelToggleBtn, builderPanelEl, dailyBuilderBarEl, dailyHubEl,
      solverInfoEl, solverStatsEl, dailySolverBackBtn, campaignBackBtn, winModalEl,
      winModalDailyBackBtn, winModalNextBtn, winModalLevelsBtn, winModalUnlockEl,
      bestScoreEl, levelHeadingEl, themeSelectEl, levelSelectEl, trapIntroModal,
    ].forEach((el) => { el.hidden = true; });
    builderToggleBtn.hidden = false;
    dailyToggleBtn.hidden = false;
    builderToggleBtn.textContent = 'Enter Creative Mode';
    dailyToggleBtn.textContent = 'Daily Puzzle';
    grid.hidden = false;
    grid.classList.remove('flash-win', 'flash-fail');
    clearMessages();
  }

  // --- Title screen -----------------------------------------------------------

  // The signpost doubles as a live daily-streak readout rather than pure
  // decoration — reuses the same stats already backing the Daily Puzzle hub
  // (see renderDailyHubUI below), just read-only here.
  function renderTitleStreakSign() {
    const stats = ensureTodayStats(loadDailyStats(), getTodayDateString());
    titleSignTextEl.textContent = stats.currentStreak > 0
      ? `🔥 ${stats.currentStreak}-day streak`
      : 'Start a streak today';
  }

  function hideTitleScreen() {
    titleScreenEl.hidden = true;
    homeBtn.hidden = false;
  }

  function showTitleScreen() {
    hideAllModes();
    grid.hidden = true;
    applyTheme('lava');
    renderTitleStreakSign();
    homeBtn.hidden = true;
    titleScreenEl.hidden = false;
  }
  homeBtn.addEventListener('click', showTitleScreen);

  $('title-play-btn').addEventListener('click', () => openThemeSelect());
  $('title-daily-btn').addEventListener('click', () => enterDailyHub());
  $('title-builder-btn').addEventListener('click', () => enterCreativeMode());
  $('title-howto-btn').addEventListener('click', () => { titleHowtoModal.hidden = false; });
  $('title-howto-close-btn').addEventListener('click', () => { titleHowtoModal.hidden = true; });
  $('title-credits-btn').addEventListener('click', () => { titleCreditsModal.hidden = false; });
  $('title-credits-close-btn').addEventListener('click', () => { titleCreditsModal.hidden = true; });

  // --- Theme select (Play) ------------------------------------------------------
  //
  // One theme at a time, Geometry Dash style: its name, a live preview of
  // its first level, and ◀ ▶ to switch (wrapping around). Locked themes are
  // greyed out with a lock and how far you are toward unlocking them.

  let selectedThemeIdx = 0;

  function openThemeSelect(theme) {
    hideAllModes();
    hideTitleScreen();
    if (theme) selectedThemeIdx = THEMES.indexOf(theme);
    grid.hidden = true;
    themeSelectEl.hidden = false;
    renderThemeSelect();
  }

  function renderThemeSelect() {
    const theme = THEMES[selectedThemeIdx];
    const progress = loadProgress();
    const unlocked = isThemeUnlocked(progress, theme);
    const done = completedCount(progress, theme);
    applyTheme(theme);

    renderLevel(campaignLevel(themeLevels(theme)[0].id), themePreviewEl);
    themeCardEl.classList.toggle('locked', !unlocked);
    themeCardEl.setAttribute('aria-label', `${THEME_INFO[theme].name}${unlocked ? '' : ' (locked)'}`);
    themeNameEl.textContent = THEME_INFO[theme].name;

    let fraction;
    if (unlocked) {
      fraction = done / LEVELS_PER_THEME;
      themeStatusEl.textContent = done === LEVELS_PER_THEME
        ? `👑 All ${LEVELS_PER_THEME} levels complete`
        : `${done} / ${LEVELS_PER_THEME} levels complete`;
    } else {
      const prev = previousTheme(theme);
      const prevDone = Math.min(completedCount(progress, prev), UNLOCK_REQUIREMENT);
      fraction = prevDone / UNLOCK_REQUIREMENT;
      themeStatusEl.textContent =
        `🔒 Locked — ${prevDone} / ${UNLOCK_REQUIREMENT} ${THEME_INFO[prev].short} levels to unlock`;
    }
    themeProgressFillEl.style.width = `${Math.round(fraction * 100)}%`;
    themeProgressFillEl.parentElement.classList.toggle('locked', !unlocked);

    themeDotsEl.innerHTML = '';
    THEMES.forEach((t, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `theme-dot${i === selectedThemeIdx ? ' active' : ''}`;
      dot.setAttribute('aria-label', `Show ${THEME_INFO[t].name}`);
      dot.addEventListener('click', () => {
        selectedThemeIdx = i;
        renderThemeSelect();
      });
      themeDotsEl.appendChild(dot);
    });

    themeLevelsBtn.disabled = !unlocked;
    themeLevelsBtn.textContent = unlocked ? 'Levels' : 'Locked';
  }

  function stepTheme(delta) {
    selectedThemeIdx = mod(selectedThemeIdx + delta, THEMES.length);
    hideResetProgressConfirm();
    renderThemeSelect();
  }
  themePrevBtn.addEventListener('click', () => stepTheme(-1));
  themeNextBtn.addEventListener('click', () => stepTheme(1));
  themeLevelsBtn.addEventListener('click', () => {
    const theme = THEMES[selectedThemeIdx];
    if (isThemeUnlocked(loadProgress(), theme)) openLevelSelect(theme);
  });

  // Arrow keys / A-D flip through themes; Enter opens the levels. Only while
  // the theme screen is up, and never while a modal sits on top of it.
  document.addEventListener('keydown', (e) => {
    if (themeSelectEl.hidden || !titleHowtoModal.hidden || !titleCreditsModal.hidden) return;
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) {
      e.preventDefault();
      stepTheme(-1);
    } else if (['ArrowRight', 'd', 'D'].includes(e.key)) {
      e.preventDefault();
      stepTheme(1);
    } else if (e.key === 'Enter' && document.activeElement === document.body) {
      themeLevelsBtn.click();
    }
  });

  // Reset progress: a two-step confirm, same pattern as Clear All.
  function hideResetProgressConfirm() {
    resetProgressConfirmEl.hidden = true;
    resetProgressBtn.hidden = false;
  }
  resetProgressBtn.addEventListener('click', () => {
    resetProgressBtn.hidden = true;
    resetProgressConfirmEl.hidden = false;
  });
  resetProgressNoBtn.addEventListener('click', hideResetProgressConfirm);
  resetProgressYesBtn.addEventListener('click', () => {
    resetProgress();
    hideResetProgressConfirm();
    selectedThemeIdx = 0;
    renderThemeSelect();
  });

  // --- Level select -------------------------------------------------------------

  let levelSelectTheme = 'lava';

  function openLevelSelect(theme) {
    hideAllModes();
    hideTitleScreen();
    levelSelectTheme = theme;
    applyTheme(theme);
    grid.hidden = true;
    levelSelectEl.hidden = false;
    renderLevelSelect();
  }

  function renderLevelSelect() {
    const theme = levelSelectTheme;
    const progress = loadProgress();
    const levels = themeLevels(theme);
    const next = THEMES[THEMES.indexOf(theme) + 1];
    levelSelectTitleEl.textContent = THEME_INFO[theme].name;
    levelSelectSubtitleEl.textContent = `${completedCount(progress, theme)} / ${levels.length} complete` +
      (next ? ` · beat ${UNLOCK_REQUIREMENT} to unlock ${THEME_INFO[next].name}` : '');

    levelGridEl.innerHTML = '';
    levels.forEach((def, n) => {
      const open = isLevelUnlocked(progress, theme, n);
      const record = progress.levels[def.id];
      const plate = document.createElement('button');
      plate.type = 'button';
      plate.className = `level-plate${record ? ' done' : ''}${open ? '' : ' locked'}`;
      plate.disabled = !open;

      const num = document.createElement('span');
      num.className = 'level-plate-num';
      num.textContent = open ? String(n + 1) : '🔒';
      const name = document.createElement('span');
      name.className = 'level-plate-name';
      name.textContent = def.name;
      const tags = document.createElement('span');
      tags.className = 'level-plate-tags';
      const tagText = [];
      if (def.timeLimit) tagText.push(`⏱ ${def.timeLimit}s`);
      if (n + 1 === UNLOCK_REQUIREMENT && next) tagText.push('🔑');
      if (record) tagText.push(`✓ ${record.moves} moves`);
      tags.textContent = tagText.join(' · ');
      plate.append(num, name, tags);

      plate.title = def.idea;
      plate.setAttribute('aria-label',
        `Level ${n + 1}: ${def.name}${def.timeLimit ? ', timed' : ''}${record ? ', completed' : ''}${open ? '' : ', locked'}`);
      plate.addEventListener('click', () => startCampaignLevel(def.id));
      levelGridEl.appendChild(plate);
    });
  }
  levelSelectBackBtn.addEventListener('click', () => openThemeSelect(levelSelectTheme));

  // --- Campaign play --------------------------------------------------------------

  // The "New trap" card before a level that introduces something. onStart
  // runs once the player dismisses it.
  let trapIntroOnStart = null;

  function showTrapIntro(types, theme, onStart) {
    trapIntroListEl.innerHTML = '';
    types.forEach((type) => {
      const row = document.createElement('li');
      const icon = document.createElement('div');
      icon.className = 'palette-icon trap-intro-icon';
      icon.style.backgroundImage = `url("${themeTexture(theme, textureKeyForTile(type, 0))}")`;
      const text = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = trapLabel(type, theme).replace(/ [↑→↓←]$/, '');
      const desc = document.createElement('p');
      desc.textContent = trapDescription(type);
      text.append(name, desc);
      row.append(icon, text);
      trapIntroListEl.appendChild(row);
    });
    trapIntroOnStart = onStart;
    trapIntroModal.hidden = false;
    trapIntroStartBtn.focus();
  }

  trapIntroStartBtn.addEventListener('click', () => {
    trapIntroModal.hidden = true;
    const start = trapIntroOnStart;
    trapIntroOnStart = null;
    if (start) start();
  });

  function levelNumber(id) {
    const def = levelDef(id);
    return themeLevels(def.theme).findIndex((d) => d.id === id) + 1;
  }

  function startCampaignLevel(id) {
    const def = levelDef(id);
    const level = campaignLevel(id);
    const n = levelNumber(id);
    const progress = loadProgress();

    hideAllModes();
    hideTitleScreen();
    currentCampaignId = id;
    applyTheme(def.theme);

    levelHeadingEl.textContent = `${THEME_INFO[def.theme].short} ${n} · ${def.name}${def.timeLimit ? ` · ⏱ ${def.timeLimit}s` : ''}`;
    levelHeadingEl.hidden = false;
    campaignBackBtn.hidden = false;
    winModalLevelsBtn.hidden = false;
    renderLevel(level, grid);

    const begin = () => {
      if (currentCampaignId !== id) return; // left before starting
      activeSolverStop = startSolverMode(level, {
        ...solverDom(),
        levelCode: `campaign-${id}`,
        onWin: (result) => handleCampaignWin(id, result),
      });
      // The level heading and its one-line hint replace the generic
      // instructions line, saving room above the grid.
      solverInfoEl.hidden = true;
      solverMessageEl.textContent = def.idea;
      solverMessageEl.className = 'hint';
    };

    const intro = levelIntroductions(id);
    if (intro.length && !isLevelCompleted(progress, id)) showTrapIntro(intro, def.theme, begin);
    else begin();
  }

  // Records the win and fills in the win modal's campaign extras: what just
  // unlocked, and whether there's a next level to go to.
  function handleCampaignWin(id, { moves, deaths, elapsedMs }) {
    const def = levelDef(id);
    const before = loadProgress();
    const after = recordLevelComplete(id, { moves, timeMs: elapsedMs, deaths });
    const levels = themeLevels(def.theme);
    const n = levelNumber(id);

    const notes = [];
    const nextTheme = THEMES[THEMES.indexOf(def.theme) + 1];
    if (nextTheme && !isThemeUnlocked(before, nextTheme) && isThemeUnlocked(after, nextTheme)) {
      notes.push(`🔓 ${THEME_INFO[nextTheme].name} unlocked!`);
    }
    if (completedCount(before, def.theme) < levels.length && completedCount(after, def.theme) === levels.length) {
      notes.push(`👑 Every ${THEME_INFO[def.theme].short} level complete!`);
    }
    winModalUnlockEl.textContent = notes.join(' ');
    winModalUnlockEl.hidden = notes.length === 0;
    winModalNextBtn.hidden = n >= levels.length;
  }

  winModalNextBtn.addEventListener('click', () => {
    if (!currentCampaignId) return;
    const def = levelDef(currentCampaignId);
    const levels = themeLevels(def.theme);
    const nextDef = levels[levelNumber(currentCampaignId)];
    if (nextDef) startCampaignLevel(nextDef.id);
  });

  function backToLevels() {
    const theme = currentCampaignId ? levelDef(currentCampaignId).theme : levelSelectTheme;
    openLevelSelect(theme);
  }
  campaignBackBtn.addEventListener('click', backToLevels);
  winModalLevelsBtn.addEventListener('click', backToLevels);

  // --- Creative Mode --------------------------------------------------------------

  // Callbacks passed to renderLevel's builderDnD option (see renderLevel).
  // Only drags that originate from the panel (draggedPaletteType) show
  // per-tile drop feedback and can be dropped on a tile; a tile picked up
  // for the trash (draggedFromTile) intentionally gets no feedback here and
  // can't be dropped on another tile — its only valid target is the trash
  // can (see trashCanEl's own drop handler below).
  const builderDnD = {
    dragStart(x, y, e) {
      draggedFromTile = { x, y };
      draggedPaletteType = null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'tile');
    },
    dragOver(x, y, e, tileEl) {
      if (!draggedPaletteType) return;
      e.preventDefault();
      const valid = canPlaceTileType(builderLevel, x, y, draggedPaletteType, activeTrapBudget);
      tileEl.classList.toggle('tile-drag-over-valid', valid);
      tileEl.classList.toggle('tile-drag-over-invalid', !valid);
    },
    dragLeave(tileEl) {
      tileEl.classList.remove('tile-drag-over-valid', 'tile-drag-over-invalid');
    },
    drop(x, y, e, tileEl) {
      e.preventDefault();
      tileEl.classList.remove('tile-drag-over-valid', 'tile-drag-over-invalid');
      if (draggedPaletteType && canPlaceTileType(builderLevel, x, y, draggedPaletteType, activeTrapBudget)) {
        setTileType(builderLevel, x, y, draggedPaletteType);
        renderBuilder();
      }
      resetDragState();
    },
    dragEnd() {
      resetDragState();
    },
    // Clicking a placed turret/vent/current/imp/boar/one-way rotates it
    // (see rotateTileType); every other tile ignores clicks. Refocuses the
    // same tile afterwards since renderBuilder() rebuilds the whole grid.
    click(x, y) {
      const rotated = rotateTileType(builderLevel.tiles[y * builderLevel.size + x]);
      if (!rotated) return;
      setTileType(builderLevel, x, y, rotated);
      renderBuilder();
      const tileEl = grid.children[y * builderLevel.size + x];
      if (tileEl) tileEl.focus();
    },
  };

  function renderBuilder() {
    renderLevel(builderLevel, grid, { builderDnD });

    const trapPoints = countTrapPoints(builderLevel);
    trapCounterEl.textContent = `Trap points: ${trapPoints} / ${activeTrapBudget}`;
    trapCounterEl.classList.toggle('budget-full', trapPoints >= activeTrapBudget);
  }

  // The draggable block list, grouped under headings and named/drawn for
  // the map's current look. A Daily Puzzle builder challenge shows only
  // that day's theme's traps. Rebuilt when the look changes.
  function renderBuilderPalette() {
    const theme = levelTheme(builderLevel);
    const groups = currentDailyChallenge
      ? [{ title: 'Basics', types: PALETTE_BASICS }, { title: `${THEME_INFO[theme].short} traps`, types: THEME_TRAPS[theme] }]
      : PALETTE_GROUPS;

    paletteListEl.innerHTML = '';
    groups.forEach(({ title, types }) => {
      const heading = document.createElement('h3');
      heading.className = 'palette-group-title';
      heading.textContent = title;
      paletteListEl.appendChild(heading);

      types.forEach((type) => {
        const label = trapLabel(type, theme);
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.draggable = true;
        item.setAttribute('role', 'img');
        item.title = trapDescription(type);
        const cost = trapCost(type);
        const costText = cost ? ` · ${cost} pt${cost === 1 ? '' : 's'}` : '';
        item.setAttribute('aria-label', `${label}${costText} — drag onto a tile to place`);

        const icon = document.createElement('div');
        icon.className = 'palette-icon';
        icon.style.backgroundImage = `url("${themeTexture(theme, textureKeyForTile(type, 0))}")`;

        const labelEl = document.createElement('span');
        labelEl.className = 'palette-label';
        labelEl.textContent = label;
        if (cost) {
          const costEl = document.createElement('span');
          costEl.className = 'palette-cost';
          costEl.textContent = `${cost} trap pt${cost === 1 ? '' : 's'}`;
          labelEl.appendChild(costEl);
        }

        item.append(icon, labelEl);

        item.addEventListener('dragstart', (e) => {
          draggedPaletteType = type;
          draggedFromTile = null;
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', type);
          // Drag just the icon sprite, not the whole panel row (dark
          // background + label text), as the drag ghost image.
          e.dataTransfer.setDragImage(icon, 16, 16);
        });
        item.addEventListener('dragend', resetDragState);

        paletteListEl.appendChild(item);
      });
    });
  }

  // The Lava / Ice / Grass switch at the top of the panel: changes the map's
  // look (and what shared traps are called), never which traps exist.
  function renderThemePicker() {
    creativeThemePickerEl.querySelectorAll('button').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.theme === levelTheme(builderLevel)));
    });
  }
  creativeThemePickerEl.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!builderLevel || currentDailyChallenge) return;
      creativeTheme = btn.dataset.theme;
      builderLevel.theme = creativeTheme;
      applyTheme(creativeTheme);
      renderThemePicker();
      renderBuilderPalette();
      renderBuilder();
      shareOutputEl.hidden = true;
    });
  });

  // The trash can is itself a draggable "empty" item (drag it onto a tile to
  // clear that tile, same mechanism as any other palette item) and also a
  // drop target for a tile dragged off the grid (clears that source tile).
  trashCanEl.addEventListener('dragstart', (e) => {
    draggedPaletteType = 'empty';
    draggedFromTile = null;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', 'empty');
    e.dataTransfer.setDragImage($('trash-icon'), 16, 16);
  });
  trashCanEl.addEventListener('dragend', resetDragState);
  trashCanEl.addEventListener('dragover', (e) => {
    if (!draggedFromTile) return;
    e.preventDefault();
    trashCanEl.classList.add('trash-drag-over');
  });
  trashCanEl.addEventListener('dragleave', () => trashCanEl.classList.remove('trash-drag-over'));
  trashCanEl.addEventListener('drop', (e) => {
    e.preventDefault();
    if (draggedFromTile) {
      setTileType(builderLevel, draggedFromTile.x, draggedFromTile.y, 'empty');
      renderBuilder();
    }
    resetDragState();
  });

  // Clear All is a two-step confirm done entirely in the panel (no native
  // confirm() popup): the first click swaps the button out for an explicit
  // Confirm/Cancel pair, and only the Confirm click actually clears tiles.
  function hideClearAllConfirm() {
    clearAllConfirmEl.hidden = true;
    clearAllBtn.hidden = false;
  }

  clearAllBtn.addEventListener('click', () => {
    clearAllBtn.hidden = true;
    clearAllConfirmEl.hidden = false;
  });

  clearAllCancelBtn.addEventListener('click', hideClearAllConfirm);

  clearAllConfirmBtn.addEventListener('click', () => {
    builderLevel = { ...createEmptyLevel(activeBuilderSize), theme: levelTheme(builderLevel) };
    renderBuilder();
    validateResultEl.textContent = '';
    validateResultEl.className = '';
    shareOutputEl.hidden = true;
    dailyBuilderResultEl.textContent = '';
    dailyBuilderResultEl.className = '';
    hideClearAllConfirm();
  });

  builderPanelToggleBtn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    builderPanelEl.classList.toggle('panel-closed', !panelOpen);
    builderPanelToggleBtn.textContent = panelOpen ? '✕ Close Blocks' : '☰ Blocks';
    builderPanelToggleBtn.setAttribute('aria-expanded', String(panelOpen));
  });

  // Shows the panel and grid for editing builderLevel (shared by Creative
  // Mode and the daily builder challenge).
  function showBuilderUI() {
    builderMode = true;
    controlsEl.hidden = false;
    trapCounterEl.hidden = false;
    validateBtn.hidden = false;
    builderPanelToggleBtn.hidden = false;
    builderPanelEl.hidden = false;
    panelOpen = true;
    builderPanelEl.classList.remove('panel-closed');
    builderPanelToggleBtn.textContent = '✕ Close Blocks';
    builderPanelToggleBtn.setAttribute('aria-expanded', 'true');
    applyTheme(levelTheme(builderLevel));
    renderThemePicker();
    renderBuilderPalette();
    renderBuilder();
  }

  function enterCreativeMode() {
    hideAllModes();
    hideTitleScreen();
    builderLevel = { ...createEmptyLevel(BUILDER_GRID_SIZE), theme: creativeTheme };
    builderToggleBtn.textContent = 'Exit Creative Mode';
    shareBtn.hidden = false;
    creativeThemePickerEl.hidden = false;
    showBuilderUI();
  }

  builderToggleBtn.addEventListener('click', () => {
    if (builderMode && !currentDailyChallenge) showTitleScreen();
    else enterCreativeMode();
  });

  validateBtn.addEventListener('click', () => {
    if (!builderLevel.start || !builderLevel.goal) {
      validateResultEl.textContent = 'Place both a start and a goal tile first.';
      validateResultEl.className = 'invalid';
      return;
    }

    const solvable = isSolvable(builderLevel);
    validateResultEl.textContent = solvable
      ? 'Solvable ✅ — there is a path from start to goal.'
      : 'Not solvable ❌ — no path from start to goal.';
    validateResultEl.className = solvable ? 'valid' : 'invalid';
  });

  shareBtn.addEventListener('click', () => {
    if (!builderLevel.start || !builderLevel.goal || !isSolvable(builderLevel)) {
      validateResultEl.textContent = "Fix the level so it's solvable before sharing.";
      validateResultEl.className = 'invalid';
      shareOutputEl.hidden = true;
      return;
    }

    // The theme travels with the room, so the link plays in the look it
    // was built in.
    const encoded = encodeLevel(builderLevel);
    const url = `${window.location.origin}${window.location.pathname}?level=${encoded}`;

    shareLinkInput.value = url;
    shareOutputEl.hidden = false;
    validateResultEl.textContent = 'Solvable ✅ — link ready below.';
    validateResultEl.className = 'valid';
  });

  copyShareBtn.addEventListener('click', async () => {
    shareLinkInput.select();
    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
      const original = copyShareBtn.textContent;
      copyShareBtn.textContent = 'Copied!';
      setTimeout(() => { copyShareBtn.textContent = original; }, 1500);
    } catch (e) {
      // Clipboard API unavailable/denied — the link text is selected above
      // so the player can still copy it manually.
    }
  });

  // --- Daily Puzzle: hub UI + wiring --------------------------------------

  // Refreshes the hub's date/theme/streak/stats text and each mode button's
  // completed state — called whenever the hub is (re)shown and right after
  // a challenge completes, so it's always current by the time the player
  // actually sees it.
  function renderDailyHubUI() {
    const dateStr = getTodayDateString();
    const theme = dailyThemeFor(dateStr);
    const stats = ensureTodayStats(loadDailyStats(), dateStr);
    saveDailyStats(stats); // persist a same-day rollover reset immediately

    dailyHubDateEl.textContent = dateStr;
    dailyHubThemeEl.textContent = `Today's theme: ${THEME_INFO[theme].name}` +
      (isThemeUnlocked(loadProgress(), theme) ? '' : ' — a sneak peek, it’s still locked in the campaign!');
    dailyHubStreakEl.textContent = stats.currentStreak > 0
      ? `🔥 Current streak: ${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'} (best: ${stats.bestStreak})`
      : `No active streak yet (best: ${stats.bestStreak}).`;

    dailyModeBtns.forEach((btn) => {
      const { type, difficulty } = btn.dataset;
      const done = !!stats.today.completed[type][difficulty];
      btn.classList.toggle('completed', done);
      btn.textContent = `${capitalize(difficulty)}${done ? ' ✓' : ''}`;
    });

    const { easy, medium, hard } = stats.perDifficultyCompletions;
    dailyHubStatsEl.textContent =
      `Days completed: ${stats.totalDaysCompleted} · Easy: ${easy} · Medium: ${medium} · Hard: ${hard}`;
  }

  function enterDailyHub() {
    hideAllModes();
    hideTitleScreen();
    applyTheme(dailyThemeFor(getTodayDateString()));
    controlsEl.hidden = false;
    dailyToggleBtn.textContent = 'Exit Daily Puzzle';
    grid.hidden = true;
    renderDailyHubUI();
    dailyHubEl.hidden = false;
  }

  dailyToggleBtn.addEventListener('click', () => {
    if (!dailyHubEl.hidden || currentDailyChallenge) showTitleScreen();
    else enterDailyHub();
  });

  // Launches a fresh solver-mode session for the day's fixed layout at the
  // given difficulty, with a synthetic per-day levelCode (so best scores are
  // tracked per day/difficulty) and an onWin hook that records the Daily
  // Puzzle completion.
  function startDailySolverChallenge(difficulty) {
    const dateStr = getTodayDateString();
    const level = generateDailySolverLevel(dateStr, difficulty);
    hideAllModes();
    hideTitleScreen();
    currentDailyChallenge = { type: 'solver', difficulty, dateStr };
    applyTheme(level.theme);
    dailySolverBackBtn.hidden = false;
    winModalDailyBackBtn.hidden = false;

    activeSolverStop = startSolverMode(level, {
      ...solverDom(),
      levelCode: `daily-${dateStr}-solver-${difficulty}`,
      onWin: () => {
        markDailyChallengeComplete(dateStr, 'solver', difficulty);
        renderDailyHubUI();
      },
    });
  }

  dailySolverBackBtn.addEventListener('click', enterDailyHub);
  winModalDailyBackBtn.addEventListener('click', enterDailyHub);

  // Enters a Daily Puzzle builder challenge: builds against this
  // difficulty's daily constraints (grid size, trap budget) using only the
  // day's theme's traps, with the daily submit bar in place of Share.
  // Validate stays available as-is — it only checks solvability, which is
  // equally useful here.
  function startDailyBuilderChallenge(difficulty) {
    const dateStr = getTodayDateString();
    const constraints = generateDailyBuilderConstraints(dateStr, difficulty);
    hideAllModes();
    hideTitleScreen();
    currentDailyChallenge = { type: 'builder', difficulty, dateStr, constraints };

    activeBuilderSize = constraints.size;
    activeTrapBudget = constraints.trapBudget;
    builderLevel = { ...createEmptyLevel(activeBuilderSize), theme: constraints.theme };
    builderToggleBtn.hidden = true;
    dailyToggleBtn.hidden = true;
    creativeThemePickerEl.hidden = true;

    dailyBuilderBarEl.hidden = false;
    dailyBuilderTargetEl.textContent =
      `Today's ${capitalize(difficulty)} Builder Challenge (${THEME_INFO[constraints.theme].name}): ` +
      `${constraints.size}×${constraints.size} grid, ${constraints.trapBudget} trap-point budget. ` +
      `Beat the bot: it must need at least ${constraints.minBotMoves} turns to solve your room.`;
    showBuilderUI();
  }

  dailyBuilderBackBtn.addEventListener('click', enterDailyHub);

  dailyBuilderSubmitBtn.addEventListener('click', () => {
    if (!currentDailyChallenge || currentDailyChallenge.type !== 'builder') return;
    const { difficulty, dateStr, constraints } = currentDailyChallenge;

    if (!builderLevel.start || !builderLevel.goal) {
      dailyBuilderResultEl.textContent = 'Place both a start and a goal tile first.';
      dailyBuilderResultEl.className = 'invalid';
      return;
    }

    const { solvable, moves } = solveBFS(builderLevel);
    if (!solvable) {
      dailyBuilderResultEl.textContent = "Bot couldn't find a path from start to goal — fix the room and try again.";
      dailyBuilderResultEl.className = 'invalid';
      return;
    }

    if (moves >= constraints.minBotMoves) {
      markDailyChallengeComplete(dateStr, 'builder', difficulty);
      dailyBuilderResultEl.textContent =
        `Bot solved your room in ${moves} turn${moves === 1 ? '' : 's'} — that clears the ${capitalize(difficulty)} ` +
        `bar (${constraints.minBotMoves}+)! Challenge complete. 🎉`;
      dailyBuilderResultEl.className = 'valid';
    } else {
      dailyBuilderResultEl.textContent =
        `Bot solved your room in only ${moves} turn${moves === 1 ? '' : 's'} — ${capitalize(difficulty)} needs at ` +
        `least ${constraints.minBotMoves}. Make it trickier and submit again.`;
      dailyBuilderResultEl.className = 'invalid';
    }
  });

  dailyModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const { type, difficulty } = btn.dataset;
      if (type === 'solver') startDailySolverChallenge(difficulty);
      else startDailyBuilderChallenge(difficulty);
    });
  });

  // --- Start-up: a shared link, or the title screen ----------------------------
  //
  // A valid `?level=` link skips the title screen and drops straight into
  // solving it, in the look it was built in, with every trap working
  // whatever the player has unlocked. It never counts toward campaign
  // progress (it has no campaign id). A malformed link falls back to the
  // title screen with a note.

  // Cloud saves (account.js) call this after downloading progress, so
  // whichever screen is up reflects it right away.
  refreshProgressViews = () => {
    renderTitleStreakSign();
    if (!themeSelectEl.hidden) renderThemeSelect();
    if (!levelSelectEl.hidden) renderLevelSelect();
    if (!dailyHubEl.hidden) renderDailyHubUI();
  };

  hideAllModes();
  grid.hidden = true;
  renderTitleStreakSign();

  const sharedParam = new URLSearchParams(window.location.search).get('level');
  if (sharedParam) {
    let sharedLevel = null;
    try {
      sharedLevel = decodeLevel(sharedParam);
      if (!isValidLevel(sharedLevel)) sharedLevel = null;
    } catch (e) {
      sharedLevel = null;
    }
    if (sharedLevel) {
      hideTitleScreen();
      applyTheme(levelTheme(sharedLevel));
      activeSolverStop = startSolverMode(sharedLevel, { ...solverDom(), levelCode: sharedParam });
    } else {
      $('title-link-error').hidden = false;
    }
  }
});
