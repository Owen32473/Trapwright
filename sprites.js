'use strict';

// Pixel-art sprite system. Every visual here is generated at runtime from
// small pixel-grid data (arrays of palette-key characters) — there are no
// external image files. A frame + its palette becomes an inline SVG (one
// <rect> per pixel, shape-rendering="crispEdges" for sharp edges at any
// scale) turned into a `data:image/svg+xml` URL, which is then used as a
// normal CSS background-image. This keeps rendering declarative (plain
// background-image on existing tile/sprite elements) and fully responsive
// (SVG viewBox scaling — no JS resize tracking needed), matching the rest
// of the vanilla HTML/CSS/JS setup.

const PIXEL_TRANSPARENT = '.';

// --- Low-level pixel grid helpers ----------------------------------------

function makeGrid(w, h, fill = PIXEL_TRANSPARENT) {
  return Array.from({ length: h }, () => new Array(w).fill(fill));
}

function setPixel(grid, x, y, ch) {
  if (grid[y] !== undefined && grid[y][x] !== undefined) grid[y][x] = ch;
}

function fillRect(grid, x0, y0, w, h, ch) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPixel(grid, x, y, ch);
  }
}

// Rotates a frame (array of equal-length strings) 90 degrees clockwise.
// Used to derive the three rotated oneway-arrow directions from a single
// hand-authored "up" arrow instead of redrawing each one.
function rotateFrame90CW(frame) {
  const h = frame.length;
  const w = frame[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    let row = '';
    for (let y = h - 1; y >= 0; y--) row += frame[y][x];
    out.push(row);
  }
  return out;
}

// Converts a frame (array of palette-key strings) + palette (key -> CSS
// color) into an inline SVG data URL. '.' pixels are left transparent.
// By default the SVG keeps its own aspect ratio when scaled (fine for tiles
// and sprites drawn into boxes of the same shape). `stretch` makes it fill
// whatever box it's given instead — needed for art stretched over
// variable-width UI like the button plate, which otherwise shrinks to a
// letterboxed strip in the middle of a wide button and lets the label run
// off its edges. `intrinsic` gives the SVG a pixel size (one CSS px per
// pixel) — border-image slices are counted in those pixels.
function frameToDataURL(frame, palette, { stretch = false, intrinsic = false } = {}) {
  const rows = frame.length;
  const cols = frame[0].length;
  let rects = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = frame[y][x];
      if (ch === PIXEL_TRANSPARENT) continue;
      const color = palette[ch];
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
    }
  }
  const aspect = stretch ? ' preserveAspectRatio="none"' : '';
  const size = intrinsic ? ` width="${cols}" height="${rows}"` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}"${size}${aspect} shape-rendering="crispEdges">${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// --- Shared floor base (used by empty/spike/start/goal so trap and item
// tiles still read as "sitting on the same floor" as plain empty tiles) ---
//
// Volcanic reskin: warm ash-grey basalt ground instead of neutral stone.
// Tiles are 16x16 now (up from 12x12) — the extra resolution is what gives
// the volcanic reskin room for the ember-crack flecks and pebble detail
// that a flatter 12x12 grid didn't have space for.

function floorBaseGrid(w = 16, h = 16) {
  const g = makeGrid(w, h, 'A');
  fillRect(g, 0, 7, w, 2, 'B');
  fillRect(g, 7, 0, 2, h, 'B');
  return g;
}
const FLOOR_PALETTE = { A: '#4a4038', B: '#332b24', C: '#5c5147', E: '#8a4020' };

// Each of the floor's 4 flagstones (the grout cross divides it into a
// 2x2 grid) gets its own light-top/left, dark-bottom/right bevel, a couple
// of pebble flecks, and one dull ember-crack fleck (E) — deliberately
// muted/desaturated rather than the bright glowing orange used on spikes,
// so floor still reads as safe ground at a glance and never competes with
// a trap tile's danger signal (see the spike section below). Shared by
// every floor-based tile (plain floor, start, goal) so they all sit on the
// same textured ground rather than start/goal floating on a flatter,
// less-detailed backdrop than an ordinary empty tile.
function addFloorBevel(g) {
  const quads = [[0, 0], [9, 0], [0, 9], [9, 9]];
  for (const [qx, qy] of quads) {
    fillRect(g, qx, qy, 7, 1, 'C');
    fillRect(g, qx, qy, 1, 7, 'C');
    fillRect(g, qx, qy + 6, 7, 1, 'B');
    fillRect(g, qx + 6, qy, 1, 7, 'B');
  }
  setPixel(g, 2, 2, 'C'); setPixel(g, 11, 2, 'C');
  setPixel(g, 2, 11, 'C'); setPixel(g, 11, 11, 'C');
  setPixel(g, 4, 12, 'B'); setPixel(g, 12, 4, 'B');
  setPixel(g, 3, 5, 'E'); setPixel(g, 4, 5, 'E');
  return g;
}

function makeFloorFrame() {
  return floorGrid().map((row) => row.join(''));
}

// --- Wall: jagged basalt rock blocks with faint lava-vein cracks --------

const WALL_PALETTE = { D: '#241d1a', E: '#150f0d', F: '#332821', G: '#0d0908', L: '#a8461f' };

// `accent` picks the detail drawn over the shared block pattern: glowing
// lava veins, frost glints on packed ice, or moss dripping over stone.
function makeWallFrame(accent = 'veins') {
  const g = makeGrid(16, 16, 'D');
  for (let y = 0; y < 16; y += 4) fillRect(g, 0, y, 16, 1, 'E');
  for (let band = 0; band < 4; band++) {
    const y0 = band * 4 + 1;
    const offset = band % 2 === 0 ? 0 : 4;
    const mortarCols = new Set();
    for (let x = offset; x < 16; x += 8) {
      fillRect(g, x, y0, 1, 3, 'E');
      mortarCols.add(x);
    }
    // Bevel each individual block (light top edge, dark bottom edge)
    // instead of a full-width line, so the vertical seams stay intact
    // instead of being painted over by the bevel.
    for (let x = 0; x < 16; x++) {
      if (mortarCols.has(x)) continue;
      setPixel(g, x, y0, 'F');
      setPixel(g, x, y0 + 2, 'G');
    }
  }
  // Faint glowing lava-vein cracks running through the rock — a quiet
  // reminder that this wall is part of the same volcanic mountain as the
  // page background, not just recolored dungeon stone.
  if (accent === 'veins') {
    setPixel(g, 6, 6, 'L'); setPixel(g, 7, 7, 'L');
    setPixel(g, 12, 13, 'L'); setPixel(g, 3, 11, 'L');
  } else if (accent === 'frost') {
    // Snow settled along the top of each block row, plus a glint or two.
    for (let y = 1; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) if ((x * 5 + y) % 9 < 2) setPixel(g, x, y, 'L');
    }
    setPixel(g, 5, 6, 'L'); setPixel(g, 11, 10, 'L');
  } else if (accent === 'crumble') {
    addCrumble(g);
  } else if (accent === 'moss') {
    // Moss clumps on the block tops, a few strands hanging down.
    for (const [x, y, len] of [[2, 1, 2], [9, 1, 1], [13, 5, 2], [5, 5, 1], [1, 9, 1], [10, 9, 3], [6, 13, 1], [14, 13, 1]]) {
      fillRect(g, x, y, 2, 1, 'L');
      fillRect(g, x, y + 1, 1, len, 'L');
    }
  }
  return g.map((row) => row.join(''));
}

// --- Spike trap: an obsidian plate with slots that molten magma spikes
// punch up through. Shared by 'spike' and 'timedspike' — one generator
// parameterized by whether the spikes are currently up (dangerous, molten),
// whether they're dormant stubs (dull, cooled-solid-black), and whether
// this is the one-shot "just triggered" flash (hot) — covers all four
// looks (spike, timedspike active/inactive, trap-triggered) without
// hand-drawing each one separately. "Cooled lava that reheats on a cycle"
// is a more literal fit for the timedspike mechanic than the old steel
// spikes retracting ever was. The plate fills the whole tile (there's no
// floor texture underneath) so a trap tile still reads as its own distinct
// mechanism, not "floor with spikes on it".

const SPIKE_PALETTE = {
  M: '#2a222a', O: '#453a44', N: '#181319', P: '#0a0810', // obsidian plate
  H: '#fff6d8', S: '#ffcf4d', D: '#ff7a1f', G: '#8a2a10', // molten spike (glint/bright/mid/base)
  K: '#3a3238', L: '#241f24',                             // cooled/dormant stub
  R: '#ff9a3c',                                           // ember halo
  T: '#fffef0', U: '#ffb347',                              // triggered flash
};

const SPIKE_SLOT_CENTERS = [3, 8, 13];
const SPIKE_PLATE_TOP = 9; // first plate row — spikes rise into rows above this

// Parametric on the grid's own size (not hardcoded to one tile resolution)
// so the same plate-drawing logic works whatever canvas makeSpikePlateFrame
// hands it.
function drawSpikePlateBase(g) {
  const w = g[0].length, h = g.length;
  fillRect(g, 0, 0, w, h, 'M');
  fillRect(g, 0, 0, w, 1, 'O');
  fillRect(g, 0, 0, 1, h, 'O');
  fillRect(g, 0, h - 1, w, 1, 'N');
  fillRect(g, w - 1, 0, 1, h, 'N');
  for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) setPixel(g, x, y, 'N');
  for (const cx of SPIKE_SLOT_CENTERS) fillRect(g, cx - 1, SPIKE_PLATE_TOP, 3, 2, 'P');
}

// Draws one spike at column cx: a thin, sharp 1px molten needle for its top
// rows (unmistakably "sharp" even at small sizes) flaring to a shaded 3px
// base where it meets the plate slot. `up` picks a tall dangerous molten
// spike vs. a short dormant cooled-obsidian stub retracted almost flush
// with the plate; `hot` swaps in the triggered flash colors and a wider
// flare for extra impact.
function drawSpike(g, cx, { up, dull, hot }) {
  const needleRows = up ? (hot ? 3 : 4) : 1;
  const tipRow = up ? 0 : SPIKE_PLATE_TOP - 3;
  const flareStart = tipRow + needleRows;
  const glint = hot ? 'T' : dull ? 'K' : 'H';
  const needle = hot ? 'T' : dull ? 'K' : 'S';
  const left = hot ? 'T' : dull ? 'K' : 'S';
  const body = hot ? 'U' : dull ? 'K' : 'D';
  const right = hot ? 'U' : dull ? 'L' : 'G';

  setPixel(g, cx, tipRow, glint);
  for (let row = tipRow + 1; row < flareStart; row++) setPixel(g, cx, row, needle);
  for (let row = flareStart; row < SPIKE_PLATE_TOP; row++) {
    setPixel(g, cx - 1, row, left);
    setPixel(g, cx, row, body);
    setPixel(g, cx + 1, row, right);
  }
  // Molten spikes are already self-evidently dangerous (bright glow vs. the
  // cooled-black dormant look), but a faint ember halo at the base still
  // helps "this will hurt you" read at a glance, same reasoning as the old
  // steel spikes' red warning dot.
  if (up && !dull && !hot) {
    setPixel(g, cx - 2, SPIKE_PLATE_TOP, 'R');
    setPixel(g, cx + 2, SPIKE_PLATE_TOP, 'R');
  }
}

function makeSpikePlateFrame({ up, dull = false, hot = false }) {
  const g = makeGrid(16, 16);
  drawSpikePlateBase(g);
  for (const cx of SPIKE_SLOT_CENTERS) drawSpike(g, cx, { up, dull, hot });
  return g.map((row) => row.join(''));
}

// --- Oneway arrow: hand-authored pointing "up", other directions derived
// by rotation so direction logic can't drift out of sync with the art. --
// Reskinned as a glowing amber rune arrow carved into dark rock.

const ONEWAY_PALETTE = { N: '#241d1a', L: '#332821', K: '#150f0d', P: '#ffb347', O: '#8a3a10' };

// Adds a 1px outline in `outlineCh` around every `coreCh` pixel (4-neighbor
// dilation) without disturbing the core pixels themselves — gives the
// hand-drawn arrow a crisp dark edge so it reads clearly against the base
// plate at any size, rather than a flat color floating with no border.
function addOutline(frame, coreCh, outlineCh) {
  const h = frame.length, w = frame[0].length;
  const rows = frame.map((r) => r.split(''));
  const isCore = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === coreCh;
  const out = frame.map((r) => r.split(''));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isCore(x, y)) continue;
      if (isCore(x - 1, y) || isCore(x + 1, y) || isCore(x, y - 1) || isCore(x, y + 1)) out[y][x] = outlineCh;
    }
  }
  return out.map((r) => r.join(''));
}

const ONEWAY_UP_CORE = (() => {
  const g = makeGrid(16, 16, 'N');
  fillRect(g, 0, 0, 16, 1, 'L');
  fillRect(g, 0, 0, 1, 16, 'L');
  fillRect(g, 0, 15, 16, 1, 'K');
  fillRect(g, 15, 0, 1, 16, 'K');
  const chevron = [
    '......PP.......',
    '.....PPPP......',
    '....PPPPPP.....',
    '...PPPPPPPP....',
    '..PPPPPPPPPP...',
  ];
  for (let row = 0; row < chevron.length; row++) {
    for (let x = 0; x < 16; x++) {
      if (chevron[row][x] === 'P') setPixel(g, x, row + 1, 'P');
    }
  }
  fillRect(g, 7, 6, 2, 7, 'P');
  return g.map((row) => row.join(''));
})();

const ONEWAY_UP_FRAME = addOutline(ONEWAY_UP_CORE, 'P', 'O');

// --- Start / Goal markers on top of the shared floor base ---------------

const START_PALETTE = {
  A: '#4a4038', B: '#332b24', C: '#5c5147', E: '#8a4020', Q: '#d94f2b', R: '#8a2a10', S: '#2a211b', F: '#ffcf4d',
};

// A pennant (not a plain rectangle) — width tapers by 1px per row as it
// flies away from the pole, with a 1px fold-shadow along the trailing
// edge — plus an ember finial and a soft ground shadow so the flag reads
// as planted rather than floating. Recolored to a scorched pole and a
// warm ember-red pennant instead of green/gold.
function makeStartFrame() {
  const g = floorGrid();
  fillRect(g, 7, 1, 1, 10, 'S');
  setPixel(g, 7, 0, 'F');
  for (let row = 1; row <= 5; row++) {
    const width = 5 - (row - 1);
    fillRect(g, 8, row, width, 1, 'Q');
    setPixel(g, 8 + width - 1, row, 'R');
  }
  fillRect(g, 5, 11, 4, 1, 'B');
  return g.map((row) => row.join(''));
}

const GOAL_PALETTE = {
  A: '#4a4038', B: '#332b24', C: '#5c5147', E: '#8a4020', T: '#ff7a1f', U: '#8a2a10', V: '#fff6d8',
};

// A faceted gem rather than a flat diamond: a bright core, an upper-left
// facet that stays bright a ring further out (catching the "light"), a
// darker lower-right facet for contrast, and a few standalone sparkle
// pixels scattered around it. Recolored from gold to a molten orange-red
// crystal so it reads as "forged from the mountain" rather than a
// generic treasure gem.
function makeGoalFrame() {
  const g = floorGrid();
  const cx = 7, cy = 7;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      const lit = x <= cx && y <= cy;
      if (d <= 2) setPixel(g, x, y, 'V');
      else if (d <= 3) setPixel(g, x, y, lit ? 'V' : 'T');
      else if (d <= 4) setPixel(g, x, y, lit ? 'T' : 'U');
    }
  }
  setPixel(g, cx, cy - 5, 'V');
  setPixel(g, cx + 5, cy, 'V');
  setPixel(g, cx - 4, cy - 4, 'V');
  return g.map((row) => row.join(''));
}

// Locked exit (any lever in the room still off): the same gem, dulled, with
// iron bars across it. Drawn with the goal's own palette keys so each
// theme's gem shows through dimmed (see LOCKED_GOAL_COLORS).
function makeLockedGoalFrame() {
  const g = makeGoalFrame().map((row) => row.split(''));
  for (const x of [4, 7, 10]) {
    fillRect(g, x, 2, 1, 12, 'L');
    fillRect(g, x + 1, 2, 1, 12, 'M');
  }
  fillRect(g, 3, 2, 10, 1, 'L');
  fillRect(g, 3, 13, 10, 1, 'M');
  return g.map((row) => row.join(''));
}

// A lever on a stone base plate: handle thrown left with a red knob when
// off, thrown right with a green knob and a glow when on.
const LEVER_COLORS = {
  K: '#2a2530', J: '#4d4656', N: '#15121a', H: '#c8c0b0', I: '#8a8478',
  O: '#e0453a', P: '#5fe07a', G: '#fff2a0',
};

function makeLeverFrame(on) {
  const g = floorGrid();
  // Base plate with a dark slot the handle pivots in.
  fillRect(g, 3, 10, 10, 4, 'K');
  fillRect(g, 3, 10, 10, 1, 'J');
  fillRect(g, 6, 11, 4, 1, 'N');
  // Handle: a 2px-wide diagonal from the slot up to the knob.
  const dir = on ? 1 : -1;
  for (let k = 0; k < 5; k++) {
    const x = 8 + dir * k;
    setPixel(g, x, 10 - k, 'H');
    setPixel(g, x - 1, 10 - k, 'I');
  }
  const kx = 8 + dir * 5;
  fillRect(g, kx - 1, 3, 3, 3, on ? 'P' : 'O');
  setPixel(g, kx - 1, 3, 'G');
  if (on) {
    for (const [x, y] of [[kx - 2, 2], [kx + 2, 2], [kx, 1], [kx + 2, 6]]) setPixel(g, x, y, 'G');
  }
  return g.map((row) => row.join(''));
}

// --- Trash-can icon (builder-panel "clear tile" tool) -------------------

const TRASH_PALETTE = { M: '#9a9aa6', N: '#6c6c78', O: '#c5c5d0' };

function makeTrashFrame() {
  const g = makeGrid(12, 12);
  fillRect(g, 4, 1, 4, 1, 'N');
  fillRect(g, 2, 2, 8, 1, 'N');
  fillRect(g, 3, 3, 6, 8, 'M');
  fillRect(g, 3, 10, 6, 1, 'N');
  fillRect(g, 4, 4, 1, 6, 'O');
  fillRect(g, 6, 4, 1, 6, 'O');
  fillRect(g, 8, 4, 1, 6, 'O');
  return g.map((row) => row.join(''));
}

// --- Volcanic cave backdrop (page background, not a gameplay tile) ------
// A wide 128x96 scene used as the whole page's background, behind and
// around the grid — a distant banded-dusk volcano skyline (same idea as
// before), framed by dark cave rock walls/ceiling closing in from the
// left, right, and top edges, so the grid reads as sitting just inside a
// cave mouth looking out at the mountain rather than floating on a flat
// page with a thin strip of scenery glimpsed only at the very bottom.
// Same bitmap -> inline-SVG pipeline as every tile/player sprite — still
// no external image files anywhere in this app, just a larger canvas
// stretched via CSS background-size instead of tiled per-cell.

const VOLCANO_PALETTE = {
  1: '#0a0710', 2: '#150a14', 3: '#241026', 4: '#3a1420', 5: '#5c1c1c', 6: '#8a2e18',
  7: '#c8501e', 8: '#ffb347',
  M: '#120c14', N: '#050308',
  L: '#ff7a1f', G: '#ffcf4d', W: '#3a3540',
  C: '#170f0c', D: '#0c0806', F: '#332721',
};

// Fills every column of `g` from a silhouette height (read from `heights`,
// tiled via modulo so a short hand-authored pattern repeats seamlessly
// across the full width) down to the bottom of the canvas — turns a short
// jagged-height list into a full mountain range without needing real
// line-interpolation code.
function fillSilhouette(g, heights, baseY, ch) {
  const w = g[0].length, h = g.length;
  for (let x = 0; x < w; x++) {
    const peak = Math.max(0, baseY - heights[x % heights.length]);
    for (let y = peak; y < h; y++) setPixel(g, x, y, ch);
  }
}

// Closes dark cave rock in from the left and right edges, deepest near the
// canvas's top/bottom and pulling back to a narrow gap around the
// vertical middle — an "iris" shape, like looking out through a cave
// mouth — computed from a smooth power curve (no hand-tuned array needed)
// plus a small per-row jagged offset so the inner edge reads as rock, not
// a perfect ellipse.
const CAVE_EDGE_JAG = [0, 3, -2, 4, 1, -3, 2, 0, -2, 3, -1, 2, 1, -2, 0, 3];
// `highlightCh`, if given, is set at each wall's own inner edge every few
// rows — computed from that row's actual depth rather than guessed fixed
// coordinates, so a highlight pixel can never miss the wall and end up
// floating in open sky when the depth formula's output isn't hand-checked
// row by row.
function fillCaveWalls(g, ch, maxDepthFrac, minDepthFrac, highlightCh) {
  const w = g[0].length, h = g.length;
  const midY = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    const distFromMid = Math.abs(y - midY) / midY;
    const frac = minDepthFrac + (maxDepthFrac - minDepthFrac) * Math.pow(distFromMid, 1.6);
    const depth = Math.max(0, Math.round(frac * w) + CAVE_EDGE_JAG[y % CAVE_EDGE_JAG.length]);
    if (depth <= 0) continue;
    fillRect(g, 0, y, depth, 1, ch);
    fillRect(g, w - depth, y, depth, 1, ch);
    if (highlightCh && depth > 1 && y % 7 === 0) {
      setPixel(g, depth - 1, y, highlightCh);
      setPixel(g, w - depth, y, highlightCh);
    }
  }
}

// A solid rock ceiling band plus a handful of dripping stalactites of
// varied length (a deterministic formula, not real randomness — this is
// static decoration, so reproducibility matters more than true variance).
function addCaveCeiling(g, ch) {
  const w = g[0].length;
  const baseDepth = Math.round(g.length * 0.1);
  fillRect(g, 0, 0, w, baseDepth, ch);
  const stalactiteCols = [10, 11, 27, 28, 45, 68, 69, 84, 100, 101, 117];
  for (const x of stalactiteCols) {
    const extra = 5 + ((x * 7) % 11);
    fillRect(g, x, baseDepth, 1, extra, ch);
  }
}

function makeVolcanoBackdropFrame() {
  const w = 128, h = 96;
  const g = makeGrid(w, h);

  // Banded dusk sky spanning the *full* canvas height so it warms
  // gradually — deep purple-black up top to a hazy amber glow — and only
  // reaches its brightest in the last few rows right at the horizon,
  // instead of flooding half the image with solid bright orange that
  // shows through every gap between peaks.
  const skyStops = ['1', '1', '2', '2', '3', '4', '5', '6', '7', '8'];
  for (let y = 0; y < h; y++) {
    const stop = skyStops[Math.min(skyStops.length - 1, Math.floor((y / h) * skyStops.length))];
    fillRect(g, 0, y, w, 1, stop);
  }

  // Two ridges, each stepping by at most a few units between neighboring
  // columns (a period-16 pattern) so the silhouette reads as a rolling
  // slope instead of a picket-fence of abrupt spikes.
  fillSilhouette(g, [8, 11, 14, 18, 21, 18, 14, 11, 8, 6, 8, 11, 14, 18, 14, 11], 42, 'M'); // far ridge
  fillSilhouette(g, [22, 28, 36, 46, 36, 28, 22, 16, 22, 30, 40, 50, 40, 30, 22, 16], 66, 'N'); // near ridge

  // Glowing crater + lava seam at the near ridge's tallest peak (the
  // "...,50,..." entry repeats at x = 11, 27, 43, 59, ... — pick x = 43,
  // clear of both the canvas edges and the cave walls closing in on them).
  const peakX = 43, peakY = 66 - 50;
  fillRect(g, peakX - 2, peakY + 2, 5, 2, 'L');
  fillRect(g, peakX - 1, peakY, 3, 2, 'G');
  setPixel(g, peakX, peakY + 4, 'L'); setPixel(g, peakX + 1, peakY + 5, 'L');
  setPixel(g, peakX + 1, peakY + 6, 'L'); setPixel(g, peakX + 2, peakY + 7, 'L');
  setPixel(g, peakX - 2, peakY - 3, 'W'); setPixel(g, peakX - 1, peakY - 5, 'W');
  setPixel(g, peakX, peakY - 6, 'W'); setPixel(g, peakX + 1, peakY - 4, 'W');
  setPixel(g, peakX, peakY - 3, 'W');

  // Cave rock framing the scene — walls closing in from the sides, a
  // ceiling with stalactites — drawn last so it sits in front of the
  // distant volcano, like looking out through a cave mouth at it.
  fillCaveWalls(g, 'C', 0.4, 0.05);
  addCaveCeiling(g, 'C');
  // A few lighter fleck highlights near the rock's inner edge so it reads
  // as jagged stone rather than a flat silhouette cutout.
  for (const [x, y] of [[18, 20], [19, 45], [22, 70], [106, 24], [104, 50], [108, 74], [30, 8], [90, 9]]) {
    setPixel(g, x, y, 'F');
  }

  return g.map((row) => row.join(''));
}


// --- Player character -----------------------------------------------------
// One 12x14 chibi sprite, reused (flipped via CSS for left-facing) rather
// than fully distinct per-direction art — keeps the hand-authored pixel
// count small while still reading clearly as a character with movement,
// fail, and win poses.

// Recolored from the original blue-tunic/maroon-cape look to a rugged
// volcanic explorer — a copper/rust hide tunic and an ember-red cloak —
// while keeping every pose's pixel layout untouched (see drawPlayerCape/
// drawPlayerUpperBody/drawPlayerLegsStanding/drawPlayerLegsStep below):
// this is a palette-only reskin, not a redraw, so the walk/hit/win
// animations can't drift out of alignment with the new look.
const PLAYER_PALETTE = {
  Y: '#4a2f1f', h: '#2e1f15', W: '#e8b98c', X: '#c99a6d',
  Z: '#c96a3a', a: '#8a4726', b: '#241d1a', c: '#15151a',
  g: '#6b4a2f', i: '#7a2418', e: '#ffcf4d', f: '#ff5c5c',
};

// Draws a cape trailing behind the character (to the left of the torso —
// "behind" whichever way it's later flipped to face) rows 6-9. `flared`
// extends it a column further out for the mid-stride/hit/win poses, so
// it visibly flutters instead of hanging static in every frame.
function drawPlayerCape(g, flared) {
  fillRect(g, 1, 6, 1, 4, 'i');
  if (flared) fillRect(g, 0, 7, 1, 3, 'i');
}

// Draws the head + torso rows shared by every player pose into `g`.
// `eyes`/`smile` toggle off for the hit pose (blank, wincing stare).
// `armSpread` moves the arm pixels outward and `armSwing` moves them up/
// down a row — together these sell the walk cycle (arms opposite the
// legs) and the hit pose's flinch, without needing separate full-body
// art per state. `armsRaised` overrides both with a distinct raised-arms
// pose for the win state. `satchel` toggles the side-bag accent off for
// the win pose (avoids colliding with the raised arm at that row).
function drawPlayerUpperBody(g, {
  eyes = true, smile = true, armSpread = 0, armSwing = 0, armsRaised = false, satchel = true,
} = {}) {
  fillRect(g, 3, 1, 6, 1, 'Y');
  fillRect(g, 2, 2, 8, 1, 'Y');
  setPixel(g, 5, 2, 'h');
  fillRect(g, 3, 3, 6, 1, 'W');
  if (eyes) { setPixel(g, 4, 3, 'c'); setPixel(g, 7, 3, 'c'); }
  fillRect(g, 3, 4, 6, 1, 'W');
  setPixel(g, 3, 4, 'X'); setPixel(g, 8, 4, 'X');
  fillRect(g, 4, 5, 4, 1, 'W');
  if (smile) setPixel(g, 5, 5, 'X');
  fillRect(g, 3, 6, 6, 1, 'Z');
  fillRect(g, 3, 7, 6, 1, 'Z');
  fillRect(g, 3, 8, 6, 1, 'Z');
  setPixel(g, 3, 8, 'a'); setPixel(g, 4, 8, 'a');
  if (satchel) setPixel(g, 8, 8, 'g');
  fillRect(g, 3, 9, 6, 1, 'b');
  if (armsRaised) {
    fillRect(g, 1, 4, 1, 3, 'Z');
    fillRect(g, 10, 4, 1, 3, 'Z');
  } else {
    const armRow = 6 + armSwing;
    setPixel(g, 2 - armSpread, armRow, 'Z');
    setPixel(g, 9 + armSpread, armRow, 'Z');
  }
}

function drawPlayerLegsStanding(g) {
  fillRect(g, 3, 10, 2, 3, 'Z');
  fillRect(g, 7, 10, 2, 3, 'Z');
  fillRect(g, 3, 13, 2, 1, 'b');
  fillRect(g, 7, 13, 2, 1, 'b');
}

// "Mid-stride": left leg lifted (shortened), right leg stepped forward.
function drawPlayerLegsStep(g) {
  fillRect(g, 3, 10, 2, 2, 'Z');
  fillRect(g, 3, 12, 2, 1, 'b');
  fillRect(g, 8, 10, 2, 3, 'Z');
  fillRect(g, 8, 13, 2, 1, 'b');
}

function makePlayerIdleFrame() {
  const g = makeGrid(12, 14);
  drawPlayerCape(g, false);
  drawPlayerUpperBody(g);
  drawPlayerLegsStanding(g);
  return g.map((row) => row.join(''));
}

function makePlayerWalkAFrame() {
  const g = makeGrid(12, 14);
  drawPlayerCape(g, false);
  drawPlayerUpperBody(g, { armSwing: 1 });
  drawPlayerLegsStanding(g);
  return g.map((row) => row.join(''));
}

function makePlayerWalkBFrame() {
  const g = makeGrid(12, 14);
  drawPlayerCape(g, true);
  drawPlayerUpperBody(g, { armSwing: -1 });
  drawPlayerLegsStep(g);
  return g.map((row) => row.join(''));
}

function makePlayerHitFrame() {
  const g = makeGrid(12, 14);
  drawPlayerCape(g, true);
  drawPlayerUpperBody(g, { eyes: false, smile: false, armSpread: 2, armSwing: -2 });
  fillRect(g, 3, 7, 6, 1, 'f');
  drawPlayerLegsStanding(g);
  return g.map((row) => row.join(''));
}

function makePlayerWinFrame() {
  const g = makeGrid(12, 14);
  drawPlayerCape(g, true);
  drawPlayerUpperBody(g, { armsRaised: true, satchel: false });
  setPixel(g, 2, 0, 'e'); setPixel(g, 9, 0, 'e');
  setPixel(g, 0, 3, 'e'); setPixel(g, 11, 3, 'e');
  drawPlayerLegsStanding(g);
  return g.map((row) => row.join(''));
}

// --- Title-screen decorative sprites --------------------------------------
// Purely decorative pixel art for the title/home screen — same technique as
// the tile/player art above (a small bitmap grid + palette -> inline SVG),
// just for UI chrome instead of gameplay tiles.

// The chrome every button wears: a bronze trim around a dark face, the
// same metal-on-shadow look as the chapter badges' rims and the cutscenes'
// caption boxes. Drawn ring by ring from the edge in: `rings` names each
// ring's color, where 'trim' is lit on its top/left (H) and shadowed on its
// bottom/right (S), meeting in G at the two mixed corners. The outermost
// corner pixels are cut off, and the middle is left empty (the face is the
// button's own CSS background). `studs` are single bright B pixels.
const BUTTON_PLATE_PALETTE = {
  K: '#0e0a0c', H: '#d8a850', G: '#a87428', S: '#5a3c14', D: '#140f17', B: '#ffe9a8',
};

function makeButtonPlateFrame(w, h, rings, { studs = [] } = {}) {
  const g = makeGrid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      const ring = rings[d];
      if (ring === undefined) continue;
      const top = y === d, left = x === d, bottom = y === h - 1 - d, right = x === w - 1 - d;
      if (d === 0 && (top || bottom) && (left || right)) continue;
      if (ring !== 'trim') setPixel(g, x, y, ring);
      else if ((top && right) || (bottom && left)) setPixel(g, x, y, 'G');
      else setPixel(g, x, y, top || left ? 'H' : 'S');
    }
  }
  for (const [x, y] of studs) setPixel(g, x, y, 'B');
  return g.map((row) => row.join(''));
}

// Every button's frame (.pixel-btn, .title-btn, the level plates — see
// style.css): the three thin rings with a stud at each inner corner, as a
// 9-slice border-image (3px slices) so the trim stays crisp and the same
// thickness on a button of any size. The face is the button's own
// background.
function makeButtonFrame() {
  return makeButtonPlateFrame(8, 8, ['K', 'trim', 'D'], { studs: [[2, 2], [5, 2], [2, 5], [5, 5]] });
}

// The home menu's frame: the same, heavier — a fourth, gold ring, a
// brighter gilt, and 4px slices.
const MENU_FRAME_PALETTE = { ...BUTTON_PLATE_PALETTE, H: '#f0c860', G: '#c8901e', S: '#7a5418' };

function makeMenuFrame() {
  return makeButtonPlateFrame(12, 12, ['K', 'trim', 'G', 'D'], { studs: [[2, 2], [9, 2], [2, 9], [9, 9]] });
}

// --- The home screen's backdrop ----------------------------------------------
// The view out of the Trapwright's workshop door, at the foot of the
// mountain (where the prologue starts): every world of the story in one
// night scene — the volcano glowing on the left, the frozen peaks behind,
// the castle on its crag under the moon on the right, and the overgrown
// forest along the bottom with a path running into it. The menu covers
// the middle, so the worlds sit to the sides and along the bottom.

const HOME_PALETTE = {
  1: '#07050e', 2: '#0c0818', 3: '#130c22', 4: '#1b112c', 5: '#261532', 6: '#371a36', 7: '#4e2034', 8: '#6e2a30',
  S: '#ffffff', s: '#8a84a8',
  O: '#e8e4d0', P: '#c8c2aa', Q: '#4a4470',
  M: '#18203a', N: '#26324e', W: '#d6ecff', w: '#86a6c8',
  V: '#150c12', U: '#24121a', L: '#ff7a1f', G: '#ffcf4d', Y: '#fff6d8', R: '#c8501e',
  C: '#0d0a15', c: '#3a3058', Z: '#c9b8ff',
  t: '#10200f', T: '#08120a', F: '#fff27a', D: '#1e1610',
  A: '#2e2522', a: '#3e322c', B: '#140e0c', e: '#6a4630',
};

// Mountains as straight-sided peaks ({ x, h, slope }), filled from each
// column's top down to the canvas bottom. `cap` flattens every peak at that
// height (a crater). Returns each column's top row, or -1 where nothing was
// drawn.
function fillPeaks(g, peaks, baseY, ch, cap = Infinity) {
  const w = g[0].length, h = g.length;
  const tops = [];
  for (let x = 0; x < w; x++) {
    let height = 0;
    for (const p of peaks) height = Math.max(height, p.h - Math.abs(x - p.x) * p.slope);
    height = Math.min(height, cap);
    if (height < 1) { tops.push(-1); continue; }
    const top = Math.round(baseY - height);
    for (let y = Math.max(0, top); y < h; y++) setPixel(g, x, y, ch);
    tops.push(top);
  }
  return tops;
}

function makeHomeBackdropFrame() {
  const w = 128, h = 96;
  const g = makeGrid(w, h);
  const skyStops = ['1', '1', '2', '2', '3', '4', '5', '6', '7', '8'];
  const skyAt = (y) => skyStops[Math.min(skyStops.length - 1, Math.floor((y / h) * skyStops.length))];
  for (let y = 0; y < h; y++) fillRect(g, 0, y, w, 1, skyAt(y));

  // Stars, then the moon (with a dithered halo and craters) behind where
  // the castle will stand.
  const mx = 106, my = 30;
  for (let k = 0; k < 46; k++) {
    const x = (k * 53 + 11) % w, y = (k * 29 + 5) % 52;
    if (Math.hypot(x - mx, y - my) > 10) setPixel(g, x, y, k % 3 === 0 ? 'S' : 's');
  }
  for (let y = my - 9; y <= my + 9; y++) {
    for (let x = mx - 9; x <= mx + 9; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d < 6.5) setPixel(g, x, y, 'O');
      else if (d < 8.5 && (x + y) % 2 === 0) setPixel(g, x, y, 'Q');
    }
  }
  for (const [x, y] of [[104, 28], [108, 32], [107, 27], [103, 32]]) setPixel(g, x, y, 'P');

  // The Frozen Caverns' peaks, far off in the middle: snow caps, and the
  // moonlit (right-hand) faces a shade lighter.
  const icePeaks = [{ x: 50, h: 30, slope: 1.1 }, { x: 66, h: 38, slope: 1.2 }, { x: 82, h: 29, slope: 1.1 }];
  const iceTops = fillPeaks(g, icePeaks, 80, 'M');
  iceTops.forEach((top, x) => {
    if (top < 0) return;
    const nearest = icePeaks.reduce((a, b) => (Math.abs(x - a.x) <= Math.abs(x - b.x) ? a : b));
    const moonlit = x > nearest.x;
    const cap = 3 + ((x * 5) % 3);
    for (let y = top; y < h; y++) {
      if (y < top + cap) setPixel(g, x, y, moonlit ? 'w' : 'W');
      else if (moonlit) setPixel(g, x, y, 'N');
    }
  });

  // The Volcanic Depths: a cone on the left with a glowing crater, lava
  // seams running down it and sparks thrown up out of it.
  const cone = [{ x: 24, h: 44, slope: 1.15 }];
  const coneTops = fillPeaks(g, cone, 84, 'V', 40);
  coneTops.forEach((top, x) => {
    if (top < 0 || x <= 24) return;
    for (let y = top; y < h; y++) setPixel(g, x, y, 'U');
  });
  for (let i = 0; i < 20; i++) setPixel(g, 22 - Math.floor(i * 0.55), 45 + i, i % 4 === 3 ? 'R' : 'L');
  for (let i = 0; i < 13; i++) setPixel(g, 27 + Math.floor(i * 0.7), 45 + i, i % 3 === 2 ? 'R' : 'L');
  fillRect(g, 21, 44, 7, 2, 'G');
  fillRect(g, 23, 44, 3, 1, 'Y');
  for (let x = 20; x <= 28; x += 2) setPixel(g, x, 43, 'L');
  for (const [x, y] of [[23, 40], [26, 38], [21, 36], [25, 33]]) setPixel(g, x, y, 'G');

  // The Abandoned Castle on its crag: a curtain wall, towers (one broken)
  // and two lit windows.
  fillPeaks(g, [{ x: 108, h: 26, slope: 0.9 }], 86, 'C');
  fillRect(g, 95, 52, 24, 10, 'C');
  for (let x = 95; x < 119; x += 2) setPixel(g, x, 51, 'C');
  const tower = (x0, width, top, broken) => {
    fillRect(g, x0, top, width, 52 - top, 'C');
    for (let x = x0; x < x0 + width; x += 2) setPixel(g, x, top - 1, 'C');
    if (!broken) return;
    // Knock a jagged bite out of the top, back to the sky behind it.
    for (let k = 0; k < width; k++) {
      for (let y = top - 1; y < top + [1, 3, 2, 0][k % 4]; y++) setPixel(g, x0 + k, y, skyAt(y));
    }
  };
  tower(96, 4, 44, false);
  tower(103, 6, 36, false);
  tower(105, 2, 32, false);
  tower(112, 4, 42, true);
  // Moonlight catches each tower's left edge (below the moon itself, which
  // they stand in front of), so the silhouette stands out from the night.
  for (const [x, top] of [[96, 44], [103, 38], [112, 44], [95, 52]]) {
    for (let y = top; y < 52 + (x === 95 ? 10 : 0); y++) if (g[y][x] === 'C') setPixel(g, x, y, 'c');
  }
  for (const [x, y] of [[106, 40], [98, 48], [104, 46], [113, 48], [108, 56], [100, 57]]) setPixel(g, x, y, 'Z');

  // The Overgrown Ruins' forest: a far treeline, a nearer one, fireflies,
  // and a path cut through it toward the mountains.
  fillSilhouette(g, [2, 4, 6, 8, 6, 4, 3, 5, 7, 9, 7, 5, 3, 2, 4, 6], 86, 't');
  fillSilhouette(g, [3, 6, 9, 12, 9, 6, 4, 7, 10, 13, 10, 7, 4, 3, 6, 8], 97, 'T');
  for (let y = 86; y < h; y++) {
    const half = 1 + Math.floor((y - 86) * 0.8);
    fillRect(g, 64 - half, y, half * 2, 1, 'D');
  }
  for (const [x, y] of [[14, 84], [33, 88], [47, 81], [79, 86], [92, 83], [110, 89], [58, 90], [121, 82]]) {
    setPixel(g, x, y, 'F');
  }

  // The doorway: stone pillars up the sides and an arch across the top,
  // laid in courses, its inner edge warm with torchlight.
  const cx = 63.5;
  const open = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const t = (30 - y) / 27;
    const half = y >= 30 ? 52 : (t < 1 ? 52 * Math.sqrt(1 - t * t) : 0);
    return Math.abs(x - cx) < half;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (open(x, y)) continue;
      const course = Math.floor(y / 5);
      let ch = 'A';
      if (y % 5 === 4 || x % 8 === (course % 2 ? 4 : 0)) ch = 'B';
      else if ((x * 13 + y * 7) % 17 === 0) ch = 'a';
      if (ch !== 'B' && (open(x - 1, y) || open(x + 1, y) || open(x, y + 1))) ch = 'e';
      setPixel(g, x, y, ch);
    }
  }
  return g.map((row) => row.join(''));
}

const TITLE_TORCH_PALETTE = { W: '#5a4632', X: '#3f321f', Y: '#ffb238', Z: '#ff6a3c', F: '#ffe066' };

// A small wall-bracket torch flanking the logo. A single static frame — the
// flicker itself is a CSS filter/drop-shadow animation (see style.css)
// rather than a second frame, since a subtle brightness pulse reads as
// flicker just as well without doubling the sprite work.
function makeTorchFrame() {
  const g = makeGrid(8, 14);
  fillRect(g, 3, 8, 2, 6, 'W');
  fillRect(g, 2, 8, 4, 1, 'X');
  fillRect(g, 2, 4, 4, 3, 'Z');
  fillRect(g, 3, 3, 2, 1, 'Z');
  fillRect(g, 3, 5, 2, 2, 'F');
  setPixel(g, 3, 2, 'Y'); setPixel(g, 4, 2, 'Y');
  setPixel(g, 3, 1, 'F');
  return g.map((row) => row.join(''));
}

const TITLE_SIGN_PALETTE = { W: '#6b4a2f', X: '#4a3220', Y: '#8a6238' };

// A plain wooden signpost — stands in for the reference image's signpost,
// repurposed here to display the player's live daily-streak count (see
// script.js's renderTitleStreakSign) instead of being purely decorative.
function makeSignpostFrame() {
  const g = makeGrid(16, 16);
  fillRect(g, 7, 6, 2, 10, 'X');
  fillRect(g, 1, 1, 14, 6, 'W');
  fillRect(g, 1, 1, 14, 1, 'Y');
  fillRect(g, 1, 1, 1, 6, 'Y');
  fillRect(g, 1, 6, 14, 1, 'X');
  fillRect(g, 14, 1, 1, 6, 'X');
  return g.map((row) => row.join(''));
}

const TITLE_SCREEN_TEXTURES = {
  buttonFrame: frameToDataURL(makeButtonFrame(), BUTTON_PLATE_PALETTE, { intrinsic: true }),
  menuFrame: frameToDataURL(makeMenuFrame(), MENU_FRAME_PALETTE, { intrinsic: true }),
  backdrop: frameToDataURL(makeHomeBackdropFrame(), HOME_PALETTE),
  torch: frameToDataURL(makeTorchFrame(), TITLE_TORCH_PALETTE),
  sign: frameToDataURL(makeSignpostFrame(), TITLE_SIGN_PALETTE),
};

// --- New trap & movement tiles ---------------------------------------------
// Same conventions as the tiles above: 16x16, generated with fillRect/
// setPixel loops, directional art drawn once facing "up" and rotated with
// rotateFrame90CW so the art can't drift out of sync with DIRECTION_DELTAS
// in script.js. Walkable tiles sit on the shared floor (addFloorBevel);
// solid ones (the turret) use the wall's dark rock instead.

// Copies every non-transparent pixel of `frame` onto grid `g` — used to
// stamp a transparent overlay sprite (the imp) onto a floor tile for its
// builder-mode look.
function stampFrame(g, frame) {
  frame.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== PIXEL_TRANSPARENT) setPixel(g, x, y, row[x]);
    }
  });
}

// Every floor-based tile (plain floor, start, goal, portals, bombs, ...)
// is drawn on floorGrid(), so a theme's floor detail (snow, moss — see
// THEME_ART) shows up under all of them. currentFloorDecor is set only
// while buildThemeTextures builds one theme's set; lava has none, so its
// floor is exactly the original.
let currentFloorDecor = null;

function floorGrid() {
  const g = addFloorBevel(floorBaseGrid());
  if (currentFloorDecor) currentFloorDecor(g);
  return g;
}

// Lava turret: a riveted cannon housing bolted into dark rock, barrel
// pointing the way it fires with a molten glow in the muzzle. Solid (the
// player can't walk onto it), so it uses the wall's rock rather than floor.
const TURRET_PALETTE = {
  D: '#241d1a', F: '#332821', G: '#0d0908',
  H: '#3d343c', J: '#5a4e58', K: '#1c171b', B: '#141014',
  M: '#ff7a1f', Y: '#ffcf4d', R: '#8a2a10',
};

function makeTurretUpFrame() {
  const g = makeGrid(16, 16, 'D');
  fillRect(g, 0, 0, 16, 1, 'F');
  fillRect(g, 0, 0, 1, 16, 'F');
  fillRect(g, 0, 15, 16, 1, 'G');
  fillRect(g, 15, 0, 1, 16, 'G');
  fillRect(g, 3, 6, 10, 8, 'H');
  fillRect(g, 4, 5, 8, 10, 'H');
  fillRect(g, 4, 5, 8, 1, 'J');
  fillRect(g, 3, 6, 1, 7, 'J');
  fillRect(g, 4, 14, 8, 1, 'K');
  fillRect(g, 12, 6, 1, 8, 'K');
  for (const [x, y] of [[5, 7], [10, 7], [5, 12], [10, 12]]) setPixel(g, x, y, 'K');
  fillRect(g, 7, 9, 2, 2, 'R');
  setPixel(g, 7, 9, 'M');
  fillRect(g, 6, 1, 4, 7, 'B');
  fillRect(g, 6, 1, 1, 7, 'K');
  fillRect(g, 7, 1, 2, 2, 'M');
  setPixel(g, 7, 1, 'Y');
  return g.map((row) => row.join(''));
}

// Flame vent: a floor grate with a nozzle pointing the way the fire jets.
// `hot` lights the slots and muzzle while it's erupting.
const VENT_PALETTE = {
  M: '#2a222a', O: '#453a44', N: '#181319', P: '#0a0810',
  Q: '#6b5f6b', E: '#5a2a14', D: '#ff7a1f', S: '#ffcf4d',
};

function makeVentUpFrame(hot) {
  const g = makeGrid(16, 16, 'M');
  fillRect(g, 0, 0, 16, 1, 'O');
  fillRect(g, 0, 0, 1, 16, 'O');
  fillRect(g, 0, 15, 16, 1, 'N');
  fillRect(g, 15, 0, 1, 16, 'N');
  for (const row of [7, 9, 11, 13]) {
    fillRect(g, 3, row, 10, 1, hot ? 'D' : 'P');
    if (hot) fillRect(g, 6, row, 4, 1, 'S');
  }
  fillRect(g, 7, 1, 2, 1, 'Q');
  fillRect(g, 6, 2, 4, 1, 'Q');
  fillRect(g, 5, 3, 6, 2, 'Q');
  fillRect(g, 7, 2, 2, 3, hot ? 'S' : 'E');
  return g.map((row) => row.join(''));
}

// Lava current: cooled crust over flowing magma, with glowing chevrons
// showing which way it shoves you. Safe to stand on.
const CURRENT_PALETTE = { C: '#3a1a10', B: '#1f0d08', L: '#5c2412', F: '#8a3a10', O: '#c8501e', P: '#ffb347' };

function makeCurrentUpFrame() {
  const g = makeGrid(16, 16, 'C');
  fillRect(g, 0, 0, 16, 1, 'L');
  fillRect(g, 0, 0, 1, 16, 'L');
  fillRect(g, 0, 15, 16, 1, 'B');
  fillRect(g, 15, 0, 1, 16, 'B');
  for (let y = 1; y < 15; y++) {
    if (y % 4 !== 0) {
      setPixel(g, 2, y, 'F');
      setPixel(g, 13, y, 'F');
    }
  }
  for (const top of [2, 8]) {
    for (let i = 0; i < 4; i++) {
      setPixel(g, 7 - i, top + i + 1, 'O');
      setPixel(g, 8 + i, top + i + 1, 'O');
    }
    for (let i = 0; i < 4; i++) {
      setPixel(g, 7 - i, top + i, 'P');
      setPixel(g, 8 + i, top + i, 'P');
    }
  }
  return g.map((row) => row.join(''));
}

// Obsidian ice: slick volcanic glass with glossy diagonal reflections.
const ICE_PALETTE = { A: '#1a1f2b', B: '#11141c', C: '#2c3547', D: '#5d7a99', E: '#cfe6ff', F: '#0b0d12' };

function makeIceFrame() {
  const g = makeGrid(16, 16, 'A');
  fillRect(g, 0, 0, 16, 1, 'C');
  fillRect(g, 0, 0, 1, 16, 'C');
  fillRect(g, 0, 15, 16, 1, 'F');
  fillRect(g, 15, 0, 1, 16, 'F');
  for (let k = 0; k < 7; k++) setPixel(g, 2 + k, 9 - k, 'D');
  for (let k = 0; k < 5; k++) setPixel(g, 3 + k, 11 - k, 'C');
  for (let k = 0; k < 6; k++) setPixel(g, 8 + k, 13 - k, 'D');
  setPixel(g, 4, 7, 'E');
  setPixel(g, 11, 10, 'E');
  setPixel(g, 12, 3, 'E');
  setPixel(g, 3, 13, 'B'); setPixel(g, 4, 13, 'B'); setPixel(g, 12, 5, 'B');
  return g.map((row) => row.join(''));
}

// Portal: a swirling ring set into the floor. Two color pairings (orange
// and violet) so a room can hold two independent portal pairs.
function makePortalFrame() {
  const g = floorGrid();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d <= 6.3 && d >= 4.6) setPixel(g, x, y, (x + y) % 3 === 0 ? 'S' : 'R');
      else if (d < 4.6) setPixel(g, x, y, 'V');
    }
  }
  for (const [x, y] of [[7, 5], [8, 5], [9, 6], [10, 8], [9, 9], [7, 10], [6, 9], [5, 7]]) setPixel(g, x, y, 'R');
  setPixel(g, 7, 7, 'W'); setPixel(g, 8, 8, 'S');
  return g.map((row) => row.join(''));
}

const PORTAL_A_PALETTE = { ...FLOOR_PALETTE, R: '#ff7a1f', S: '#ffcf4d', V: '#3a1208', W: '#fff6d8' };
const PORTAL_B_PALETTE = { ...FLOOR_PALETTE, R: '#8a4dff', S: '#d6b8ff', V: '#1c0f33', W: '#f4ecff' };

// Bomb: a round black bomb with a fuse. 'armed' has a dull ember on the
// fuse tip, 'lit' a bright spark (plus a CSS blink — see .bomb-lit in
// style.css), and 'gone' is the scorch mark left after it explodes.
const BOMB_PALETTE = {
  ...FLOOR_PALETTE,
  K: '#141216', J: '#2e2a33', H: '#7a7484', W: '#8a6238',
  S: '#ffcf4d', T: '#fff6d8', D: '#ff7a1f', X: '#1e1914', Z: '#2a221c',
};

function makeBombFrame(state) {
  const g = floorGrid();
  if (state === 'gone') {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 8);
        if (d < 3.2) setPixel(g, x, y, 'X');
        else if (d < 5.4 && (x * 3 + y) % 4 !== 0) setPixel(g, x, y, 'Z');
      }
    }
    return g.map((row) => row.join(''));
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7, y - 9.5);
      if (d < 4.6) setPixel(g, x, y, x + y < 14 ? 'J' : 'K');
    }
  }
  setPixel(g, 5, 7, 'H'); setPixel(g, 4, 8, 'H'); setPixel(g, 5, 8, 'J');
  fillRect(g, 9, 4, 2, 2, 'J');
  setPixel(g, 11, 3, 'W'); setPixel(g, 12, 2, 'W');
  if (state === 'lit') {
    setPixel(g, 13, 1, 'T');
    for (const [x, y] of [[12, 1], [14, 1], [13, 0], [13, 2]]) setPixel(g, x, y, 'S');
    for (const [x, y] of [[12, 0], [14, 0], [14, 2]]) setPixel(g, x, y, 'D');
  } else {
    setPixel(g, 13, 1, 'D');
  }
  return g.map((row) => row.join(''));
}

// Hidden spike, builder-mode look only: floor with faint ghostly spike
// outlines and a dashed border, so the builder can see where they put one.
// During play it's drawn as plain floor (see textureKeyForTile in
// script.js) until it's been revealed by killing someone.
const HIDDEN_SPIKE_PALETTE = { ...FLOOR_PALETTE, G: '#7a6d60', Q: '#a89684' };

function makeHiddenSpikeBuilderFrame() {
  const g = floorGrid();
  for (const cx of SPIKE_SLOT_CENTERS) {
    for (let row = 4; row <= 8; row++) setPixel(g, cx, row, 'G');
    setPixel(g, cx - 1, 8, 'G');
    setPixel(g, cx + 1, 8, 'G');
    setPixel(g, cx, 3, 'Q');
  }
  for (let k = 0; k < 16; k += 2) {
    setPixel(g, k, 0, 'Q'); setPixel(g, k, 15, 'Q');
    setPixel(g, 0, k, 'Q'); setPixel(g, 15, k, 'Q');
  }
  return g.map((row) => row.join(''));
}

// --- Moving hazards (transparent overlays drawn on top of tiles) -----------

// Fire imp: a small horned fire demon. Drawn as a moving overlay during
// play; stamped onto floor with patrol-axis arrows for its builder look.
const IMP_PALETTE = { R: '#c0321e', D: '#7a1a10', H: '#3a0d08', Y: '#ffe066', O: '#ff9a3c', W: '#fff6d8' };

const IMP_FRAME = [
  '................',
  '....H......H....',
  '....HH....HH....',
  '.....RRRRRR.....',
  '....RRRRRRRR....',
  '....RYYRRYYR....',
  '....RRRRRRRR....',
  '.....RDWWDR.....',
  '......RRRR......',
  '....RRRRRRRR....',
  '...RR.RRRR.RR...',
  '...O..RRRR..O...',
  '......RDDR....O.',
  '.....RR..RR..O..',
  '.....D....D.O...',
  '................',
];

const IMP_BUILDER_PALETTE = { ...FLOOR_PALETTE, ...IMP_PALETTE, P: '#ffb347' };

function makeImpBuilderFrame(axis) {
  const g = floorGrid();
  stampFrame(g, IMP_FRAME);
  // Little arrowheads at both ends of the patrol axis.
  if (axis === 'h') {
    setPixel(g, 0, 8, 'P'); setPixel(g, 1, 7, 'P'); setPixel(g, 1, 9, 'P');
    setPixel(g, 15, 8, 'P'); setPixel(g, 14, 7, 'P'); setPixel(g, 14, 9, 'P');
  } else {
    setPixel(g, 8, 0, 'P'); setPixel(g, 7, 1, 'P'); setPixel(g, 9, 1, 'P');
    setPixel(g, 8, 15, 'P'); setPixel(g, 7, 14, 'P'); setPixel(g, 9, 14, 'P');
  }
  return g.map((row) => row.join(''));
}

const FIRE_PALETTE = { D: '#e0401a', O: '#ff9a3c', Y: '#ffe066', W: '#fff6d8' };

// A tapering flame tongue, widest at the bottom, with a hot core.
function makeFlameFrame() {
  const g = makeGrid(16, 16);
  for (let y = 1; y < 16; y++) {
    const hw = Math.min(7, 1 + (y - 1) * 0.55);
    const wobble = [0, 1, 0, -1][y % 4] * (y < 9 ? 1 : 0);
    const cx = 7.5 + wobble;
    for (let x = 0; x < 16; x++) {
      const dist = Math.abs(x - cx);
      if (dist > hw) continue;
      const ch = dist <= hw - 4 ? 'W' : dist <= hw - 2.5 ? 'Y' : dist <= hw - 1.2 ? 'O' : 'D';
      setPixel(g, x, y, y < 4 && ch === 'W' ? 'Y' : ch);
    }
  }
  return g.map((row) => row.join(''));
}

function makeFireballFrame() {
  const g = makeGrid(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 1.8) setPixel(g, x, y, 'W');
      else if (d < 3) setPixel(g, x, y, 'Y');
      else if (d < 4.2) setPixel(g, x, y, 'O');
      else if (d < 5.2) setPixel(g, x, y, 'D');
    }
  }
  for (const [x, y] of [[2, 3], [13, 2], [1, 11], [14, 12], [8, 1]]) setPixel(g, x, y, 'O');
  return g.map((row) => row.join(''));
}

// A spiky star-burst: the radius wobbles with angle to give it points.
function makeBlastFrame() {
  const g = makeGrid(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const r = 5.6 + 2.2 * Math.cos(4 * Math.atan2(dy, dx));
      const t = Math.hypot(dx, dy) / r;
      if (t >= 1) continue;
      setPixel(g, x, y, t < 0.35 ? 'W' : t < 0.6 ? 'Y' : t < 0.85 ? 'O' : 'D');
    }
  }
  return g.map((row) => row.join(''));
}

// --- Build every data URL once at load time ------------------------------

// Builds '<family>-up/right/down/left' texture entries from one up-facing
// frame (see rotateFrame90CW).
function directionalTextures(family, upFrame, palette) {
  const right = rotateFrame90CW(upFrame);
  const down = rotateFrame90CW(right);
  const left = rotateFrame90CW(down);
  return {
    [`${family}-up`]: frameToDataURL(upFrame, palette),
    [`${family}-right`]: frameToDataURL(right, palette),
    [`${family}-down`]: frameToDataURL(down, palette),
    [`${family}-left`]: frameToDataURL(left, palette),
  };
}

// --- Ice-theme trap tiles ----------------------------------------------------

// Thin ice: pale translucent ice with hairline cracks. 'cracked' is how it
// looks with you standing on it (it breaks the moment you step off);
// 'broken' is the hole left behind — dark freezing water with shards.
// Deliberately darker and more watery than slick ice (which is bright and
// glossy), so the two never read as the same tile.
const THIN_ICE_PALETTE = {
  A: '#5fa9c9', B: '#3f86a8', C: '#9ad3ea', K: '#e8f7ff', W: '#ffffff', Q: '#2f6f90',
  D: '#0c2638', E: '#17405c', F: '#2f6c92', N: '#d8f0ff',
};

function makeThinIceFrame(state) {
  const g = makeGrid(16, 16, 'A');
  if (state === 'broken') {
    fillRect(g, 0, 0, 16, 16, 'D');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (Math.abs(d - 3.5) < 0.5 || Math.abs(d - 6) < 0.45) setPixel(g, x, y, 'E');
      }
    }
    // A jagged rim of the ice that broke away, and floating shards.
    for (let k = 0; k < 16; k++) {
      const jag = [1, 0, 2, 1, 0, 1, 2, 0][k % 8];
      fillRect(g, k, 0, 1, jag, 'B');
      fillRect(g, k, 16 - jag, 1, jag, 'B');
      fillRect(g, 0, k, jag, 1, 'B');
      fillRect(g, 16 - jag, k, jag, 1, 'B');
    }
    for (const [x, y] of [[4, 4], [5, 4], [4, 5], [11, 10], [12, 10], [10, 12], [9, 5]]) setPixel(g, x, y, 'N');
    setPixel(g, 7, 9, 'F'); setPixel(g, 8, 9, 'F');
    return g.map((row) => row.join(''));
  }
  fillRect(g, 0, 0, 16, 1, 'C');
  fillRect(g, 0, 0, 1, 16, 'C');
  fillRect(g, 0, 15, 16, 1, 'B');
  fillRect(g, 15, 0, 1, 16, 'B');
  // Dark water showing through the thinnest patches.
  for (const [x, y, w, h] of [[3, 3, 3, 2], [9, 9, 4, 2], [11, 4, 2, 2], [4, 11, 2, 2]]) fillRect(g, x, y, w, h, 'Q');
  // Cracks — a few jagged white lines.
  const cracks = [[2, 13, 1, -1, 5], [8, 2, 1, 1, 5], [13, 13, -1, -1, 4], [6, 8, 1, 0, 3]];
  if (state === 'cracked') {
    // Spiderweb from the middle: 8 rays and a ring.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      for (let k = 1; k <= 6; k++) setPixel(g, 7 + dx * k + (k % 3 === 0 ? dy : 0), 7 + dy * k, 'K');
    }
    for (const [x, y] of [[5, 5], [9, 5], [5, 9], [9, 9], [7, 4], [4, 7]]) setPixel(g, x, y, 'K');
  } else {
    cracks.forEach(([x, y, dx, dy, n]) => {
      for (let k = 0; k < n; k++) setPixel(g, x + dx * k, y + dy * k, 'K');
    });
  }
  setPixel(g, 4, 3, 'W'); setPixel(g, 5, 2, 'W'); setPixel(g, 12, 7, 'W');
  return g.map((row) => row.join(''));
}

// Frostbite patch: frosted ground with a big snowflake, ringed in violet
// frost so it never reads as plain ice.
const FROST_PALETTE = { A: '#a3bdd6', B: '#86a2c0', C: '#d2e6f5', W: '#ffffff', P: '#a996ea', M: '#e6f2ff' };

function makeFrostFrame() {
  const g = makeGrid(16, 16, 'A');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) if ((x * 7 + y * 3) % 11 === 0) setPixel(g, x, y, 'B');
  }
  for (let k = 0; k < 16; k += 2) {
    setPixel(g, k, 0, 'P'); setPixel(g, k + 1, 15, 'P');
    setPixel(g, 0, k + 1, 'P'); setPixel(g, 15, k, 'P');
  }
  // Six-armed snowflake with little branches.
  const cx = 7.5, cy = 7.5;
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    for (let r = 0; r <= 5; r++) setPixel(g, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 'W');
    for (const side of [-0.6, 0.6]) {
      setPixel(g, Math.round(cx + Math.cos(a) * 3.2 + Math.cos(a + side * 2) * 1.2), Math.round(cy + Math.sin(a) * 3.2 + Math.sin(a + side * 2) * 1.2), 'C');
    }
  }
  for (const [x, y] of [[2, 3], [3, 2], [12, 13], [13, 12], [2, 12], [13, 3]]) setPixel(g, x, y, 'M');
  return g.map((row) => row.join(''));
}

// Falling icicle: an icicle hanging over the tile (drawn in perspective,
// from the top edge) and its shadow on the floor. 'shaking' adds loose
// chips and a crack at its root (the tile also wobbles — see
// .icicle-shaking in style.css).
const ICICLE_COLORS = { I: '#e4f6ff', J: '#8fc4e8', K: '#4f86b0', W: '#ffffff', Z: '#1c2530' };

function makeIcicleFrame(state) {
  const g = floorGrid();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (Math.hypot((x - 7.5) / 3.6, (y - 12) / 1.6) < 1) setPixel(g, x, y, 'Z');
    }
  }
  for (let y = 0; y < 9; y++) {
    const half = Math.max(0, 2.5 - y * 0.3);
    for (let x = Math.round(7.5 - half); x <= Math.round(7.5 + half) - 1; x++) setPixel(g, x, y, x < 8 ? 'I' : 'J');
  }
  setPixel(g, 7, 9, 'J');
  setPixel(g, 6, 1, 'W');
  if (state === 'shaking') {
    fillRect(g, 5, 0, 6, 1, 'K');
    for (const [x, y] of [[4, 3], [11, 4], [3, 6], [12, 7]]) setPixel(g, x, y, 'W');
  }
  return g.map((row) => row.join(''));
}

// A fallen icicle: a solid, faceted block of ice (solid like a wall until
// the room resets).
const ICE_BLOCK_PALETTE = { A: '#8fc4e8', B: '#cfeaf8', C: '#5a94bc', D: '#2e5a7a', W: '#ffffff', F: '#4a4038' };

function makeIceBlockFrame() {
  const g = makeGrid(16, 16, 'F');
  for (let y = 1; y < 16; y++) {
    for (let x = 1; x < 15; x++) {
      const inBlock = y >= 2 + Math.abs(x - 7.5) * 0.35 && y <= 14;
      if (!inBlock) continue;
      setPixel(g, x, y, x + y < 13 ? 'B' : x > 9 ? 'C' : 'A');
    }
  }
  for (let x = 1; x < 15; x++) setPixel(g, x, 15, 'D');
  for (let y = 4; y < 15; y++) { setPixel(g, 1, y, 'D'); setPixel(g, 14, y, 'D'); }
  for (let k = 0; k < 5; k++) setPixel(g, 8 + (k % 2), 4 + k * 2, 'C');
  setPixel(g, 4, 5, 'W'); setPixel(g, 5, 4, 'W'); setPixel(g, 11, 12, 'W');
  return g.map((row) => row.join(''));
}

// The icicle spearing down on its crash tick (transparent overlay).
function makeIcicleCrashFrame() {
  const g = makeGrid(16, 16);
  for (let y = 0; y < 13; y++) {
    const half = Math.max(0, 3 - y * 0.24);
    for (let x = Math.round(7.5 - half); x <= Math.round(7.5 + half) - 1; x++) setPixel(g, x, y, x < 8 ? 'I' : 'J');
  }
  for (const [x, y] of [[3, 12], [2, 14], [5, 14], [11, 13], [13, 14], [10, 15], [6, 15]]) setPixel(g, x, y, 'W');
  setPixel(g, 7, 13, 'W'); setPixel(g, 8, 13, 'W');
  return g.map((row) => row.join(''));
}

// --- Grass-theme trap tiles --------------------------------------------------

// Grabbing vines: a tangle of thick vines and leaves across the floor.
const VINE_COLORS = { V: '#2e6b2a', U: '#4f9a3a', L: '#8fd05a', K: '#1c4a1a' };

function drawVineWave(g, y0, phase, ch, amp = 1.6) {
  for (let x = 0; x < 16; x++) {
    const y = Math.round(y0 + Math.sin((x + phase) * 0.8) * amp);
    setPixel(g, x, y, ch);
    setPixel(g, x, y + 1, 'K');
  }
}

function makeVinesFrame() {
  const g = floorGrid();
  drawVineWave(g, 3, 0, 'V');
  drawVineWave(g, 8, 2, 'U');
  drawVineWave(g, 12, 4, 'V');
  for (const [x, y] of [[3, 1], [10, 5], [6, 10], [13, 10], [1, 14], [9, 14]]) {
    setPixel(g, x, y, 'L'); setPixel(g, x + 1, y, 'L'); setPixel(g, x, y + 1, 'U');
  }
  return g.map((row) => row.join(''));
}

// Vines coiled round the lower half of the player while they're held
// (transparent overlay, drawn above the player sprite).
function makeVineWrapFrame() {
  const g = makeGrid(16, 16);
  for (const [y0, phase] of [[9, 0], [12, 2], [15, 1]]) {
    for (let x = 2; x < 14; x++) {
      const y = Math.round(y0 + Math.sin((x + phase) * 0.9) * 1.2);
      setPixel(g, x, y, 'U');
      setPixel(g, x, y - 1, 'V');
    }
  }
  for (const [x, y] of [[2, 8], [13, 10], [4, 13], [12, 14]]) { setPixel(g, x, y, 'L'); setPixel(g, x + 1, y - 1, 'L'); }
  return g.map((row) => row.join(''));
}

// Mushroom pad: a big spotted cap on a stubby stem.
const MUSHROOM_COLORS = { R: '#d8392b', D: '#8a1a14', W: '#fff4e0', S: '#efe0c0', T: '#c8b490', G: '#9a7a54' };

function makeMushroomFrame() {
  const g = floorGrid();
  fillRect(g, 6, 9, 4, 5, 'S');
  fillRect(g, 9, 9, 1, 5, 'T');
  fillRect(g, 5, 14, 6, 1, 'T');
  for (let y = 2; y <= 9; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x - 7.5) / 7, (y - 9) / 7);
      if (d < 1 && y < 9) setPixel(g, x, y, x > 10 || y > 7 ? 'D' : 'R');
    }
  }
  fillRect(g, 2, 9, 12, 1, 'G');
  for (const [x, y] of [[4, 5], [5, 5], [4, 6], [9, 3], [10, 3], [11, 6], [7, 6]]) setPixel(g, x, y, 'W');
  return g.map((row) => row.join(''));
}

// Snapjaw: a flytrap growing from a mossy stone planter. Solid. 'idle' is
// half open, 'open' (the warning beat) gapes wide, 'shut' is mid-bite.
const SNAPJAW_PALETTE = {
  A: '#4a4f40', B: '#34382e', C: '#63695a', M: '#5e9e3a',
  G: '#4fae3a', H: '#2e7a22', R: '#c83a3a', Q: '#8a1f24', T: '#f8f8e8', S: '#3a6a22',
};

function makeSnapjawFrame(state) {
  const g = makeGrid(16, 16, 'A');
  fillRect(g, 0, 0, 16, 1, 'C');
  fillRect(g, 0, 0, 1, 16, 'C');
  fillRect(g, 0, 15, 16, 1, 'B');
  fillRect(g, 15, 0, 1, 16, 'B');
  for (const [x, y] of [[2, 13], [3, 13], [12, 2], [13, 2], [13, 13]]) setPixel(g, x, y, 'M');
  fillRect(g, 7, 10, 2, 5, 'S');
  // Jaw gap: how far apart the upper and lower jaw are at the hinge.
  const gap = state === 'open' ? 5 : state === 'shut' ? 0 : 2;
  const hingeX = 3;
  const midY = 7;
  for (let x = hingeX; x <= 13; x++) {
    const spread = Math.round(((x - hingeX) / 10) * gap);
    const topY = midY - 1 - spread;
    const botY = midY + 1 + spread;
    fillRect(g, x, topY - 2, 1, 2, x > 10 ? 'H' : 'G');
    fillRect(g, x, botY + 1, 1, 2, x > 10 ? 'H' : 'G');
    if (gap > 0) fillRect(g, x, topY, 1, botY - topY + 1, x < 5 ? 'Q' : 'R');
    else fillRect(g, x, midY - 1, 1, 3, 'H');
    if (x % 2 === 0) {
      setPixel(g, x, topY, 'T');
      setPixel(g, x, botY, 'T');
    }
  }
  return g.map((row) => row.join(''));
}

// The bite itself on a neighboring tile (transparent overlay): two green
// jaws clamping, teeth meeting in the middle.
function makeBiteFrame() {
  const g = makeGrid(16, 16);
  for (let x = 1; x < 15; x++) {
    const curve = Math.round(Math.abs(x - 7.5) * 0.4);
    fillRect(g, x, 2 + curve, 1, 3, 'G');
    fillRect(g, x, 11 - curve, 1, 3, 'G');
    if (x % 2 === 1) {
      setPixel(g, x, 5 + curve, 'T'); setPixel(g, x, 6 + curve, 'T');
      setPixel(g, x, 10 - curve, 'T'); setPixel(g, x, 9 - curve, 'T');
    }
  }
  return g.map((row) => row.join(''));
}

// Wild boar: hand-authored side view, facing right (flipped via CSS when it
// charges left).
const BOAR_PALETTE = { B: '#7a5536', D: '#4a3220', N: '#2e1f14', P: '#d89a8a', W: '#f4f0e0', K: '#15151a', E: '#ff5c3c' };

const BOAR_FRAME = [
  '................',
  '................',
  '................',
  '....NNNNN.......',
  '..NNBBBBBNN.....',
  '.NBBBBBBBBBNN...',
  '.BBBBBBBBBBBBBD.',
  'NBBBBBBBBBBBKBDD',
  'NBBBBBBBBBBBBBPP',
  '.BBBBBBBBBBBBWPP',
  '.DBBBBBBBBBBBW..',
  '..DDBBBBBBBBD...',
  '...DD.DD..DD.D..',
  '...DD.DD..DD.D..',
  '...NN.NN..NN.N..',
  '................',
];

const BOAR_BUILDER_COLORS = { ...BOAR_PALETTE, P: '#d89a8a', Y: '#e8c04a' };

function makeBoarBuilderFrame(axis) {
  const g = floorGrid();
  stampFrame(g, BOAR_FRAME);
  if (axis === 'h') {
    setPixel(g, 0, 8, 'Y'); setPixel(g, 1, 7, 'Y'); setPixel(g, 1, 9, 'Y');
    setPixel(g, 15, 3, 'Y'); setPixel(g, 14, 2, 'Y'); setPixel(g, 14, 4, 'Y');
  } else {
    setPixel(g, 8, 0, 'Y'); setPixel(g, 7, 1, 'Y'); setPixel(g, 9, 1, 'Y');
    setPixel(g, 8, 15, 'Y'); setPixel(g, 7, 14, 'Y'); setPixel(g, 9, 14, 'Y');
  }
  return g.map((row) => row.join(''));
}

// Fairy ring: the grass theme's portal — a circle of tiny glowing
// mushrooms around a patch of shimmering grass.
function makeFairyRingFrame() {
  const g = floorGrid();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) if (Math.hypot(x - 7.5, y - 7.5) < 3.6) setPixel(g, x, y, 'V');
  }
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI / 4) * k;
    const x = Math.round(7 + Math.cos(a) * 5.4);
    const y = Math.round(7 + Math.sin(a) * 5.4);
    fillRect(g, x, y, 2, 1, 'R');
    setPixel(g, x, y, 'S');
    setPixel(g, x + (k % 2), y + 1, 'W');
  }
  setPixel(g, 7, 7, 'W'); setPixel(g, 8, 8, 'S'); setPixel(g, 6, 9, 'S'); setPixel(g, 9, 6, 'S');
  return g.map((row) => row.join(''));
}

// --- Castle-theme art ------------------------------------------------------------
//
// The abandoned castle's own traps (crusher, pressure plate, portcullis,
// ghost), plus the castle versions of shared traps that need a different
// shape, not just different colors: magic mirrors (portals), a crossbow
// (turret), a powder barrel (bomb) and rotten floorboards (thin ice).

// Crusher: a stone block on a chain. 'up' is the floor under it — a
// recessed slot with the block's shadow — and 'down' is the block itself
// resting on the floor, solid, with iron bands.
const CRUSHER_PALETTE = {
  A: '#57525e', B: '#3a3640', C: '#6e6978', Z: '#1c1a22', K: '#2a2730',
  S: '#6a6474', T: '#8a8494', U: '#46414e', I: '#9aa0ae', J: '#5a606e', R: '#b02a3a',
};

function makeCrusherFrame(state) {
  if (state === 'down') {
    const g = makeGrid(16, 16, 'S');
    fillRect(g, 0, 0, 16, 1, 'T');
    fillRect(g, 0, 0, 1, 16, 'T');
    fillRect(g, 0, 15, 16, 1, 'U');
    fillRect(g, 15, 0, 1, 16, 'U');
    for (const y of [4, 11]) fillRect(g, 0, y, 16, 2, 'J');
    for (const y of [4, 11]) fillRect(g, 0, y, 16, 1, 'I');
    for (const [x, y] of [[2, 4], [13, 4], [2, 11], [13, 11]]) setPixel(g, x, y + 1, 'K');
    // Cracks from all the slamming.
    for (const [x, y] of [[5, 7], [6, 8], [7, 8], [10, 2], [11, 3], [9, 13]]) setPixel(g, x, y, 'U');
    return g.map((row) => row.join(''));
  }
  const g = floorGrid();
  // The slot the block drops into, and its shadow from above.
  for (let k = 1; k < 15; k++) {
    setPixel(g, k, 1, 'K'); setPixel(g, k, 14, 'K');
    setPixel(g, 1, k, 'K'); setPixel(g, 14, k, 'K');
  }
  for (let y = 3; y < 13; y++) {
    for (let x = 3; x < 13; x++) if ((x + y) % 2 === 0) setPixel(g, x, y, 'Z');
  }
  // Warning notches at the corners.
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) setPixel(g, x, y, 'R');
  return g.map((row) => row.join(''));
}

// The block slamming down (transparent overlay, crash tick only): the
// block's bottom edge and a burst of dust.
function makeCrushFrame() {
  const g = makeGrid(16, 16);
  fillRect(g, 1, 0, 14, 11, 'S');
  fillRect(g, 1, 10, 14, 1, 'U');
  fillRect(g, 1, 4, 14, 1, 'I');
  for (const [x, y] of [[0, 12], [2, 13], [4, 12], [11, 12], [13, 13], [15, 12], [7, 14], [9, 13]]) setPixel(g, x, y, 'T');
  return g.map((row) => row.join(''));
}

// Pressure plate: a square stone plate sunk into the floor, with a rune.
const PLATE_COLORS = { P: '#6e6978', Q: '#46414e', R: '#8a8494', V: '#b89aff', W: '#e8dcff' };

function makePlateFrame() {
  const g = floorGrid();
  fillRect(g, 3, 3, 10, 10, 'P');
  fillRect(g, 3, 3, 10, 1, 'Q');
  fillRect(g, 3, 3, 1, 10, 'Q');
  fillRect(g, 3, 12, 10, 1, 'R');
  fillRect(g, 12, 3, 1, 10, 'R');
  // A diamond rune in the middle.
  for (const [x, y] of [[7, 5], [8, 5], [6, 6], [9, 6], [5, 7], [10, 7], [5, 8], [10, 8], [6, 9], [9, 9], [7, 10], [8, 10]]) setPixel(g, x, y, 'V');
  setPixel(g, 7, 7, 'W'); setPixel(g, 8, 8, 'W');
  return g.map((row) => row.join(''));
}

// Portcullis: iron bars across the floor ('shut', solid), or the bars
// hauled up out of sight with only their spiked tips showing ('open').
const GATE_COLORS = { I: '#8a8e9c', J: '#4a4e5c', K: '#1c1e26', T: '#c0c4d0', R: '#b02a3a' };

function makeGateFrame(open) {
  const g = floorGrid();
  if (open) {
    for (const x of [2, 6, 10, 13]) {
      setPixel(g, x, 0, 'I'); setPixel(g, x, 1, 'T');
    }
    fillRect(g, 0, 0, 16, 1, 'K');
    fillRect(g, 1, 14, 14, 1, 'K');
    return g.map((row) => row.join(''));
  }
  for (const x of [2, 6, 10, 13]) {
    fillRect(g, x, 0, 2, 16, 'J');
    fillRect(g, x, 0, 1, 16, 'I');
    setPixel(g, x, 15, 'T'); setPixel(g, x + 1, 15, 'T');
  }
  for (const y of [3, 11]) {
    fillRect(g, 0, y, 16, 1, 'J');
    fillRect(g, 0, y, 16, 1, 'I');
    for (const x of [2, 6, 10, 13]) setPixel(g, x, y, 'K');
  }
  return g.map((row) => row.join(''));
}

// Ghost: a pale wisp with hollow eyes and a ragged tail (transparent
// overlay; stamped on floor for its Creative Mode look).
const GHOST_PALETTE = { W: '#eef0ff', V: '#b8bce0', K: '#1c1a2a', G: '#8a8ec0' };

const GHOST_FRAME = [
  '................',
  '.....VWWWWV.....',
  '....VWWWWWWV....',
  '...VWWWWWWWWV...',
  '...WWKKWWKKWW...',
  '...WWKKWWKKWW...',
  '..VWWWWWWWWWWV..',
  '..WWWWWKKWWWWW..',
  '..WWWWWKKWWWWW..',
  '..WWWWWWWWWWWW..',
  '..VWWWWWWWWWWV..',
  '..VWWWWWWWWWWV..',
  '..GVWWVWWVWWVG..',
  '...GV.GVVG.VG...',
  '....G..GG..G....',
  '................',
];

function makeGhostBuilderFrame() {
  const g = floorGrid();
  stampFrame(g, GHOST_FRAME);
  return g.map((row) => row.join(''));
}

// Magic mirror: the castle's portal — a tall oval glass in an ornate
// frame. R frame, S frame highlight, V glass, W glint (same keys as the
// other portal styles, so the per-theme portal colors slot in).
function makeMirrorFrame() {
  const g = floorGrid();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x - 7.5) / 5.6, (y - 7.5) / 7.2);
      if (d <= 1 && d > 0.78) setPixel(g, x, y, x + y < 14 ? 'S' : 'R');
      else if (d <= 0.78) setPixel(g, x, y, 'V');
    }
  }
  for (const [x, y] of [[5, 4], [5, 5], [6, 3], [9, 10], [10, 9]]) setPixel(g, x, y, 'W');
  setPixel(g, 7, 0, 'S'); setPixel(g, 8, 0, 'S');
  return g.map((row) => row.join(''));
}

// Crossbow: the castle's turret — a heavy crossbow bolted to the wall,
// facing up, with the bolt nocked. Uses the turret palette keys (wall D/F/G,
// housing H/J/K/B, bolt tip M/Y, R) so the per-theme turret colors slot in.
function makeCrossbowUpFrame() {
  const g = makeGrid(16, 16, 'D');
  fillRect(g, 0, 0, 16, 1, 'F');
  fillRect(g, 0, 0, 1, 16, 'F');
  fillRect(g, 0, 15, 16, 1, 'G');
  fillRect(g, 15, 0, 1, 16, 'G');
  // Stock.
  fillRect(g, 7, 4, 2, 11, 'H');
  fillRect(g, 7, 4, 1, 11, 'J');
  // Bow arms, curving back from the stock.
  for (let k = 0; k < 6; k++) {
    setPixel(g, 6 - k, 6 + Math.floor(k / 2), 'J');
    setPixel(g, 9 + k, 6 + Math.floor(k / 2), 'K');
  }
  // String.
  for (let x = 2; x < 14; x++) setPixel(g, x, 9, 'B');
  // Bolt, point up.
  fillRect(g, 7, 1, 2, 5, 'R');
  setPixel(g, 7, 1, 'Y'); setPixel(g, 8, 1, 'M');
  setPixel(g, 7, 2, 'M');
  return g.map((row) => row.join(''));
}

// Powder barrel: the castle's bomb — a banded wooden keg with a fuse.
// 'gone' reuses the bomb's scorch mark.
const BARREL_COLORS = {
  O: '#8a5a32', P: '#6b4222', Q: '#a8723e', I: '#5a5e6a', J: '#8a8e9c',
  W: '#c8a870', S: '#ffcf4d', T: '#fff6d8', D: '#ff7a1f', X: '#1e1914', Z: '#2a221c',
};

function makeBarrelFrame(state) {
  if (state === 'gone') return makeBombFrame('gone');
  const g = floorGrid();
  for (let y = 4; y < 15; y++) {
    const bulge = y > 6 && y < 12 ? 1 : 0;
    fillRect(g, 3 - bulge, y, 10 + bulge * 2, 1, 'O');
    setPixel(g, 3 - bulge, y, 'Q');
    setPixel(g, 12 + bulge, y, 'P');
  }
  for (const y of [5, 13]) fillRect(g, 3, y, 10, 1, 'I');
  fillRect(g, 2, 9, 12, 1, 'J');
  for (const x of [6, 9]) fillRect(g, x, 6, 1, 7, 'P');
  fillRect(g, 7, 3, 2, 1, 'P');
  setPixel(g, 9, 2, 'W'); setPixel(g, 10, 1, 'W');
  if (state === 'lit') {
    setPixel(g, 11, 0, 'T');
    for (const [x, y] of [[10, 0], [12, 0], [11, 1]]) setPixel(g, x, y, 'S');
    setPixel(g, 12, 1, 'D');
  } else {
    setPixel(g, 11, 0, 'D');
  }
  return g.map((row) => row.join(''));
}

// Rotten floorboards: the castle's thin ice — old planks that hold you once.
// 'cracked' (you're standing on it) sags and splits; 'broken' is the hole
// left behind, straight down into the dark.
const FLOORBOARD_PALETTE = {
  A: '#7a5a3a', B: '#5a3f26', C: '#94704a', K: '#2e1f14', N: '#3a2a1a', D: '#07060a', E: '#141018',
};

function makeFloorboardFrame(state) {
  const g = makeGrid(16, 16, 'A');
  if (state === 'broken') {
    fillRect(g, 0, 0, 16, 16, 'D');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) if (Math.hypot(x - 7.5, y - 7.5) > 6.5 && (x * 3 + y) % 4 !== 0) setPixel(g, x, y, 'E');
    }
    // Splintered plank ends round the edge.
    for (const [x, y, w] of [[0, 0, 4], [11, 0, 5], [0, 15, 3], [12, 15, 4], [0, 6, 2], [14, 9, 2]]) fillRect(g, x, y, w, 1, 'B');
    return g.map((row) => row.join(''));
  }
  // Four planks, grain lines, nail heads.
  for (const y of [0, 4, 8, 12]) {
    fillRect(g, 0, y, 16, 1, 'C');
    fillRect(g, 0, y + 3, 16, 1, 'K');
  }
  for (const [x, y] of [[3, 2], [9, 5], [5, 10], [12, 13], [13, 1]]) fillRect(g, x, y, 3, 1, 'B');
  for (const [x, y] of [[1, 1], [14, 1], [1, 9], [14, 9]]) setPixel(g, x, y, 'N');
  if (state === 'cracked') {
    for (let k = 0; k < 12; k++) setPixel(g, 2 + k, 5 + Math.round(Math.sin(k) * 1.5) + (k > 6 ? 2 : 0), 'K');
    fillRect(g, 7, 6, 2, 4, 'N');
  }
  return g.map((row) => row.join(''));
}

// Crumbling masonry for the castle walls (see the 'crumble' accent in
// makeWallFrame): a chipped-off corner, a crack, a cobweb.
function addCrumble(g) {
  fillRect(g, 13, 0, 3, 2, 'G');
  setPixel(g, 12, 0, 'G');
  fillRect(g, 0, 13, 2, 3, 'G');
  for (const [x, y] of [[4, 6], [5, 7], [5, 8], [6, 9], [10, 10], [11, 11]]) setPixel(g, x, y, 'G');
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [3, 2], [2, 3]]) setPixel(g, x, y, 'L');
}

// Moonlit ruins: a castle's broken towers against a huge moon, with bats,
// framed by a crumbling stone arch.
const CASTLE_PALETTE = {
  1: '#07060f', 2: '#0d0b1c', 3: '#141129', 4: '#1b1736', 5: '#231d44', 6: '#2c2552', 7: '#382f60', 8: '#463a6e',
  O: '#e8e4d0', P: '#c8c2aa', Q: '#8a84a8', S: '#ffffff',
  K: '#0b0912', H: '#110f1a', B: '#050408',
  C: '#1a1720', F: '#3a3444',
};

function makeCastleBackdropFrame() {
  const w = 128, h = 96;
  const g = makeGrid(w, h);
  const skyStops = ['1', '1', '2', '2', '3', '4', '5', '6', '7', '8'];
  for (let y = 0; y < h; y++) {
    fillRect(g, 0, y, w, 1, skyStops[Math.min(skyStops.length - 1, Math.floor((y / h) * skyStops.length))]);
  }
  for (let k = 0; k < 36; k++) setPixel(g, (k * 41 + 7) % w, (k * 13) % 44, 'S');
  // The moon, with a halo and craters.
  const mx = 84, my = 24;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d < 11) setPixel(g, x, y, 'O');
      else if (d < 13 && (x + y) % 2 === 0) setPixel(g, x, y, 'Q');
    }
  }
  for (const [x, y, r] of [[80, 20, 2], [88, 27, 3], [86, 17, 1], [79, 28, 1]]) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) <= r) setPixel(g, x + dx, y + dy, 'P');
    }
  }
  // Rolling hills, then the castle: a keep, towers (one broken), a wall
  // with crenellations.
  fillSilhouette(g, [6, 8, 10, 12, 10, 8, 7, 6, 8, 10, 12, 14, 12, 10, 8, 7], 84, 'H');
  const tower = (x0, width, top, broken) => {
    fillRect(g, x0, top, width, h - top, 'K');
    for (let x = x0; x < x0 + width; x += 2) setPixel(g, x, top - 1, 'K');
    if (broken) for (let k = 0; k < width; k++) fillRect(g, x0 + k, top - 1, 1, (k * 3) % 5, '5');
  };
  fillRect(g, 30, 58, 70, h - 58, 'K');
  for (let x = 30; x < 100; x += 3) setPixel(g, x, 57, 'K');
  tower(34, 8, 40, false);
  tower(52, 14, 30, false);
  tower(58, 3, 24, false);
  tower(76, 9, 44, true);
  tower(92, 6, 50, false);
  // Bats.
  for (const [x, y] of [[40, 16], [48, 22], [62, 12], [104, 34]]) {
    setPixel(g, x, y, 'B'); setPixel(g, x - 1, y - 1, 'B'); setPixel(g, x + 1, y - 1, 'B');
    setPixel(g, x - 2, y - 1, 'B'); setPixel(g, x + 2, y - 1, 'B');
  }
  fillCaveWalls(g, 'C', 0.36, 0.05, 'F');
  addCaveCeiling(g, 'C');
  return g.map((row) => row.join(''));
}

// --- Theme art: palettes per theme -------------------------------------------
//
// Everything that's shared between themes is the same generator with a
// different palette (and, for floor/walls, a little theme-specific detail).
// Lava's entries are the original palettes, untouched.

const THEME_ART = {
  lava: {
    floor: FLOOR_PALETTE,
    floorDecor: null,
    wall: WALL_PALETTE, wallAccent: 'veins',
    spike: SPIKE_PALETTE,
    oneway: ONEWAY_PALETTE,
    start: { Q: '#d94f2b', R: '#8a2a10', S: '#2a211b', F: '#ffcf4d' },
    goal: { T: '#ff7a1f', U: '#8a2a10', V: '#fff6d8' },
    portalStyle: 'ring',
    portalA: { R: '#ff7a1f', S: '#ffcf4d', V: '#3a1208', W: '#fff6d8' },
    portalB: { R: '#8a4dff', S: '#d6b8ff', V: '#1c0f33', W: '#f4ecff' },
    ghost: { G: '#7a6d60', Q: '#a89684' },
    ice: ICE_PALETTE,
    turret: TURRET_PALETTE,
    current: CURRENT_PALETTE,
    shot: FIRE_PALETTE,
  },
  ice: {
    floor: { A: '#5a6c84', B: '#3f4d61', C: '#7a8ca3', E: '#9fd3f5', q: '#dfeefc', r: '#ffffff' },
    floorDecor: (g) => {
      // Snow drifted against each flagstone's top edge, plus a sparkle.
      for (const [qx, qy] of [[0, 0], [9, 0], [0, 9], [9, 9]]) fillRect(g, qx + 1, qy + 1, 4, 1, 'q');
      setPixel(g, 12, 12, 'r'); setPixel(g, 3, 12, 'q'); setPixel(g, 4, 12, 'q');
    },
    wall: { D: '#1f2e44', E: '#111b2a', F: '#2e4260', G: '#0b121d', L: '#a9cbe8' }, wallAccent: 'frost',
    spike: {
      M: '#2b3e57', O: '#46607f', N: '#1b2838', P: '#0d1520',
      H: '#ffffff', S: '#e6f6ff', D: '#a8dcff', G: '#4f86b8',
      K: '#39506b', L: '#25364a', R: '#bfe8ff', T: '#ffffff', U: '#cfefff',
    },
    oneway: { N: '#2b3e57', L: '#46607f', K: '#1b2838', P: '#bfe8ff', O: '#2a5a8a' },
    start: { Q: '#4aa8e0', R: '#2a6a9a', S: '#2a2f3a', F: '#ffffff' },
    goal: { T: '#5fe0ff', U: '#1f7fb0', V: '#f0fcff' },
    portalStyle: 'ring',
    portalA: { R: '#39d0e6', S: '#b8f6ff', V: '#0c2a3a', W: '#ffffff' },
    portalB: { R: '#e052c8', S: '#ffc2f0', V: '#2e0c2a', W: '#fff0fb' },
    ghost: { G: '#8093a8', Q: '#b4c8dc' },
    ice: { A: '#a8d8f0', B: '#7fb8dc', C: '#d6f0ff', D: '#ffffff', E: '#ffffff', F: '#5f94ba' },
    turret: {
      D: '#1f2e44', F: '#2e4260', G: '#0b121d',
      H: '#4a6a8a', J: '#6f93b6', K: '#2a4260', B: '#1a2c40',
      M: '#8fe6ff', Y: '#ffffff', R: '#3a7aa8',
    },
    current: CURRENT_PALETTE,
    shot: { D: '#4fa8e0', O: '#8fd8ff', Y: '#d8f6ff', W: '#ffffff' },
  },
  grass: {
    floor: { A: '#6a7c4a', B: '#4a5832', C: '#88a060', E: '#e8d45a', q: '#9fd35a', r: '#5fa83a' },
    floorDecor: (g) => {
      // Grass tufts pushing up through the grout, and the odd flower.
      for (const [x, y] of [[7, 3], [8, 12], [3, 7], [12, 8]]) {
        setPixel(g, x, y, 'q'); setPixel(g, x, y - 1, 'r');
      }
      setPixel(g, 12, 3, 'E');
    },
    wall: { D: '#2e3328', E: '#1a1d16', F: '#434a3a', G: '#12150e', L: '#4f8a2e' }, wallAccent: 'moss',
    spike: {
      M: '#4a3a26', O: '#6b5536', N: '#2e2416', P: '#1a130b',
      H: '#f4f0d0', S: '#d8d0a0', D: '#8a9a4a', G: '#4a5a22',
      K: '#5a4a30', L: '#3a2e1c', R: '#a8d060', T: '#fffbe0', U: '#d8f080',
    },
    oneway: { N: '#4a4a3a', L: '#63634e', K: '#2e2e22', P: '#9fd35a', O: '#2e5a16' },
    start: { Q: '#5cb84a', R: '#2e7a2a', S: '#4a3220', F: '#ffe066' },
    goal: { T: '#3ddc84', U: '#1a7a44', V: '#eafff0' },
    portalStyle: 'fairy',
    portalA: { R: '#e8b83a', S: '#fff0a0', V: '#3a5a2a', W: '#fffbd0' },
    portalB: { R: '#5a8cff', S: '#cfe0ff', V: '#2a4a4a', W: '#f0f6ff' },
    ghost: { G: '#8a9a6a', Q: '#b8c890' },
    ice: ICE_PALETTE,
    turret: TURRET_PALETTE,
    current: { C: '#2a6a9a', B: '#1a4a70', L: '#3a86ba', F: '#4f9ad0', O: '#8fd0f0', P: '#e0f6ff' },
    shot: FIRE_PALETTE,
  },
  castle: {
    floor: { A: '#57525e', B: '#3a3640', C: '#6e6978', E: '#8a8478', q: '#2a2730', r: '#b8b4c0' },
    floorDecor: (g) => {
      // Cracks across the flagstones, a scrap of cobweb, a little rubble.
      for (const [x, y] of [[2, 3], [3, 4], [4, 4], [5, 5], [11, 10], [12, 11], [12, 12], [10, 2]]) setPixel(g, x, y, 'q');
      setPixel(g, 14, 14, 'r'); setPixel(g, 13, 14, 'r'); setPixel(g, 14, 13, 'r');
      setPixel(g, 4, 12, 'E'); setPixel(g, 5, 13, 'E');
    },
    wall: { D: '#2c2833', E: '#17151b', F: '#403a48', G: '#0e0c11', L: '#8a8494' }, wallAccent: 'crumble',
    spike: {
      M: '#3a3640', O: '#57525e', N: '#221f27', P: '#121016',
      H: '#ffffff', S: '#d6d8e0', D: '#8f94a3', G: '#4a4e5c',
      K: '#4a4652', L: '#2e2b33', R: '#c83a4a', T: '#ffffff', U: '#e0e4f0',
    },
    oneway: { N: '#2c2833', L: '#403a48', K: '#17151b', P: '#c8b4ff', O: '#4a2a7a' },
    start: { Q: '#6b3fa0', R: '#3e2266', S: '#2a2420', F: '#e8c04a' },
    goal: { T: '#c9b8ff', U: '#6a4fb0', V: '#f8f4ff' },
    portalStyle: 'mirror',
    portalA: { R: '#9aa0ae', S: '#e0e4f0', V: '#2e3350', W: '#ffffff' },
    portalB: { R: '#8a5ac8', S: '#e0ccff', V: '#241a3c', W: '#f4ecff' },
    ghost: { G: '#7a7684', Q: '#a8a4b4' },
    ice: ICE_PALETTE,
    turretStyle: 'crossbow',
    turret: {
      D: '#2c2833', F: '#403a48', G: '#0e0c11',
      H: '#6b4a2f', J: '#8a6238', K: '#3a2618', B: '#1a1510',
      M: '#e0e4f0', Y: '#ffffff', R: '#8f94a3',
    },
    current: CURRENT_PALETTE,
    bombStyle: 'barrel',
    thinIceStyle: 'boards',
    shot: { D: '#6a6e7c', O: '#a0a6b8', Y: '#dfe3ee', W: '#ffffff' },
  },
};

// Colors every floor-based trap brings with it, whatever floor it sits on.
const BOMB_COLORS = { K: '#141216', J: '#2e2a33', H: '#7a7484', W: '#8a6238', S: '#ffcf4d', T: '#fff6d8', D: '#ff7a1f', X: '#1e1914', Z: '#2a221c' };
const IMP_BUILDER_COLORS = { ...IMP_PALETTE, P: '#ffb347' };

// Every tile texture (data URL) for one theme, keyed like TILE_TEXTURES.
function buildThemeTextures(theme) {
  const art = THEME_ART[theme];
  const onFloor = (colors) => ({ ...art.floor, ...colors });
  const url = frameToDataURL;
  const oneRight = rotateFrame90CW(ONEWAY_UP_FRAME);
  const oneDown = rotateFrame90CW(oneRight);
  const oneLeft = rotateFrame90CW(oneDown);
  const portalFrame = { fairy: makeFairyRingFrame, mirror: makeMirrorFrame }[art.portalStyle] || makePortalFrame;
  const turretFrame = art.turretStyle === 'crossbow' ? makeCrossbowUpFrame : makeTurretUpFrame;
  const barrels = art.bombStyle === 'barrel';
  const bombFrame = barrels ? makeBarrelFrame : makeBombFrame;
  const bombColors = barrels ? BARREL_COLORS : BOMB_COLORS;
  const boards = art.thinIceStyle === 'boards';
  const thinIceFrame = boards ? makeFloorboardFrame : makeThinIceFrame;
  const thinIcePalette = boards ? FLOORBOARD_PALETTE : THIN_ICE_PALETTE;

  currentFloorDecor = art.floorDecor;
  const textures = {
    empty: url(makeFloorFrame(), art.floor),
    wall: url(makeWallFrame(art.wallAccent), art.wall),
    spike: url(makeSpikePlateFrame({ up: true }), art.spike),
    'timedspike-active': url(makeSpikePlateFrame({ up: true }), art.spike),
    'timedspike-inactive': url(makeSpikePlateFrame({ up: false, dull: true }), art.spike),
    'trap-triggered': url(makeSpikePlateFrame({ up: true, hot: true }), art.spike),
    'oneway-up': url(ONEWAY_UP_FRAME, art.oneway),
    'oneway-right': url(oneRight, art.oneway),
    'oneway-down': url(oneDown, art.oneway),
    'oneway-left': url(oneLeft, art.oneway),
    start: url(makeStartFrame(), onFloor(art.start)),
    goal: url(makeGoalFrame(), onFloor(art.goal)),
    'goal-locked': url(makeLockedGoalFrame(), onFloor({
      T: '#6a6470', U: '#3a3640', V: art.goal.T, L: '#9a98a6', M: '#4a4856',
    })),
    lever: url(makeLeverFrame(false), onFloor(LEVER_COLORS)),
    'lever-on': url(makeLeverFrame(true), onFloor(LEVER_COLORS)),
    hiddenspike: url(makeHiddenSpikeBuilderFrame(), onFloor(art.ghost)),
    bomb: url(bombFrame('armed'), onFloor(bombColors)),
    'bomb-lit': url(bombFrame('lit'), onFloor(bombColors)),
    'bomb-gone': url(bombFrame('gone'), onFloor({ ...BOMB_COLORS, ...bombColors })),
    ice: url(makeIceFrame(), art.ice),
    'portal-a': url(portalFrame(), onFloor(art.portalA)),
    'portal-b': url(portalFrame(), onFloor(art.portalB)),
    'imp-h': url(makeImpBuilderFrame('h'), onFloor(IMP_BUILDER_COLORS)),
    'imp-v': url(makeImpBuilderFrame('v'), onFloor(IMP_BUILDER_COLORS)),
    ...directionalTextures('turret', turretFrame(), art.turret),
    ...directionalTextures('vent', makeVentUpFrame(false), VENT_PALETTE),
    ...Object.fromEntries(
      Object.entries(directionalTextures('vent', makeVentUpFrame(true), VENT_PALETTE)).map(([key, u]) => [`${key}-active`, u])
    ),
    ...directionalTextures('current', makeCurrentUpFrame(), art.current),
    thinice: url(thinIceFrame('intact'), thinIcePalette),
    'thinice-cracked': url(thinIceFrame('cracked'), thinIcePalette),
    'thinice-broken': url(thinIceFrame('broken'), thinIcePalette),
    frost: url(makeFrostFrame(), FROST_PALETTE),
    icicle: url(makeIcicleFrame('hanging'), onFloor(ICICLE_COLORS)),
    'icicle-shaking': url(makeIcicleFrame('shaking'), onFloor(ICICLE_COLORS)),
    'icicle-fallen': url(makeIceBlockFrame(), { ...ICE_BLOCK_PALETTE, F: art.floor.A }),
    vines: url(makeVinesFrame(), onFloor(VINE_COLORS)),
    mushroom: url(makeMushroomFrame(), onFloor(MUSHROOM_COLORS)),
    snapjaw: url(makeSnapjawFrame('idle'), SNAPJAW_PALETTE),
    'snapjaw-open': url(makeSnapjawFrame('open'), SNAPJAW_PALETTE),
    'snapjaw-shut': url(makeSnapjawFrame('shut'), SNAPJAW_PALETTE),
    'boar-h': url(makeBoarBuilderFrame('h'), onFloor(BOAR_BUILDER_COLORS)),
    'boar-v': url(makeBoarBuilderFrame('v'), onFloor(BOAR_BUILDER_COLORS)),
    crusher: url(makeCrusherFrame('up'), onFloor(CRUSHER_PALETTE)),
    'crusher-down': url(makeCrusherFrame('down'), CRUSHER_PALETTE),
    plate: url(makePlateFrame(), onFloor(PLATE_COLORS)),
    gate: url(makeGateFrame(false), onFloor(GATE_COLORS)),
    'gate-open': url(makeGateFrame(true), onFloor(GATE_COLORS)),
    ghost: url(makeGhostBuilderFrame(), onFloor(GHOST_PALETTE)),
  };
  currentFloorDecor = null;
  return textures;
}

// Transparent overlays for moving/transient hazards, per theme (only the
// turret's shot changes: a fireball in lava, an ice shard in the ice).
function buildHazardTextures(theme) {
  return {
    flame: frameToDataURL(makeFlameFrame(), FIRE_PALETTE),
    fireball: frameToDataURL(makeFireballFrame(), THEME_ART[theme].shot),
    imp: frameToDataURL(IMP_FRAME, IMP_PALETTE),
    blast: frameToDataURL(makeBlastFrame(), FIRE_PALETTE),
    boar: frameToDataURL(BOAR_FRAME, BOAR_PALETTE),
    bite: frameToDataURL(makeBiteFrame(), SNAPJAW_PALETTE),
    'icicle-crash': frameToDataURL(makeIcicleCrashFrame(), ICICLE_COLORS),
    'vine-wrap': frameToDataURL(makeVineWrapFrame(), VINE_COLORS),
    ghost: frameToDataURL(GHOST_FRAME, GHOST_PALETTE),
    crush: frameToDataURL(makeCrushFrame(), CRUSHER_PALETTE),
  };
}

// --- Player colors per theme ---------------------------------------------------
// Palette swaps only, same as the volcanic reskin: a blue parka with a red
// scarf for the ice, a leaf cloak over an olive tunic for the ruins.

const PLAYER_PALETTES = {
  lava: PLAYER_PALETTE,
  ice: {
    Y: '#e6eef7', h: '#b5c4d6', W: '#e8b98c', X: '#c99a6d',
    Z: '#3f78b5', a: '#2a5588', b: '#2a2f3a', c: '#15151a',
    g: '#6b4a2f', i: '#d9455f', e: '#bfe8ff', f: '#ff5c5c',
  },
  grass: {
    Y: '#6b4a2f', h: '#4a3220', W: '#e8b98c', X: '#c99a6d',
    Z: '#5a7a3a', a: '#3a5224', b: '#3a2a1a', c: '#15151a',
    g: '#8a6238', i: '#8fc23a', e: '#ffe066', f: '#ff5c5c',
  },
  // A steel helm, a deep-purple tunic and a tattered crimson cloak.
  castle: {
    Y: '#9aa0ae', h: '#6a707e', W: '#e8b98c', X: '#c99a6d',
    Z: '#5a3a8a', a: '#3a2460', b: '#2a2420', c: '#15151a',
    g: '#6b4a2f', i: '#8a1f2e', e: '#e8dcff', f: '#ff5c5c',
  },
};

function buildPlayerFrames(palette) {
  return {
    idle: frameToDataURL(makePlayerIdleFrame(), palette),
    walkA: frameToDataURL(makePlayerWalkAFrame(), palette),
    walkB: frameToDataURL(makePlayerWalkBFrame(), palette),
    hit: frameToDataURL(makePlayerHitFrame(), palette),
    win: frameToDataURL(makePlayerWinFrame(), palette),
  };
}

// --- Backdrops for the ice and grass themes -------------------------------------

const GLACIER_PALETTE = {
  1: '#040914', 2: '#07102a', 3: '#0b1a3c', 4: '#10264e', 5: '#15345e', 6: '#1c4a70', 7: '#26647e', 8: '#347e8c',
  A: '#3dffb0', B: '#2ad0c0', S: '#ffffff',
  M: '#233a5a', N: '#3f5f86', O: '#33517a',
  C: '#0c1a2c', F: '#35658e',
};

// Aurora ribbons over a glacier range, seen from inside an ice cave.
function makeGlacierBackdropFrame() {
  const w = 128, h = 96;
  const g = makeGrid(w, h);
  const skyStops = ['1', '1', '2', '2', '3', '3', '4', '5', '6', '7', '8'];
  for (let y = 0; y < h; y++) {
    fillRect(g, 0, y, w, 1, skyStops[Math.min(skyStops.length - 1, Math.floor((y / h) * skyStops.length))]);
  }
  for (let k = 0; k < 40; k++) setPixel(g, (k * 37) % w, (k * 11) % 40, 'S');
  // Two wavy aurora ribbons.
  for (let x = 0; x < w; x++) {
    const y1 = Math.round(22 + Math.sin(x * 0.09) * 5 + Math.sin(x * 0.23) * 2);
    fillRect(g, x, y1, 1, 3, 'A');
    setPixel(g, x, y1 + 3, 'B');
    const y2 = Math.round(32 + Math.sin(x * 0.07 + 2) * 4);
    if (x % 3 !== 0) fillRect(g, x, y2, 1, 2, 'B');
  }
  fillSilhouette(g, [10, 14, 20, 26, 30, 26, 20, 16, 12, 16, 22, 28, 22, 16, 12, 9], 52, 'M');
  fillSilhouette(g, [20, 26, 34, 42, 34, 28, 22, 18, 24, 32, 40, 46, 40, 32, 24, 18], 72, 'N');
  // Shaded faces on the near peaks.
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) if (g[y][x] === 'N' && (x + y) % 5 === 0 && x % 16 > 8) setPixel(g, x, y, 'O');
  }
  fillCaveWalls(g, 'C', 0.4, 0.05, 'F');
  addCaveCeiling(g, 'C');
  return g.map((row) => row.join(''));
}

const GROVE_PALETTE = {
  1: '#07120b', 2: '#0b1a10', 3: '#102616', 4: '#16341c', 5: '#1f4424', 6: '#2e5a2c', 7: '#4a7434', 8: '#7a9444',
  T: '#132416', M: '#0e1d10', N: '#081208',
  C: '#0c2210', F: '#2e6a2a', Y: '#fff27a',
};

// An overgrown temple in a forest clearing at dusk, framed by foliage and
// hanging vines, with fireflies.
function makeGroveBackdropFrame() {
  const w = 128, h = 96;
  const g = makeGrid(w, h);
  const skyStops = ['1', '2', '2', '3', '3', '4', '5', '6', '7', '8'];
  for (let y = 0; y < h; y++) {
    fillRect(g, 0, y, w, 1, skyStops[Math.min(skyStops.length - 1, Math.floor((y / h) * skyStops.length))]);
  }
  // A stepped temple silhouette in the middle distance.
  const tx = 64;
  for (let step = 0; step < 6; step++) fillRect(g, tx - 22 + step * 4, 40 + step * 5 - 25, 44 - step * 8, 60, 'T');
  fillRect(g, tx - 3, 12, 6, 4, 'T');
  fillSilhouette(g, [12, 18, 14, 20, 26, 20, 16, 22, 28, 22, 18, 14, 20, 24, 18, 14], 62, 'M');
  fillSilhouette(g, [26, 34, 30, 38, 44, 38, 30, 26, 34, 42, 48, 40, 32, 28, 34, 30], 84, 'N');
  fillCaveWalls(g, 'C', 0.4, 0.05, 'F');
  addCaveCeiling(g, 'C');
  for (const [x, y] of [[30, 30], [44, 52], [78, 40], [92, 58], [60, 66], [100, 34], [36, 70], [84, 22]]) setPixel(g, x, y, 'Y');
  return g.map((row) => row.join(''));
}

// Every theme's full tile set. TILE_TEXTURES (lava) is also the default
// look for anything that doesn't say which theme it's in.
const THEME_TILE_TEXTURES = Object.fromEntries(
  Object.keys(THEME_ART).map((theme) => [theme, buildThemeTextures(theme)])
);
const TILE_TEXTURES = THEME_TILE_TEXTURES.lava;

const THEME_HAZARD_TEXTURES = Object.fromEntries(
  Object.keys(THEME_ART).map((theme) => [theme, buildHazardTextures(theme)])
);
const HAZARD_TEXTURES = THEME_HAZARD_TEXTURES.lava;

// A tile's texture in a theme, falling back to lava's for any key a theme
// doesn't define.
function themeTexture(theme, key) {
  return (THEME_TILE_TEXTURES[theme] || TILE_TEXTURES)[key] || TILE_TEXTURES[key];
}

function themeHazardTexture(theme, key) {
  return (THEME_HAZARD_TEXTURES[theme] || HAZARD_TEXTURES)[key];
}

// Icons for builder-panel UI chrome that aren't placeable tile types.
const UI_ICON_TEXTURES = {
  trash: frameToDataURL(makeTrashFrame(), TRASH_PALETTE),
};

// --- Profile icons (account button / account panel) -------------------------
// A player picks one of these as their account icon. Most are the game's own
// tile art, so an icon reads as "a tile from the dungeon"; the key and door
// are drawn here on the same lava floor to match. The ids are stored in the
// player's cloud profile (and checked by firestore.rules), so never rename
// one — only add.

const KEY_ICON_FRAME = [
  '............',
  '............',
  '............',
  '.DDD........',
  'DYYODDDDDDDD',
  'DY.OYYYYYYYD',
  'DOOODDDDODOD',
  '.DDD...DODOD',
  '.......DDDDD',
  '............',
  '............',
  '............',
];
const KEY_ICON_COLORS = { D: '#4a2e08', Y: '#ffd84a', O: '#c8901e' };

const DOOR_ICON_FRAME = [
  '...SSSSSS...',
  '..SXXXXXXS..',
  '.SXWYWWYWXS.',
  '.SXWYWWYWXS.',
  '.SXWYWWYWXS.',
  '.SXXXXXXXXS.',
  '.SXWYWWYGXS.',
  '.SXWYWWYWXS.',
  '.SXWYWWYWXS.',
  '.SXXXXXXXXS.',
  '.SXWYWWYWXS.',
  '.SSSSSSSSSS.',
];
const DOOR_ICON_COLORS = { S: '#7a7a88', X: '#2a1c10', W: '#6b4a2f', Y: '#8a6238', G: '#ffcf4d' };

// Centers a 12x12 icon frame on a 16x16 floor tile.
function makeFloorIconFrame(frame) {
  const g = floorGrid();
  const blank = PIXEL_TRANSPARENT.repeat(16);
  stampFrame(g, [blank, blank, ...frame.map((row) => `..${row}..`), blank, blank]);
  return g.map((row) => row.join(''));
}

// In picker order. The first is the default for new accounts.
const PROFILE_ICONS = [
  { id: 'spike', name: 'Spike trap', url: themeTexture('lava', 'spike') },
  { id: 'key', name: 'Key', url: frameToDataURL(makeFloorIconFrame(KEY_ICON_FRAME), { ...FLOOR_PALETTE, ...KEY_ICON_COLORS }) },
  { id: 'door', name: 'Door', url: frameToDataURL(makeFloorIconFrame(DOOR_ICON_FRAME), { ...FLOOR_PALETTE, ...DOOR_ICON_COLORS }) },
  { id: 'bomb', name: 'Bomb', url: themeTexture('lava', 'bomb-lit') },
  { id: 'portal', name: 'Portal', url: themeTexture('lava', 'portal-a') },
  { id: 'gem', name: 'Goal gem', url: themeTexture('lava', 'goal') },
  { id: 'icicle', name: 'Icicle', url: themeTexture('ice', 'icicle') },
  { id: 'snapjaw', name: 'Snapjaw', url: themeTexture('grass', 'snapjaw') },
  { id: 'mushroom', name: 'Mushroom', url: themeTexture('grass', 'mushroom') },
];
const DEFAULT_PROFILE_ICON = PROFILE_ICONS[0].id;

function profileIconUrl(id) {
  return (PROFILE_ICONS.find((icon) => icon.id === id) || PROFILE_ICONS[0]).url;
}

const THEME_PLAYER_FRAMES = Object.fromEntries(
  Object.entries(PLAYER_PALETTES).map(([theme, palette]) => [theme, buildPlayerFrames(palette)])
);
const PLAYER_FRAMES = THEME_PLAYER_FRAMES.lava;

// --- Story cutscene art (see story.js) ---------------------------------------
// The cutscenes reuse the tile art and the player's frames; these are the
// few extra pieces the story needs.

// The old Trapwright: the player's own poses (so every animation lines up),
// with grey hair and beard, a deep-teal robe and a gold mantle. The beard
// covers the lower face (row 5) and the cheek pixels on row 4.
const MASTER_PALETTE = {
  Y: '#cfcac0', h: '#9a958c', W: '#e0b088', X: '#c09070',
  Z: '#2f6470', a: '#1d4450', b: '#3a2a1a', c: '#15151a',
  g: '#8a6238', i: '#c8901e', e: '#ffe9a8', f: '#ff5c5c',
};
// The figure glimpsed in the dark: the master's shape, all shadow, with two
// pale eyes.
const SHADOW_PALETTE = {
  Y: '#1a1424', h: '#120e1a', W: '#221a2e', X: '#1a1424',
  Z: '#1e1729', a: '#140f1d', b: '#0e0a14', c: '#d8d0ff',
  g: '#1a1424', i: '#2a1f3a', e: '#6a5a9a', f: '#221a2e',
};

function addBeard(frame) {
  return frame.map((row, y) => {
    if (y === 5) return row.replace(/[WX]/g, 'Y');
    if (y === 4) return row.replace(/X/g, 'h');
    return row;
  });
}

function buildBeardedFrames(palette) {
  return {
    idle: frameToDataURL(addBeard(makePlayerIdleFrame()), palette),
    walkA: frameToDataURL(addBeard(makePlayerWalkAFrame()), palette),
    walkB: frameToDataURL(addBeard(makePlayerWalkBFrame()), palette),
    hit: frameToDataURL(addBeard(makePlayerHitFrame()), palette),
    win: frameToDataURL(addBeard(makePlayerWinFrame()), palette),
  };
}

// A journal page: curling parchment with lines of ink and a wax seal.
const JOURNAL_PALETTE = { P: '#e8d8a8', Q: '#c8b07a', R: '#8a7048', I: '#4a3a2a', S: '#b02a2a', T: '#e05a4a' };

function makeJournalFrame() {
  const g = makeGrid(16, 16);
  fillRect(g, 3, 2, 10, 12, 'P');
  fillRect(g, 3, 13, 10, 1, 'Q');
  fillRect(g, 12, 2, 1, 12, 'Q');
  setPixel(g, 12, 2, PIXEL_TRANSPARENT);
  setPixel(g, 11, 2, 'R');
  setPixel(g, 12, 3, 'R');
  for (const [y, w] of [[4, 7], [6, 6], [8, 7], [10, 4]]) fillRect(g, 4, y, w, 1, 'I');
  fillRect(g, 9, 10, 2, 2, 'S');
  setPixel(g, 9, 10, 'T');
  return g.map((row) => row.join(''));
}

// The Trapwright's tools: a hammer and a chisel, crossed.
const TOOLS_PALETTE = { H: '#9aa0ae', J: '#5a606e', W: '#8a6238', X: '#5a3e24', K: '#e8ecf4' };

function makeToolsFrame() {
  const g = makeGrid(16, 16);
  for (let i = 0; i < 9; i++) setPixel(g, 4 + i, 13 - i, 'W');
  for (let i = 0; i < 9; i++) setPixel(g, 5 + i, 14 - i, 'X');
  fillRect(g, 10, 2, 5, 3, 'H');
  fillRect(g, 10, 4, 5, 1, 'J');
  setPixel(g, 10, 2, 'K');
  for (let i = 0; i < 6; i++) setPixel(g, 3 + i, 3 + i, 'H');
  for (let i = 0; i < 3; i++) setPixel(g, 9 + i, 9 + i, 'W');
  setPixel(g, 12, 12, 'X');
  setPixel(g, 3, 3, 'K');
  return g.map((row) => row.join(''));
}

// A workbench: a plank top on two legs, a cog and a spike half-built on it.
const WORKBENCH_PALETTE = { W: '#8a6238', X: '#5a3e24', Y: '#b08050', H: '#9aa0ae', J: '#5a606e', R: '#ff7a1f' };

function makeWorkbenchFrame() {
  const g = makeGrid(16, 16);
  fillRect(g, 1, 8, 14, 2, 'W');
  fillRect(g, 1, 8, 14, 1, 'Y');
  fillRect(g, 1, 10, 14, 1, 'X');
  fillRect(g, 2, 11, 2, 5, 'X');
  fillRect(g, 12, 11, 2, 5, 'X');
  fillRect(g, 3, 5, 4, 3, 'H');
  for (const [x, y] of [[4, 4], [2, 6], [7, 6], [5, 8]]) setPixel(g, x, y, 'H');
  setPixel(g, 4, 6, 'J');
  fillRect(g, 10, 6, 3, 2, 'J');
  setPixel(g, 11, 5, 'H');
  setPixel(g, 11, 4, 'R');
  return g.map((row) => row.join(''));
}

// --- Chapter badges (see badges.js) -------------------------------------------
// A medal on a ribbon, one per world: a metal rim (M rim, N its lit
// upper-left, O its shadowed lower-right) around a dark field (F, with a
// G inner ring), the world's emblem in the middle (E, H highlight, D
// accent), and two notched ribbon tails (R, S shade).

const BADGE_EMBLEMS = {
  flame: [
    '....E....',
    '...EE....',
    '...EEE.E.',
    '..EEHEEE.',
    '..EHHHEE.',
    '.EEHHHHE.',
    '.EHHDHHE.',
    '.EHDDDHE.',
    '..EEEEE..',
  ],
  snowflake: [
    '....E....',
    '.E..E..E.',
    '..E.E.E..',
    '...EHE...',
    'EEEHDHEEE',
    '...EHE...',
    '..E.E.E..',
    '.E..E..E.',
    '....E....',
  ],
  leaf: [
    '......EE.',
    '....EEHE.',
    '...EEHEE.',
    '..EEHEEE.',
    '..EHEEEE.',
    '.EHEEEE..',
    '.HEEEE...',
    'D.EE.....',
    'D........',
  ],
  crown: [
    '.........',
    'H...H...H',
    'E..EEE..E',
    'EE.EEE.EE',
    'EEEEEEEEE',
    'EEDEEEDEE',
    'EEEEEEEEE',
    'HHHHHHHHH',
    '.........',
  ],
};

const BADGE_PALETTES = {
  lava: {
    M: '#c8702a', N: '#f0a860', O: '#7a3a14', F: '#3a1208', G: '#5a2010',
    E: '#ff7a1f', H: '#ffe066', D: '#fff6d8', R: '#d8392b', S: '#8a1a14',
  },
  ice: {
    M: '#b8c8dc', N: '#eef6ff', O: '#5a6a86', F: '#12243a', G: '#1e3656',
    E: '#cfeaff', H: '#7fdcff', D: '#ffffff', R: '#3f78b5', S: '#2a5588',
  },
  grass: {
    M: '#c8a040', N: '#f0d880', O: '#6a5018', F: '#12301a', G: '#1e4626',
    E: '#6fbf3a', H: '#c8f07a', D: '#8a6238', R: '#4f9a3a', S: '#2e6b2a',
  },
  castle: {
    M: '#e8c04a', N: '#fff0a0', O: '#8a6010', F: '#241536', G: '#34204e',
    E: '#ffcf4d', H: '#fff6d8', D: '#d8392b', R: '#6a3aaa', S: '#3a2460',
  },
};

function makeBadgeFrame(emblem) {
  const g = makeGrid(24, 28);
  // Ribbon tails first, so the medal overlaps their tops; each ends in a
  // notch.
  for (const [x0, dir] of [[7, -1], [13, 1]]) {
    let x = x0;
    for (let y = 14; y < 28; y++) {
      x = x0 + Math.floor((y - 14) / 4) * dir;
      fillRect(g, x, y, 4, 1, 'R');
      setPixel(g, dir < 0 ? x + 3 : x, y, 'S');
    }
    setPixel(g, x + 1, 27, PIXEL_TRANSPARENT);
    setPixel(g, x + 2, 27, PIXEL_TRANSPARENT);
  }
  const cx = 11.5, cy = 10.5;
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 24; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 10) continue;
      if (d > 8.2) setPixel(g, x, y, x + y < cx + cy - 3 ? 'N' : x + y > cx + cy + 3 ? 'O' : 'M');
      else if (d > 7.2) setPixel(g, x, y, 'G');
      else setPixel(g, x, y, 'F');
    }
  }
  BADGE_EMBLEMS[emblem].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== PIXEL_TRANSPARENT) setPixel(g, 7 + x, 6 + y, ch);
    });
  });
  return g.map((row) => row.join(''));
}

const BADGE_TEXTURES = {
  lava: frameToDataURL(makeBadgeFrame('flame'), BADGE_PALETTES.lava),
  ice: frameToDataURL(makeBadgeFrame('snowflake'), BADGE_PALETTES.ice),
  grass: frameToDataURL(makeBadgeFrame('leaf'), BADGE_PALETTES.grass),
  castle: frameToDataURL(makeBadgeFrame('crown'), BADGE_PALETTES.castle),
};

const STORY_ACTOR_FRAMES = {
  master: buildBeardedFrames(MASTER_PALETTE),
  shadow: buildBeardedFrames(SHADOW_PALETTE),
};

const STORY_PROP_TEXTURES = {
  journal: frameToDataURL(makeJournalFrame(), JOURNAL_PALETTE),
  tools: frameToDataURL(makeToolsFrame(), TOOLS_PALETTE),
  workbench: frameToDataURL(makeWorkbenchFrame(), WORKBENCH_PALETTE),
  torch: TITLE_SCREEN_TEXTURES.torch,
};

// --- Home menu icons -------------------------------------------------------------
// One per menu button, mostly the story's own props: the gem every room
// ends at, the master's journal (How To Play), their tools (Creative Mode).

// A page torn from a wall calendar: two binding rings, a red header, and
// today's square marked with a gem-orange dot.
const CALENDAR_PALETTE = { K: '#9aa0ae', R: '#c8392b', r: '#8a1a14', P: '#e8d8a8', Q: '#c8b07a', I: '#8a7048', G: '#ff7a1f' };

function makeCalendarFrame() {
  const g = makeGrid(16, 16);
  fillRect(g, 2, 3, 12, 11, 'P');
  fillRect(g, 2, 3, 12, 3, 'R');
  fillRect(g, 2, 5, 12, 1, 'r');
  fillRect(g, 2, 13, 12, 1, 'Q');
  fillRect(g, 13, 3, 1, 11, 'Q');
  for (const x of [5, 10]) fillRect(g, x, 1, 1, 4, 'K');
  for (const y of [7, 10]) for (const x of [4, 7, 10]) fillRect(g, x, y, 2, 1, 'I');
  fillRect(g, 10, 10, 2, 2, 'G');
  return g.map((row) => row.join(''));
}

// A five-pointed gold star — the stars a room is rated in.
const STAR_ICON_FRAME = [
  '................',
  '.......Y........',
  '......YYY.......',
  '......YHY.......',
  '.....YYHYY......',
  'YYYYYYHHHYYYYYY.',
  '.YYHHHHHHHHHYY..',
  '..YYHHHHHHHYY...',
  '...YYHHHHHYY....',
  '....YHHHHHY.....',
  '....YHHYHHY.....',
  '...YHHY.YHHY....',
  '...YHY...YHY....',
  '..YYY.....YYY...',
  '..YY.......YY...',
  '................',
];
const STAR_ICON_COLORS = { Y: '#e8a020', H: '#ffe066' };

// The goal tile's gem (see makeGoalFrame), on its own and drawn larger.
function makeGemIconFrame() {
  const g = makeGrid(16, 16);
  const cx = 7, cy = 8;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      const lit = x <= cx && y <= cy;
      if (d <= 2) setPixel(g, x, y, 'V');
      else if (d <= 4) setPixel(g, x, y, lit ? 'V' : 'T');
      else if (d <= 6) setPixel(g, x, y, lit ? 'T' : 'U');
    }
  }
  setPixel(g, 13, 2, 'V'); setPixel(g, 2, 13, 'V'); setPixel(g, 14, 9, 'T');
  return g.map((row) => row.join(''));
}

const TITLE_MENU_ICONS = {
  play: frameToDataURL(makeGemIconFrame(), GOAL_PALETTE),
  daily: frameToDataURL(makeCalendarFrame(), CALENDAR_PALETTE),
  creative: STORY_PROP_TEXTURES.tools,
  howto: STORY_PROP_TEXTURES.journal,
  credits: frameToDataURL(STAR_ICON_FRAME, STAR_ICON_COLORS),
};

// Whole-page backdrop per theme (see applyTheme in script.js).
const PAGE_BACKGROUND_TEXTURES = {
  lava: frameToDataURL(makeVolcanoBackdropFrame(), VOLCANO_PALETTE),
  ice: frameToDataURL(makeGlacierBackdropFrame(), GLACIER_PALETTE),
  grass: frameToDataURL(makeGroveBackdropFrame(), GROVE_PALETTE),
  castle: frameToDataURL(makeCastleBackdropFrame(), CASTLE_PALETTE),
};

// Injects the @keyframes for player animation states. These embed the
// precomputed data URLs directly in the generated CSS text rather than via
// custom properties, since the frames never change at runtime — this is
// the pixel-art equivalent of a spritesheet swap, done with plain CSS
// keyframes instead of a build-time image atlas. Called once from
// script.js's bootstrap, before any solver-mode rendering happens.
//
// Each theme gets its own copy of the frame-swapping rules and keyframes
// (the player's colors and the spike flash differ per theme), scoped under
// the `.theme-<name>` class renderLevel puts on the grid. Lava's copy is
// unscoped, so it's also the default for anything without a theme class.
function themeSpriteStyles(theme, scope) {
  const f = THEME_PLAYER_FRAMES[theme];
  const n = theme;
  return `
    ${scope} .player-sprite-inner.anim-idle {
      background-image: url("${f.idle}");
      animation: player-idle-bob 1.4s ease-in-out infinite;
    }
    ${scope} .player-sprite-inner.anim-walk {
      animation: player-walk-cycle-${n} 0.28s steps(1, end) 1 forwards;
    }
    ${scope} .player-sprite-inner.anim-hit {
      animation: player-hit-flash-${n} 0.45s ease-out 1 forwards;
    }
    ${scope} .player-sprite-inner.anim-win {
      animation: player-win-bounce-${n} 0.6s ease-in-out infinite;
    }
    ${scope} .player-sprite-inner.anim-held {
      background-image: url("${f.walkB}");
    }
    /* Travel poses — see TERRAIN_ANIMATIONS in script.js. They pivot on
       the feet, so leaning reads as the ground moving under the player. */
    ${scope} .player-sprite-inner.anim-slip {
      transform-origin: 50% 100%;
      animation: player-slip-${n} 0.2s ease-in-out infinite alternate;
    }
    ${scope} .player-sprite-inner.anim-shove {
      transform-origin: 50% 100%;
      animation: player-shove-${n} 0.14s ease-in-out infinite alternate;
    }
    ${scope} .player-sprite-inner.anim-bounce {
      transform-origin: 50% 100%;
      animation: player-bounce-${n} 0.17s ease-out infinite alternate;
    }
    ${scope} .player-sprite-inner.anim-warp {
      background-image: url("${f.idle}");
      animation: player-warp-spin 0.34s linear infinite;
    }
    /* Slipping: feet shooting out ahead, leaning back, arms flailing
       between the flinch pose and a stride. */
    @keyframes player-slip-${n} {
      0% { background-image: url("${f.hit}"); transform: skewX(10deg) rotate(-5deg); }
      50% { background-image: url("${f.walkB}"); transform: skewX(15deg) rotate(-10deg) translateY(-4%); }
      100% { background-image: url("${f.hit}"); transform: skewX(8deg) rotate(-3deg); }
    }
    /* Shoved by a current: stumbling forward, legs scrambling. */
    @keyframes player-shove-${n} {
      0% { background-image: url("${f.walkA}"); transform: rotate(7deg) translateX(2%); }
      50% { background-image: url("${f.walkB}"); transform: rotate(11deg) translateX(5%); }
      100% { background-image: url("${f.walkA}"); transform: rotate(8deg) translateX(3%); }
    }
    /* Flung by a mushroom: arms up, squashing and stretching. */
    @keyframes player-bounce-${n} {
      from { background-image: url("${f.win}"); transform: scale(0.9, 1.15); }
      to { background-image: url("${f.win}"); transform: scale(1.08, 0.92); }
    }
    @keyframes player-walk-cycle-${n} {
      0% { background-image: url("${f.walkA}"); transform: translateY(0); }
      50% { background-image: url("${f.walkB}"); transform: translateY(-10%); }
      100% { background-image: url("${f.walkA}"); transform: translateY(0); }
    }
    @keyframes player-hit-flash-${n} {
      0% { background-image: url("${f.hit}"); transform: translate(0, 0); filter: brightness(1.8) saturate(1.5); }
      30% { transform: translate(-6%, 0); }
      60% { transform: translate(6%, 0); }
      100% { background-image: url("${f.idle}"); transform: translate(0, 0); filter: none; }
    }
    @keyframes player-win-bounce-${n} {
      0%, 100% { background-image: url("${f.win}"); transform: translateY(0); }
      50% { background-image: url("${f.idle}"); transform: translateY(-16%); }
    }
    ${scope} .tile.trap-triggered {
      animation: trap-trigger-flash-${n} 0.45s ease-out 1;
    }
    @keyframes trap-trigger-flash-${n} {
      0% { filter: brightness(1); }
      25% { filter: brightness(2.2) saturate(1.5); }
      100% { filter: brightness(1); }
    }
  `;
}

function injectSpriteStyles() {
  const style = document.createElement('style');
  style.textContent = `
    ${themeSpriteStyles('lava', '')}
    ${themeSpriteStyles('ice', '.theme-ice')}
    ${themeSpriteStyles('grass', '.theme-grass')}
    ${themeSpriteStyles('castle', '.theme-castle')}
    /* Struggling against the vines: a small side-to-side tug. */
    .player-sprite-inner.anim-held {
      animation: player-struggle 0.22s ease-in-out infinite alternate;
    }
    @keyframes player-idle-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6%); }
    }
    /* Spun through a portal (the glide itself shrinks and pops them). */
    @keyframes player-warp-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes player-struggle {
      from { transform: translateX(-5%) rotate(-3deg); }
      to { transform: translateX(5%) rotate(3deg); }
    }
    .tile.hazard-triggered {
      animation: hazard-trigger-flash 0.45s ease-out 1;
    }
    @keyframes hazard-trigger-flash {
      0% { filter: brightness(1); }
      25% { filter: brightness(2.2) sepia(1) saturate(4) hue-rotate(-20deg); }
      100% { filter: brightness(1); }
    }
    .tile-goal {
      animation: goal-idle-pulse 2.2s ease-in-out infinite;
    }
    @keyframes goal-idle-pulse {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.35); }
    }
  `;
  document.head.appendChild(style);
}
