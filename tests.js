'use strict';

// Quick sanity checks for isSolvable() (defined in script.js) and the
// campaign (levels.js). Plain assertions, no test framework — open
// tests.html and read the console.
//
// A few checks exercise real localStorage (daily stats, campaign progress);
// they save whatever a real player had stored first and put it back after,
// since tests.html shares an origin with the game.
const savedStorage = {};
['trapRoomDailyStats', 'trapRoomProgress'].forEach((key) => {
  try { savedStorage[key] = localStorage.getItem(key); } catch (e) { savedStorage[key] = null; }
});
function restoreStorage() {
  Object.entries(savedStorage).forEach(([key, value]) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {
      // storage unavailable — nothing to restore
    }
  });
}

function assert(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`);
  } else {
    console.error(`FAIL: ${message}`);
  }
}

// Solvable: open 3x3 grid, nothing blocking start from goal.
const solvableLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 2],
  tiles: [
    'start', 'empty', 'empty',
    'empty', 'empty', 'empty',
    'empty', 'empty', 'goal',
  ],
};
assert(isSolvable(solvableLevel) === true, 'open grid is solvable');

// Unsolvable: spikes (not walls) seal off the goal's only two neighbors.
const spikeBlockedLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 2],
  tiles: [
    'start', 'empty', 'empty',
    'empty', 'empty', 'spike',
    'empty', 'spike', 'goal',
  ],
};
assert(isSolvable(spikeBlockedLevel) === false, 'spikes sealing off the goal make it unsolvable');

// Unsolvable: a wall — not a trap — blocks the only path. In a 3-wide grid
// a solid wall column between start and goal leaves no way around it.
const wallBlockedLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 2],
  tiles: [
    'start', 'wall',  'empty',
    'empty', 'wall',  'empty',
    'empty', 'wall',  'goal',
  ],
};
assert(isSolvable(wallBlockedLevel) === false, 'a wall blocking the only path makes it unsolvable');

// --- one-way walls and timed spikes (isSolvable direction/time awareness) --

assert(isOnewayPassable('oneway-right', 1, 0) === true, 'oneway-right allows moving right through it');
assert(isOnewayPassable('oneway-right', -1, 0) === false, 'oneway-right blocks moving left through it');
assert(isOnewayPassable('empty', -1, 0) === true, 'non-oneway tile types are direction-agnostic');

assert(isTimedSpikeActiveAtTurn(0) === true, 'timed spike is active at turn 0');
assert(isTimedSpikeActiveAtTurn(1) === true, 'timed spike stays active through the whole active phase');
assert(isTimedSpikeActiveAtTurn(2) === false, 'timed spike becomes inactive once its phase flips');

// Solvable: the only path passes through a one-way wall moving in its
// allowed direction.
const onewayForwardLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 0],
  tiles: [
    'start', 'oneway-right', 'goal',
    'empty',  'empty',        'empty',
    'empty',  'empty',        'empty',
  ],
};
assert(isSolvable(onewayForwardLevel) === true, 'a one-way wall is passable in its allowed direction');

// Unsolvable: the only path requires entering the same one-way wall from the
// wrong side (moving left through 'oneway-right'), with walls sealing off
// every other route.
const onewayBlockedLevel = {
  size: 3,
  start: [2, 0],
  goal: [0, 0],
  tiles: [
    'goal',  'oneway-right', 'start',
    'wall',  'wall',         'wall',
    'wall',  'wall',         'wall',
  ],
};
assert(isSolvable(onewayBlockedLevel) === false, 'a one-way wall blocks entry from the wrong direction');

// Solvable: reaching the timed spike requires a 2-move detour first, which
// happens to land on it during its inactive phase (turn 3). A naive check
// that always treats 'timedspike' like a permanent spike would wrongly call
// this unsolvable.
const timedSpikeWaitLevel = {
  size: 4,
  start: [0, 0],
  goal: [3, 2],
  tiles: [
    'start', 'empty', 'empty',      'wall',
    'empty', 'wall',  'empty',      'wall',
    'empty', 'wall',  'timedspike', 'goal',
    'wall',  'wall',  'wall',       'wall',
  ],
};
assert(isSolvable(timedSpikeWaitLevel) === true, 'a timed spike is passable once its inactive phase lines up');

// The only path is a single step onto a timed spike, which is active on
// turn 0. Rushing it kills, but the bot (like a real player) can wait on
// the start tile until the spike drops: wait, wait, cross on turn 2 (safe
// on 2 and 3), step onto the goal on turn 3 = 4 turns.
const timedSpikeRushLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 0],
  tiles: [
    'start', 'timedspike', 'goal',
    'wall',  'wall',       'wall',
    'wall',  'wall',       'wall',
  ],
};
assert(solveBFS(timedSpikeRushLevel).moves === 4, 'the bot can wait in place for a timed spike to drop');

// A permanently deadly tile with no way around stays unsolvable no matter
// how long you wait.
const spikeCorridorLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 0],
  tiles: [
    'start', 'spike', 'goal',
    'wall',  'wall',  'wall',
    'wall',  'wall',  'wall',
  ],
};
assert(isSolvable(spikeCorridorLevel) === false, 'waiting never gets you past a plain spike');

// --- encodeLevel / decodeLevel round trip -------------------------------

const roundTripLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 2],
  tiles: [
    'start', 'empty', 'wall',
    'spike', 'empty', 'empty',
    'empty', 'wall',  'goal',
  ],
};
const roundTripEncoded = encodeLevel(roundTripLevel);
assert(
  JSON.stringify(decodeLevel(roundTripEncoded)) === JSON.stringify(roundTripLevel),
  'encodeLevel/decodeLevel round-trips an ordinary level'
);
assert(
  /^[A-Za-z0-9_-]*$/.test(roundTripEncoded),
  'encoded level string is URL-safe (only A-Z a-z 0-9 - _)'
);

// A level whose standard (pre-URL-safe) base64 happens to contain both '+'
// and '/'. Real tile data can never trigger this — base64 only emits '+'/'/'
// from a byte whose value is 0x3E/0x3F/0x7E/0x7F ('>', '?', '~', DEL), none
// of which appear in our tile vocabulary or JSON punctuation — so this
// fixture stuffs an extra field with those bytes purely to exercise the
// byte-safe replace/restore logic in encodeLevel/decodeLevel.
const specialCharsLevel = {
  size: 2,
  start: [0, 0],
  goal: [1, 1],
  tiles: ['start', 'empty', 'empty', 'goal'],
  note: '>yyyyy?zzzzz',
};
const specialCharsEncoded = encodeLevel(specialCharsLevel);
assert(
  JSON.stringify(decodeLevel(specialCharsEncoded)) === JSON.stringify(specialCharsLevel),
  'a level whose base64 contains + and / still round-trips correctly'
);
assert(
  /^[A-Za-z0-9_-]*$/.test(specialCharsEncoded),
  'that encoded string has no +, /, or = despite the underlying base64 containing them'
);

// --- New traps & movement tiles -------------------------------------------

// Builds a 1-row corridor level from a tile list, walls implied nowhere —
// start/goal coordinates are read off the 'start'/'goal' entries.
function corridor(tiles) {
  return {
    size: tiles.length,
    start: [tiles.indexOf('start'), 0],
    goal: [tiles.indexOf('goal'), 0],
    tiles: [...tiles, ...new Array(tiles.length * (tiles.length - 1)).fill('wall')],
  };
}

// Every sprite frame must be a rectangle, or frameToDataURL silently
// paints "undefined"-colored pixels.
assert(IMP_FRAME.every((row) => row.length === 16) && IMP_FRAME.length === 16, 'imp sprite frame is 16x16');
assert(BOAR_FRAME.every((row) => row.length === 16) && BOAR_FRAME.length === 16, 'boar sprite frame is 16x16');
const liveTextureKeys = [
  'bomb-lit', 'bomb-gone', 'vent-up-active', 'timedspike-active', 'timedspike-inactive', 'trap-triggered',
  'thinice-cracked', 'thinice-broken', 'icicle-shaking', 'icicle-fallen', 'snapjaw-open', 'snapjaw-shut',
];
for (const theme of THEMES) {
  assert(
    [...BUILDER_PALETTE_TYPES, ...liveTextureKeys]
      .every((key) => key === 'timedspike' || typeof THEME_TILE_TEXTURES[theme][key] === 'string'),
    `every placeable tile type has a ${theme} texture`
  );
  assert(
    Object.values({ ...THEME_TILE_TEXTURES[theme], ...THEME_HAZARD_TEXTURES[theme] }).every((url) => !url.includes('undefined')),
    `no ${theme} texture references an undefined palette color`
  );
  assert(typeof PAGE_BACKGROUND_TEXTURES[theme] === 'string' && !PAGE_BACKGROUND_TEXTURES[theme].includes('undefined'), `${theme} has a backdrop`);
}

// Rotation and trap costs.
assert(rotateTileType('turret-up') === 'turret-right', 'turrets rotate clockwise');
assert(rotateTileType('current-left') === 'current-up', 'rotation wraps around from left back to up');
assert(rotateTileType('imp-h') === 'imp-v' && rotateTileType('imp-v') === 'imp-h', 'imps flip patrol axis');
assert(rotateTileType('spike') === null, 'non-directional tiles do not rotate');
assert(trapCost('bomb') === 2 && trapCost('spike') === 1 && trapCost('ice') === 0, 'trap costs: bomb 2, spike 1, ice free');
assert(rotateTileType('boar-h') === 'boar-v' && rotateTileType('boar-v') === 'boar-h', 'boars flip patrol axis');
assert(
  trapCost('thinice') === 1 && trapCost('frost') === 1 && trapCost('vines') === 1 &&
    trapCost('icicle') === 2 && trapCost('snapjaw') === 2 && trapCost('boar-h') === 2 && trapCost('mushroom') === 0,
  'new trap costs: thin ice/frost/vines 1, icicle/snapjaw/boar 2, mushroom free'
);

const budgetLevel = createEmptyLevel(4);
setTileType(budgetLevel, 0, 0, 'bomb');
setTileType(budgetLevel, 1, 0, 'spike');
assert(countTrapPoints(budgetLevel) === 3, 'trap points add up per-type costs');
assert(canPlaceTileType(budgetLevel, 2, 0, 'spike', 4) === true, 'a 1-point trap fits in the last point of budget');
assert(canPlaceTileType(budgetLevel, 2, 0, 'turret-up', 4) === false, 'a 2-point trap does not fit in 1 remaining point');
assert(canPlaceTileType(budgetLevel, 1, 0, 'turret-up', 4) === true, 'upgrading a spike to a turret only costs the difference');
assert(canPlaceTileType(budgetLevel, 2, 0, 'ice', 3) === true, 'movement tiles are free even at a full budget');
setTileType(budgetLevel, 0, 1, 'portal-a');
setTileType(budgetLevel, 1, 1, 'portal-a');
assert(canPlaceTileType(budgetLevel, 2, 1, 'portal-a') === false, 'at most two portals of each color');
assert(canPlaceTileType(budgetLevel, 2, 1, 'portal-b') === true, 'the other portal color is still available');

// Ice: one keypress slides all the way across to the goal.
const iceLevel = corridor(['start', 'ice', 'ice', 'ice', 'goal']);
assert(solveBFS(iceLevel).moves === 1, 'ice slides the player the whole way in one move');

// Ice sliding into a spike kills, even if you only meant to take one step.
const iceSpikeCtx = buildHazardContext(corridor(['start', 'ice', 'ice', 'spike', 'goal']));
const iceSpikeMove = resolveMove(iceSpikeCtx, 0, 0, 1, 0, 0, []);
assert(iceSpikeMove.death && iceSpikeMove.death.label === 'spike', 'sliding on ice into a spike is fatal');

// Ice deflection: a slide that runs into something glances off onto the
// next tile to the side instead of stopping dead.
const gridLevel = (rows) => ({ size: rows.length, start: null, goal: null, tiles: rows.flat() });
const xyOf = (level, idx) => [idx % level.size, Math.floor(idx / level.size)];

const deflectDown = gridLevel([
  ['start', 'ice',  'ice',   'wall'],
  ['wall',  'wall', 'empty', 'wall'],
  ['wall',  'wall', 'empty', 'wall'],
  ['wall',  'wall', 'wall',  'wall'],
]);
const deflectDownMove = resolveMove(buildHazardContext(deflectDown), 0, 0, 1, 0, 0, []);
assert(
  JSON.stringify(xyOf(deflectDown, deflectDownMove.final)) === '[2,1]',
  'sliding right into a wall glances down onto the next tile'
);

const deflectEither = gridLevel([
  ['wall',  'wall', 'empty', 'wall'],
  ['start', 'ice',  'ice',   'wall'],
  ['wall',  'wall', 'empty', 'wall'],
  ['wall',  'wall', 'wall',  'wall'],
]);
assert(
  JSON.stringify(xyOf(deflectEither, resolveMove(buildHazardContext(deflectEither), 0, 1, 1, 0, 0, []).final)) === '[2,2]',
  'a horizontal slide blocked ahead prefers down when up is open too'
);

const deflectUp = gridLevel([
  ['wall',  'wall', 'empty', 'wall'],
  ['start', 'ice',  'ice',   'wall'],
  ['wall',  'wall', 'wall',  'wall'],
  ['wall',  'wall', 'wall',  'wall'],
]);
assert(
  JSON.stringify(xyOf(deflectUp, resolveMove(buildHazardContext(deflectUp), 0, 1, 1, 0, 0, []).final)) === '[2,0]',
  'a horizontal slide glances up when down is blocked'
);

const deflectRight = gridLevel([
  ['start', 'wall',  'wall'],
  ['ice',   'empty', 'wall'],
  ['wall',  'wall',  'wall'],
]);
assert(
  JSON.stringify(xyOf(deflectRight, resolveMove(buildHazardContext(deflectRight), 0, 0, 0, 1, 0, []).final)) === '[1,1]',
  'a vertical slide blocked ahead glances right'
);

const deflectChain = gridLevel([
  ['start', 'ice',   'wall', 'wall'],
  ['wall',  'ice',   'wall', 'wall'],
  ['wall',  'ice',   'wall', 'wall'],
  ['wall',  'empty', 'wall', 'wall'],
]);
const chainMove = resolveMove(buildHazardContext(deflectChain), 0, 0, 1, 0, 0, []);
assert(
  JSON.stringify(xyOf(deflectChain, chainMove.final)) === '[1,3]' && chainMove.path.length === 4,
  'glancing onto more ice keeps sliding in the new direction'
);

const boxedIn = gridLevel([
  ['start', 'ice',  'wall'],
  ['wall',  'wall', 'wall'],
  ['wall',  'wall', 'wall'],
]);
assert(
  JSON.stringify(xyOf(boxedIn, resolveMove(buildHazardContext(boxedIn), 0, 0, 1, 0, 0, []).final)) === '[1,0]',
  'ice with nowhere to go ahead or sideways stops the slide'
);

// Slide animation timing: one SLIDE_MS_PER_TILE per tile glided, and a
// portal warp (non-adjacent jump) takes twice as long.
const iceTimeline = slideTimeline(5, 0, resolveMove(buildHazardContext(iceLevel), 0, 0, 1, 0, 0, []).path);
assert(
  iceTimeline.durationMs === 4 * SLIDE_MS_PER_TILE && iceTimeline.stops.length === 5,
  'an ice slide animates one tile at a time, start to finish'
);
const warpTimeline = slideTimeline(5, 0, [1, 3]);
assert(
  warpTimeline.stops[2].warp === true && warpTimeline.durationMs === 3 * SLIDE_MS_PER_TILE,
  'a portal jump is animated as a warp, not a glide'
);

// Lava current: stepping on it shoves you one more tile its way.
const currentCtx = buildHazardContext(corridor(['start', 'current-right', 'empty', 'empty', 'goal']));
assert(resolveMove(currentCtx, 0, 0, 1, 0, 0, []).final === 2, 'a lava current pushes the player one tile');
const blockedCurrentCtx = buildHazardContext(corridor(['start', 'current-left', 'empty', 'goal']));
// Pushed back onto the start tile — a legal (if annoying) outcome.
assert(resolveMove(blockedCurrentCtx, 0, 0, 1, 0, 0, []).final === 0, 'a current can push you backwards');
const loopCtx = buildHazardContext(corridor(['start', 'current-right', 'current-left', 'goal']));
assert(resolveMove(loopCtx, 0, 0, 1, 0, 0, []) !== undefined, 'currents pointing at each other do not loop forever');

// Portals: the only way past the wall is through the portal pair.
const portalLevel = corridor(['start', 'portal-a', 'wall', 'portal-a', 'goal']);
assert(solveBFS(portalLevel).moves === 2, 'portals teleport to their partner');
assert(isSolvable(corridor(['start', 'portal-b', 'wall', 'portal-a', 'goal'])) === false, 'mismatched portal colors do not link');

// Hidden spikes are exactly as deadly as spikes to the solver.
assert(isSolvable(corridor(['start', 'hiddenspike', 'goal'])) === false, 'a hidden spike blocks like a spike');

// Turret: fireballs march 1 tile per tick, one every TURRET_PERIOD ticks.
const turretCtx = buildHazardContext(corridor(['turret-right', 'empty', 'empty', 'empty', 'empty', 'start', 'goal']));
assert(hazardAt(turretCtx, 1, 1) === 'fireball', 'a fireball is 1 tile out 1 tick after firing');
assert(hazardAt(turretCtx, 2, 2) === 'fireball', 'the same fireball is 2 tiles out a tick later');
assert(hazardAt(turretCtx, 1, 2) === null, 'the tile it just left is clear again');
assert(hazardAt(turretCtx, 5, 5) === null, 'fireballs never enter the start tile');

// Vent: 2 ticks of fire every 5, reaching VENT_RANGE tiles ahead.
const ventCtx = buildHazardContext(corridor(['start', 'vent-right', 'empty', 'empty', 'empty', 'goal']));
assert(hazardAt(ventCtx, 1, 0) === null && hazardAt(ventCtx, 1, 3) === 'flame vent', 'vents are dormant, then erupt');
assert(hazardAt(ventCtx, 3, 3) === 'flame vent' && hazardAt(ventCtx, 4, 3) === null, 'vent fire reaches 2 tiles ahead');

// Imps pace back and forth along their open run.
const impCtx = buildHazardContext(corridor(['start', 'imp-h', 'empty', 'empty', 'goal']));
const impTrack = [0, 1, 2, 3, 4].map((t) => impPositionAt(impCtx.imps[0], t));
assert(JSON.stringify(impTrack) === JSON.stringify([1, 2, 3, 2, 1]), 'an imp ping-pongs between start and goal');
assert(isSolvable(corridor(['start', 'imp-h', 'goal'])) === false, 'an imp pinned in a 1-tile gap blocks it for good');

// Bombs: lit on entry, explode BOMB_FUSE_TICKS later in a plus shape, and
// set off bombs caught in the blast.
const bombCorridor = corridor(['start', 'bomb', 'bomb', 'empty', 'empty', 'empty', 'goal']);
const bombCtx = buildHazardContext(bombCorridor);
const bombMove = resolveMove(bombCtx, 0, 0, 1, 0, 0, initialObjectStates(bombCtx));
assert(JSON.stringify(bombMove.litBombs) === '[0]', 'stepping on a bomb lights its fuse');
let bombStates = [BOMB_FUSE_TICKS, BOMB_ARMED];
for (let t = 1; t < BOMB_FUSE_TICKS; t++) bombStates = advanceObjects(bombCtx, bombStates);
assert(hazardAt(bombCtx, 2, BOMB_FUSE_TICKS - 1, bombStates) === null, 'no blast before the fuse runs out');
bombStates = advanceObjects(bombCtx, bombStates);
assert(hazardAt(bombCtx, 2, BOMB_FUSE_TICKS, bombStates) === 'bomb blast', 'the blast covers neighboring tiles');
assert(hazardAt(bombCtx, 0, BOMB_FUSE_TICKS, bombStates) === null, 'the blast never reaches the start tile');
assert(bombStates[1] === 1, 'a blast reaching another bomb sets it off next tick');
bombStates = advanceObjects(bombCtx, bombStates);
assert(bombStates[0] === BOMB_GONE && bombStates[1] === BOMB_EXPLODING, 'chain reaction: second bomb explodes a tick later');
assert(isSolvable(bombCorridor), 'a bomb corridor is solvable by running straight through it');

// --- Ice-theme traps ---------------------------------------------------------

// Thin ice breaks when you step off it, and is deadly once broken.
const thinCtx = buildHazardContext(corridor(['start', 'thinice', 'empty', 'goal']));
const offThin = resolveMove(thinCtx, 1, 0, 1, 0, 0, initialObjectStates(thinCtx));
assert(JSON.stringify(offThin.brokenIce) === '[0]', 'stepping off thin ice breaks it');
assert(resolveMove(thinCtx, 0, 0, 1, 0, 0, initialObjectStates(thinCtx)).brokenIce.length === 0, 'stepping onto thin ice does not break it');
assert(hazardAt(thinCtx, 1, 0, [THIN_ICE_BROKEN]) === 'thin ice', 'broken thin ice is deadly');
assert(hazardAt(thinCtx, 1, 0, [THIN_ICE_INTACT]) === null, 'intact thin ice is safe');
const thinSlide = buildHazardContext(corridor(['start', 'ice', 'thinice', 'ice', 'goal']));
assert(resolveMove(thinSlide, 0, 0, 1, 0, 0, [0]).final === 2, 'a slide stops dead on thin ice');
assert(isSolvable(corridor(['start', 'thinice', 'goal'])) === true, 'thin ice can be crossed once');
// A current that shoves you straight back onto the thin ice you just left
// drops you in: it broke the moment you stepped off.
const pushBack = resolveMove(buildHazardContext(corridor(['start', 'thinice', 'current-left', 'goal'])), 1, 0, 1, 0, 0, [0]);
assert(pushBack.death && pushBack.death.label === 'thin ice', 'being pushed back onto thin ice you just left is fatal');

// Frostbite: you may arrive, but never wait. Waiting out a timed spike has
// to happen on the start tile, not the frost in front of it.
assert(solveBFS(corridor(['start', 'frost', 'goal'])).moves === 2, 'frost is safe to walk across');
assert(solveBFS(corridor(['start', 'frost', 'timedspike', 'goal'])).moves === 4, 'the bot waits on safe ground, not on frost');
assert(isSolvable(corridor(['start', 'timedspike', 'frost', 'timedspike', 'goal'])) === false, 'frost between two timed spikes cannot be waited on');

// Falling icicle: walking under it starts it shaking; it crashes
// ICICLE_DROP_TICKS later (deadly on its tile), then lies there as a solid
// block that also stops shots.
const icicleCtx = buildHazardContext(corridor(['start', 'icicle', 'empty', 'goal']));
const underIcicle = resolveMove(icicleCtx, 0, 0, 1, 0, 0, [ICICLE_HANGING]);
assert(JSON.stringify(underIcicle.litIcicles) === '[0]', 'walking under an icicle shakes it loose');
let icicleStates = applyMoveToObjects([ICICLE_HANGING], underIcicle);
for (let t = 0; t < ICICLE_DROP_TICKS; t++) icicleStates = advanceObjects(icicleCtx, icicleStates);
assert(hazardAt(icicleCtx, 1, 0, icicleStates) === 'falling icicle', 'the icicle crashes ICICLE_DROP_TICKS later');
icicleStates = advanceObjects(icicleCtx, icicleStates);
assert(icicleStates[0] === ICICLE_FALLEN && isSolidAt(icicleCtx, 1, icicleStates), 'a fallen icicle is solid');
assert(resolveMove(icicleCtx, 0, 0, 1, 0, 0, icicleStates) === null, 'you cannot walk into a fallen icicle');
const shieldCtx = buildHazardContext(corridor(['turret-right', 'empty', 'icicle', 'empty', 'empty', 'start', 'goal']));
assert(hazardAt(shieldCtx, 4, 4, [ICICLE_HANGING]) === 'fireball', 'shots pass under a hanging icicle');
assert(hazardAt(shieldCtx, 4, 4, [ICICLE_FALLEN]) === null, 'a fallen icicle blocks shots');
assert(hazardAt(shieldCtx, 1, 1, [ICICLE_FALLEN]) === 'fireball', 'shots still reach tiles before the icicle');

// --- Grass-theme traps -------------------------------------------------------

// Vines: grabbed on entry, then held for VINE_HOLD_TICKS turns.
assert(resolveMove(buildHazardContext(corridor(['start', 'vines', 'goal'])), 0, 0, 1, 0, 0, []).grabbed === true, 'vines grab you');
assert(solveBFS(corridor(['start', 'vines', 'empty', 'goal'])).moves === 3 + VINE_HOLD_TICKS, 'vines hold the bot for VINE_HOLD_TICKS turns');
assert(resolveMove(buildHazardContext(corridor(['start', 'ice', 'vines', 'ice', 'goal'])), 0, 0, 1, 0, 0, []).final === 2, 'vines stop a slide');

// Mushroom: bounces you 2 tiles on, over anything but a solid tile.
const hopMove = resolveMove(buildHazardContext(corridor(['start', 'mushroom', 'spike', 'empty', 'goal'])), 0, 0, 1, 0, 0, []);
assert(hopMove.final === 3 && !hopMove.death && JSON.stringify(hopMove.hops) === '[1]', 'a mushroom hops you over a spike');
assert(isSolvable(corridor(['start', 'mushroom', 'wall', 'goal'])) === false, 'mushrooms cannot hop walls');
assert(resolveMove(buildHazardContext(corridor(['start', 'mushroom', 'spike', 'spike', 'goal'])), 0, 0, 1, 0, 0, []).death.label === 'spike', 'a mushroom can bounce you onto a spike');

// Snapjaw: solid, bites its 4 neighbors on the last tick of each 6.
const jawCtx = buildHazardContext(corridor(['start', 'empty', 'snapjaw', 'empty', 'goal']));
assert(isSolidTile('snapjaw'), 'snapjaws are solid');
assert(hazardAt(jawCtx, 1, SNAPJAW_PERIOD - 1) === 'snapjaw' && hazardAt(jawCtx, 3, SNAPJAW_PERIOD - 1) === 'snapjaw', 'a snapjaw bites beside it');
assert(hazardAt(jawCtx, 1, SNAPJAW_PERIOD - 2) === null, 'and only on its bite tick');

// Boar: 2 tiles per tick; both tiles it crosses are deadly.
const boarCtx = buildHazardContext(corridor(['start', 'boar-h', 'empty', 'empty', 'empty', 'goal']));
assert(JSON.stringify(boarCellsAt(boarCtx.boars[0], 1)) === '[3,2]', 'a boar charges 2 tiles per tick');
assert(hazardAt(boarCtx, 2, 1) === 'wild boar' && hazardAt(boarCtx, 3, 1) === 'wild boar', 'both tiles a boar crosses are deadly');

// --- Daily Puzzle -------------------------------------------------------

// Determinism: the whole point of seeding from the date is that every
// player gets the same puzzle with no backend — so generation must be a
// pure function of (date, type, difficulty), not Math.random().
assert(
  JSON.stringify(generateDailySolverLevel('2026-09-16', 'medium')) ===
    JSON.stringify(generateDailySolverLevel('2026-09-16', 'medium')),
  'daily solver level generation is deterministic for a given date/difficulty'
);
assert(
  JSON.stringify(generateDailySolverLevel('2026-09-16', 'medium')) !==
    JSON.stringify(generateDailySolverLevel('2026-09-17', 'medium')),
  'daily solver level generation differs across dates'
);
for (const difficulty of DIFFICULTIES) {
  assert(
    isSolvable(generateDailySolverLevel('2026-09-16', difficulty)),
    `generated daily solver level (${difficulty}) is solvable`
  );
}

// The daily theme rotates lava -> ice -> grass by date, the same for
// everyone, and each room is generated in (and marked with) that theme.
assert(
  ['2026-06-01', '2026-06-02', '2026-06-03'].map(dailyThemeFor).sort().join() === 'grass,ice,lava',
  'three consecutive days cover all three daily themes'
);
assert(dailyThemeFor('2026-06-01') === dailyThemeFor('2026-06-04'), 'the daily theme repeats every 3 days');

// Across a month of dates, every difficulty should generate a real room
// (not the empty fallback) that actually includes its theme's signature
// traps.
const DAILY_SIGNATURE = { lava: ['bomb', 'turret'], ice: ['turret', 'icicle'], grass: ['snapjaw'] };
for (const difficulty of DIFFICULTIES) {
  let fallbacks = 0;
  let missing = 0;
  let wrongTheme = 0;
  for (let day = 1; day <= 30; day++) {
    const dateStr = `2026-06-${String(day).padStart(2, '0')}`;
    const level = generateDailySolverLevel(dateStr, difficulty);
    if (level.theme !== dailyThemeFor(dateStr)) wrongTheme++;
    const fallback = buildFallbackSolverLevel(level.size);
    if (JSON.stringify(level.tiles) === JSON.stringify(fallback.tiles)) fallbacks++;
    if (!DAILY_SIGNATURE[level.theme].every((f) => level.tiles.some((t) => tileFamily(t) === f))) missing++;
  }
  assert(fallbacks === 0, `daily ${difficulty}: no date fell back to the empty room`);
  assert(missing === 0, `daily ${difficulty}: every room has its theme's signature traps`);
  assert(wrongTheme === 0, `daily ${difficulty}: every room is in the day's theme`);
}

assert(
  JSON.stringify(generateDailyBuilderConstraints('2026-09-16', 'hard')) ===
    JSON.stringify(generateDailyBuilderConstraints('2026-09-16', 'hard')),
  'daily builder constraints are deterministic for a given date/difficulty'
);

// solveBFS is isSolvable's shared implementation, extended to also report
// the shortest solving path length (used to score a Daily Puzzle builder
// challenge against its minBotMoves target) — check both halves agree with
// the plain isSolvable cases above and that the move count itself is right.
const shortPathLevel = {
  size: 3,
  start: [0, 0],
  goal: [2, 0],
  tiles: ['start', 'empty', 'goal', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
};
const shortPathResult = solveBFS(shortPathLevel);
assert(shortPathResult.solvable === true && shortPathResult.moves === 2, 'solveBFS reports the shortest path length');
const unsolvableResult = solveBFS(wallBlockedLevel);
assert(
  unsolvableResult.solvable === false && unsolvableResult.moves === null,
  'solveBFS reports moves: null when unsolvable'
);

// isDailyStreakEarned: 2-of-3 difficulty modes (via either challenge type)
// or hard alone, per SPEC.md's Daily Puzzle streak rule.
assert(
  isDailyStreakEarned({ solver: { hard: true }, builder: {} }) === true,
  'completing hard alone earns the daily streak'
);
assert(
  isDailyStreakEarned({ solver: { easy: true }, builder: { medium: true } }) === true,
  'completing 2 of 3 modes across both types earns the daily streak'
);
assert(
  isDailyStreakEarned({ solver: { easy: true }, builder: {} }) === false,
  'completing only 1 of 3 non-hard modes does not earn the daily streak'
);
assert(
  isDailyStreakEarned({ solver: {}, builder: {} }) === false,
  'completing nothing does not earn the daily streak'
);

// markDailyChallengeComplete: exercised against real localStorage (like
// readBestScore/writeBestScore above) but under dedicated fake dates so it
// can't collide with an actual player's saved progress.
localStorage.removeItem('trapRoomDailyStats');
markDailyChallengeComplete('2026-02-01', 'solver', 'hard');
const consecutiveDay = markDailyChallengeComplete('2026-02-02', 'builder', 'hard');
assert(consecutiveDay.currentStreak === 2, 'consecutive days extend the streak');
assert(consecutiveDay.totalDaysCompleted === 2, 'each newly-earned day increments totalDaysCompleted');

const afterGap = markDailyChallengeComplete('2026-02-04', 'solver', 'hard'); // 2026-02-03 skipped
assert(afterGap.currentStreak === 1, 'a skipped day resets the streak to 1');
assert(afterGap.bestStreak === 2, 'bestStreak keeps the earlier high point after a reset');

const beforeRepeat = markDailyChallengeComplete('2026-02-04', 'solver', 'hard'); // already completed
assert(
  beforeRepeat.totalDaysCompleted === afterGap.totalDaysCompleted,
  'completing an already-completed challenge again does not double-count'
);
localStorage.removeItem('trapRoomDailyStats');

// --- Themes and shared links -------------------------------------------------

assert(trapLabel('spike', 'ice') === 'Icicle Spike' && trapLabel('current-up', 'grass') === 'Stream', 'shared traps are named per theme');
assert(trapLabel('oneway-left', 'lava') === 'One-Way ←', 'one-way labels keep their arrow');
assert(normalizeTheme('volcano') === 'lava' && levelTheme({}) === 'lava', 'an unknown or missing theme is lava');
const themedRoom = { ...roundTripLevel, theme: 'grass' };
assert(decodeLevel(encodeLevel(themedRoom)).theme === 'grass', 'a shared link remembers the theme it was built in');

// --- Campaign ----------------------------------------------------------------

assert(CAMPAIGN_LEVELS.length === THEMES.length * LEVELS_PER_THEME, 'the campaign has 10 levels per theme');
assert(new Set(CAMPAIGN_LEVELS.map((d) => d.id)).size === CAMPAIGN_LEVELS.length, 'campaign level ids are unique');
const allowedFamilies = (theme) => new Set([...PALETTE_BASICS, 'empty', ...THEME_TRAPS[theme]].map(tileFamily));
for (const def of CAMPAIGN_LEVELS) {
  let level;
  try {
    level = campaignLevel(def.id);
  } catch (e) {
    assert(false, `${def.id} parses (${e.message})`);
    continue;
  }
  const { solvable, moves } = solveBFS(level);
  assert(solvable, `${def.id} "${def.name}" is solvable (${moves} turns)`);
  const allowed = allowedFamilies(def.theme);
  const stray = level.tiles.filter((t) => !allowed.has(tileFamily(t)));
  assert(stray.length === 0, `${def.id} only uses ${def.theme} traps${stray.length ? ` (found ${[...new Set(stray)]})` : ''}`);
  const count = (type) => level.tiles.filter((t) => t === type).length;
  assert(
    count('bomb') <= MAX_BOMBS && count('icicle') <= MAX_ICICLES && count('thinice') <= MAX_THIN_ICE &&
      count('portal-a') <= MAX_PORTALS_PER_COLOR && count('portal-b') <= MAX_PORTALS_PER_COLOR,
    `${def.id} stays within Creative Mode's per-trap caps`
  );
  if (def.timeLimit) {
    const botSeconds = (moves * HAZARD_TICK_MS) / 1000;
    assert(def.timeLimit >= botSeconds * 2 + 4, `${def.id}'s ${def.timeLimit}s limit leaves at least double the bot's ${botSeconds}s`);
  }
}
for (const theme of THEMES) {
  const firstIntro = levelIntroductions(themeLevels(theme)[0].id);
  assert(firstIntro.length > 0, `${theme} level 1 introduces at least one trap`);
}

// Unlock rules: lava is always open; the next theme opens at
// UNLOCK_REQUIREMENT completed levels of the previous one; levels open in
// order.
resetProgress();
let progress = loadProgress();
assert(isThemeUnlocked(progress, 'lava') && !isThemeUnlocked(progress, 'ice'), 'a fresh save has only lava unlocked');
assert(isLevelUnlocked(progress, 'lava', 0) && !isLevelUnlocked(progress, 'lava', 1), 'only lava level 1 is open at first');
themeLevels('lava').slice(0, UNLOCK_REQUIREMENT - 1).forEach((def) => {
  progress = recordLevelComplete(def.id, { moves: 10, timeMs: 5000, deaths: 1 });
});
assert(!isThemeUnlocked(progress, 'ice'), `${UNLOCK_REQUIREMENT - 1} lava levels do not unlock ice`);
assert(isLevelUnlocked(progress, 'lava', UNLOCK_REQUIREMENT - 1), 'beating a level opens the next one');
progress = recordLevelComplete(themeLevels('lava')[UNLOCK_REQUIREMENT - 1].id, { moves: 10, timeMs: 5000, deaths: 0 });
assert(isThemeUnlocked(progress, 'ice') && !isThemeUnlocked(progress, 'grass'), `${UNLOCK_REQUIREMENT} lava levels unlock ice (not grass)`);
progress = recordLevelComplete('lava-01', { moves: 7, timeMs: 9000, deaths: 3 });
assert(
  JSON.stringify(progress.levels['lava-01']) === JSON.stringify({ moves: 7, timeMs: 5000, deaths: 1 }),
  'a replay keeps the best of each stat'
);
resetProgress();
assert(completedCount(loadProgress(), 'lava') === 0, 'reset progress clears every level');

// Cloud saves (cloudsave.js): merging two copies of a save keeps everything
// either one earned.
{
  const phone = normalizeSave({
    progress: { levels: { 'lava-01': { moves: 9, timeMs: 4000, deaths: 2 }, 'lava-02': { moves: 20, timeMs: 9000, deaths: 0 } } },
    bestScores: { roomA: 12, roomB: 30 },
    dailyStats: {
      currentStreak: 3, bestStreak: 3, totalDaysCompleted: 5, lastStreakDate: '2026-09-23',
      perDifficultyCompletions: { easy: 4, medium: 2, hard: 1 },
      today: { date: '2026-09-24', completed: { solver: { easy: true }, builder: {} }, streakEarned: false },
    },
  });
  const laptop = normalizeSave({
    progress: { levels: { 'lava-01': { moves: 7, timeMs: 6000, deaths: 1 }, 'lava-03': { moves: 15, timeMs: 7000, deaths: 4 } } },
    bestScores: { roomA: 10, roomC: 8 },
    dailyStats: {
      currentStreak: 1, bestStreak: 6, totalDaysCompleted: 7, lastStreakDate: '2026-09-20',
      perDifficultyCompletions: { easy: 6, medium: 1, hard: 1 },
      today: { date: '2026-09-24', completed: { solver: {}, builder: { medium: true } }, streakEarned: false },
    },
  });
  const merged = mergeSaves(phone, laptop);
  assert(
    Object.keys(merged.progress.levels).sort().join() === 'lava-01,lava-02,lava-03',
    'merged saves keep levels beaten on either device'
  );
  assert(
    JSON.stringify(merged.progress.levels['lava-01']) === JSON.stringify({ moves: 7, timeMs: 4000, deaths: 1 }),
    'merged saves keep the best of each level stat'
  );
  assert(
    JSON.stringify(merged.bestScores) === JSON.stringify({ roomA: 10, roomB: 30, roomC: 8 }),
    'merged saves keep the fewest moves per room'
  );
  const ds = merged.dailyStats;
  assert(ds.currentStreak === 3 && ds.lastStreakDate === '2026-09-23', 'merged daily stats keep the most recent streak');
  assert(ds.bestStreak === 6 && ds.totalDaysCompleted === 7 && ds.perDifficultyCompletions.easy === 6 && ds.perDifficultyCompletions.medium === 2,
    'merged daily stats keep the higher lifetime counts');
  assert(ds.today.completed.solver.easy && ds.today.completed.builder.medium, "merged daily stats combine the same day's completions");
  assert(serializeSave(mergeSaves(phone, laptop)) === serializeSave(mergeSaves(laptop, phone)), 'merging is order-independent');
  assert(serializeSave(mergeSaves(merged, merged)) === serializeSave(merged), 'merging a save with itself changes nothing');

  const yesterday = normalizeSave({ dailyStats: { today: { date: '2026-09-23', completed: { solver: { hard: true }, builder: {} }, streakEarned: true } } });
  assert(mergeSaves(yesterday, laptop).dailyStats.today.date === '2026-09-24', "a newer day's completions replace an older day's");

  const reset = mergeSaves(normalizeSave({}), laptop, { campaignReset: true });
  assert(Object.keys(reset.progress.levels).length === 0 && reset.bestScores.roomC === 8,
    'a campaign reset replaces the other copy’s campaign but still merges the rest');

  assert(serializeSave(parseSave('not json')) === serializeSave(emptySave()), 'a corrupt cloud save reads as empty');
  const odd = normalizeSave({ progress: { levels: { x: 'nope', y: { moves: '5' } } }, bestScores: { r: 'abc', s: 4 } });
  assert(!('x' in odd.progress.levels) && odd.progress.levels.y.moves === 5 && odd.progress.levels.y.timeMs === null,
    'normalizeSave drops malformed levels and fills missing stats');
  assert(JSON.stringify(odd.bestScores) === JSON.stringify({ s: 4 }), 'normalizeSave drops non-numeric best scores');

  // Round trip through this device's storage, putting the real save back after.
  const realSave = readLocalSave();
  writeLocalSave(merged);
  assert(serializeSave(readLocalSave()) === serializeSave(merged), 'writeLocalSave/readLocalSave round-trip a save');
  clearLocalSave();
  assert(serializeSave(readLocalSave()) === serializeSave(emptySave()), 'clearLocalSave removes the whole save');
  writeLocalSave(realSave);
}

restoreStorage();
console.log('Sanity checks complete.');
