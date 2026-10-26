'use strict';

// --- Themes ------------------------------------------------------------
//
// A theme is a look (tile art, background, player colors — see
// THEME_TILE_TEXTURES in sprites.js) plus the traps its campaign levels
// use. Trap *rules* never depend on the theme: a level's `theme` field only
// picks how it's drawn and what shared traps are called. A level with no
// `theme` (every shared link made before themes existed) is lava.

// The castle is the bonus world: it comes last, and opens only once every
// level of the other three is beaten (see isThemeUnlocked in levels.js).
const THEMES = ['lava', 'ice', 'grass', 'castle'];
const BONUS_THEMES = ['castle'];
// The worlds of the regular chain (each unlocks the next).
const MAIN_THEMES = THEMES.filter((t) => !BONUS_THEMES.includes(t));

const THEME_INFO = {
  lava: { name: 'Volcanic Depths', short: 'Lava' },
  ice: { name: 'Frozen Caverns', short: 'Ice' },
  grass: { name: 'Overgrown Ruins', short: 'Grass' },
  castle: { name: 'Abandoned Castle', short: 'Castle' },
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
    'portal-a', 'portal-b', 'ice', 'current-right', 'turret-right', 'vent-right', 'imp-h', 'bomb', 'lever',
  ],
  ice: [
    'spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left',
    'portal-a', 'portal-b', 'ice', 'turret-right', 'thinice', 'frost', 'icicle', 'lever',
  ],
  grass: [
    'spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left',
    'portal-a', 'portal-b', 'current-right', 'vines', 'mushroom', 'snapjaw', 'boar-h', 'lever',
  ],
  castle: [
    'spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left',
    'portal-a', 'portal-b', 'turret-right', 'bomb', 'thinice', 'lever', 'crusher', 'plate', 'gate', 'ghost',
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
    types: ['spike', 'timedspike', 'hiddenspike', 'oneway-up', 'oneway-right', 'oneway-down', 'oneway-left', 'portal-a', 'portal-b', 'lever'],
  },
  { title: 'Lava', types: ['bomb', 'turret-right', 'vent-right', 'imp-h', 'ice', 'current-right'] },
  { title: 'Ice', types: ['thinice', 'frost', 'icicle'] },
  { title: 'Grass', types: ['vines', 'mushroom', 'snapjaw', 'boar-h'] },
  { title: 'Castle', types: ['crusher', 'plate', 'gate', 'ghost'] },
];
const BUILDER_PALETTE_TYPES = PALETTE_GROUPS.flatMap((group) => group.types);

// A trap's display name. Shared traps are named per theme (a spike is an
// "Icicle Spike" in an ice room); everything else has one name. A theme
// missing from a per-theme entry uses the lava name.
const TRAP_NAMES = {
  wall: 'Wall',
  start: 'Start',
  goal: 'Goal',
  spike: { lava: 'Spike', ice: 'Icicle Spike', grass: 'Thorn Spike', castle: 'Iron Spikes' },
  timedspike: { lava: 'Timed Spike', ice: 'Frost Spike', grass: 'Snapping Thorns', castle: 'Spiked Floor' },
  hiddenspike: { lava: 'Hidden Spike', ice: 'Buried Spike', grass: 'Covered Pit', castle: 'Trapdoor' },
  oneway: { lava: 'One-Way', ice: 'Frosted One-Way', grass: 'Vine One-Way', castle: 'Carved Arrow' },
  'portal-a': { lava: 'Portal (Orange)', ice: 'Aurora Portal (Cyan)', grass: 'Fairy Ring (Gold)', castle: 'Magic Mirror (Silver)' },
  'portal-b': { lava: 'Portal (Violet)', ice: 'Aurora Portal (Pink)', grass: 'Fairy Ring (Blue)', castle: 'Magic Mirror (Violet)' },
  ice: { lava: 'Obsidian Ice', ice: 'Slick Ice', grass: 'Obsidian Ice' },
  turret: { lava: 'Lava Turret', ice: 'Frost Cannon', grass: 'Lava Turret', castle: 'Crossbow' },
  current: { lava: 'Lava Current', ice: 'Lava Current', grass: 'Stream' },
  bomb: { lava: 'Bomb', castle: 'Powder Barrel' },
  vent: 'Flame Vent',
  imp: 'Fire Imp',
  thinice: { lava: 'Thin Ice', castle: 'Rotten Floorboards' },
  frost: 'Frostbite Patch',
  icicle: 'Falling Icicle',
  vines: 'Grabbing Vines',
  mushroom: 'Mushroom Pad',
  snapjaw: 'Snapjaw',
  boar: 'Wild Boar',
  lever: { lava: 'Lever', castle: 'Castle Lever' },
  crusher: 'Crusher',
  plate: 'Pressure Plate',
  gate: 'Portcullis',
  ghost: 'Ghost',
};

const ONEWAY_ARROWS = { up: '↑', right: '→', down: '↓', left: '←' };

function trapLabel(type, theme = 'lava') {
  const entry = TRAP_NAMES[type] || TRAP_NAMES[tileFamily(type)];
  if (!entry) return type;
  const name = typeof entry === 'string' ? entry : entry[normalizeTheme(theme)] || entry.lava;
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
  lever: 'Step on it to flip it on — step on it again and it flips back off. The exit stays locked until every lever is on.',
  crusher: 'A stone block on a 6-beat cycle: up for 3 beats (it shakes on the third), slams down on the 4th — deadly — then stays down, solid, for 2.',
  plate: 'Every time you step on a plate, every portcullis in the room flips: open ones shut, shut ones open.',
  gate: 'Iron bars, shut until a pressure plate opens them. Shots and blasts pass straight through.',
  ghost: "Drifts one tile toward you every other beat — straight through walls. It can't enter the start or the gem. One touch and you're back at the start.",
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
// Plates and portcullises are free, like levers: they reshape the room
// but never hurt on their own.
const TRAP_COSTS = {
  spike: 1, timedspike: 1, hiddenspike: 1, vent: 1,
  thinice: 1, frost: 1, vines: 1, crusher: 1,
  bomb: 2, turret: 2, imp: 2, icicle: 2, snapjaw: 2, boar: 2, ghost: 2,
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
// and every bomb, icicle, thin-ice tile and lever carries its own state
// that multiplies the solver's search space (see solveBFS). Levers are
// free (they never hurt), so the cap is all that limits them.
const MAX_PORTALS_PER_COLOR = 2;
const MAX_BOMBS = 4;
const MAX_ICICLES = 4;
const MAX_THIN_ICE = 16;
const MAX_LEVERS = 4;
// The ghost's position is part of the solver's state, so one per room.
const MAX_GHOSTS = 1;
const TYPE_CAPS = { bomb: MAX_BOMBS, icicle: MAX_ICICLES, thinice: MAX_THIN_ICE, lever: MAX_LEVERS, ghost: MAX_GHOSTS };

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
// Lever: flips every time the player moves onto it. The exit is locked
// (solid, like a wall) while any lever in the room is off.
const LEVER_OFF = 0;
const LEVER_ON = 1;

// Crusher: a CRUSHER_PERIOD-tick cycle — up for 3 ticks (walkable; it
// shakes on the third as a warning), slams on the 4th (deadly on its tile),
// then stays down, solid, for 2. Hazards pass it at every phase.
const CRUSHER_PERIOD = 6;
function crusherPhase(turn) {
  return mod(turn, CRUSHER_PERIOD);
}
function isCrusherWarningAtTurn(turn) {
  return crusherPhase(turn) === 2;
}
function isCrusherSlammingAtTurn(turn) {
  return crusherPhase(turn) === 3;
}
function isCrusherDownAtTurn(turn) {
  return crusherPhase(turn) >= 4;
}

// Pressure plates and portcullises: one bit for the whole room. Every
// plate press flips every portcullis; they all start shut (solid).
const GATES_CLOSED = 0;
const GATES_OPEN = 1;

// Ghost: every GHOST_PERIOD ticks it drifts one tile toward the player,
// straight through walls (see ghostStep). At most one per room.
const GHOST_PERIOD = 2;

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
// falling icicles, levers — are "objects": each gets a slot in one flat
// array of small integers (bombs first, then thin ice, then icicles, then
// levers), passed around as `states`. Being a plain array of single digits is what lets solveBFS
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
  // hanging icicle, a crusher or a portcullis (they couldn't react to one
  // falling, slamming or shutting).
  const patrolPassable = (x, y) => hazardPassable(x, y) && !['icicle', 'crusher', 'gate'].includes(tiles[y * size + x]);

  // Pass 1: object slots, so line-of-fire precomputation below can refer to
  // the icicles along the way.
  const bombs = [];
  const thinIce = [];
  const icicles = [];
  const levers = [];
  tiles.forEach((type, i) => {
    if (type === 'bomb') bombs.push({ idx: i });
    else if (type === 'thinice') thinIce.push({ idx: i });
    else if (type === 'icicle') icicles.push({ idx: i });
    else if (type === 'lever') levers.push({ idx: i });
  });
  const slotAt = new Map();
  const bombIndexAt = new Map();
  [...bombs, ...thinIce, ...icicles, ...levers].forEach((obj, slot) => {
    obj.slot = slot;
    slotAt.set(obj.idx, slot);
  });
  bombs.forEach((bomb) => bombIndexAt.set(bomb.idx, bomb.slot));
  // Two more slots after the per-tile objects: the room's portcullis bit
  // (if it has plates or portcullises) and the ghost's tile (if it has one).
  let objectCount = bombs.length + thinIce.length + icicles.length + levers.length;
  const gateSlot = tiles.some((t) => t === 'plate' || t === 'gate') ? objectCount++ : -1;
  const ghostSpawn = tiles.indexOf('ghost');
  const ghost = ghostSpawn >= 0 ? { slot: objectCount++, spawn: ghostSpawn } : null;

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
  // tile idx -> [{ d, blockers, from }, one per turret reaching it]; `from`
  // is the tile the shot was on the tick before (the turret itself at d=1),
  // for animating it.
  const fireballDistances = new Map();
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
        fireballDistances.get(idx).push({ d, blockers, from: idx - (dy * size + dx) });
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
  if (tiles.includes('crusher')) periods.push(CRUSHER_PERIOD);
  if (ghost) periods.push(GHOST_PERIOD);

  return {
    size, tiles, flameCells, fireballDistances, imps, boars, biteCells,
    bombs, thinIce, icicles, levers, slotAt, bombIndexAt, portalPartner,
    gateSlot, ghost, objectCount,
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

// Every object starts in state 0 — bombs armed, thin ice intact, icicles
// hanging, levers off, portcullises shut — except the ghost, which starts
// on its spawn tile.
function initialObjectStates(ctx) {
  const states = new Array(ctx.objectCount).fill(0);
  if (ctx.ghost) states[ctx.ghost.slot] = ctx.ghost.spawn;
  return states;
}

// Where the ghost goes next, from tile `from` toward tile `target`: one
// step along whichever axis is farther off (horizontal on a tie), or along
// the other if that step would enter the start or the goal — the safe
// zones it never enters. Walls don't stop it. Stays put if both are
// barred, or if it's already there.
function ghostStep(ctx, from, target) {
  const { size, tiles } = ctx;
  const fx = from % size;
  const fy = Math.floor(from / size);
  const ox = (target % size) - fx;
  const oy = Math.floor(target / size) - fy;
  const steps = Math.abs(ox) >= Math.abs(oy)
    ? [[Math.sign(ox), 0], [0, Math.sign(oy)]]
    : [[0, Math.sign(oy)], [Math.sign(ox), 0]];
  for (const [dx, dy] of steps) {
    if (!dx && !dy) continue;
    const idx = (fy + dy) * size + (fx + dx);
    if (tiles[idx] !== 'start' && tiles[idx] !== 'goal') return idx;
  }
  return from;
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

// Advances every object into tick `tick` (returns a new array): burning
// fuses tick down and explode at zero, last tick's explosions burn out, any
// bomb caught in a new blast is set to go off next tick, shaking icicles
// count down, crash, and settle, and — on every GHOST_PERIOD-th tick — the
// ghost drifts toward the player on tile `playerIdx`. Thin ice, levers and
// portcullises only change when the player moves (see applyMoveToObjects).
function advanceObjects(ctx, states, playerIdx, tick) {
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
  if (ctx.ghost && playerIdx !== undefined && mod(tick, GHOST_PERIOD) === 0) {
    next[ctx.ghost.slot] = ghostStep(ctx, states[ctx.ghost.slot], playerIdx);
  }
  return next;
}

// What a move (see resolveMove) does to the room's objects: bombs it
// stepped on start their fuses, icicles it passed under start shaking, thin
// ice it left behind breaks, every lever it entered flips (twice if it
// entered one twice), and every plate it pressed flips the portcullises.
// Returns a new array.
function applyMoveToObjects(states, move) {
  const { litBombs, litIcicles, brokenIce, flippedLevers, pressedPlates } = move;
  if (!litBombs.length && !litIcicles.length && !brokenIce.length && !flippedLevers.length && !pressedPlates.length) {
    return states;
  }
  const next = states.slice();
  litBombs.forEach((slot) => { next[slot] = BOMB_FUSE_TICKS; });
  litIcicles.forEach((slot) => { next[slot] = ICICLE_DROP_TICKS; });
  brokenIce.forEach((slot) => { next[slot] = THIN_ICE_BROKEN; });
  flippedLevers.forEach((slot) => { next[slot] = next[slot] === LEVER_ON ? LEVER_OFF : LEVER_ON; });
  pressedPlates.forEach((slot) => { next[slot] = next[slot] === GATES_OPEN ? GATES_CLOSED : GATES_OPEN; });
  return next;
}

// Whether the room's portcullises are open right now.
function gatesOpen(ctx, states) {
  return ctx.gateSlot >= 0 && !!states && states[ctx.gateSlot] === GATES_OPEN;
}

// Whether the exit is locked: the room has levers and at least one is off.
function isExitLocked(ctx, states) {
  return ctx.levers.length > 0 && ctx.levers.some(({ slot }) => states[slot] !== LEVER_ON);
}

// How many of the room's levers are on.
function leversOn(ctx, states) {
  return ctx.levers.filter(({ slot }) => states[slot] === LEVER_ON).length;
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
  if (type === 'crusher' && isCrusherSlammingAtTurn(tick)) return 'crusher';
  if (ctx.ghost && states && states[ctx.ghost.slot] === idx) return 'ghost';
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
// has fallen; the exit while it's locked; a portcullis while shut; a
// crusher while it's down (only known given the tick — without one, a
// crusher counts as up).
function isSolidAt(ctx, idx, states, tick) {
  const type = ctx.tiles[idx];
  return isSolidTile(type)
    || (type === 'icicle' && objectState(ctx, idx, states) === ICICLE_FALLEN)
    || (type === 'goal' && isExitLocked(ctx, states))
    || (type === 'gate' && !gatesOpen(ctx, states))
    || (type === 'crusher' && tick !== undefined && isCrusherDownAtTurn(tick));
}

// Whether a single step in direction (dx, dy) may land on (x, y) at all
// during `tick`, ignoring danger: bounds, solid tiles, and one-way
// direction.
function canStepOnto(ctx, x, y, dx, dy, states, tick) {
  if (x < 0 || x >= ctx.size || y < 0 || y >= ctx.size) return false;
  const idx = y * ctx.size + x;
  return !isSolidAt(ctx, idx, states, tick) && isOnewayPassable(ctx.tiles[idx], dx, dy);
}

// Which way a player on the ice tile (x, y), sliding in direction
// (dx, dy), keeps going: straight ahead if that's open, otherwise they
// glance off whatever's in the way onto the next tile to the side — down
// then up when sliding horizontally, right then left when sliding
// vertically. null if all three are blocked (the slide stops here).
function iceSlideDirection(ctx, x, y, dx, dy, states, tick) {
  const sideways = dy === 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
  const options = [[dx, dy], ...sideways];
  return options.find(([ox, oy]) => canStepOnto(ctx, x + ox, y + oy, ox, oy, states, tick)) || null;
}

// Plays out one player move starting at (x, y) during the given tick,
// including everything the tile underfoot does next — ice keeps you sliding
// the same way, glancing sideways off anything in the way (see
// iceSlideDirection) until you leave the ice, a current shoves you one tile
// its way, a mushroom bounces you two tiles on, a portal drops you on its
// partner, vines grab you and stop you dead. Every tile passed through is
// checked for danger at this same tick.
//
// Every lever entered flips on the spot, so a move that flips the last
// lever can carry on straight through the exit it just unlocked.
//
// Returns null if the very first step is blocked (a no-op, not a move).
// Otherwise { path, final, death, won, grabbed, litBombs, litIcicles,
// brokenIce, flippedLevers, hops, teleported }: path is every tile index
// entered in order, final is where the player ends up, death is { label,
// idx } if something killed them on the way, grabbed is true if vines
// caught them. litBombs/litIcicles/brokenIce/flippedLevers list the object
// slots this move affects (see applyMoveToObjects), and hops lists the
// positions in path reached by a mushroom bounce rather than a step (for
// animation).
function resolveMove(ctx, x, y, dx, dy, tick, states) {
  if (!canStepOnto(ctx, x + dx, y + dy, dx, dy, states, tick)) return null;

  const { size, tiles } = ctx;
  const path = [];
  const litBombs = [];
  const litIcicles = [];
  const brokenIce = [];
  const flippedLevers = [];
  const pressedPlates = [];
  const hops = [];
  // The room as the move sees it so far: `states` plus any levers flipped
  // or plates pressed along the way (the only changes that matter mid-move
  // — they can unlock or relock the exit, and open or shut portcullises).
  let live = states;
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
    litBombs, litIcicles, brokenIce, flippedLevers, pressedPlates, hops, teleported, ...extra,
  });

  for (;;) {
    const i = cy * size + cx;
    path.push(i);
    const type = tiles[i];
    const brokeThisMove = type === 'thinice' && brokenIce.includes(ctx.slotAt.get(i));
    const label = hazardAt(ctx, i, tick, live) || (brokeThisMove ? 'thin ice' : null);
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
    if (type === 'lever') {
      const slot = ctx.slotAt.get(i);
      flippedLevers.push(slot);
      live = live.slice();
      live[slot] = live[slot] === LEVER_ON ? LEVER_OFF : LEVER_ON;
    }
    if (type === 'plate') {
      pressedPlates.push(ctx.gateSlot);
      live = live.slice();
      live[ctx.gateSlot] = live[ctx.gateSlot] === GATES_OPEN ? GATES_CLOSED : GATES_OPEN;
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
      const partnerLabel = hazardAt(ctx, partner, tick, live);
      if (partnerLabel) return result(partner, { death: { label: partnerLabel, idx: partner } });
      return result(partner);
    }

    if (type === 'mushroom') {
      // Bounce over the next tile (anything but a solid one) onto the one
      // after it, if you could step onto that one moving this way.
      const [mx, my] = [cx + mdx, cy + mdy];
      const [lx, ly] = [cx + mdx * MUSHROOM_HOP, cy + mdy * MUSHROOM_HOP];
      const midOpen = mx >= 0 && mx < size && my >= 0 && my < size && !isSolidAt(ctx, my * size + mx, live, tick);
      if (!midOpen || !canStepOnto(ctx, lx, ly, mdx, mdy, live, tick)) return result(i);
      hops.push(path.length);
      cx = lx;
      cy = ly;
      continue;
    }

    let push = null;
    if (type === 'ice') push = iceSlideDirection(ctx, cx, cy, mdx, mdy, live, tick);
    else if (tileFamily(type) === 'current') push = tileDirection(type);
    if (!push || !canStepOnto(ctx, cx + push[0], cy + push[1], push[0], push[1], live, tick)) return result(i);

    leave(i);
    [mdx, mdy] = push;
    cx += mdx;
    cy += mdy;
  }
}

// How a move plays out over time, for animating it: `stops` lists every
// tile the player passes through (starting with fromIdx) and when they
// arrive there, in ms. A plain one-tile step is a walk and takes
// WALK_STEP_MS; every tile of a multi-tile move (ice slide, current push,
// mushroom bounce, portal warp) takes SLIDE_MS_PER_TILE. A stop reached by
// portal is marked `warp` (it gets a vanish/reappear instead of a glide,
// and takes twice as long); one reached by a mushroom bounce (`hops` holds
// its position in path) is marked `hop` (an arc over the tile in between).
// `durationMs` is the whole move. Pure, so solver mode (input lock,
// deferred death/win) and renderLevel (the animation itself) agree on the
// timing.
const WALK_STEP_MS = 150;
const SLIDE_MS_PER_TILE = 85;

function slideTimeline(size, fromIdx, path, hops = []) {
  if (path.length === 1 && !hops.length) {
    return { stops: [{ idx: fromIdx, t: 0, warp: false, hop: false }, { idx: path[0], t: WALK_STEP_MS, warp: false, hop: false }], durationMs: WALK_STEP_MS, walk: true };
  }
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
  return { stops, durationMs: t, walk: false };
}

// BFS reachability check from start to goal, returning both whether the
// level is solvable and — since BFS explores in turn order — the length of
// the *shortest* solution in turns (parMoves, below, counts moves instead). Standalone and DOM-free so it can be
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
  return searchLevel(level, false);
}

// The fewest *moves* (waits are free) that beat the level, or null if it
// can't be beaten — par for star ratings (see starsFor). Same search as
// solveBFS, but a wait costs nothing, so it can differ from solveBFS's
// turn count when the quickest route in time isn't the one with the fewest
// steps.
function parMoves(level) {
  return searchLevel(level, true).moves;
}

// The search behind solveBFS and parMoves: a breadth-first search in layers
// of cost, where a move always costs 1 and a wait costs 1 (turns) or 0
// (freeWaits — moves only). Zero-cost edges stay in the current layer, so
// the first win found is always the cheapest.
function searchLevel(level, freeWaits) {
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
  // Object states are single digits, except the ghost's tile — so a room
  // with a ghost needs separators in its keys.
  const joiner = ctx.ghost ? ',' : '';
  const keyOf = (idx, turn, states, held) => {
    let key = String(idx * timeSlots + (cycle ? turn % cycle : turn));
    if (hasObjects) key += `:${states.join(joiner)}`;
    if (held) key += `h${held}`;
    return key;
  };

  const startIdx = sy * size + sx;
  const startStates = initialObjectStates(ctx);
  const visited = new Set([keyOf(startIdx, 0, startStates, 0)]);
  // Entries are [tile idx, turn (the hazard tick), object states, vine hold
  // left]. `layer` holds every state reachable at cost `cost`.
  let layer = [[startIdx, 0, startStates, 0]];

  for (let cost = 0; layer.length; cost++) {
    const next = [];
    const nextKeys = new Set();
    for (let head = 0; head < layer.length; head++) {
      const [idx, turn, states, held] = layer[head];
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
          if (move.won) return { solvable: true, moves: cost + 1 };
          final = move.final;
          nextHeld = move.grabbed ? VINE_HOLD_TICKS : 0;
          if (hasObjects) nextStates = applyMoveToObjects(states, move);
        }

        if (hasObjects) nextStates = advanceObjects(ctx, nextStates, final, turn + 1);
        if (hazardAt(ctx, final, turn + 1, nextStates)) continue;

        const entry = [final, turn + 1, nextStates, nextHeld];
        const key = keyOf(final, turn + 1, nextStates, nextHeld);
        if (visited.has(key)) continue;
        if (waiting && freeWaits) {
          visited.add(key);
          layer.push(entry);
        } else if (!nextKeys.has(key)) {
          nextKeys.add(key);
          next.push([key, entry]);
        }
      }
    }
    // A state queued for the next layer may have been reached for free
    // later in this one; only the ones still unvisited carry on.
    layer = [];
    next.forEach(([key, entry]) => {
      if (visited.has(key)) return;
      visited.add(key);
      layer.push(entry);
    });
  }

  return { solvable: false, moves: null };
}

// Star rating for beating a level in `moves` against its par: 3 for par or
// better, 2 for up to 50% over, 1 for finishing at all. null without a par.
function starsFor(moves, par) {
  if (!par) return null;
  if (moves <= par) return 3;
  if (moves <= Math.floor(par * 1.5)) return 2;
  return 1;
}

// A rating as three stars, filled or hollow: '★★☆'.
function starText(stars) {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

// Timed rooms. The fastest run takes the bot's turns at one hazard tick
// each. The tightest limit Creative Mode accepts is the campaign's hardest
// rule (the castle's: 1.5x that plus 3 seconds), so a player's timed room is
// never tighter than any in the game. Both are null for an unsolvable room.
function fastestRunSeconds(level) {
  const { moves } = solveBFS(level);
  return moves === null ? null : (moves * HAZARD_TICK_MS) / 1000;
}

function minFairTimeLimit(level) {
  const fastest = fastestRunSeconds(level);
  return fastest === null ? null : Math.ceil(fastest * 1.5 + 3);
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
  // Castle days are rare (see dailyThemeFor), and a notch harder than the
  // other worlds at each difficulty — the castle is the bonus world.
  castle: {
    easy: {
      size: 7, wallDensity: 0.10, trapDensity: 0.05, onewayDensity: 0, iceDensity: 0, currentDensity: 0,
      thinIceDensity: 0.06, crusherDensity: 0.06,
      timedSpikeShare: 0.3, hiddenSpikeShare: 0,
      extras: { turret: 1, plate: 1, gate: 2 },
    },
    medium: {
      size: 8, wallDensity: 0.12, trapDensity: 0.06, onewayDensity: 0.03, iceDensity: 0, currentDensity: 0,
      thinIceDensity: 0.06, crusherDensity: 0.06,
      timedSpikeShare: 0.4, hiddenSpikeShare: 0.15,
      extras: { turret: 1, bomb: 1, plate: 1, gate: 3 },
    },
    hard: {
      size: 10, wallDensity: 0.13, trapDensity: 0.07, onewayDensity: 0.04, iceDensity: 0, currentDensity: 0,
      thinIceDensity: 0.05, crusherDensity: 0.05,
      timedSpikeShare: 0.5, hiddenSpikeShare: 0.2,
      extras: { turret: 2, bomb: 1, plate: 2, gate: 4, ghost: 1, portalPairs: 1 },
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
    thinIceDensity = 0, frostDensity = 0, vinesDensity = 0, mushroomDensity = 0, crusherDensity = 0,
    timedSpikeShare, hiddenSpikeShare,
  } = params;
  const extras = {
    bomb: 0, turret: 0, vent: 0, imp: 0, portalPairs: 0, icicle: 0, snapjaw: 0, boar: 0, plate: 0, gate: 0, ghost: 0,
    ...params.extras,
  };
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
      } else if ((roll -= crusherDensity) < 0) {
        setTileType(level, x, y, 'crusher');
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
  place(extras.plate, () => 'plate');
  place(extras.gate, () => 'gate');
  place(extras.ghost, () => 'ghost');

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
// Castle days are rare: on roughly DAILY_CASTLE_CHANCE of dates (picked by
// hashing the date, so everyone gets the same ones) the castle takes over;
// every other date keeps the lava/ice/grass rotation it always had.
const DAILY_CASTLE_CHANCE = 1 / 7;

function dailyThemeFor(dateStr) {
  if (mulberry32(hashStringToSeed(`trap-room-daily-castle:${dateStr}`))() < DAILY_CASTLE_CHANCE) return 'castle';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNumber = Math.round(Date.UTC(y, m - 1, d) / 86400000);
  return MAIN_THEMES[mod(dayNumber, MAIN_THEMES.length)];
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
    if (isSolvable(level)) return { ...addDailyLevers(level, dateStr, difficulty), theme };
  }
  return { ...buildFallbackSolverLevel(params.size), theme };
}

// Some days' solver rooms also get levers: DAILY_LEVER_CHANCE of days, per
// difficulty, with DAILY_LEVER_COUNTS[difficulty] of them. Rolled from a
// seed of its own, after the room itself is settled, so a day without
// levers is exactly the room it always was.
const DAILY_LEVER_CHANCE = 0.4;
const DAILY_LEVER_COUNTS = { easy: 1, medium: 2, hard: 3 };

// Drops the day's levers onto open floor (never right next to the start),
// trying a handful of spots until the room is still solvable with every
// lever to flip; gives up and returns the room unchanged if none work.
function addDailyLevers(level, dateStr, difficulty) {
  const rng = mulberry32(dailySeedFor(dateStr, 'levers', difficulty));
  if (rng() >= DAILY_LEVER_CHANCE) return level;
  const { size } = level;
  const [sx, sy] = level.start;
  const openCells = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const nearStart = Math.abs(x - sx) + Math.abs(y - sy) <= 1;
      if (!nearStart && level.tiles[y * size + x] === 'empty') openCells.push([x, y]);
    }
  }
  const count = Math.min(DAILY_LEVER_COUNTS[difficulty], MAX_LEVERS);
  if (openCells.length < count) return level;
  for (let attempt = 0; attempt < 12; attempt++) {
    const withLevers = { ...level, tiles: level.tiles.slice() };
    seededShuffle(rng, openCells).slice(0, count).forEach(([x, y]) => {
      withLevers.tiles[y * size + x] = 'lever';
    });
    if (isSolvable(withLevers)) return withLevers;
  }
  return level;
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
// and breaks behind you, icicles shake and fall, levers show which way
// they're thrown, the exit is barred while any lever is off, hidden spikes pass for
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
  if (tileType === 'goal') return isExitLocked(world.ctx, world.states) ? 'goal-locked' : 'goal';
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
  if (tileType === 'lever') return state === LEVER_ON ? 'lever-on' : 'lever';
  if (tileType === 'crusher') return isCrusherSlammingAtTurn(turn) || isCrusherDownAtTurn(turn) ? 'crusher-down' : 'crusher';
  if (tileType === 'gate') return gatesOpen(world.ctx, world.states) ? 'gate-open' : 'gate';
  if (tileType === 'ghost') return 'empty';
  return tileType;
}

// How the player looks on each kind of ground (keyed by tileFamily) — the
// one place to add or change a terrain animation. What the ground *does*
// to movement (ice slides you, currents shove you, ...) lives in
// resolveMove; this only decides how it looks.
//   travel — the pose held while a move carries the player across that
//            ground (anim-<travel>; see injectSpriteStyles in sprites.js).
//            The first tile on a move's path with a travel pose picks it;
//            a move with none is a plain walk.
//   stance — an extra motion layered over whatever pose is playing while
//            the player stands on that ground (terrain-<stance> in
//            style.css).
const TERRAIN_ANIMATIONS = {
  ice: { travel: 'slip' },       // sliding floor: feet out, arms flailing
  current: { travel: 'shove' },  // shoved along, stumbling forward
  mushroom: { travel: 'bounce' }, // flung up, arms high
  portal: { travel: 'warp' },    // spun through
  thinice: { stance: 'wobble' }, // gives way once you step off: teetering
  icicle: { stance: 'wobble' },  // about to fall on you (only while shaking)
  frost: { stance: 'shiver' },   // freezing: don't stay
};

// The pose for a whole move (see resolveMove): 'walk' unless some tile on
// its path carries the player along.
function travelPoseFor(tiles, move) {
  for (const idx of move.path) {
    const entry = TERRAIN_ANIMATIONS[tileFamily(tiles[idx])];
    if (entry && entry.travel) return entry.travel;
  }
  return 'walk';
}

// The stance for a player standing on tile idx right now, or null. Falling
// ground only makes you unsteady while it's actually about to go: intact
// thin ice, an icicle that's shaking.
function terrainStanceAt(ctx, idx, states) {
  const type = ctx.tiles[idx];
  const entry = TERRAIN_ANIMATIONS[tileFamily(type)];
  if (!entry || !entry.stance) return null;
  const state = objectState(ctx, idx, states);
  if (type === 'thinice' && state !== THIN_ICE_INTACT) return null;
  if (type === 'icicle' && !(state >= 1 && state <= ICICLE_DROP_TICKS)) return null;
  return entry.stance;
}

// Moving/transient hazards drawn on top of tiles during play, as
// idx -> [{ kind, from }, ...]. A kind is a HAZARD_TEXTURES key, optionally
// with a '-flip' suffix (a boar charging left); 'dust' (the tile a boar
// just charged across) has no texture of its own, only CSS. `from` lists
// the tiles a moving hazard (imp, boar, fireball) crossed to get here this
// tick, oldest first, so renderLevel can glide it in instead of popping it
// into place; empty for anything that didn't move.
// `ghostFrom`, if given, is the tile the ghost last drifted from (solver
// mode tracks it), so it glides between tiles too.
function hazardOverlaysFor(ctx, tick, states, ghostFrom) {
  const overlays = new Map();
  const add = (idx, kind, from = []) => {
    if (!overlays.has(idx)) overlays.set(idx, []);
    overlays.get(idx).push({ kind, from: from.filter((i, k) => i !== idx && i !== from[k - 1]) });
  };
  ctx.flameCells.forEach((_, idx) => {
    if (isFlameAt(ctx, idx, tick, states)) add(idx, 'flame');
  });
  ctx.fireballDistances.forEach((shots, idx) => {
    if (!isFireballAt(ctx, idx, tick, states)) return;
    const shot = shots.find(({ d, blockers }) => mod(tick - d, TURRET_PERIOD) === 0 && !lineBlocked(blockers, states));
    add(idx, 'fireball', [shot.from]);
  });
  ctx.imps.forEach((imp) => add(impPositionAt(imp, tick), 'imp', [impPositionAt(imp, tick - 1)]));
  ctx.boars.forEach((boar) => {
    const [at, ...crossed] = boarCellsAt(boar, tick);
    const from = crossed[crossed.length - 1];
    const headingLeft = at % ctx.size < from % ctx.size;
    crossed.forEach((idx) => { if (idx !== at) add(idx, 'dust'); });
    const trail = [];
    for (let k = BOAR_SPEED; k >= 1; k--) trail.push(patrolPositionAt(boar, BOAR_SPEED * tick - k));
    add(at, headingLeft ? 'boar-flip' : 'boar', trail);
  });
  if (isSnapjawBitingAtTurn(tick)) ctx.biteCells.forEach((idx) => add(idx, 'bite'));
  ctx.icicles.forEach(({ idx, slot }) => {
    if (states[slot] === ICICLE_CRASHING) add(idx, 'icicle-crash');
  });
  if (isCrusherSlammingAtTurn(tick)) {
    ctx.tiles.forEach((type, idx) => { if (type === 'crusher') add(idx, 'crush'); });
  }
  blastCellsFor(ctx, states).forEach((idx) => add(idx, 'blast'));
  if (ctx.ghost) {
    const at = states[ctx.ghost.slot];
    add(at, 'ghost', ghostFrom === undefined ? [] : [ghostFrom]);
  }
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

// How long a moving hazard (imp, boar, fireball) takes to glide into the
// tile it moved to at the start of a tick. Kept short: the game already
// counts it as there, so it mustn't visibly lag behind what can kill you.
const MOVER_GLIDE_MS = 180;

// Glides an overlay element (sitting on tile finalIdx) in from `from` (the
// tiles it crossed, oldest first; see hazardOverlaysFor), resuming
// elapsedMs into the glide. Evenly spaced, so a boar crossing two tiles in
// one glide simply moves twice as fast.
function glideOverlay(el, size, from, finalIdx, elapsedMs, gapPx) {
  const cells = [...from, finalIdx];
  const step = MOVER_GLIDE_MS / (cells.length - 1);
  const timeline = {
    stops: cells.map((idx, k) => ({ idx, t: k * step, warp: false, hop: false })),
    durationMs: MOVER_GLIDE_MS,
  };
  const animation = el.animate(slideKeyframes(size, timeline, finalIdx, gapPx), {
    duration: MOVER_GLIDE_MS, easing: 'ease-out', fill: 'both',
  });
  animation.currentTime = elapsedMs;
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
// 'idle'|'walk'|'hit'|'win'|'held'|<a TERRAIN_ANIMATIONS travel pose>,
// stance, elapsedMs }) picks which pixel-art pose/animation plays, and
// stance (see terrainStanceAt) layers the ground's own wobble/shiver over
// it; defaults to facing right, idle when playerPos is given without it. elapsedMs resumes a one-shot animation
// part-way through (via a negative animation-delay) so re-rendering the
// grid on a hazard tick doesn't restart the player's walk/hit animation
// from frame one.
// playerAnim.slide ({ fromIdx, path, hops, elapsedMs }), during any move —
// a one-tile step or an ice slide / current push / mushroom bounce / portal
// warp — glides the player from fromIdx through every tile in path (see
// slideTimeline) to playerPos, again resuming part-way through on a
// re-render, and makes each ice tile crossed glint as the player passes
// over it.
// turn picks the look of time-based tiles (timed spikes, vents, turrets,
// snapjaws); defaults to turn 0 for callers that don't track turns, e.g.
// Creative Mode.
// world ({ ctx, states, revealed, playerIdx, held, tickElapsedMs,
// collapses }), given only by solver mode, turns on the live-play look:
// moving hazards drawn as overlays (gliding in over the first
// MOVER_GLIDE_MS of the tick, tickElapsedMs in), object states (bomb
// fuses, thin ice, icicles), hidden spikes disguised as floor, vines
// wrapped round a held player, and thin ice caving in behind the player
// (collapses: [{ idx, elapsedMs }], elapsedMs since that tile gave way —
// negative while the player is still on their way off it). Solver mode passes the same
// tick its danger checks use, so what's drawn and what kills can never
// disagree.
function renderLevel(level, container, { builderDnD, playerPos, playerAnim, turn = 0, world } = {}) {
  const theme = levelTheme(level);
  container.style.setProperty('--grid-size', level.size);
  THEMES.forEach((t) => container.classList.toggle(`theme-${t}`, t === theme));
  container.innerHTML = '';

  const overlays = world ? hazardOverlaysFor(world.ctx, turn, world.states, world.ghostFrom) : null;
  const gapPx = parseFloat(getComputedStyle(container).columnGap) || 0;
  const collapseAt = new Map((world && world.collapses || []).map(({ idx, elapsedMs }) => [idx, elapsedMs]));
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
      if (tileType === 'crusher' && isCrusherWarningAtTurn(turn)) tileEl.classList.add('vent-warning');
      if (textureKey === 'icicle-shaking') tileEl.classList.add('icicle-shaking');
      if (textureKey === 'goal-locked') tileEl.classList.add('goal-locked');
      if (tileType === 'frost' && isPlayerTile) tileEl.classList.add('frost-underfoot');
      if (textureKey === 'thinice-cracked') tileEl.classList.add('thinice-underfoot');
      if (textureKey === 'bomb-lit') {
        tileEl.classList.add('bomb-lit');
        const countdownEl = document.createElement('span');
        countdownEl.className = 'bomb-countdown';
        countdownEl.textContent = String(objectState(world.ctx, i, world.states));
        tileEl.appendChild(countdownEl);
      }
      (overlays.get(i) || []).forEach(({ kind, from }) => {
        const overlayEl = document.createElement('div');
        overlayEl.className = `hazard-sprite hazard-${kind}`;
        const overlayTexture = themeHazardTexture(theme, kind.replace(/-flip$/, ''));
        if (overlayTexture) overlayEl.style.backgroundImage = `url("${overlayTexture}")`;
        const gliding = from.length && turn > 0 && world.tickElapsedMs < MOVER_GLIDE_MS;
        if (!gliding) {
          tileEl.appendChild(overlayEl);
          return;
        }
        // A wrapper does the gliding, so the sprite's own CSS animation
        // (the imp's hop, the boar's trot) keeps its transform.
        const moverEl = document.createElement('div');
        moverEl.className = 'hazard-mover';
        moverEl.appendChild(overlayEl);
        tileEl.appendChild(moverEl);
        tileEl.classList.add('tile-has-mover');
        glideOverlay(moverEl, level.size, from, i, world.tickElapsedMs, gapPx);
      });
      if (collapseAt.has(i)) {
        // The intact slab sinks away, revealing the broken tile under it.
        const slabEl = document.createElement('div');
        slabEl.className = 'hazard-sprite ice-collapse';
        slabEl.style.backgroundImage = `url("${themeTexture(theme, 'thinice-cracked')}")`;
        slabEl.style.animationDelay = `${-collapseAt.get(i)}ms`;
        tileEl.appendChild(slabEl);
      }
    }

    if (glintAt.has(i)) {
      tileEl.classList.add('ice-glint');
      tileEl.style.animationDelay = `${glintAt.get(i) - slide.elapsedMs}ms`;
    }

    if (isPlayerTile) {
      const { facing = 'right', state = 'idle', stance = null, elapsedMs = 0 } = playerAnim || {};
      // Four layers, each owning one transform: .player-slide moves the
      // player between tiles, .player-terrain adds the ground's stance
      // (wobbling on thin ice, shivering on frost), .player-sprite flips
      // facing, and .player-sprite-inner runs the pose animation.
      const slideEl = document.createElement('div');
      slideEl.className = 'player-slide';
      const terrainEl = document.createElement('div');
      terrainEl.className = `player-terrain${stance ? ` terrain-${stance}` : ''}`;
      const playerEl = document.createElement('div');
      playerEl.className = `player-sprite${facing === 'left' ? ' facing-left' : ''}`;
      const innerEl = document.createElement('div');
      innerEl.className = `player-sprite-inner anim-${state}`;
      if (elapsedMs > 0) innerEl.style.animationDelay = `-${elapsedMs}ms`;
      playerEl.appendChild(innerEl);
      terrainEl.appendChild(playerEl);
      slideEl.appendChild(terrainEl);
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
        // A walk eases in and out of the step; a slide keeps a steady
        // speed so every tile it crosses gets the same time.
        const animation = slideEl.animate(
          slideKeyframes(level.size, timeline, i, gapPx),
          { duration: timeline.durationMs, easing: timeline.walk ? 'ease-in-out' : 'linear', fill: 'both' }
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

// How far (px) a finger has to travel on the grid to count as a swipe
// rather than a tap.
const SWIPE_MIN_PX = 24;

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
  if (theme === 'castle') {
    const castle = { fireball: 'crossbow bolt', 'thin ice': 'the floorboards gave way', 'bomb blast': 'powder blast', ghost: 'the ghost got you' };
    if (castle[label]) return castle[label];
  }
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
// re-sharing the same level can't corrupt its data. One keypress (or swipe,
// or D-pad tap — see tryMove) = one move, resolved by resolveMove (the same function solveBFS uses) so ice
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
// onWin({ moves, deaths, elapsedMs, stars }), if given, is called at the
// end of a successful run (the campaign records progress with it, the Daily
// Puzzle its completion) — startSolverMode itself has no opinion on what
// winning "means" beyond this level's own goal tile. stars (1-3, or null)
// rates the run against par: the level's fewest possible moves (see
// parMoves), passed in as `par` when the caller already knows it
// (the campaign caches it), otherwise worked out at the first win.
//
// A level with a `timeLimit` (seconds) is a timed room: the clock counts
// down, and if it runs out the run restarts (hidden spikes already found
// stay found).
//
// Returns a stop() function that removes this run's input listeners and
// clears its hazard-tick interval, so the next session can start clean.
function startSolverMode(level, {
  grid, controlsEl, solverInfoEl, solverMessageEl, solverStatsEl,
  moveCountEl, deathCountEl, elapsedTimeEl, timeLabelEl, solverResetBtn,
  bestScoreEl, winModalEl, winModalStatsEl, winModalStarsEl, winModalResetBtn, dpadEl,
  levelCode, onWin, par: knownPar,
}) {
  controlsEl.hidden = true;
  solverInfoEl.hidden = false;
  solverStatsEl.hidden = false;
  dpadEl.hidden = false;
  document.body.classList.add('playing');
  let par = knownPar;

  const theme = levelTheme(level);
  setMusic(theme);
  const timeLimitMs = level.timeLimit ? level.timeLimit * 1000 : 0;
  timeLabelEl.textContent = timeLimitMs ? 'Time left:' : 'Time:';

  // The level never changes during a run, so its hazard layout is worked
  // out once up front.
  const ctx = buildHazardContext(level);

  // One-shot player animations settle back to idle after this long (the
  // longest of them, anim-hit, runs 0.45s). Travel poses (see
  // TERRAIN_ANIMATIONS) instead last exactly as long as their move.
  const ONE_SHOT_ANIM_MS = 500;
  const ONE_SHOT_STATES = ['walk', 'hit', 'slip', 'shove', 'bounce', 'warp'];
  // How long the thin-ice collapse animation runs (ice-collapse in
  // style.css); after this the slab is gone and needn't be drawn.
  const ICE_COLLAPSE_MS = 450;

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
  //   pendingFlashes — [{ idx, className }]: one-shot flashes (the tile that
  //                   just killed the player, a lever just flipped, the exit
  //                   unlocking), applied once by the next render().
  //   slide         — { fromIdx, path, hops, startedAt, durationMs } while
  //                   a move (one step or many tiles) is animating.
  //   inputLockedUntil — keypresses are ignored (not queued) until the
  //                   move finishes, so the player can't act from a tile
  //                   they visibly haven't reached yet.
  //   outcomeTimer  — a death or win at the end of a move, deferred until
  //                   the animation actually gets there; dying is true while
  //                   a deferred death is pending.
  //   collapses     — [{ idx, at }]: thin ice caving in, from time `at`
  //                   (when the player leaves the tile, per the move's
  //                   timeline) — see renderLevel's world.collapses.
  let playerPos, won, moveCount, deathCount, facing, animState, animStartedAt, animDurationMs;
  let startTime, timerId, processedTick, states, revealed, pendingFlashes;
  // The tile the ghost drifted from on the latest tick (undefined if it
  // didn't move), so it's drawn gliding rather than jumping.
  let ghostFrom;
  let heldUntilTick, arrivedTick;
  let slide, inputLockedUntil, outcomeTimer, dying, collapses;

  function currentHazardTick() {
    return Math.floor((Date.now() - startTime) / HAZARD_TICK_MS);
  }

  function playerIdx() {
    return playerPos[1] * level.size + playerPos[0];
  }

  // durationMs: how long a one-shot state (walk/hit/a travel pose) plays before
  // render() settles it back to idle.
  function setAnim(state, durationMs = ONE_SHOT_ANIM_MS) {
    animState = state;
    animStartedAt = Date.now();
    animDurationMs = durationMs;
  }

  function render() {
    let elapsedMs = Date.now() - animStartedAt;
    const held = !won && processedTick < heldUntilTick;
    if (ONE_SHOT_STATES.includes(animState) && elapsedMs >= animDurationMs) {
      setAnim(held ? 'held' : 'idle');
      elapsedMs = 0;
    }
    if (animState === 'held' && !held) setAnim('idle');
    const now = Date.now();
    if (slide && now - slide.startedAt >= slide.durationMs) slide = null;
    collapses = collapses.filter(({ at }) => now - at < ICE_COLLAPSE_MS);
    // The ground only gets its say once the player has actually landed.
    const stance = !won && !slide && !dying ? terrainStanceAt(ctx, playerIdx(), states) : null;
    renderLevel(level, grid, {
      playerPos,
      playerAnim: {
        facing,
        state: animState,
        stance,
        elapsedMs: ['idle', 'held'].includes(animState) ? 0 : elapsedMs,
        slide: slide && { fromIdx: slide.fromIdx, path: slide.path, hops: slide.hops, elapsedMs: now - slide.startedAt },
      },
      turn: processedTick,
      world: {
        ctx, states, revealed, playerIdx: playerIdx(), held: held && !slide, ghostFrom,
        tickElapsedMs: now - startTime - processedTick * HAZARD_TICK_MS,
        collapses: collapses.map(({ idx, at }) => ({ idx, elapsedMs: now - at })),
      },
    });
    moveCountEl.textContent = String(moveCount);
    deathCountEl.textContent = String(deathCount);

    // One-shot flashes (the tile that just killed the player, a flipped
    // lever, the exit opening). renderLevel just rebuilt the whole grid, so
    // these have to be applied as one-shot classes after the fact.
    pendingFlashes.forEach(({ idx, className }) => {
      const tileEl = grid.children[idx];
      if (tileEl) tileEl.classList.add(className);
    });
    pendingFlashes = [];
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
    collapses = [];
    inputLockedUntil = 0;
    dying = false;
    deathCount++;
    // Each life starts its move count over, so the moves shown (and the
    // ones a win is scored and starred on) are the winning life's alone.
    moveCount = 0;
    setAnim('hit');
    states = initialObjectStates(ctx);
    ghostFrom = undefined;
    heldUntilTick = 0;
    arrivedTick = processedTick;
    if (label === 'hidden spike') revealed.add(idx);
    setMessage(`Ouch — ${deathLabelFor(label, theme)}! Back to start.`, 'invalid');
    flashGrid('flash-fail');
    const spikeDeath = label.endsWith('spike');
    pendingFlashes.push({ idx, className: spikeDeath ? 'trap-triggered' : 'hazard-triggered' });
    playSound('death');
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
      if (ctx.objectCount) {
        const before = states;
        states = advanceObjects(ctx, states, playerIdx(), processedTick);
        if (ctx.bombs.some(({ slot }) => states[slot] === BOMB_EXPLODING && before[slot] !== BOMB_EXPLODING)) playSound('blast');
        if (ctx.icicles.some(({ slot }) => states[slot] === ICICLE_CRASHING && before[slot] !== ICICLE_CRASHING)) playSound('icicle-crash');
        if (ctx.ghost) {
          const { slot } = ctx.ghost;
          ghostFrom = states[slot] !== before[slot] ? before[slot] : undefined;
        }
      }
      if (isCrusherSlammingAtTurn(processedTick) && ctx.tiles.includes('crusher')) playSound('crush');
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
    playSound('timeup');
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

  function showWinModal(elapsedMs, stars) {
    winModalStatsEl.textContent =
      `Time: ${formatElapsed(elapsedMs)}   ·   Moves: ${moveCount}   ·   Deaths: ${deathCount}`;
    winModalStarsEl.hidden = !stars;
    if (stars) {
      winModalStarsEl.innerHTML = '';
      const row = document.createElement('span');
      row.className = 'star-row';
      row.setAttribute('aria-label', `${stars} of 3 stars`);
      row.textContent = starText(stars);
      const note = document.createElement('span');
      note.className = 'star-note';
      note.textContent = stars === 3
        ? `Par is ${par} moves — perfect!`
        : `Par is ${par} moves. Match it for ${stars === 2 ? 'the third star' : 'all three stars'}.`;
      winModalStarsEl.append(row, note);
    }
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
    ghostFrom = undefined;
    revealed = new Set();
    heldUntilTick = 0;
    arrivedTick = 0;
    pendingFlashes = [];
    clearTimeout(outcomeTimer);
    slide = null;
    collapses = [];
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
    playSound('win');
    if (par === undefined) par = parMoves(level);
    const stars = starsFor(moveCount, par);
    showWinModal(elapsedMs, stars);

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

    if (onWin) onWin({ moves: moveCount, deaths: deathCount, elapsedMs, stars });
  }

  // Every way of moving (keys, swipes, the D-pad) comes through here: one
  // call is one attempted move of one tile in direction (dx, dy). Ignored —
  // not queued — while the last move is still animating.
  function tryMove(dx, dy) {
    if (won || !winModalEl.hidden) return;
    if (Date.now() < inputLockedUntil) return;

    // Catch the world up first so the move is judged against the hazards
    // that are actually on screen right now.
    advanceWorldTo(currentHazardTick());

    if (processedTick < heldUntilTick) {
      setMessage('🌿 The vines have you — hold on…', '');
      render();
      return;
    }

    const move = resolveMove(ctx, playerPos[0], playerPos[1], dx, dy, processedTick, states);
    if (!move) {
      playSound('bump');
      render();
      return;
    }

    moveCount++;
    if (dx < 0) facing = 'left';
    else if (dx > 0) facing = 'right';

    const fromIdx = playerIdx();
    const endIdx = move.death ? move.death.idx : move.final;
    playerPos = [endIdx % level.size, Math.floor(endIdx / level.size)];

    // Every move glides the player along its path — one step, or a whole
    // slide/push/bounce/warp. Whatever happens at the end — dying, winning —
    // waits until the glide actually gets there, and input is ignored until
    // then.
    const timeline = slideTimeline(level.size, fromIdx, move.path, move.hops);
    const settleMs = timeline.durationMs;
    const multiTile = !timeline.walk;
    slide = { fromIdx, path: move.path, hops: move.hops, startedAt: Date.now(), durationMs: settleMs };
    inputLockedUntil = Date.now() + settleMs;
    const pose = travelPoseFor(ctx.tiles, move);
    if (pose === 'walk') setAnim('walk');
    else setAnim(pose, settleMs);
    playSound(pose === 'walk' ? 'step' : pose);
    const afterSlide = (fn) => {
      clearTimeout(outcomeTimer);
      outcomeTimer = setTimeout(fn, settleMs);
    };

    if (move.death) {
      const { label, idx } = move.death;
      dying = true;
      render();
      afterSlide(() => {
        killPlayer(label, idx);
        render();
      });
      return;
    }

    const wasLocked = isExitLocked(ctx, states);
    states = applyMoveToObjects(states, move);
    const nowLocked = isExitLocked(ctx, states);
    move.flippedLevers.forEach((slot) => {
      const { idx } = ctx.levers.find((lever) => lever.slot === slot);
      pendingFlashes.push({ idx, className: 'lever-flipped' });
    });
    move.path.forEach((idx) => {
      if (ctx.tiles[idx] === 'plate') pendingFlashes.push({ idx, className: 'lever-flipped' });
    });
    if (wasLocked && !nowLocked) pendingFlashes.push({ idx: level.goal[1] * level.size + level.goal[0], className: 'goal-unlocked' });
    // Each thin-ice tile left behind caves in as the player leaves it.
    move.brokenIce.forEach((slot) => {
      const { idx } = ctx.thinIce.find((ice) => ice.slot === slot);
      const stop = timeline.stops.find((st) => st.idx === idx);
      collapses.push({ idx, at: Date.now() + (stop ? stop.t : 0) });
    });
    // Frostbite counts from when the player visibly lands (a long slide
    // shouldn't eat into the time they have to step off again) — only ever
    // more lenient than solveBFS, never less. A single step counts from the
    // keypress, as it always has.
    arrivedTick = processedTick + (multiTile ? Math.ceil(settleMs / HAZARD_TICK_MS) : 0);
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

    if (move.flippedLevers.length) playSound('lever');
    if (move.pressedPlates.length) playSound('plate');
    if (wasLocked !== nowLocked) playSound(nowLocked ? 'lock' : 'unlock');
    if (move.grabbed) playSound('grab');
    if (move.litBombs.length) playSound('fuse');
    if (move.litIcicles.length) playSound('icicle-crack');
    if (move.brokenIce.length) playSound('crack');

    if (move.grabbed) {
      setMessage('🌿 Grabbed by vines! You’re stuck for a moment.', 'invalid');
    } else if (move.pressedPlates.length && !move.flippedLevers.length) {
      setMessage(gatesOpen(ctx, states)
        ? '⚙ Plate pressed — every portcullis grinds open.'
        : '⚙ Plate pressed — every portcullis slams shut.', '');
    } else if (move.flippedLevers.length) {
      const total = ctx.levers.length;
      if (!nowLocked) setMessage('🔓 Every lever is on — the exit is open!', 'valid');
      else if (!wasLocked) setMessage('🔒 That lever flipped back off — the exit is locked again.', 'invalid');
      else setMessage(`Lever flipped: ${leversOn(ctx, states)} of ${total} on.`, '');
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
    // Drop out of the travel pose and take up the ground's stance the
    // moment the glide lands, rather than on the next hazard tick.
    afterSlide(render);
  }

  function handleKeydown(e) {
    const delta = KEY_DELTAS[e.key];
    if (!delta) return;
    e.preventDefault();
    tryMove(...delta);
  }

  // Touch: a swipe anywhere on the grid moves one tile its way (whichever
  // axis it went further along). Starting on the grid also stops the page
  // scrolling or zooming under the player's thumb.
  let swipeFrom = null;
  function handleTouchStart(e) {
    if (e.touches.length !== 1) {
      swipeFrom = null;
      return;
    }
    swipeFrom = [e.touches[0].clientX, e.touches[0].clientY];
    e.preventDefault();
  }
  function handleTouchMove(e) {
    e.preventDefault();
  }
  function handleTouchEnd(e) {
    if (!swipeFrom) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - swipeFrom[0];
    const dy = touch.clientY - swipeFrom[1];
    swipeFrom = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(Math.sign(dx), 0);
    else tryMove(0, Math.sign(dy));
  }

  // The on-screen D-pad (shown on touch screens only — see #dpad in
  // style.css): each press is one move.
  function handleDpad(e) {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    e.preventDefault();
    tryMove(...DIRECTION_DELTAS[btn.dataset.dir]);
  }

  document.addEventListener('keydown', handleKeydown);
  grid.addEventListener('touchstart', handleTouchStart, { passive: false });
  grid.addEventListener('touchmove', handleTouchMove, { passive: false });
  grid.addEventListener('touchend', handleTouchEnd);
  dpadEl.addEventListener('pointerdown', handleDpad);
  solverResetBtn.addEventListener('click', resetRun);
  winModalResetBtn.addEventListener('click', resetRun);

  resetRun();

  return function stop() {
    document.removeEventListener('keydown', handleKeydown);
    grid.removeEventListener('touchstart', handleTouchStart);
    grid.removeEventListener('touchmove', handleTouchMove);
    grid.removeEventListener('touchend', handleTouchEnd);
    dpadEl.removeEventListener('pointerdown', handleDpad);
    dpadEl.hidden = true;
    document.body.classList.remove('playing');
    setMusic('home');
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
  const winModalStarsEl = $('win-modal-stars');
  const dpadEl = $('dpad');
  const muteBtn = $('mute-btn');
  const winModalUnlockEl = $('win-modal-unlock');
  const winModalResetBtn = $('win-modal-reset-btn');
  const winModalNextBtn = $('win-modal-next-btn');
  const winModalLevelsBtn = $('win-modal-levels-btn');
  const builderPanelToggleBtn = $('builder-panel-toggle');
  const builderPanelEl = $('builder-panel');
  const creativeThemePickerEl = $('creative-theme-picker');
  const creativeRoomFieldsEl = $('creative-room-fields');
  const roomNameInput = $('room-name-input');
  const timeLimitSelect = $('time-limit-select');
  const timeLimitHintEl = $('time-limit-hint');
  const saveRoomBtn = $('save-room-btn');
  const myRoomsBtn = $('my-rooms-btn');
  const roomStatusEl = $('room-status');
  const roomsModal = $('rooms-modal');
  const roomsListEl = $('rooms-list');
  const roomsCountEl = $('rooms-count');
  const roomsEmptyEl = $('rooms-empty');
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
  const dailyHubWorldEl = $('daily-hub-world');
  const dailyHubBannerEl = $('daily-hub-banner');
  const dailyHubStripEl = $('daily-hub-strip');
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
  const themeInfoEl = $('theme-info');
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
  const cutsceneEl = $('cutscene');
  const badgeAwardEl = $('badge-award');
  const storyBtn = $('story-btn');
  const storyModal = $('story-modal');
  const storyListEl = $('story-list');

  const titleScreenEl = $('title-screen');
  const titleHowtoModal = $('title-howto-modal');
  const titleCreditsModal = $('title-credits-modal');
  const titleSignTextEl = $('title-sign-text');
  const homeBtn = $('home-btn');

  // Paints the title screen's decorative pixel art (see TITLE_SCREEN_TEXTURES
  // in sprites.js) the same way Creative Mode paints palette icons — a plain
  // inline background-image, no <img> elements. The button frame
  // specifically goes through a CSS custom property instead (read by
  // .title-btn/.pixel-btn in style.css) rather than being set per-element
  // here, since it's shared by every "chrome" button on the game page — see
  // the comment on .pixel-btn in style.css for why that has to be a custom
  // property and not another per-element inline style. The home menu's
  // heavier frame goes the same way.
  document.documentElement.style.setProperty('--plate-frame', `url("${TITLE_SCREEN_TEXTURES.buttonFrame}")`);
  document.documentElement.style.setProperty('--menu-frame', `url("${TITLE_SCREEN_TEXTURES.menuFrame}")`);
  titleScreenEl.style.backgroundImage = `url("${TITLE_SCREEN_TEXTURES.backdrop}")`;
  document.querySelectorAll('.title-torch').forEach((el) => { el.style.backgroundImage = `url("${TITLE_SCREEN_TEXTURES.torch}")`; });
  document.querySelectorAll('.title-page').forEach((el) => { el.style.backgroundImage = `url("${STORY_PROP_TEXTURES.journal}")`; });
  document.querySelectorAll('.title-btn-icon').forEach((el) => { el.style.backgroundImage = `url("${TITLE_MENU_ICONS[el.dataset.icon]}")`; });
  $('title-hero').style.backgroundImage = `url("${THEME_PLAYER_FRAMES.lava.idle}")`;
  $('title-sign-post').style.backgroundImage = `url("${TITLE_SCREEN_TEXTURES.sign}")`;
  scatterParticles($('title-embers'), 14, 11);
  scatterParticles($('title-fireflies'), 10, 23);
  scatterParticles($('ambient'), 36, 37);
  $('trash-icon').style.backgroundImage = `url("${UI_ICON_TEXTURES.trash}")`;

  // Switches the page's backdrop and accent colors (body[data-theme] in
  // style.css) to a theme.
  function applyTheme(theme) {
    const t = normalizeTheme(theme);
    document.body.dataset.theme = t;
    document.body.style.backgroundImage = `url("${PAGE_BACKGROUND_TEXTURES[t]}")`;
  }
  applyTheme('lava');

  // The Daily Puzzle's moving backdrop layer (#ambient — embers, snow,
  // fireflies or fog, by body[data-ambient] in style.css), so a day's world
  // shows all around its screens. null turns it off; hideAllModes does.
  function setAmbient(theme) {
    if (theme) document.body.dataset.ambient = normalizeTheme(theme);
    else delete document.body.dataset.ambient;
  }

  // Fills a decoration layer with `count` particles (plain <i>s). Each gets
  // its place, size, speed, start offset and drift as custom properties
  // (--x --y --s --t --d --o), from a fixed seed so the scatter is the same
  // every visit; the layer's own CSS decides what they look like and how
  // they move.
  function scatterParticles(container, count, seed) {
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.style.setProperty('--x', `${(rng() * 100).toFixed(1)}%`);
      p.style.setProperty('--y', `${(rng() * 100).toFixed(1)}%`);
      p.style.setProperty('--s', `${[3, 4, 4, 6][Math.floor(rng() * 4)]}px`);
      p.style.setProperty('--t', `${(7 + rng() * 9).toFixed(1)}s`);
      p.style.setProperty('--d', `${(-rng() * 16).toFixed(1)}s`);
      p.style.setProperty('--o', `${Math.round((rng() - 0.5) * 140)}px`);
      container.appendChild(p);
    }
  }

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

  // The My Rooms id of the room being built (null until it's first saved;
  // after that, every edit saves it — see roomEdited).
  let currentRoomId = null;

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
      bestScoreEl, winModalEl, winModalStatsEl, winModalStarsEl, winModalResetBtn, dpadEl,
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
    finishWorldSlide();
    stopSolver();
    builderMode = false;
    builderLevel = null;
    currentRoomId = null;
    currentDailyChallenge = null;
    currentCampaignId = null;
    activeBuilderSize = BUILDER_GRID_SIZE;
    activeTrapBudget = TRAP_BUDGET;
    resetDragState();
    hideClearAllConfirm();
    hideResetProgressConfirm();
    setAmbient(null);

    [
      controlsEl, trapCounterEl, validateBtn, shareBtn, shareOutputEl,
      builderPanelToggleBtn, builderPanelEl, dailyBuilderBarEl, dailyHubEl,
      solverInfoEl, solverStatsEl, dailySolverBackBtn, campaignBackBtn, winModalEl,
      winModalDailyBackBtn, winModalNextBtn, winModalLevelsBtn, winModalUnlockEl,
      bestScoreEl, levelHeadingEl, themeSelectEl, levelSelectEl, trapIntroModal, storyModal,
      saveRoomBtn, myRoomsBtn, roomStatusEl, roomsModal,
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

  // Sound and music on/off, remembered on this device (see sounds.js).
  function renderMuteBtn() {
    const muted = isMuted();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute sound and music' : 'Mute sound and music');
  }
  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    renderMuteBtn();
  });
  renderMuteBtn();
  // The menus' tune; each room switches to its world's (see startSolverMode).
  setMusic('home');

  // A new game opens with the prologue (see shouldPlayOpening in story.js),
  // over the world select it then leaves the player on.
  $('title-play-btn').addEventListener('click', () => {
    openThemeSelect();
    if (shouldPlayOpening(loadProgress())) playCutscene('opening', cutsceneEl);
  });
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
      const stars = `★ ${themeStars(progress, theme)} / ${LEVELS_PER_THEME * 3}`;
      themeStatusEl.textContent = done === LEVELS_PER_THEME
        ? `👑 All ${LEVELS_PER_THEME} levels complete · ${stars}`
        : `${done} / ${LEVELS_PER_THEME} levels complete · ${stars}`;
    } else if (BONUS_THEMES.includes(theme)) {
      // The bonus world: every level of every other world, with where each
      // one stands (the status line wraps — white-space: pre-line).
      const { done: bonusDone, total } = bonusProgress(progress);
      fraction = bonusDone / total;
      const perWorld = MAIN_THEMES
        .map((t) => `${THEME_INFO[t].short} ${completedCount(progress, t)}/${themeLevels(t).length}`)
        .join(' · ');
      themeStatusEl.textContent =
        `🔒 Bonus world — beat every other level to open\n${bonusDone} / ${total}  ·  ${perWorld}`;
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
      dot.addEventListener('click', () => showTheme(i, Math.sign(i - selectedThemeIdx)));
      themeDotsEl.appendChild(dot);
    });

    themeLevelsBtn.disabled = !unlocked;
    themeLevelsBtn.textContent = unlocked ? 'Levels' : 'Locked';
  }

  function stepTheme(delta) {
    showTheme(mod(selectedThemeIdx + delta, THEMES.length), delta);
  }

  // Switching worlds slides the screen over: the current world (its card,
  // and its name/status/progress) slides out one side while the next one
  // slides in from the other, and the page backdrop slides across with
  // them. `dir` is +1 for the next world (everything moves left), -1 for
  // the previous. Instant for anyone who prefers reduced motion.
  const WORLD_SLIDE_MS = 420;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let worldSlide = null; // { animations, leftovers } while a slide runs

  // Jumps any slide still running straight to its end and clears away its
  // departing copies, so a quick double-press starts clean.
  function finishWorldSlide() {
    if (!worldSlide) return;
    worldSlide.animations.forEach((a) => a.cancel());
    worldSlide.leftovers.forEach((el) => el.remove());
    worldSlide = null;
  }

  // A copy of el left in its place to slide away. It keeps el's ids: the
  // card, its preview grid and the world name are all styled by id, and a
  // copy without them would lose its size and look mid-slide. The copy goes
  // after el in the same parent, so a lookup by id still finds the real
  // one first, and it's gone again within WORLD_SLIDE_MS.
  function departingCopy(el) {
    const copy = el.cloneNode(true);
    copy.classList.add('world-slide-ghost');
    copy.setAttribute('aria-hidden', 'true');
    el.parentElement.appendChild(copy);
    return copy;
  }

  function backdropLayer(image) {
    const layer = document.createElement('div');
    layer.className = 'world-slide-backdrop';
    layer.style.backgroundImage = image;
    document.body.appendChild(layer);
    return layer;
  }

  function showTheme(idx, dir) {
    if (idx === selectedThemeIdx) return;
    finishWorldSlide();
    const animate = dir !== 0 && !reducedMotion.matches && !themeSelectEl.hidden;
    const parts = [themeCardEl, themeInfoEl];
    const copies = animate ? parts.map(departingCopy) : [];
    const oldBackdrop = document.body.style.backgroundImage;

    selectedThemeIdx = idx;
    hideResetProgressConfirm();
    renderThemeSelect();
    if (!animate) return;

    const panelWidth = themeSelectEl.getBoundingClientRect().width;
    const screenWidth = window.innerWidth;
    const outgoing = backdropLayer(oldBackdrop);
    const incoming = backdropLayer(document.body.style.backgroundImage);
    const timing = { duration: WORLD_SLIDE_MS, easing: 'cubic-bezier(0.22, 0.8, 0.24, 1)' };
    const slide = (el, from, to) => el.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      timing
    );
    const animations = [
      ...parts.map((el) => slide(el, dir * panelWidth, 0)),
      ...copies.map((el) => slide(el, 0, -dir * panelWidth)),
      slide(incoming, dir * screenWidth, 0),
      slide(outgoing, 0, -dir * screenWidth),
    ];
    const current = { animations, leftovers: [...copies, outgoing, incoming] };
    worldSlide = current;
    const done = () => { if (worldSlide === current) finishWorldSlide(); };
    animations[0].finished.then(done, () => {});
    // Backstop: a page that isn't drawing frames (a hidden tab) never runs
    // its animations, so tidy up on a timer too rather than leave the
    // departing copies lying around.
    setTimeout(done, WORLD_SLIDE_MS + 150);
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
    if (themeSelectEl.hidden || !titleHowtoModal.hidden || !titleCreditsModal.hidden || !storyModal.hidden) return;
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

  // Story: every cutscene, to rewatch. One opens once its world's last level
  // is beaten (isStoryUnlocked in story.js); the rest show what opens them.
  function renderStoryList() {
    const progress = loadProgress();
    storyListEl.innerHTML = '';
    STORY_SCENES.forEach((scene) => {
      const open = isStoryUnlocked(progress, scene.id);
      const item = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pixel-btn';
      btn.disabled = !open;
      btn.textContent = open ? `▶ ${scene.label}: ${scene.title}` : `🔒 ${scene.label}`;
      const hint = document.createElement('span');
      hint.className = 'story-hint';
      if (!open) hint.textContent = `Beat the last level of ${THEME_INFO[scene.after].name}`;
      else if (!isStorySeen(progress, scene.id)) hint.textContent = 'Not watched yet';
      if (hint.textContent) btn.appendChild(hint);
      btn.addEventListener('click', () => playCutscene(scene.id, cutsceneEl, { onDone: renderStoryList }));
      item.appendChild(btn);
      storyListEl.appendChild(item);
    });
  }
  storyBtn.addEventListener('click', () => {
    renderStoryList();
    storyModal.hidden = false;
  });
  $('story-close-btn').addEventListener('click', () => { storyModal.hidden = true; });

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
    const next = nextMainTheme(theme);
    levelSelectTitleEl.textContent = THEME_INFO[theme].name;
    levelSelectSubtitleEl.textContent = `${completedCount(progress, theme)} / ${levels.length} complete` +
      ` · ★ ${themeStars(progress, theme)} / ${levels.length * 3}` +
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
      // A record can be missing its stats (a cloud save repaired by hand).
      if (record) tagText.push(Number.isFinite(record.moves) ? `✓ ${record.moves} moves` : '✓');
      tags.textContent = tagText.join(' · ');
      const stars = levelStars(progress, def.id);
      const starsEl = document.createElement('span');
      starsEl.className = `level-plate-stars${stars ? '' : ' none'}`;
      // A level beaten before stars existed shows none until it's replayed.
      starsEl.textContent = record ? starText(stars) : '';
      plate.append(num, name, starsEl, tags);

      plate.title = def.idea;
      plate.setAttribute('aria-label',
        `Level ${n + 1}: ${def.name}${def.timeLimit ? ', timed' : ''}${record ? ', completed' : ''}` +
        `${stars ? `, ${stars} of 3 stars` : ''}${open ? '' : ', locked'}`);
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
        par: campaignPar(id),
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
  function handleCampaignWin(id, { moves, deaths, elapsedMs, stars }) {
    const def = levelDef(id);
    const before = loadProgress();
    const after = recordLevelComplete(id, { moves, timeMs: elapsedMs, deaths, stars });
    const levels = themeLevels(def.theme);
    const n = levelNumber(id);

    const notes = [];
    // Whatever this win opened: the next world in the chain, or — with the
    // very last main-world level — the bonus castle.
    THEMES.forEach((t) => {
      if (!isThemeUnlocked(before, t) && isThemeUnlocked(after, t)) {
        notes.push(BONUS_THEMES.includes(t)
          ? `🏰 Every world beaten — the ${THEME_INFO[t].name} has opened!`
          : `🔓 ${THEME_INFO[t].name} unlocked!`);
      }
    });
    if (completedCount(before, def.theme) < levels.length && completedCount(after, def.theme) === levels.length) {
      notes.push(`👑 Every ${THEME_INFO[def.theme].short} level complete!`);
    }
    winModalUnlockEl.textContent = notes.join(' ');
    winModalUnlockEl.hidden = notes.length === 0;
    winModalNextBtn.hidden = n >= levels.length;

    // The world's cutscene, the first time its last level falls, then its
    // badge (badges.js) if this win finished the world: after a beat, so
    // the win lands first, and over the win card (still there when they
    // end). The cutscene waits for no one — it's skipped if the player has
    // already left the room — but the badge always shows.
    const scene = storySceneAfterLevel(id);
    const sceneDue = scene && !isStorySeen(after, scene);
    const badge = badgeEarnedByWin(before, after);
    if (sceneDue || badge) {
      setTimeout(() => {
        const award = () => { if (badge) showBadgeAward(badge, badgeAwardEl); };
        if (sceneDue && currentCampaignId === id && !winModalEl.hidden && !isCutscenePlaying()) {
          playCutscene(scene, cutsceneEl, { onDone: award });
        } else {
          award();
        }
      }, STORY_AFTER_WIN_MS);
    }
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
        roomEdited();
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
      roomEdited();
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
      roomEdited();
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
      roomEdited();
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
    const timeLimit = cleanTimeLimit(timeLimitSelect.value);
    if (timeLimit && !currentDailyChallenge) builderLevel.timeLimit = timeLimit;
    renderBuilder();
    roomEdited();
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

  // Opens Creative Mode on a new, unsaved room — or, given one of My Rooms,
  // on that room.
  function enterCreativeMode(room = null) {
    hideAllModes();
    hideTitleScreen();
    if (room) {
      builderLevel = cleanDraftLevel(room.level);
      creativeTheme = levelTheme(builderLevel);
      currentRoomId = room.id;
    } else {
      builderLevel = { ...createEmptyLevel(BUILDER_GRID_SIZE), theme: creativeTheme };
    }
    roomNameInput.value = room ? room.name : '';
    builderToggleBtn.textContent = 'Exit Creative Mode';
    shareBtn.hidden = false;
    saveRoomBtn.hidden = false;
    myRoomsBtn.hidden = false;
    creativeThemePickerEl.hidden = false;
    creativeRoomFieldsEl.hidden = false;
    renderTimeLimitSelect();
    showBuilderUI();
    renderRoomStatus(room ? 'Saved ✓' : 'Not saved yet');
  }

  // --- My Rooms (see rooms.js) ---------------------------------------------------

  function renderRoomStatus(text) {
    roomStatusEl.textContent = text;
    roomStatusEl.hidden = false;
  }

  // Once a room has been saved, every change to it saves straight away.
  function roomEdited() {
    if (!builderMode || currentDailyChallenge) return;
    if (builderLevel.timeLimit) renderTimeLimitHint();
    if (!currentRoomId) {
      renderRoomStatus('Not saved yet');
      return;
    }
    if (putRoom(currentRoomId, roomNameInput.value, builderLevel)) renderRoomStatus('Saved ✓');
    else renderRoomStatus('Couldn’t save this room');
  }

  saveRoomBtn.addEventListener('click', () => {
    if (!builderMode || currentDailyChallenge) return;
    const id = currentRoomId || newRoomId();
    if (!putRoom(id, roomNameInput.value, builderLevel)) {
      renderRoomStatus(`My Rooms is full (${MAX_ROOMS}). Delete one to save this.`);
      return;
    }
    currentRoomId = id;
    roomNameInput.value = cleanRoomName(roomNameInput.value);
    renderRoomStatus('Saved ✓ — changes now save as you build');
  });

  roomNameInput.addEventListener('input', roomEdited);
  roomNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveRoomBtn.click();
  });

  // A small, non-interactive picture of a room (the same renderer as the
  // world select's preview).
  function roomThumb(level) {
    const thumb = document.createElement('div');
    thumb.className = 'room-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    renderLevel(level, thumb);
    return thumb;
  }

  function roomMeta(room) {
    const { level } = room;
    const parts = [THEME_INFO[levelTheme(level)].short, `${level.size}×${level.size}`];
    if (level.timeLimit) parts.push(`⏱ ${level.timeLimit}s`);
    if (!level.start || !level.goal) parts.push('unfinished');
    parts.push(new Date(room.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    return parts.join(' · ');
  }

  function renderRoomsList() {
    const list = roomList(loadRooms());
    roomsCountEl.textContent = `${list.length} / ${MAX_ROOMS} rooms`;
    roomsEmptyEl.hidden = list.length > 0;
    roomsListEl.innerHTML = '';
    list.forEach((room) => {
      const item = document.createElement('li');
      item.className = `room-row${room.id === currentRoomId ? ' current' : ''}`;
      const info = document.createElement('div');
      info.className = 'room-info';
      const name = document.createElement('strong');
      name.textContent = room.name;
      const meta = document.createElement('span');
      meta.className = 'room-meta';
      meta.textContent = roomMeta(room);
      info.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'room-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'pixel-btn';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('aria-label', `Edit ${room.name}`);
      editBtn.addEventListener('click', () => enterCreativeMode(room));
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'text-btn room-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', `Delete ${room.name}`);
      // Two steps, like Clear All: the first click asks, the second deletes.
      deleteBtn.addEventListener('click', () => {
        if (!deleteBtn.classList.contains('confirming')) {
          deleteBtn.classList.add('confirming');
          deleteBtn.textContent = 'Really delete?';
          return;
        }
        deleteRoom(room.id);
        if (room.id === currentRoomId) {
          currentRoomId = null;
          renderRoomStatus('Not saved yet');
        }
        renderRoomsList();
      });
      actions.append(editBtn, deleteBtn);
      item.append(roomThumb(room.level), info, actions);
      roomsListEl.appendChild(item);
    });
  }

  myRoomsBtn.addEventListener('click', () => {
    renderRoomsList();
    roomsModal.hidden = false;
  });
  $('rooms-close-btn').addEventListener('click', () => { roomsModal.hidden = true; });
  $('rooms-new-btn').addEventListener('click', () => enterCreativeMode());

  // --- Time limit ------------------------------------------------------------------

  function renderTimeLimitSelect() {
    const current = cleanTimeLimit(builderLevel.timeLimit);
    const choices = ROOM_TIME_LIMITS.includes(current) ? ROOM_TIME_LIMITS : [...ROOM_TIME_LIMITS, current].sort((a, b) => a - b);
    timeLimitSelect.innerHTML = '';
    choices.forEach((seconds) => {
      const option = document.createElement('option');
      option.value = String(seconds);
      option.textContent = seconds ? `${seconds} seconds` : 'Off';
      timeLimitSelect.appendChild(option);
    });
    timeLimitSelect.value = String(current);
    renderTimeLimitHint();
  }

  // Under the picker: how fast the room can be beaten, and whether the
  // limit is fair (see minFairTimeLimit).
  function renderTimeLimitHint() {
    const limit = cleanTimeLimit(builderLevel.timeLimit);
    timeLimitHintEl.className = '';
    if (!limit) {
      timeLimitHintEl.textContent = 'Set a limit to make this a timed room: the run restarts when the clock hits zero.';
      return;
    }
    const verdict = timeLimitVerdict(builderLevel);
    timeLimitHintEl.textContent = verdict.text;
    timeLimitHintEl.className = verdict.ok ? 'valid' : 'invalid';
  }

  // Whether a timed room's limit is fair, in words. ok is false when the
  // room can't be judged yet or the limit is too tight.
  function timeLimitVerdict(level) {
    const limit = cleanTimeLimit(level.timeLimit);
    if (!level.start || !level.goal) return { ok: false, text: 'Place a start and a goal to check the limit.' };
    const fastest = fastestRunSeconds(level);
    if (fastest === null) return { ok: false, text: 'Make the room solvable to check the limit.' };
    const fair = Math.ceil(fastest * 1.5 + 3);
    return limit >= fair
      ? { ok: true, text: `Fastest possible run: ${fastest}s. A ${limit}s limit is fair.` }
      : { ok: false, text: `Too tight: the fastest possible run takes ${fastest}s. Allow at least ${fair}s.` };
  }

  timeLimitSelect.addEventListener('change', () => {
    const limit = cleanTimeLimit(timeLimitSelect.value);
    if (limit) builderLevel.timeLimit = limit;
    else delete builderLevel.timeLimit;
    renderTimeLimitHint();
    shareOutputEl.hidden = true;
    roomEdited();
  });

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
    if (solvable && builderLevel.timeLimit) {
      const verdict = timeLimitVerdict(builderLevel);
      validateResultEl.textContent = verdict.ok ? `Solvable ✅ — ${verdict.text}` : `Solvable, but the time limit is ❌ ${verdict.text}`;
      validateResultEl.className = verdict.ok ? 'valid' : 'invalid';
    }
    if (!currentDailyChallenge) renderTimeLimitHint();
  });

  shareBtn.addEventListener('click', () => {
    if (!builderLevel.start || !builderLevel.goal || !isSolvable(builderLevel)) {
      validateResultEl.textContent = "Fix the level so it's solvable before sharing.";
      validateResultEl.className = 'invalid';
      shareOutputEl.hidden = true;
      return;
    }
    if (builderLevel.timeLimit && !timeLimitVerdict(builderLevel).ok) {
      validateResultEl.textContent = `Fix the time limit before sharing. ${timeLimitVerdict(builderLevel).text}`;
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
    validateResultEl.textContent = builderLevel.timeLimit
      ? `Solvable ✅ — link ready below (⏱ ${builderLevel.timeLimit}s timed room).`
      : 'Solvable ✅ — link ready below.';
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

  // The hub's banner: a row of the day's world's own tiles under its
  // backdrop, like a cutscene's stage — the hero at the start, a few of that
  // world's traps, the gem at the end.
  const DAILY_HUB_STRIPS = {
    lava: ['empty', 'empty', 'spike', 'empty', 'ice', 'ice', 'empty', 'bomb', 'empty', 'timedspike-active', 'empty', 'goal'],
    ice: ['empty', 'empty', 'thinice', 'frost', 'empty', 'icicle', 'ice', 'ice', 'empty', 'spike', 'empty', 'goal'],
    grass: ['empty', 'empty', 'vines', 'empty', 'mushroom', 'empty', 'snapjaw', 'empty', 'empty', 'spike', 'empty', 'goal'],
    castle: ['empty', 'empty', 'plate', 'empty', 'crusher', 'empty', 'thinice', 'empty', 'gate-open', 'spike', 'empty', 'goal'],
  };

  function renderDailyHubBanner(theme) {
    dailyHubBannerEl.style.backgroundImage = `url("${PAGE_BACKGROUND_TEXTURES[theme]}")`;
    dailyHubStripEl.replaceChildren(...DAILY_HUB_STRIPS[theme].map((key) => {
      const tile = document.createElement('span');
      tile.style.backgroundImage = `url("${themeTexture(theme, key)}")`;
      return tile;
    }));
    const hero = document.createElement('span');
    hero.className = 'daily-hub-hero';
    hero.style.backgroundImage = `url("${THEME_PLAYER_FRAMES[theme].idle}")`;
    dailyHubStripEl.appendChild(hero);
  }

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
    dailyHubWorldEl.textContent = THEME_INFO[theme].name;
    renderDailyHubBanner(theme);
    const locked = !isThemeUnlocked(loadProgress(), theme);
    dailyHubThemeEl.hidden = !locked;
    dailyHubThemeEl.textContent = locked ? 'A sneak peek: this world is still locked in the campaign!' : '';
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
    const theme = dailyThemeFor(getTodayDateString());
    applyTheme(theme);
    setAmbient(theme);
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
    setAmbient(level.theme);
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
    setAmbient(constraints.theme);

    activeBuilderSize = constraints.size;
    activeTrapBudget = constraints.trapBudget;
    builderLevel = { ...createEmptyLevel(activeBuilderSize), theme: constraints.theme };
    builderToggleBtn.hidden = true;
    dailyToggleBtn.hidden = true;
    creativeThemePickerEl.hidden = true;
    creativeRoomFieldsEl.hidden = true;

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
      // A timed room's limit comes from the link, so only a sane one counts.
      else if (cleanTimeLimit(sharedLevel.timeLimit)) sharedLevel.timeLimit = cleanTimeLimit(sharedLevel.timeLimit);
      else delete sharedLevel.timeLimit;
    } catch (e) {
      sharedLevel = null;
    }
    if (sharedLevel) {
      hideTitleScreen();
      // The grid was hidden above for the title screen; a shared room
      // skips that screen, so bring it back before the run starts.
      grid.hidden = false;
      applyTheme(levelTheme(sharedLevel));
      activeSolverStop = startSolverMode(sharedLevel, { ...solverDom(), levelCode: sharedParam });
    } else {
      $('title-link-error').hidden = false;
    }
  }
});
