# Trapwright — Spec

(Called "Trap Room" until September 2026. Internal names such as the
`trapRoom*` localStorage keys and the project folder keep the old name on
purpose: renaming the keys would wipe every player's saved progress.)

Paste this into future sessions for context. Keep it in sync with the code —
if the data model changes, update this file in the same session.

## File structure

```
index.html   - page shell: #title-screen (home/title screen — see Title
               screen below), #title-howto-modal / #title-credits-modal,
               #trap-intro-modal (the "New trap!" card), #theme-select
               and #level-select (the campaign's world and level
               screens — see Campaign below), #controls (Creative Mode
               toggle, Daily Puzzle toggle, trap counter, Validate
               button, Share button; starts `hidden`), #daily-hub
               (the day's world banner, streak/stats + solver/builder x
               easy/medium/hard mode buttons), #ambient (the Daily
               Puzzle's moving world layer), #daily-builder-bar (target constraints + Submit to
               Bot + back button, shown during a daily builder challenge),
               #level-heading (campaign level name), #solver-info
               instructions, #solver-stats (time/move/death counters +
               Reset button + campaign/daily back buttons),
               #grid container, #validate-result / #solver-message /
               #daily-builder-result feedback text, #best-score,
               #share-output (link input + copy button), #win-modal
               (centered completion summary + unlock note + Next Level /
               Play Again / Levels / back-to-daily buttons)
style.css    - grid layout (CSS Grid) + tile/player-sprite positioning
               + control styling + win/fail flash animations + Daily Puzzle
               hub/builder-bar styling + responsive sizing. Per-type/
               per-frame pixel-art colors live in sprites.js, not here —
               see Pixel-art rendering below.
sprites.js   - pixel-art sprite system: bitmap grid data + a generator
               that turns each frame into an inline SVG data URL, used as
               a plain CSS background-image. No external image files. See
               Pixel-art rendering below.
script.js    - themes (THEMES, THEME_TRAPS, trap names/descriptions),
               level helpers (createEmptyLevel, setTileType,
               canPlaceTileType, solveBFS/isSolvable), the trap rules
               (buildHazardContext/hazardAt/resolveMove/advanceObjects),
               encodeLevel/decodeLevel/isValidLevel (sharing),
               renderLevel(), solver mode (incl. move/death counters, live
               timer, timed rooms, reset, best score, win modal), Daily
               Puzzle (seeded RNG, per-theme daily generation, streak/stats
               persistence — see Daily Puzzle below), page bootstrap
               (every screen: title, world/level select, campaign play,
               Creative Mode, Daily Puzzle, shared links)
sounds.js    - sound effects and background music, synthesized with the
               Web Audio API (no audio files), plus the per-device mute
               setting — see Sound below.
               Loaded after sprites.js, before script.js.
levels.js    - the campaign: 36 hand-built levels as readable maps
               (parseLevelMap), new-trap detection, unlock rules, and
               saved progress (see Campaign below). Loaded after
               script.js.
story.js     - the story: its cutscenes as data (STORY_SCENES), when each
               plays, and the cutscene player (see Story and cutscenes
               below). Loaded after levels.js.
badges.js    - chapter badges: which are earned, the account panel's badge
               list and the award animation (see Chapter badges below).
               Loaded after story.js.
rooms.js     - saved Creative Mode rooms (My Rooms): storage, clean-up and
               merge rules, and the time-limit choices (see My Rooms and
               Time limits below). Loaded after badges.js, before
               cloudsave.js.
cloudsave.js - the player's whole save as one object: read/write/clear
               it in localStorage, and the rules for merging two copies
               (see Accounts and cloud saves below). No Firebase here, so
               tests.js can check it. Loaded after levels.js.
account.js   - accounts on Firebase: the top-right account button, the
               #account-modal screens (log in, sign up, forgot/reset
               password, pick a username, account panel) and cloud-save
               syncing. Loaded last, after the Firebase SDK and
               firebase-config.js.
privacy.html - the privacy policy (standalone page, linked from sign-up,
               the account panel and Credits)
firebase-config.js - the Firebase project's (public) web config; accounts
               stay off until apiKey is filled in
firestore.rules - Firestore security rules, pasted into the Firebase
               console (not deployed from here)
Play at Home.command - double-click to serve the game to devices on the
               home Wi-Fi (see Hosting below)
favicon.svg  - browser-tab icon, linked from index.html
tests.html   - minimal page that loads sprites.js + script.js + levels.js +
               story.js + badges.js + rooms.js + cloudsave.js + tests.js, for running the sanity checks below
               in a browser console
tests.js     - plain-assertion sanity checks for isSolvable()/solveBFS(),
               every trap's rules, the encodeLevel/decodeLevel round trip,
               Daily Puzzle generation + streak bookkeeping, and the
               campaign (every level solvable, theme-legal, within caps;
               unlock rules)
SPEC.md      - this file
```

No build tools, no frameworks. Everything runs by opening `index.html`
directly (or via a static file server) in a browser. The one backend is
Firebase, for optional accounts (see Accounts and cloud saves below),
loaded from Google's CDN as its "compat" scripts so it's plain globals like
everything else. Without it (unconfigured, or offline) the game works
exactly as before, saving on the device only.

## Tile types

| Type                                                        | Meaning                                    |
|--------------------------------------------------------------|---------------------------------------------|
| `empty`                                                      | Walkable floor, no hazard                  |
| `wall`                                                       | Solid, blocks movement                     |
| `spike`                                                      | Walkable-into but kills/damages the player |
| `timedspike`                                                 | Like `spike`, but only dangerous on some turns — see below |
| `oneway-up` / `oneway-right` / `oneway-down` / `oneway-left`  | Wall that can only be *entered* while moving in the arrow's direction; blocks like `wall` from any other direction |
| `hiddenspike`                                                | A `spike` that looks like plain floor during play until it kills you — see New traps below |
| `bomb`                                                       | Stepping on it lights a fuse; it explodes in a plus shape 3 ticks later |
| `turret-up` / `-right` / `-down` / `-left`                   | Solid lava turret; fires a fireball down its line every 3 ticks |
| `vent-up` / `-right` / `-down` / `-left`                     | Walkable floor grate; every 5 ticks erupts in fire covering itself + 2 tiles ahead |
| `imp-h` / `imp-v`                                            | Fire imp's starting tile (floor underneath); the imp paces its row/column |
| `ice`                                                        | Obsidian ice: keeps you sliding the way you moved; blocked ahead, you glance sideways (see New traps below) |
| `current-up` / `-right` / `-down` / `-left`                  | Lava current: shoves you one extra tile its way when you step on it |
| `portal-a` / `portal-b`                                      | Portal pair (orange/violet): stepping on one warps you to the other of the same color |
| `thinice`                                                    | Thin ice: breaks when you step off it (deadly afterwards); a slide stops on it |
| `frost`                                                      | Frostbite patch: safe to arrive on, deadly to still be on 2 ticks after arriving |
| `icicle`                                                     | Falling icicle: walking under it drops it 3 ticks later (deadly that tick), leaving a solid block |
| `vines`                                                      | Grabbing vines: stop you and hold you in place for 2 ticks |
| `mushroom`                                                   | Mushroom pad: bounces you 2 tiles on, over any non-solid tile |
| `snapjaw`                                                    | Solid flytrap; bites its 4 neighbors every 6 ticks |
| `boar-h` / `boar-v`                                          | Wild boar's starting tile; charges its row/column 2 tiles per tick |
| `lever`                                                      | Flips on/off each time the player moves onto it; the goal is locked (solid) until every lever in the room is on — see Levers below |
| `crusher`                                                    | Castle: a stone block on a 6-tick cycle — up (walkable) 3, slams (deadly) 1, down (solid) 2 — see Castle traps below |
| `plate` / `gate`                                             | Castle: pressure plate / portcullis — every plate press flips every portcullis in the room (they start shut, i.e. solid) |
| `ghost`                                                      | Castle: the ghost's starting tile (floor underneath); it chases the player through walls — see Castle traps below |
| `start`                                                      | Player's starting tile                     |
| `goal`                                                       | Win tile                                   |

### `timedspike`

A `timedspike` toggles between deadly ("active") and walkable ("inactive")
based on a "turn" count. `TIMED_SPIKE_PHASE_LENGTH` (in [script.js](script.js),
currently `2`) is how many turns each phase lasts; `isTimedSpikeActiveAtTurn(turn)`
computes which phase a given turn falls in, and turn 0 is always active.
This single pure function is shared by two notions of "turn": solveBFS's
discrete turns (one move *or wait* per turn), and solver mode's real-time
hazard ticks (`HAZARD_TICK_MS`, currently `500`, since the run started).
Both feed the same tick number into the same `hazardAt()` (see New traps
below), so the timing *pattern* is identical — a human just has to keep up
with it in real time. A `timedspike` (like every timed hazard) can kill a
player who is simply standing on it when it activates, and the BFS models
this too: every turn, the tile the bot ends on must also be safe at the
*next* tick. See Validation below.

In Creative Mode there's no notion of "current turn" (or real time), so
`timedspike` tiles always render in their active look there; in solver
mode they render according to the live, real-time-derived turn.

### `oneway-*`

`ONEWAY_DELTAS` (in [script.js](script.js)) maps each `oneway-*` type to
the `[dx, dy]` step it permits. `isOnewayPassable(tileType, dx, dy)`
returns whether a move in that direction may enter that tile; it returns
`true` for any non-`oneway-*` type, so callers can apply it unconditionally.
The restriction only applies to *entering* the tile — once standing on a
one-way tile, the player can leave in any direction (including back out
the "wrong" side).

Both new types are still just strings in the same flat `tiles` array — the
level object shape and the `?level=` sharing format below are unchanged,
so old shared links keep working exactly as before.

`start` and `goal` are both a tile *type* (for rendering — one tile in the
grid is drawn distinctly) and a set of *coordinates* stored separately on
the level object (for game logic, e.g. "where do I place the player").
When both are placed they must point at the same cell as the matching
tile type. This is intentional duplication, not a bug: the renderer only
reads `tiles`, game logic only needs to read `start`/`goal` without
scanning the grid.

## New traps, movement tiles, and hazard timing

All the rules live in pure, DOM-free functions in [script.js](script.js)
so solveBFS and real gameplay share one definition of "what happens":

- `buildHazardContext(level)` precomputes everything time-independent:
  `flameCells` (tile idx -> the icicle slots between it and each vent
  reaching it), `fireballDistances` (tile idx -> `{ d, blockers }` for
  each turret whose line of fire crosses it), `imps`/`boars` (each
  patrol's `path`, `originIndex`, `period` in steps), `biteCells` (every
  tile a snapjaw bites), `bombs`/`thinIce`/`icicles` (each with its tile
  and object `slot`; bombs also their plus-shaped `blast`), `slotAt`,
  `portalPartner`, `objectCount`, and `cycleLength` (the LCM of every
  timed hazard's period present).
- **Objects**: bombs, thin ice and icicles are the parts of a room that
  change as you play. Each gets a slot in one flat array of small
  integers, `states` (bombs first, then thin ice, then icicles), which
  both solveBFS and solver mode carry around. `initialObjectStates(ctx)`
  is all zeros (armed / intact / hanging). `advanceObjects(ctx, states)`
  steps bombs and icicles one tick; `applyMoveToObjects(states, move)`
  applies what a move did (bombs lit, icicles shaken, thin ice broken).
- `hazardAt(ctx, idx, tick, states)` returns a death label (`'spike'`,
  `'hidden spike'`, `'timed spike'`, `'thin ice'`, `'falling icicle'`,
  `'flame vent'`, `'fireball'`, `'fire imp'`, `'wild boar'`,
  `'snapjaw'`, `'bomb blast'`) or `null` — the single definition of
  "deadly". Frostbite is the one exception: it depends on how long the
  player has stood there, so solveBFS (no waiting on `frost`) and solver
  mode (`arrivedTick`) apply it themselves. Labels are internal keys;
  `deathLabelFor(label, theme)` words them for the player ("icicle
  spike", "ice shard").
- `resolveMove(ctx, x, y, dx, dy, tick, states)` plays out one move
  including whatever the tiles do next (ice slides, currents push,
  mushrooms bounce, portals warp, vines stop you; loop-guarded so
  opposing currents can't push forever), checking every tile entered
  with `hazardAt` at that same tick. Returns `null` for a blocked first
  step (a no-op), else `{ path, final, death, won, grabbed, litBombs,
  litIcicles, brokenIce, hops, teleported }` — `hops` lists positions in
  `path` reached by a mushroom bounce (animated as an arc).

**Timings — deliberately different per trap** so they drift in and out
of sync instead of pulsing together:

| Trap | Rhythm |
|------|--------|
| `timedspike` | 4-tick cycle: deadly 2, safe 2 (turn 0 active) — unchanged, so old rooms play the same |
| `vent-*` | 5-tick cycle: dormant 2, warning glow 1 (`vent-warning` class), erupting 2; fire reaches `VENT_RANGE` = 2 tiles ahead |
| `turret-*` | fires every 3 ticks (`turret-charged` glow on the firing tick); fireball moves 1 tile/tick; tile `d` away holds one when `(tick - d) % 3 === 0` |
| `imp-*` | 1 tile per tick, ping-ponging along its maximal open run (period `2 * (len - 1)`) |
| `bomb` | `BOMB_FUSE_TICKS` = 3 from being stepped on, then a 1-tick blast; a blast reaching another bomb sets it off the next tick |
| `snapjaw` | 6-tick cycle: idle 4, rustling warning 1 (`vent-warning` class, open-jaw texture), bite 1 on its 4 neighbors |
| `boar-*` | `BOAR_SPEED` = 2 tiles per tick, ping-ponging like an imp; both tiles crossed in a tick are deadly (`boarCellsAt`) |
| `icicle` | `ICICLE_DROP_TICKS` = 3 from being walked under, then 1 deadly crash tick, then solid (`ICICLE_FALLEN`) |
| `vines` | hold the player `VINE_HOLD_TICKS` = 2 ticks: a move at tick T that ends on vines allows the next move at T + 3 |
| `frost` | deadly once the player has been on it `FROSTBITE_TICKS` = 2 ticks — i.e. never wait on it |

Thin ice (`THIN_ICE_INTACT`/`THIN_ICE_BROKEN`) breaks when the player
steps off it (the tile a move starts from, or any tile a current pushes
them off mid-move), never by time; entering a tile broken earlier in the
same move is fatal too. A slide stops *on* thin ice (it isn't `ice`).

A fallen icicle is solid (`isSolidAt`) and blocks fire and fireballs
(each flame/shot cell remembers which icicle slots lie between it and its
source — `lineBlocked`), but imps and boars never patrol under an icicle
in the first place, since their routes are fixed up front. The mushroom
hop can't clear a solid tile (including a fallen icicle) and its landing
tile must be enterable in the direction of travel.

Bomb state per bomb: `BOMB_ARMED` (0), lit `1..BOMB_FUSE_TICKS` (ticks
left, shown as a countdown on the tile), `BOMB_EXPLODING`, `BOMB_GONE`
(scorch mark, plain floor from then on).

**Safe zones**: `blocksHazards()` — walls, turrets, one-ways, *and* the
start and goal tiles stop fire, fireballs, imps and blasts, so the player
can never be killed while respawning.

**Solid vs walkable**: `isSolidTile()` is `wall` + `turret-*` +
`snapjaw`, and `isSolidAt()` adds fallen icicles; everything else (vents,
bombs, portals, ice, currents, imp/boar tiles, hidden spikes, thin ice,
frost, vines, mushrooms, hanging icicles) can be stepped onto.

**Hidden spikes** are exactly `spike` to the rules; only rendering
differs (floor look + `tile-empty` class during play until revealed; a
ghostly dashed-outline look in Creative Mode).

**Ice deflection**: `iceSlideDirection(ctx, x, y, dx, dy)` decides where
a slide goes from each ice tile: straight ahead if open; otherwise it
glances off to the side — down then up for a horizontal slide, right then
left for a vertical one — and keeps sliding that new way if it lands on
more ice. It only stops on an ice tile when ahead and both sides are all
blocked. (Standing still on ice and pressing into a wall is still a no-op
— deflection only happens mid-slide.)

**Portals** pair by color; an unpaired portal is plain floor. Arriving by
portal doesn't trigger the partner portal's own warp.

## Levers

A `lever` is floor with one bit of state: an object slot (after bombs,
thin ice and icicles — see `buildHazardContext`) that's `LEVER_OFF` (0)
or `LEVER_ON` (1). `resolveMove` flips a lever every time the player
*enters* it — walking, or at the end of a slide or push (slides stop on a
lever, since it isn't ice); a mushroom hop over one doesn't count, and
standing still doesn't either. It tracks the flips on a live copy of the
states as it goes, so a move that flips the last lever can carry on into
the exit it just opened; the move reports them as `flippedLevers` (a slot
entered twice is listed twice) and `applyMoveToObjects` applies them.

`isExitLocked(ctx, states)` is true while the room has levers and any is
off, and `isSolidAt` then treats the goal like a wall — it blocks moves,
slides glance off it, mushrooms can't hop over it. Because lever states
are object states, solveBFS/parMoves search them like any other object,
so "solvable" means "can end with every lever on and reach the goal".
Dying resets every lever to off (like every object). `MAX_LEVERS` (4)
caps them in Creative Mode; they cost no trap points. The goal draws as
`goal-locked` (a dimmed gem behind iron bars, no pulse) while locked, and
flashes (`goal-unlocked`) when it opens; a flipped lever pops
(`lever-flipped`). Solver mode's message line counts levers on, or says
the exit just opened or just locked again.

## Castle traps

The castle world's own traps, all built into the same shared rules
(`hazardAt`/`isSolidAt`/`resolveMove`/`advanceObjects`) as everything
else, so the solver and live play can't disagree:

- **Crusher** (`crusher`): purely tick-based — `crusherPhase(tick)` of
  `CRUSHER_PERIOD` (6): up on 0–2 (walkable; `isCrusherWarningAtTurn` on 2
  shakes it via the `vent-warning` class), slamming on 3 (`hazardAt` says
  `'crusher'`), down on 4–5 (`isCrusherDownAtTurn` — solid). Solidity now
  depends on the tick, so `isSolidAt`/`canStepOnto`/`iceSlideDirection`
  take an optional `tick` (without one, a crusher counts as up).
  Hazards pass a crusher at every phase; imps/boars never patrol across
  one. Two crushers in a row fit one up-window; three can't be crossed.
- **Pressure plate + portcullis** (`plate`, `gate`): one room-wide object
  slot, `ctx.gateSlot` (`GATES_CLOSED` 0 / `GATES_OPEN` 1, shut at start).
  Entering a plate — walking, or at the end of a slide or push, like a
  lever — flips it, tracked on the move's live states so the rest of the
  move sees the change; the move reports `pressedPlates` and
  `applyMoveToObjects` applies them. `gatesOpen(ctx, states)`; a shut
  portcullis is solid (`isSolidAt`). Portcullises are bars: hazards
  always pass through, and patrols never cross them.
- **Ghost** (`ghost`, at most `MAX_GHOSTS` = 1): its tile is an object
  slot, `ctx.ghost.slot`, starting at its spawn tile. `advanceObjects
  (ctx, states, playerIdx, tick)` now takes the player's tile and the
  tick being entered; on every `GHOST_PERIOD`-th (2nd) tick the ghost
  takes one `ghostStep` toward the player — along the axis that's
  farther off (horizontal on a tie), or the other if that step would
  enter the start or goal (it never does), straight through walls.
  `hazardAt` returns `'ghost'` on its tile. Moves resolve before the ghost
  moves, in solveBFS (advance after the move, then the "survive the next
  tick" check) and in live play (keypresses judged against the current
  ghost; `advanceWorldTo` moves it on the tick), so they agree. Because
  its tile is a multi-digit number, rooms with a ghost join object states
  with commas in solveBFS keys. `GHOST_PERIOD` is folded into the cycle.
  Dying sends it back to its spawn (all objects reset).

Castle reskins of shared traps (same rules, new art and names): Iron
Spikes, Spiked Floor, Trapdoor (hidden spike), Carved Arrow, Magic Mirrors
(portals), Crossbow (turret, bolts), Powder Barrel (bomb), Rotten
Floorboards (thin ice), Castle Lever. `TRAP_NAMES` entries missing a
theme fall back to the lava name.

## Level object shape

```js
{
  size: 8,               // N — grid is N x N
  start: [x, y] | null,   // start tile coordinates, or null if unplaced
  goal: [x, y] | null,    // goal tile coordinates, or null if unplaced
  tiles: [ /* N*N strings, one of the tile types above */ ],
  theme: 'lava',          // optional: 'lava' | 'ice' | 'grass' — the look only
  timeLimit: 15,          // optional, campaign only: seconds (a timed room)
}
```

`theme` never changes any rule — every trap works the same in every look.
A missing or unknown theme is lava (`levelTheme`/`normalizeTheme`), which
is what keeps every shared link made before themes existed playing
exactly as before.

`start`/`goal` are only ever `null` mid-edit in Creative Mode (see below).
A level in that state is intentionally incomplete — `isSolvable()` treats
it as unsolvable rather than throwing, and nothing else in the codebase
should assume they're always non-null.

### Coordinates

- `x` = column (0 = leftmost), `y` = row (0 = topmost).
- `[x, y]`, in that order — not `[row, col]`.

### `tiles` array indexing

`tiles` is a **flat, row-major array** of length `size * size`. It is NOT
a nested/2D array.

- Index for cell `(x, y)`: `index = y * size + x`
- To read a cell: `tiles[y * size + x]`
- To iterate with coordinates:
  ```js
  for (let y = 0; y < level.size; y++) {
    for (let x = 0; x < level.size; x++) {
      const type = level.tiles[y * level.size + x];
    }
  }
  ```

The renderer (`renderLevel`) just appends one `tile` element per array
entry in order and relies on CSS Grid (`grid-template-columns: repeat(size,
1fr)`) to wrap them into rows — so array order must already be row-major
(row 0 left-to-right, then row 1, etc.) for the visual grid to be correct.

## Rendering

`renderLevel(level, container)` in [script.js](script.js):

1. Sets `--grid-size` CSS variable on the container to `level.size`, and
   a `theme-<name>` class for the level's theme (which scopes the
   player's per-theme colors — see Themes below).
2. Clears the container.
3. Appends one `tile tile-{type}` element per entry in `level.tiles` — a
   `<button>` when `onTileClick` is given (Creative Mode), a plain `<div>`
   otherwise (view/solver mode; nothing there is clickable).

CSS (`#grid` in [style.css](style.css)) uses `display: grid` with
`grid-template-columns`/`rows: repeat(var(--grid-size), 1fr)` and
`aspect-ratio: 1/1` to lay tiles out as a square grid. Tile colors are
set per type via `.tile-<type>` classes.

`renderLevel(level, container, { onTileClick, playerPos, playerAnim, turn })`
optionally takes:

- `onTileClick(x, y)` — when given, every tile is rendered as a real
  `<button type="button">` (not a div with a click listener) with a
  `tile-clickable` class and an `aria-label` describing its row, column,
  and type (`tileAriaLabel`), and a click listener that calls back with
  that tile's grid coordinates. Using a real button means it's in the tab
  order, responds to Enter/Space, and gets a focus outline
  (`.tile-clickable:focus-visible` in [style.css](style.css)) for free —
  needed for keyboard-only builder use. Previews (the world select's)
  renders without this option and is non-interactive; Creative Mode renders
  with it. Builder mode's click handler also calls `.focus()` on the
  re-rendered tile at the same coordinates after every click, since
  `renderLevel` rebuilds the whole grid (clearing DOM focus) on each call —
  without that, cycling a tile via keyboard would bounce focus back to the
  top of the page every click.
- `playerPos` — an `[x, y]` pair. When given, a `.player-sprite` `<div>`
  (the animated pixel-art character — see Pixel-art rendering below) is
  appended on top of the tile at those coordinates. This is a pure
  rendering overlay: it never reads or writes `level.tiles`, so it's safe
  to call every frame from solver mode without mutating the level being
  played. Creative Mode and previews never pass this.
- `playerAnim` — `{ facing: 'left' | 'right', state: 'idle' | 'walk' |
  'hit' | 'win' }`, read alongside `playerPos` to pick the character's
  pose/animation. Defaults to `{ facing: 'right', state: 'idle' }` when
  `playerPos` is given without it. Only solver mode passes this.
- `turn` — which turn number to render hazards for; only affects
  `timedspike` tiles (see above). Defaults to `0` (active) for callers that
  don't track turns, e.g. Creative Mode. Solver mode passes its live,
  real-time-derived tick (`currentHazardTick()`, not `moveCount` — see
  `timedspike` above), applied uniformly to every tile including whichever
  one the player is standing on. Unlike the move-counted model this
  replaced, there's no per-tile override needed here: since both the
  render and the danger check now read the same live clock, a tile's
  displayed state and its actual danger can never disagree, whether the
  player just arrived or has been standing there for a while.

## Pixel-art rendering

(Button plates are the one exception to "SVG keeps its aspect ratio":
`frameToDataURL(frame, palette, { stretch: true })` adds
`preserveAspectRatio="none"` so the plate fills buttons of any width —
without it a wide button like "Exit Creative Mode" got a letterboxed plate
narrower than its own label.)

Every visual in the game — tile textures, the player character, the page
background, trap "triggered" flashes — is 2D pixel art generated at
runtime in [sprites.js](sprites.js), themed as a volcanic mountain dungeon
(dark basalt rock, molten-lava traps, embers) rather than plain neutral
stone. There are no external image files and no build step: a sprite is
defined as a small bitmap (an array of equal-length strings, one character
per pixel) plus a palette object (character -> CSS color, `.` always
transparent). Tile bitmaps are 16x16 (bumped up from an earlier 12x12 to
give the volcanic reskin's cracks/pebbles/glow detail more room); the
player stays at its original 12x14 and was reskinned by recoloring
`PLAYER_PALETTE` only, with every pose's pixel layout untouched, since a
palette swap can't desync an animation the way a pixel-coordinate rewrite
could. `frameToDataURL(frame, palette)`
turns that into an inline SVG (one `<rect>` per non-transparent pixel,
`shape-rendering="crispEdges"` so edges stay sharp at any scale) encoded
as a `data:image/svg+xml` URL. Because it's an SVG (not a raster image),
scaling it with CSS (`background-size: 100% 100%`) is exactly as crisp at
560px as at 40px — there's no per-size asset and no JS resize tracking
needed, unlike a fixed-pixel technique (e.g. box-shadow pixel art) would
require.

Most tile bitmaps are *generated* (drawn with `makeGrid`/`fillRect`/
`setPixel` loops — see `makeFloorFrame`, `makeWallFrame`, the shared
`makeSpikePlateFrame`) rather than hand-typed, since floor/wall/spike art
is simple repeating/parametric geometry; this also means the four
`oneway-*` arrows are drawn once (`ONEWAY_UP_CORE`, then outlined into
`ONEWAY_UP_FRAME` — see below) and the other three directions are derived
with `rotateFrame90CW`, so the art can't drift out of sync with
`ONEWAY_DELTAS` in [script.js](script.js). The player character is
hand-authored (an organic humanoid shape doesn't lend itself to the same
loops) but reuses one base pose across every animation state via a shared
`drawPlayerCape`/`drawPlayerUpperBody`/`drawPlayerLegsStanding`/
`drawPlayerLegsStep` helper set, rather than fully distinct art per state.
Most static tiles (floor, wall, oneway arrows) also get a light-top/
dark-bottom or light-top-left/dark-bottom-right *bevel* — a couple of
`fillRect`/`setPixel` calls per shape rather than a flat fill — which is
what makes them read as individually-lit 3D panels instead of solid-color
squares; the goal gem takes this further with an actual per-facet split
(see below) rather than a uniform bevel.

### Tile textures

`TILE_TEXTURES` in [sprites.js](sprites.js) maps each tile type (plus
`timedspike-active`/`timedspike-inactive`/`trap-triggered` — see below) to
its precomputed data URL. `textureForTile(tileType, turn)` in
[script.js](script.js) resolves `'timedspike'` to the right variant for
the given turn (reusing `isTimedSpikeActiveAtTurn`, same as the
`timedspike-active`/`timedspike-inactive` CSS classes already applied for
the flash-state hooks); `renderLevel` sets the result as each tile
element's inline `background-image`. This is set *in addition to* the
existing `.tile-<type>` class (which still sets a plain
`background-color` — see [style.css](style.css)): the SVG art's
transparent pixels let that color show through as a base/fallback, and
the inline `background-image` always wins the cascade over anything the
class could set, so there's no conflict.

#### Spike/timedspike: the plate

A trap tile is a riveted obsidian plate (`drawSpikePlateBase` — a beveled
panel with 4 corner rivets and 3 dark slot cutouts, parametric on the
grid's own width/height rather than hardcoded to one tile resolution) that
fills the *entire* tile, not floor-with-spikes-on-it — this makes a trap
read as its own distinct mechanism at a glance, and means `SPIKE_PALETTE`
has no floor colors in it at all. `drawSpike(g, cx, { up, dull, hot })`
draws one spike per slot: a 1px-wide molten *needle* for its first rows
(unmistakably sharp even at small tile sizes) with a bright single-pixel
glint at the very apex, flaring to a shaded 3px base (light-left/mid/
dark-right) where it meets the plate. `up` picks a tall dangerous molten
spike vs. a short `dull` stub retracted almost flush with the plate (used
for `timedspike-inactive` — cooled dark-obsidian colors, no glint, reads
as solidified lava rather than just "shorter"; a `timedspike` cycling
between molten and cooled is a more literal fit for the mechanic than the
old steel-retracting-into-the-floor look ever was); `hot` swaps in a
brighter white-hot flash palette for the one-shot `trap-triggered` look.
Plain `spike` tiles and `timedspike-active` both render `up: true`
(regular, non-`dull`, non-`hot`) — a plain spike has no active/inactive
concept, so it always looks exactly like a timed spike mid-active-phase.
Non-`dull`, non-`hot`, `up` spikes also get a small ember `R` warning-glow
pixel flanking each slot — molten spikes already read as dangerous via
their own glow, but the halo still helps "this will hurt you" register at
a glance the same way the original steel spikes' red warning dot did.
`trap-triggered` is one shared `hot` flash frame used by *both* trap
types — see the Trap-triggered flash section below — since a triggered
spike looks the same regardless of which type fired it.

#### Oneway arrows, start, and goal

The `oneway-*` chevron is drawn once as `ONEWAY_UP_CORE` (a dark-rock base
plate + bevel + the chevron itself in a `P` core color), then
`addOutline(frame, coreCh, outlineCh)` — a generic 4-neighbor dilation, not
specific to arrows — adds a 1px dark outline around every `P` pixel to
produce the final `ONEWAY_UP_FRAME`, now rendered in a glowing amber-rune
color instead of blue; this is what makes the arrow read clearly against
the plate at a glance instead of a flat shape with no edge. `makeStartFrame`
draws the flag as an actual tapering pennant (`width = 5 - (row - 1)` per
row, narrowing by 1px going down) with a 1px fold-shadow on its trailing
edge, an ember finial on a charred-wood pole, and a small ground-shadow
rectangle at its base, rather than a plain rectangle — recolored from a
green pennant to a warm ember-red one. `makeGoalFrame`'s diamond is a
faceted gem, not a flat one: the Manhattan-distance rings from the center
pick a *brighter* color when `x <= cx && y <= cy` (the upper-left facet)
and a *darker* one otherwise (the lower-right facet), so it reads as lit
from one direction, plus a few standalone sparkle pixels — recolored from
a gold gem to a molten orange-red crystal so it reads as forged from the
mountain rather than a generic treasure. `.tile-goal`
also gets a continuous `goal-idle-pulse` `filter: brightness()` animation
from `injectSpriteStyles` (2.2s ease-in-out infinite) — safe to leave
running unconditionally in every mode (view/builder/solver) since it only
animates `filter`, never `transform` or layout, so it can't shift the tile
grid or fight with anything else.

#### New trap and movement tiles

Generated the same way (16x16 grids + palettes, directional art drawn
facing up and rotated via `directionalTextures(family, upFrame,
palette)`): `makeTurretUpFrame` (cannon housing in wall rock),
`makeVentUpFrame(hot)` (grate + nozzle; `vent-*-active` variants glow),
`makeCurrentUpFrame` (crust with chevrons), `makeIceFrame` (glossy
obsidian glass), `makePortalFrame` (ring on floor; orange/violet
palettes), `makeBombFrame('armed'|'lit'|'gone')`,
`makeHiddenSpikeBuilderFrame` (ghost spikes + dashed border, builder
only), and `makeImpBuilderFrame(axis)` (imp stamped on floor with patrol
arrows, via `stampFrame`). Moving hazards are transparent overlays in
`HAZARD_TEXTURES` (`flame`, `fireball`, `imp` — the hand-authored
`IMP_FRAME` — and `blast`), drawn by `renderLevel` as `.hazard-sprite
.hazard-<kind>` children of the tile (below the player sprite; CSS
flicker/hop/pop animations in [style.css](style.css)).

The ice and grass traps are drawn the same way: `makeThinIceFrame
('intact'|'cracked'|'broken')` (teal ice with white cracks — deliberately
darker than slick ice; 'cracked' is shown under the player; 'broken' is a
water hole), `makeFrostFrame` (snowflake on frosted ground, violet rim),
`makeIcicleFrame('hanging'|'shaking')` + `makeIceBlockFrame` (fallen),
`makeVinesFrame`, `makeMushroomFrame`, `makeSnapjawFrame('idle'|'open'|
'shut')`, `makeBoarBuilderFrame(axis)` (the hand-authored `BOAR_FRAME` on
floor) and `makeFairyRingFrame` (the grass theme's portals). Their
overlays — `boar` (flipped with the CSS `scale` property when charging
left), `bite`, `icicle-crash`, `vine-wrap` (drawn *above* a held player)
— join `flame`/`fireball`/`imp`/`blast` in the per-theme hazard textures;
`dust` (the tile a boar just crossed) is CSS only.

`renderLevel`'s `world` option (`{ ctx, states, revealed, playerIdx,
held }`, passed only by solver mode) switches on the live-play look via
`textureKeyForTile` (bomb fuses, thin ice cracking/broken, icicles
shaking/fallen, snapjaw poses, disguised hidden spikes, bare floor under
imps and boars) and `hazardOverlaysFor` (per-tile overlay list); without
it (Creative Mode/previews) every tile shows its "what is this" look.

### Themes

Every theme's art comes from the same generators with different palettes
(`THEME_ART` in [sprites.js](sprites.js): floor, floor detail, wall and
wall accent, spike plate, one-way, start/goal, portals and portal style,
hidden-spike ghost, ice, turret, current, and the turret's shot).
Lava's entries are the original palettes, so the volcanic look is
pixel-for-pixel unchanged. Ice: snow-dusted slate floor, dark navy
packed-ice walls with frost, icicle spikes, bright slick ice, frost
cannons shooting ice shards, cyan/pink aurora portals, a cyan crystal
goal. Grass: mossy flagstones with tufts, dark mossy walls, thorn spikes
on wood, streams (water currents), gold/blue fairy rings, an emerald
goal. Castle: cracked dusty flagstones with cobwebs, crumbling grey-violet
walls (a chipped corner, a crack, a web — `wallAccent: 'crumble'`), iron
spikes, a purple-and-gold banner, a moonstone gem, magic mirrors
(`portalStyle: 'mirror'`), a wall-mounted crossbow (`turretStyle`), powder
barrels (`bombStyle`), rotten floorboards (`thinIceStyle`), the crusher,
plate, portcullis and ghost art, a moonlit ruined-castle backdrop
(`makeCastleBackdropFrame`) and a steel-helm / purple-tunic / crimson-cloak
player. Its music is a slow harmonic-minor waltz (`MUSIC_THEMES.castle`).
Contrast rule for all of them: walls darkest, floor mid, hazards and the
goal brightest.

- `buildThemeTextures(theme)` builds a theme's full tile set; every
  floor-based tile (start, goal, portals, bombs, icicles, vines,
  mushrooms, imp/boar tiles, hidden-spike ghosts) is drawn on *that*
  theme's floor via `floorGrid()` + `currentFloorDecor`, so a Creative
  Mode fire imp in an ice map sits on snowy slate, not basalt. Traps
  unique to one theme keep their own colors everywhere.
- `THEME_TILE_TEXTURES[theme]`, `THEME_HAZARD_TEXTURES[theme]`,
  `themeTexture(theme, key)` / `themeHazardTexture(theme, key)`;
  `TILE_TEXTURES`/`HAZARD_TEXTURES` are the lava sets.
- `PLAYER_PALETTES` — palette swaps only (blue parka + red scarf for ice,
  leaf cloak + olive tunic for grass). `injectSpriteStyles` emits one copy
  of the player/trap-flash rules per theme: lava's unscoped (the default),
  ice's and grass's under `.theme-ice`/`.theme-grass`, the class
  `renderLevel` puts on the grid.
- `PAGE_BACKGROUND_TEXTURES.lava/.ice/.grass` — the volcano, a glacier
  range under an aurora framed by an ice cave (`makeGlacierBackdropFrame`),
  and an overgrown temple at dusk framed by foliage with fireflies
  (`makeGroveBackdropFrame`). `applyTheme(theme)` in script.js sets the
  body backdrop and `body[data-theme]`, which drives `--theme-accent`/
  `--theme-glow` in style.css (headings, progress bar, grid glow). The
  title screen has a backdrop of its own (see Title screen → Pixel art)
  over the lava theme.

### Player character and animation states

The character itself has a small ember-red cape (`drawPlayerCape`, drawn
*before* the body so the body's arm pixels can overwrite it at the hit
pose's widened arm position — see below), a hair part-shadow and a chin
shading pixel for a touch more facial detail, and single-pixel arms drawn
*separately* from the fixed-width torso (`armSpread` moves them outward,
`armSwing` moves them up/down a row) rather than baked into one wide
shoulder row — this is what lets the walk cycle swing the arms opposite
the legs and the cape flare a column wider on the "flared" frames
(`drawPlayerCape(g, true)`), instead of every pose sharing one static
silhouette. `armsRaised` on `drawPlayerUpperBody` overrides the normal
arm-pixel logic entirely with two 2px-tall raised-arm pillars for the win
pose specifically, since "arms straight up" doesn't fit the
spread/swing model the other poses use.

`renderLevel` renders the player as two nested elements per
`playerAnim`/`playerPos` (see Rendering above):
`.player-sprite` (outer — positions the character over the tile and holds
the left/right facing flip, `transform: scaleX(-1)`, as a *static* style)
wrapping `.player-sprite-inner` (inner — carries the `anim-<state>` class
and its `animation`). The flip has to live on a separate element from the
animation because a CSS `animation` fully controls whatever properties its
keyframes touch for as long as it runs — if the flip's static
`transform: scaleX(-1)` were on the same element as an animation with its
own `transform` keyframes (the walk bounce, the hit shake), the animation
would silently override the flip while it played.

`injectSpriteStyles()` (called once from the `DOMContentLoaded` bootstrap
in [script.js](script.js), before any rendering) builds a `<style>` element
whose `@keyframes` embed the precomputed `PLAYER_FRAMES` data URLs
directly as literal `background-image: url("...")` values at specific
keyframe percentages — the pixel-art equivalent of a spritesheet swap,
done with plain CSS instead of a build-time image atlas, since the frames
never change at runtime. Each animation's keyframes set *both* the frame
swap and a small `transform` bounce/shake together, so one `@keyframes`
block is enough per state (no separate bob animation layered on top):

| `anim-<state>` class | Plays on                        | Behavior |
|-----------------------|----------------------------------|----------|
| `anim-idle`           | initial render, before any move  | static idle frame + a gentle infinite bob (`transform` only, so it composes cleanly under any facing flip) |
| `anim-walk`           | every accepted, non-dangerous move | one 2-frame step cycle + bounce, `animation-fill-mode: forwards` so it holds the walk-cycle's last frame (== the idle pose) once it finishes, rather than reverting to no background-image at all |
| `anim-hit`            | a spike/active-timedspike death  | one hit-recoil frame + a shake + a brightness/saturation flash, also `forwards` |
| `anim-win`            | reaching the goal                | an infinite loop between the win pose and the idle pose — safe to loop forever since reaching the goal freezes input (`won` short-circuits the keydown handler), so nothing re-renders the element out from under it |
| `anim-slip`           | a move across ice                | leaning back, feet out, flailing between the hit and stride frames |
| `anim-shove`          | a move pushed by a current       | stumbling forward, legs scrambling |
| `anim-bounce`         | a mushroom bounce                | arms up (win frame), squash and stretch |
| `anim-warp`           | a portal jump                    | spinning while the glide shrinks/pops the player |
| `anim-held`           | held by vines                    | a side-to-side struggle |

The four travel poses (`slip`/`shove`/`bounce`/`warp`) come from
`TERRAIN_ANIMATIONS` in [script.js](script.js) — the one table that says
how the player looks on each kind of ground (keyed by `tileFamily`). A
move's pose is the `travel` of the first tile on its path that has one
(`travelPoseFor`), else `walk`; it lasts exactly as long as the move. A
tile's `stance` is an extra motion layered over any pose while the player
stands there (`terrainStanceAt`), on its own `.player-terrain` element
between `.player-slide` and `.player-sprite`: `terrain-wobble` (teetering)
on intact thin ice and under a shaking icicle — ground about to give way —
and `terrain-shiver` (jitter + cold glow) on frost. What the ground *does*
to movement stays in `resolveMove`; the table only covers the look.

`anim-walk`/`anim-hit` need `forwards` because `renderLevel` builds a
*brand-new* `.player-sprite-inner` element on every move (the whole grid
is torn down and rebuilt — see Rendering above), so each move's animation
always plays from the start; without `forwards` the element would go
blank (`background-image: none`) the moment that one-shot animation
finished, since neither class declares a static `background-image` of its
own to fall back to.

`startSolverMode` tracks `facing` (flips to `'left'`/`'right'` on a
horizontal move; unchanged on a vertical one — there's no separate
up/down art) and `animState` as local variables alongside `playerPos`,
sets `animState` per the table above at each decision point, and passes
both into `render()`'s `renderLevel(..., { playerAnim: { facing, state:
animState }, ... })` call.

### Trap-triggered flash

When a move is dangerous, right after the `render()` call that shows the
player back at start (with `anim-hit`), the *tile the player was just
standing on* gets a one-shot `trap-triggered` class added directly
(`grid.children[triggeredIdx].classList.add(...)`) — the same
after-the-fact-DOM-patch pattern Creative Mode already uses to restore
focus after a click-rotate rebuilds the grid (see Builder mode below), needed
here for the same reason: `renderLevel` already tore down and rebuilt
every tile in that `render()` call, so there's no way to pass "this one
tile is currently triggered" through `renderLevel`'s normal per-type
texture lookup without adding a bespoke option for a one-frame effect.
The `trap-trigger-flash` keyframes (also from `injectSpriteStyles`)
swap to the bright `trap-triggered` texture partway through and a
brightness pulse, then land back on `filter: brightness(1)` — deliberately
*without* `forwards`, since unlike the player sprite this tile element
isn't going anywhere: letting the animation end normally just reveals the
tile's own already-correct inline `background-image` (set earlier in that
same `render()` call) underneath.

### Page background: the volcanic cave backdrop

`makeVolcanoBackdropFrame()` in [sprites.js](sprites.js) generates a single
wide 128x96 decorative sprite — a banded dusk sky, two silhouetted mountain
ridges, a glowing crater with a lava seam, and dark cave rock (walls closing
in from the sides in an "iris" shape, plus a ceiling with stalactites)
framing the whole scene, so the grid reads as sitting just inside a cave
mouth looking out at the mountain rather than floating on a flat page.
Applied as `document.body.style.backgroundImage` at bootstrap (right after
`injectSpriteStyles()`), the same "JS sets a data-URL background-image"
pattern used everywhere else in this file, just on `<body>` instead of a
tile/palette-icon element. `fillSilhouette(g, heights, baseY, ch)` fills
every column from a hand-authored per-column height (tiled via modulo, so
a short array repeats seamlessly across the full width) down to the canvas
bottom — turning a short jagged-height list into a full ridge without
needing real line-interpolation code; `fillCaveWalls()`/`addCaveCeiling()`
do the same for the framing rock, from a smooth power-curve depth formula
plus a small jagged per-row offset rather than a hand-tuned shape.

In [style.css](style.css), `body`'s background is `background-size: cover;
background-position: center bottom; background-attachment: fixed` — full
viewport, edge to edge. This wasn't the first thing tried: an earlier
version capped it to a fixed-height band (`background-size: 100% 380px`)
specifically to keep the per-source-pixel scale close to what the tile art
itself uses, since stretching a low-res backdrop across an entire tall page
blows each source pixel up far larger than a tile's own. That trade-off
turned out to be the wrong one in practice — the grid is opaque and covers
most of a typical viewport, so a band anchored *below* it was mostly hidden
behind it, and every other mode's chrome (the heading, `#controls`, the
Daily Puzzle hub) sat over nothing but the flat `background-color` fallback
above the grid. `cover` trades some of that per-pixel sharpness for the
backdrop actually being visible everywhere on the page, which is the point
of having one. `background-attachment: fixed` keeps it pinned to the
viewport rather than the scrolling page, so it stays full-bleed regardless
of how tall a given mode's content is. `background-color: #0a0710`
(matching the backdrop's own darkest top-sky band) is the fallback for the
instant before the pixel art paints, so there's no flash of a mismatched
color.

## Creative Mode (formerly Builder Mode)

Entered from the title screen's "Creative Mode" button or the "Enter/Exit
Creative Mode" button in `#controls` ([script.js](script.js)); exiting
returns to the title screen. (Internal names — `builderMode`,
`builderLevel`, `#builder-toggle`, `#builder-panel` — kept the old word.)
Entering starts from a blank, unsaved grid (`createEmptyLevel(
BUILDER_GRID_SIZE)` plus the last-picked `theme`), or from one of My Rooms
(see below). An unsaved room's edits are discarded on exit.

**Every trap from every theme is available from the start**, whatever
the player has unlocked in the campaign. The Lava / Ice / Grass switch at
the top of the panel (`#creative-theme-picker`) sets `builderLevel.theme`:
the map's look, the page backdrop, and what shared traps are called in
the palette (a turret is a "Frost Cannon" in an ice map). It never
changes which traps exist or what they do.

### My Rooms

Saved rooms ([rooms.js](rooms.js)), up to `MAX_ROOMS` (50). The Blocks
panel has a room name field (`#room-name-input`, up to 32 characters,
"Untitled room" if blank) and `#controls` a **Save** button, a **My
Rooms** button and a status line (`#room-status`). The first Save gives
the room an id (`currentRoomId`); from then on every edit — a tile placed,
rotated or trashed, Clear All, the look, the time limit, the name — saves
it straight away (`roomEdited` → `putRoom`), so there's nothing to forget.
My Rooms (`#rooms-modal`) lists them newest first, each with a thumbnail
(`renderLevel` into `.room-thumb`), its look, size, time limit and date,
an **Edit** button (opens it in Creative Mode) and a two-step **Delete**.
**New Room** starts a blank one. None of this shows in a Daily Puzzle
builder challenge.

`localStorage['trapRoomCreativeRooms']` = `{ rooms: { [id]: { name,
level, updatedAt } }, deleted: { [id]: deletedAt } }`. Rooms are part of
the cloud save (`rooms` — see Accounts and cloud saves). A delete leaves
its id and time behind so merging with a device that still has the room
doesn't bring it back; merging keeps each room's newest edit, and an edit
made after a delete wins over it (`mergeRooms`). Every level read from
storage or the cloud is rebuilt to exactly a level's fields
(`cleanDraftLevel`/`cleanRoomLevel`), so a save can't carry anything else
into the game.

### Time limits

The Blocks panel's **⏱ Time limit** (`#time-limit-select`) makes a room a
timed room: Off, or 10 to 180 seconds (`ROOM_TIME_LIMITS`), stored as
`builderLevel.timeLimit` — the same field the campaign's timed rooms use,
so solver mode counts it down and restarts the run at zero with no other
changes. Under it, `#time-limit-hint` says whether the limit is fair: the
fastest possible run is the bot's turns at one hazard tick each
(`fastestRunSeconds`), and the tightest limit allowed is the castle's rule,
1.5× that plus 3 seconds (`minFairTimeLimit`), so no player's room is
tighter than the hardest in the game. Validate reports it; Share refuses
a too-tight limit. The limit travels in the share link (it's part of the
level's JSON), and a link's limit is only kept if it's whole seconds from 5
to 600 (`cleanTimeLimit`); anything else plays untimed.

### Placing and rotating tiles

Tiles are placed by drag-and-drop from the panel's palette
(`PALETTE_GROUPS`: Basics, Every theme, Lava, Ice, Grass — a trap shared
by several themes is listed once, under the first; each trap shows its
point cost and has its description as a tooltip). Clicking a placed
turret, vent, current, imp, boar or one-way tile rotates it
(`rotateTileType`: directional families step clockwise, imps and boars
flip between `-h`/`-v`); other tiles ignore clicks. The click
handler refocuses the same tile afterwards, since `renderBuilder()`
rebuilds the grid. `setTileType(level, x, y, newType)` is the low-level
setter; it keeps `level.start`/`level.goal` consistent (overwriting the
current start/goal clears that reference; placing a new start/goal resets
the previous one to `'empty'`).

### Trap budget (trap points)

`TRAP_BUDGET = 10` trap *points* (not tiles). `TRAP_COSTS` gives each
lethal family a cost — `spike`/`timedspike`/`hiddenspike`/`vent`/
`thinice`/`frost`/`vines` 1, `bomb`/`turret`/`imp`/`icicle`/`snapjaw`/
`boar` 2 — via `trapCost(type)`; movement tiles (`ice`, `current-*`,
`portal-*`, `oneway-*`, `mushroom`) are free. Vines never kill on their
own but cost a point, since holding you still is what makes everything
else deadly. `countTrapPoints` sums
costs; `#trap-counter` shows `Trap points: n / budget` and turns red
(`budget-full`) at the cap. `canPlaceTileType(level, x, y, newType,
trapBudget)` only charges the *net* cost change, so swapping a trap for
an equal-or-cheaper one is always allowed. Independent hard caps: at most
`MAX_PORTALS_PER_COLOR` (2) of each portal color, and `TYPE_CAPS` for the
stateful objects — `MAX_BOMBS` (4), `MAX_ICICLES` (4), `MAX_THIN_ICE`
(16) — since each one multiplies the solver's search space. Campaign
levels respect the same caps (checked in tests.js).

### Validation (`isSolvable`)

`solveBFS(level)` in [script.js](script.js) is a standalone, DOM-free BFS
returning `{ solvable, moves }` (`moves` = shortest solution in turns);
`isSolvable(level)` wraps it. Each turn the bot either moves (resolved by
the same `resolveMove` real gameplay uses) or **waits in place** — a real
player can always stand still, so the bot can too — and the tile it ends
on must be safe at the *next* tick as well (`hazardAt(final, turn + 1)`),
mirroring solver mode killing a stationary player. So a BFS solution is
genuinely playable by a human moving at most one tile per tick. Two
player-specific rules sit on top: while vines hold the bot it can only
wait, and it can never wait on `frost`.

State is `(tile, turn mod ctx.cycleLength, every object's state, vine
hold left)`. `cycleLength` folds every periodic hazard into one
repeating window; object states capture the part that doesn't repeat. If mismatched cycles push
`cycleLength` past `BFS_MAX_CYCLE` (720), turns are tracked exactly up to
that horizon instead (conservative: a solution needing longer counts as
unsolvable). Returns unsolvable immediately if `start`/`goal` is `null` or
either sits on a solid or spike tile.

It takes only a level object — no grid/DOM coupling — and backs the
Validate button, the sharing gate, daily solver generation, and the daily
builder bot's score. Because waits count as turns, the bot's score (and
the builder-challenge text) is in *turns*.

The "Validate" button (`#validate-btn`) runs this against the current
builder level and writes a result into `#validate-result`
("Solvable"/"Not solvable", or a prompt to place both start and goal
if either is missing).

### Sanity checks

[tests.js](tests.js), loaded by [tests.html](tests.html), has plain
`assert()` checks (no test framework) against:

- `isSolvable()`: an open solvable grid, a grid where spikes seal off the
  goal, a grid where a *wall* (not a trap) blocks the only path, a one-way
  wall passable in its allowed direction vs. blocked (with all other routes
  walled off) from the wrong direction, a timed spike passable once its
  inactive phase lines up, the bot waiting on the start tile for a timed
  spike to drop (4 turns), and waiting never getting past a plain spike.
- New traps: rotation, trap-point costs and budget/portal limits, ice
  slides (incl. sliding into a spike), currents (incl. opposing currents
  not looping), portals (and mismatched colors not linking), hidden spikes
  blocking like spikes, turret fireball positions, vent timing/range, imp
  patrol, bomb fuse/blast/chain reaction, and every sprite being a proper
  rectangle with no undefined palette colors.
- Ice and grass traps: thin ice breaking (and a current pushing you back
  onto it), slides stopping on thin ice and on vines, frostbite (the bot
  waits on safe ground instead), icicle drop timing / solidity /
  shielding shots, the vine hold length, mushroom hops (over spikes, not
  walls, possibly onto spikes), snapjaw bite timing, boar speed.
- Every theme has every texture (and backdrop) with no undefined colors.
- Daily generation: the theme rotates over 3 days; across 30 dates per
  difficulty, no room falls back to the empty fallback, every room is in
  its day's theme, and has that theme's signature traps.
- Campaign: 10 levels per theme, unique ids, every level parses and is
  solvable, uses only its theme's traps, stays within the per-trap caps,
  and a timed room's limit is at least double the bot's time plus 4s;
  unlock rules (7 levels don't unlock the next theme, 8 do; levels open
  in order; replays keep the best stats; reset clears everything).
- Themes: per-theme trap names, unknown theme -> lava, and a shared link
  keeps its theme through encode/decode.
- My Rooms and time limits: half-built rooms save with tidied names;
  malformed rooms are dropped; merging keeps each room's newest edit, keeps
  deletes, lets a later edit bring a room back, and is order-independent;
  rooms ride in the cloud save; putRoom/deleteRoom/the 50-room cap; only
  sane time limits count; a share link keeps its limit; the fastest run
  and fair-limit rules.
- Badges: one per world with art; none at the start; earned only when
  every level of the world is beaten; the finishing win earns it (a replay
  doesn't); levels beaten on two devices add up to one.
- Story: every scene is well-formed (known step kinds, stage maps parse,
  actors/props exist before they're used, known looks/poses/props/sounds);
  one scene per world, after its last level only; when the prologue plays;
  what the Story list unlocks; the seen list normalizes, merges as a union
  across devices, clears with a campaign reset and survives a win.
- `isOnewayPassable()` / `isTimedSpikeActiveAtTurn()`: direct checks on the
  direction/phase logic those `isSolvable()` cases exercise indirectly.
- `encodeLevel()`/`decodeLevel()`: an ordinary level round-trips and its
  encoded form is URL-safe, and a level crafted so its intermediate
  (pre-URL-safe) base64 contains both `+` and `/` still round-trips and
  still produces a URL-safe string. See the comment on `specialCharsLevel`
  in [tests.js](tests.js) for why real tile data can never naturally
  trigger `+`/`/` (it requires a raw byte value of `>`, `?`, `~`, or DEL,
  none of which appear in our tile-name/JSON-punctuation alphabet).

Open `tests.html` in a browser and read the console. Tests that touch
localStorage (daily stats, campaign progress) save and restore whatever a
real player had stored, since tests.html shares the game's origin.

## Sharing (`?level=` URL param)

Builder mode has a "Share" button (`#share-btn`, shown/hidden alongside
Validate) in [script.js](script.js). Clicking it:

1. Re-checks `!builderLevel.start || !builderLevel.goal || !isSolvable(builderLevel)`
   — the same `isSolvable()` used by Validate. If the level isn't
   solvable, it shows an error in `#validate-result` and refuses to
   generate a link, so an unsolvable room can never be shared.
2. Otherwise calls `encodeLevel(builderLevel)` and builds
   `<origin><pathname>?level=<encoded>`, writes it into the readonly
   `#share-link` input, and reveals `#share-output` (input + "Copy Link"
   button, which uses `navigator.clipboard.writeText`).

### Encoding format

`encodeLevel(level)` / `decodeLevel(encoded)` in [script.js](script.js)
are a pure, DOM-free (aside from `btoa`/`atob`/`TextEncoder`) round trip:

```
level object -> JSON.stringify -> UTF-8 bytes -> base64 -> base64url
```

The base64 -> base64url step replaces `+` with `-`, `/` with `_`, and
strips `=` padding, so the result is safe to drop directly into a query
string with no additional escaping — the `?level=` value is exactly this
string. `decodeLevel` reverses each step (restoring `-`/`_` and re-adding
`=` padding before `atob`) and returns `JSON.parse`d level object; it
throws on malformed input, so callers reading the URL must try/catch.

`isValidLevel(level)` is a minimal shape check (numeric `size`, `tiles`
array of length `size*size`, `start`/`goal` as 2-element arrays) used to
guard against a hand-edited or truncated `?level=` value crashing solver
mode — it is not a solvability check.

The level's `theme` travels inside the encoded JSON, so a link plays in
the look it was built in. A shared room always plays with every trap
working, whatever the player has unlocked, and never touches campaign
progress (it only keeps its own per-link best score).

## Solver mode

`startSolverMode(level, { ...dom, levelCode, onWin })` runs one level —
a campaign level, a Daily Puzzle room, or a `?level=` shared link (read
at the end of the page bootstrap: decoded inside a `try`, and if that
throws or `isValidLevel` rejects it, the title screen shows
`#title-link-error` instead). It hides `#controls`
  entirely (`#controls[hidden] { display: none; }` — needed because
  `#controls` also has an explicit `display: flex`, which would otherwise
  win the cascade over the `[hidden]` UA-stylesheet rule and keep it
  visible) and shows `#solver-info`.

### Player state

The player's position is tracked as a **separate local variable**
(`playerPos`, a `[x, y]` pair) inside `startSolverMode` — it is never
written into `level.tiles`. `renderLevel(level, container, { playerPos,
playerAnim })` draws it as an animated `.player-sprite` overlay `<div>`
(see Pixel-art rendering above) appended on top of the tile at
`playerPos`, purely visual. This is intentional: mutating the tile grid
to represent the player would corrupt the level data on reset or
re-encoding for another share.

### Movement

A single `document.addEventListener('keydown', ...)` handles Arrow
keys/WASD (mapped in the `KEY_DELTAS` table — both letter cases so
caps lock/shift don't break it) with plain `keydown`, no framework. Each
keypress is one tile of movement:

1. Ignore the key if the game is already won, or if it's not a recognized
   movement key.
2. Compute `[nx, ny]`. If it's outside `[0, level.size)` on either axis,
   the move is a no-op (grid bounds block movement).
3. First catch the world up to the live tick (`advanceWorldTo`), then run
   `resolveMove` from the player's tile at that tick:
   - `null` (wall, turret, out of bounds, wrong-way one-way) — no-op.
   - a `death` — counts as a move, then `killPlayer(label, idx)`.
   - `won` — move onto the goal, set the won flag, show a win message with
     the final move count, a `.flash-win` animation on `#grid`, and the
     best-score check (below). Further keypresses are ignored once won.
   - otherwise — the player ends on `final` (which may be several tiles
     away after ice/currents/a mushroom/a portal); `applyMoveToObjects`
     lights bombs, shakes icicles and breaks thin ice left behind, and a
     message says what happened. If vines `grabbed` the player,
     `heldUntilTick = tick + 1 + VINE_HOLD_TICKS`: keypresses before then
     are ignored ("The vines have you"), the player shows the `anim-held`
     struggle pose, and the `vine-wrap` overlay is drawn over them —
     matching solveBFS's forced waits exactly.

**Every move is animated.** The player never jumps between tiles: they
glide along `resolveMove`'s `path`. `slideTimeline` gives each tile an
arrival time — a plain one-tile step is a walk (`WALK_STEP_MS` = 150ms,
eased in and out); every tile of a multi-tile move (ice slide, current
push, mushroom bounce, portal warp) takes `SLIDE_MS_PER_TILE` = 85ms at a
steady speed, a portal jump or mushroom hop twice that. `renderLevel` animates
the `.player-slide` wrapper with the Web Animations API (`slideKeyframes`
— translates in whole tiles plus the grid gap; warps shrink out and pop
back in, hops arc up over the tile in between) resuming at the elapsed time
on every re-render, each ice tile crossed plays an `ice-glint` flash timed
to the player's arrival, and the player holds the move's travel pose (see
Player character and animation states). Input is ignored — not queued —
until the glide lands (`inputLockedUntil`), and a death or win at the end
of a move is deferred (`outcomeTimer`) until the player visibly gets
there. The game logic itself still resolves the whole move instantly, at
the keypress's tick, exactly as solveBFS assumes. Thin ice left behind
caves in (an `ice-collapse` slab over the broken tile, timed to when the
player leaves it — `collapses`, passed to `renderLevel` as
`world.collapses`), and intact thin ice under the player creaks
(`thinice-underfoot`).

**Moving hazards glide too.** `hazardOverlaysFor` gives each imp, boar
and fireball overlay a `from` list (the tiles it crossed this tick; a
fireball's previous tile is stored as `from` in `fireballDistances`), and
`renderLevel` glides it in over the first `MOVER_GLIDE_MS` = 180ms of the
tick (`world.tickElapsedMs`) via a `.hazard-mover` wrapper, so the
sprite's own hop/trot animation keeps its transform. The game counts it
as there from the start of the tick, which is why the glide is short.

### Touch controls

Every way of moving goes through startSolverMode's `tryMove(dx, dy)` —
one call, one move, ignored while the last move is still animating:
the keyboard (`handleKeydown`), a swipe on the grid (touchstart/touchend;
at least `SWIPE_MIN_PX` = 24px, along whichever axis moved further — a
shorter touch is a tap and does nothing), and the on-screen D-pad
(`#dpad`, four buttons with `data-dir`, pointerdown). The D-pad is
un-hidden by startSolverMode, but CSS only shows it on touch screens
(`@media (hover: none) and (pointer: coarse)`). While playing,
`body.playing` gives the grid and pad `touch-action: none` (and the grid
listeners `preventDefault`), so swiping never scrolls or zooms the page,
and on touch screens the grid shrinks to fit the header, pad and hint on
one screen (`calc(100dvh - 482px)`, never under 200px). Creative Mode
still needs a mouse: its drag and drop is HTML5 drag events, which
touch screens don't send.

### Sound

[sounds.js](sounds.js) synthesizes every sound with the Web Audio API:
`SOUNDS` maps each name to a few short oscillator tones and filtered
noise bursts (`tone`, `noise`, `arpeggio`), all under one quiet master
gain (`MASTER_VOLUME`). The AudioContext is created or resumed on the
first key press, click or touch (browsers block sound before that), and
`playSound(name)` is a no-op until then or while muted. Solver mode
plays: `step` (alternating pitch), `bump` (blocked move), the travel
poses' `slip`/`shove`/`bounce`/`warp`, `crack` (thin ice), `fuse`,
`blast` (a bomb going off, detected in `advanceWorldTo`), `icicle-crack`
/ `icicle-crash`, `grab` (vines), `lever`, `unlock`/`lock` (the exit),
`death`, `win` and `timeup`. Turrets, vents and snapjaws stay silent —
they fire every few beats forever, which would grate. `#mute-btn` (top
right, beside the account button) toggles `localStorage['trapRoomMuted']`
— sound and music together, a device preference, not part of the synced
save.

**Music**: a faint looping tune (`MUSIC_VOLUME`, well under the sound
effects), sequenced live: every eighth note `playMusicStep` may play a
bass note, a pad chord (first beat of each bar) and a melody note, a
100ms timer scheduling ~0.3s ahead (`scheduleMusic`). `MUSIC_THEMES` gives
each area its own key, scale, tempo, 4-chord loop, 4-bar tune and
instruments: `home` (calm A minor, the menus), `lava` (darker D
phrygian, lower, faster), `ice` (slow, high E-lydian chimes with an
echo), `grass` (bouncy G major with a walking bass). `setMusic(area)`
crossfades; the bootstrap sets `home`, startSolverMode switches to the
room's theme and its stop() switches back. The music starts with the
first gesture (like the sound effects), stops while muted, and the whole
AudioContext is suspended while the tab is hidden.

### Hazards killing a stationary player

`killPlayer(label, idx)` is the shared death handler: resets `playerPos`
to `level.start`, increments `deathCount`, resets every object (bombs
re-armed, thin ice mended, icicles re-hung — each life starts with a
fresh room) and any vine hold, reveals the tile if it was a hidden spike
(revealed hidden spikes stay visible across deaths until a full Reset),
shows a fail message plus `.flash-fail` on `#grid`, and queues a one-shot
flash on the tile that killed the player (`trap-triggered` for spike
types, a generic `hazard-triggered` burn flash for everything else). It
doesn't render; callers render once after all state changes, and
`render()` applies the queued flash (`pendingFlash`) after rebuilding the
grid.

`advanceWorldTo(targetTick)` steps `processedTick` forward one tick at a
time (usually one step; more if the interval was throttled), advancing
objects and killing the player if `hazardAt` says their current tile is
deadly at the new tick, or if they're on `frost` and `processedTick >=
arrivedTick + FROSTBITE_TICKS` — the real-time counterpart of solveBFS's
"must survive into the next tick" and "never wait on frost" rules.
(`arrivedTick` counts from when a slide visibly lands, so a long slide
never eats the time you have to step off — only ever more lenient than
the bot, never less.) `hazardTick()` runs every 100ms: it
updates `#elapsed-time`, and if the live tick has advanced, calls
`advanceWorldTo` and re-renders so hazards animate while the player
stands still. The keydown handler also calls `advanceWorldTo` first, so a
move is always judged against what's on screen.

**Player animation across re-renders**: since the whole grid is rebuilt on
every tick, `render()` passes `playerAnim.elapsedMs` (time since the
current animation state started) and `renderLevel` sets a negative
`animation-delay`, so a walk/hit animation continues rather than
restarting every tick; one-shot states settle back to `idle` after 500ms.

### Move/death counters, timer, and reset

`moveCount`, `deathCount`, `startTime`, `timerId`, `processedTick`,
`states`, `revealed`, `heldUntilTick` and `arrivedTick` are local variables alongside `playerPos` inside `startSolverMode`, all set
together (with `playerPos`/`won`/`facing`/`animState`) by one `resetRun()`
function so there's a single place that defines "what a fresh run looks
like":

- `moveCount` counts the accepted keypresses of the current life: every
  death (`killPlayer`) resets it to 0, so the moves shown — and the ones a
  win is scored, starred and best-scored on — are the winning life's
  alone. This is purely a UI/scoring
  counter now — it does **not** drive hazard timing (see `timedspike`
  above and `startTime`/`timerId` below for what does).
- `deathCount` counts every call to `killPlayer` (moving into something
  deadly, *or* a hazard arriving under a stationary player) — i.e. every
  time `playerPos` gets reset back to `level.start`.
- `startTime`/`timerId`/`processedTick`: `startTimer()` (called from
  `resetRun()`) records `Date.now()` and starts a `setInterval` on
  `hazardTick()` (100ms) — this single interval does double duty: it keeps
  `#elapsed-time` current (`formatElapsed(Date.now() - startTime)`) *and*
  is what drives real-time hazard danger (see Hazards killing a
  stationary player above). Both are wall-clock time, not move-based, so
  they're the one piece of solver state that needs a real interval rather
  than updating only on keypress. `handleWin()` clears the interval so the
  displayed time freezes at the moment of victory (instead of continuing
  to tick behind the win modal) and hazards stop advancing once the level
  is beaten. `processedTick` — the last tick the world was advanced to —
  is what lets `hazardTick()` skip redundant re-renders when the live tick
  hasn't advanced.
- `states`/`revealed`: every object's state and the set of revealed
  hidden spikes; `resetRun()` resets every object and hides every hidden
  spike again.

**Timed rooms**: a level with `timeLimit` shows "Time left:" and counts
down (`formatRemaining`; red and blinking in the last 5 seconds). When it
hits zero, `timeUp()` restarts the run — but keeps the hidden spikes
already found, the one thing running out of time shouldn't cost you.

Both counters are written into `#move-count`/`#death-count` from `render()`
every move, and the live timer keeps `#elapsed-time` current independently.

**Reset**: `#solver-reset-btn` (inside `#solver-stats`, always visible
during solver mode) calls `resetRun()` directly — same function used for
the initial setup and for the win modal's "Play Again" button. It restores
`playerPos` to `level.start`, zeroes both counters, restarts the timer,
clears the win/fail message and any `flash-win`/`flash-fail` grid class,
and hides the win modal if it's open. Like the spike-death reset, this only
touches local solver-mode state — `level.tiles` is never written, so
resetting mid-run can't corrupt the level.

### Win modal and best score

On reaching the goal, `handleWin()` stops the timer, computes the final
elapsed time, and calls `showWinModal(elapsedMs)`, which writes a
`Time: … · Moves: … · Deaths: …` summary into `#win-modal-stats` and
unhides `#win-modal` — a `position: fixed; inset: 0` overlay
(`display: flex` to center `#win-modal-card`, so it needs its own
`#win-modal[hidden] { display: none; }` override — see the `[hidden]`
pitfall note below) that sits on top of the grid until "Play Again"
(`#win-modal-reset-btn`, wired to the same `resetRun()`) is clicked.
Above the stats, `#win-modal-stars` shows the run's star rating and par
(see Star ratings). `onWin({ moves, deaths, elapsedMs, stars })` then lets the caller react: the
campaign records progress and shows Next Level / ← Levels (plus an
unlock note in `#win-modal-unlock`), the Daily Puzzle records the
challenge and shows Back to Daily Puzzle. Input is ignored while the win
modal is open.

Separately, `moveCount` is also compared against a best score in
`localStorage`, keyed by `trapRoomBestScore:<levelCode>` where `levelCode`
is the raw `?level=` string for this room (`bestScoreKeyFor` in
[script.js](script.js)) — **not** one global key, so every shared room
tracks its own best independently and can't clobber another room's score.
If there's no previous best or the new score is lower, it's written back
and `#best-score` (a separate line below the grid, not part of the modal)
announces a new best; otherwise it shows the existing best. This line is
deliberately left alone by `resetRun()` — it's room-level history, not
current-run state, so it stays visible as a target across resets.
`readBestScore`/`writeBestScore` wrap `localStorage` access in try/catch
and silently no-op if it throws (private browsing, disabled storage,
etc.) — best-score tracking degrades gracefully rather than crashing
solver mode.

### The `[hidden]` + explicit `display` pitfall

Several elements here (`#controls`, `#share-output`, `#solver-stats`,
`#win-modal`, `#grid`, `#theme-select`, `#level-select`,
`#creative-theme-picker`, `#reset-progress-confirm`) are toggled via the `hidden` DOM property but also need
`display: flex` for their own layout when visible. The `[hidden]`
attribute's `display: none` comes from the low-specificity UA stylesheet,
so a same-element ID rule setting `display: flex` **wins the cascade and
keeps the element visible** even while `hidden` is `true`. Every such
element needs an explicit `#id[hidden] { display: none; }` rule alongside
its normal `display: flex` rule in [style.css](style.css) — forgetting one
(as happened once already when `#solver-stats` gained its Reset button and
a `display: flex` rule) silently breaks visibility toggling for that
element only, with no console error. If you add a new toggled element that
needs a non-`block` `display`, add its `[hidden]` override in the same
edit.

## Daily Puzzle

A top-level mode (alongside the campaign and Creative Mode), toggled by
`#daily-toggle` in [script.js](script.js). It has two challenge types —
**solver** (navigate a fixed, procedurally-generated layout) and **builder**
(build a layout against the day's size/trap-budget constraints, scored by a
BFS "bot" solving it) — each with three difficulty tiers (easy/medium/hard).
Everything is derived deterministically from the calendar date, so every
player gets the identical set of six daily challenges with no backend or
database: the date *is* the shared state, the same way `?level=` sharing
encodes a whole level into a URL with no server involved.

### Deterministic generation

`hashStringToSeed(str)` (FNV-1a) turns a string into a 32-bit seed, and
`mulberry32(seed)` is a small deterministic PRNG — given the same seed it
always produces the same sequence, unlike `Math.random()`. `dailySeedFor(dateStr, type, difficulty)` hashes
`` `trap-room-daily:${dateStr}:${type}:${difficulty}` `` so each of the six
daily challenges (2 types × 3 difficulties) has its own independent seed —
changing one difficulty's or type's generation can never affect another's.
`getTodayDateString()` reads the player's *local* date (not UTC) as
`YYYY-MM-DD`, since the puzzle should roll over at the player's own
midnight.

**Levers**: after a solver room is settled, `addDailyLevers` rolls a
separate seed (`dailySeedFor(date, 'levers', difficulty)`): on
`DAILY_LEVER_CHANCE` (40%) of days it drops `DAILY_LEVER_COUNTS`
(easy 1, medium 2, hard 3) levers on open floor away from the start,
trying up to 12 placements that keep the room solvable, else leaving it
lever-free. Because it's a separate roll after the room, a day without
levers is exactly the room it always was. Builder challenges get levers
through the theme palettes (`THEME_TRAPS`).

**Castle days**: on roughly `DAILY_CASTLE_CHANCE` (1 in 7) of dates —
chosen by hashing the date, so everyone gets the same ones — the castle
takes over the daily puzzle; every other date keeps exactly the rotation
below, so adding the castle didn't move any other date's theme. Castle
rooms use crushers, floorboards, crossbows, plates and portcullises (plus
a powder barrel from medium and the ghost on hard).

**Theme rotation**: `dailyThemeFor(dateStr)` picks lava, ice, grass,
lava, … by calendar day (the day number comes from the date string as a
UTC date, so time zones can't shift it) — everyone gets the same theme on
the same day. The Daily Puzzle is playable in every theme, locked ones
included (the hub calls a locked theme "a sneak peek"), and never
touches campaign progress.

- **Solver**: `generateDailySolverLevel(dateStr, difficulty)` looks up the
  day's theme's params in `DAILY_SOLVER_PARAMS[theme][difficulty]` and calls
  `buildRandomSolverLevel`, which lays a bordered room with `start` pinned
  near the top-left and `goal` near the bottom-right, rolls every other
  interior cell independently against per-cell densities (wall, spike —
  split into plain/timed/hidden by `timedSpikeShare`/`hiddenSpikeShare` —
  one-way, ice, current), then places exact counts of `extras` (bombs,
  vents, imps, portal pairs) on shuffled open floor away from the start,
  and turrets on random non-corner border walls facing inward. Easy: 1
  bomb + 1 turret, ice. Medium: adds a vent, an imp, currents, timed and
  hidden spikes. Hard: 2 each of bomb/turret/vent/imp plus a portal pair.
  Lava's params are unchanged from before themes existed, and every newer
  density/extra defaults to 0, so a lava day generates exactly the room
  it always would have. Ice rolls slick ice, thin ice (capped at
  `MAX_THIN_ICE`) and frost per cell, plus frost cannons and icicles as
  extras (and a portal pair on hard); grass rolls streams, vines and
  mushrooms per cell, plus snapjaws and boars (and a portal pair on
  hard). The generated room carries its `theme`. A randomly-rolled
  room has no solvability guarantee, so this retries with an incrementing
  nonce mixed into the seed (`baseSeed ^ Math.imul(attempt + 1, 2654435761)`)
  until `isSolvable()` confirms a path — still fully deterministic, since
  the same date always retries in the same order. `buildFallbackSolverLevel`
  (an empty bordered room) is a last-resort if 500 attempts somehow all
  fail.
- **Builder**: `generateDailyBuilderConstraints(dateStr, difficulty)` returns
  the day's `theme` and seeds one `mulberry32` call per difficulty to
  draw a grid size, a trap-point
  budget (easy 4-6, medium 7-9, hard 10-13), and a `minBotMoves` target (in
  bot turns) from that difficulty's ranges in
  `DAILY_BUILDER_PARAMS` — the constraints the player must build within and
  the bar their room must clear.

### Builder challenge scoring (the "bot")

`solveBFS(level)` (in the Sharing/Validation code, alongside `isSolvable`) is
a BFS identical to the one that always backed `isSolvable`, except it now
returns `{ solvable, moves }` instead of a bare boolean — since BFS explores
in move-count order, the first time it reaches the goal *is* the shortest
solving path. `isSolvable(level)` is now a one-line wrapper
(`solveBFS(level).solvable`) so every existing caller (Validate, the sharing
gate, the sanity checks) is unaffected.

The Daily Puzzle builder challenge's "Submit to Bot" button runs `solveBFS`
against the player's `builderLevel` and compares `moves` to that
difficulty's `minBotMoves`: at or above the target, the challenge is
complete (a higher bar means the player had to build something more
*convoluted*, not just bigger); below it, the room was too easy and the
player can keep editing and resubmit. This reuses the exact same
solvability search as everywhere else in the app — there's no separate
"AI" — so a builder challenge's bar is exactly as trustworthy as Validate's
solvable/not-solvable verdict elsewhere.

`activeBuilderSize`/`activeTrapBudget` (bootstrap-local variables) let
Creative Mode's existing machinery serve both normal Creative Mode
(`BUILDER_GRID_SIZE`/`TRAP_BUDGET`) and a daily builder challenge (that
day's constraints) without duplicating the drag-and-drop/palette/Clear-All
code: `canPlaceTileType(level, x, y, newType, trapBudget)` now takes the
budget as a parameter (defaulting to `TRAP_BUDGET` for normal Creative Mode's
call sites), and every `createEmptyLevel(...)` call in Creative Mode's
bootstrap code uses `activeBuilderSize` instead of the `BUILDER_GRID_SIZE`
constant directly.

### Streak rule and stats

A day's streak is earned by completing **2 of the day's 3 difficulty
"modes"** (easy/medium/hard — a mode counts as done if *either* the solver
or the builder challenge at that difficulty is completed, or both) **or by
completing hard mode alone**. `isDailyStreakEarned(completed)` implements
exactly this rule and is the single source of truth for it.

`localStorage['trapRoomDailyStats']` (a different key from the per-room
`trapRoomBestScore:<levelCode>` best-score entries — see Solver mode above)
holds:

```js
{
  currentStreak, bestStreak, totalDaysCompleted,      // lifetime
  perDifficultyCompletions: { easy, medium, hard },   // lifetime, see below
  lastStreakDate,                                     // "YYYY-MM-DD" | null
  today: {
    date,                                             // "YYYY-MM-DD"
    completed: { solver: {..}, builder: {..} },       // booleans per difficulty
    streakEarned,                                     // this date's streak already counted?
  },
}
```

`ensureTodayStats(stats, dateStr)` rolls `today` over to a fresh,
all-incomplete state whenever the stored date doesn't match — a new
calendar day always starts every mode unattempted — without ever touching
the lifetime counters. `markDailyChallengeComplete(dateStr, type,
difficulty)` is the only place that mutates stats: it records the
completion (a no-op if that exact challenge was already completed today, so
replaying one can't double-count), increments `perDifficultyCompletions[difficulty]`
the first time *either* type clears that difficulty today, and — if this
newly satisfies `isDailyStreakEarned` and today's streak wasn't already
counted — advances `currentStreak` (reset to `1` if `lastStreakDate` wasn't
literally yesterday, else `+1`), `bestStreak`, and `totalDaysCompleted`.
`loadDailyStats()`/`saveDailyStats()` wrap `localStorage` access the same
way `readBestScore`/`writeBestScore` do (see Solver mode above): shallow-
merged onto defaults on read, try/catch-and-ignore on write, so a fresh
install, a shape mismatch, or blocked storage all degrade to "no progress
yet" instead of crashing the hub.

### Hub and challenge UI flow

`#daily-hub` is a menu, not a board — the grid is hidden while it's up,
and the page takes on the day's theme. `renderDailyHubUI()` refreshes the
date/world/streak/stats text and each `.daily-mode-btn`'s completed
state (a ✓ suffix + `.completed` styling) from `loadDailyStats()` every time
the hub is (re)shown.

The hub is a dark glass card in the day's world's colors (`--theme-accent`
/ `--theme-glow`), so the world shows around and through it. Its top is a
banner of that world (`renderDailyHubBanner`): the world's page backdrop
cropped to its sky and peaks and lit from below in its accent color, with
"Daily Puzzle", the world's name (in the cutscenes' chapter-card
wordmark) and the date over it, and under it a strip of twelve of that
world's own tiles (`DAILY_HUB_STRIPS` — a few of its signature traps,
the gem at the end) with the hero, dressed for that world, standing on
the first, like a cutscene's stage. When the day's world is still locked
in the campaign, a line under the banner says it's a sneak peek.

### World layer (`#ambient`)

On every Daily Puzzle screen — the hub, a solver challenge and a builder
challenge — the day's world also moves all around the page, so each map
type has a background of its own beyond the campaign's backdrop:
`setAmbient(theme)` sets `body[data-ambient]` (each daily entry function
calls it after `hideAllModes()`, which clears it), and `#ambient`, a fixed
full-page layer at `z-index: -1` (above the body's backdrop, below the
page), shows that world's version. Volcanic Depths: a forge-glow from
below and rising embers. Frozen Caverns: a cold floor mist and falling
snow. Overgrown Ruins: a green haze, wandering fireflies and the odd
falling leaf. Abandoned Castle: banks of lilac fog rolling past and
drifting dust. The particles are square, like pixels: 36 plain `<i>`s
scattered once at bootstrap by `scatterParticles(container, count,
seed)`, which gives each its place, size, speed, start offset and drift as
custom properties (`--x --y --s --t --d --o`) from a fixed seed; each
world's CSS decides what they look like and how they move. The title
screen's embers and fireflies use the same helper. Under
`prefers-reduced-motion` the particles are hidden and the light stays
still.

- **Solver challenge**: `startDailySolverChallenge(difficulty)` calls the
  same `startSolverMode` normal shared-link solving uses, just with a
  synthetic `levelCode` (`` `daily-${dateStr}-solver-${difficulty}` ``, so
  best scores are tracked per day/difficulty for free via the existing
  best-score mechanism) and an `onWin` hook that calls
  `markDailyChallengeComplete` and refreshes the hub. Because the hub can
  launch multiple solver sessions across one page load (hub → play → back →
  play a different difficulty) — unlike the one-shot `?level=` flow, which
  only ever calls `startSolverMode` once per page load — `startSolverMode`
  now **returns a `stop()` function** that removes its `keydown` listener
  and clears its hazard-tick interval; the hub calls the previous session's
  `stop()` before starting a new one (and stores it in `activeSolverStop`).
  Skipping this would stack up duplicate document-level `keydown` listeners
  and intervals from every previous session (`stopSolver()`, called by
  `hideAllModes()` — see Screens below). `#daily-solver-back-btn` (in
  `#solver-stats`) and `#win-modal-daily-back-btn` (in the win modal) are
  both wired once, at bootstrap time, to `enterDailyHub()` — static
  elements shown/hidden per session rather than rewired each time, to
  avoid the same listener-stacking problem.
- **Builder challenge**: `startDailyBuilderChallenge(difficulty)` sets
  `activeBuilderSize`/`activeTrapBudget` from that day's constraints,
  starts a blank room in the day's theme, swaps the normal Share button
  out for `#daily-builder-bar` (target text + Submit to Bot + a
  back-to-hub button), hides Creative Mode's theme switch, and limits the
  palette to Basics plus that theme's `THEME_TRAPS` — otherwise it reuses
  Creative Mode as-is (Validate still works unmodified, since it only
  checks solvability).

Creative Mode and the hub are mutually exclusive: every mode starts with
`hideAllModes()`, so `activeBuilderSize`/`activeTrapBudget` are always
reset back
to the plain constants on the way into ordinary Creative Mode regardless of
what a previous daily builder challenge left them at.

## Campaign (Play)

### Levels ([levels.js](levels.js))

`CAMPAIGN_LEVELS` holds 48 levels, 12 per theme, played in
order — each `{ id, theme, name, idea, map, timeLimit? }`. `map` is one
string per row, one space-separated token per tile (`LEVEL_TOKENS`: `#`
wall, `.` floor, `S`/`G`, `^` spike, `t` timed, `h` hidden, `o^ o> ov o<`
one-ways, `T^…` turrets, `V^…` vents, `C^…` currents, `I-`/`I|` imps,
`B-`/`B|` boars, `b` bomb, `i` ice, `pa`/`pb` portals, `=` thin ice, `*`
frost, `!` icicle, `%` vines, `m` mushroom, `J` snapjaw, `L` lever,
`X` crusher, `P` pressure plate, `g` portcullis, `@` ghost).
`parseLevelMap(rows, theme)` throws on an unknown token or a non-square
map; `campaignLevel(id)` returns a fresh level object every call.

Levels 1–10 get steadily harder within each theme (9 and 10 are the
hardest), and each theme introduces its traps one or two at a time.
Levels 11–12 of each theme are its lever rooms (Switchback/Powder Keg,
Brittle Switches/Cold Circuit, Leapfrog Levers/Switchyard) and its
hardest: long routes where levers meet things you can't undo (one-ways,
thin ice, bombs). They were found with a solver-guided search that
favoured a long par and a high share of doomed states, then checked by
hand. tests.js checks each lever room's par beats every level before it
in its world (so the world still runs easy to hard), and that it's longer
to solve with its levers than without them. Every
level is solvable by solveBFS, and tests.js also plays nothing it can't
back up: only the theme's own traps, within Creative Mode's caps. A few
were designed with the solver's help — slide/thin-ice layouts were chosen
for a high share of "doomed" states (positions you can reach alive but
can no longer win from), and icicle levels were checked to be unsolvable
without the icicle. Timed rooms (`timeLimit`): Lava 5 (15s), Ice 5 (25s),
Grass 5 (28s), each at least double the bot's time plus 4 seconds.

The **castle** (bonus world) is harder from its first room and harder
every level after: par rises strictly level to level (24 → 92), its first
room's par beats the median mid-world (levels 5–8) par, and The Last Lock
(castle 12) has the longest par in the game — tests.js checks all three.
Its levels were found by a solver-guided search over carved mazes (each
level's traps dropped onto the corridors, scored on par and the share of
doomed states, and required to route the winning path through that
level's new trap), then named and checked by hand. Traps are introduced in
order: crushers and carved arrows (1), plates and portcullises (2),
floorboards (3), crossbows (4), the ghost (5), powder barrels (6), magic
mirrors (7), trapdoors (8), castle levers (11). Its two timed rooms —
Powder Store (6, 39s) and The Oubliette (9, 57s) — are tighter than other
worlds': at least 1.5× the bot's time plus 3 seconds, and no more than the
2× + 4s rule elsewhere.

`levelIntroductions(id)` derives the "New trap!" card: one representative
tile per trap family appearing in this level but in no earlier level of
the same theme (so ice level 1 introduces "Icicle Spike" and "Slick Ice",
reskins included). The card (`#trap-intro-modal`, with each trap's icon,
themed name and `trapDescription`) shows before a level the player hasn't
beaten yet; the run (and its clock) starts when they press Start.

### Unlock rules and progress

- Lava is always unlocked. Ice unlocks once `UNLOCK_REQUIREMENT` (8) lava
  levels are completed; grass once 8 ice levels are. (`isThemeUnlocked`)
- The **Abandoned Castle** is the bonus world (`BONUS_THEMES`; the others
  are `MAIN_THEMES`): it unlocks only once **every** level of every main
  world is beaten (`bonusProgress` — counts whatever levels those worlds
  hold), stars not required. Its locked card shows "n / total" and each
  world's count; grass level 8 carries no 🔑 (it doesn't open the castle
  alone — `nextMainTheme`). The win that completes the last main-world
  level announces the castle opening.
- Within an unlocked theme, level 1 is open and level n opens once level
  n−1 is beaten (`isLevelUnlocked`) — so "8 of the world's levels"
  means beating levels 1–8.
- Completing a level = reaching the goal once.
- `localStorage['trapRoomProgress']` = `{ version: 1, levels: { [id]:
  { moves, timeMs, deaths, stars? } }, story: [sceneId] }` (`story`: the
  cutscenes seen, sorted — see Story and cutscenes) — a level is complete once it has
  an entry, which keeps the best of each stat and the most stars
  (`recordLevelComplete`; `stars` is missing for wins from before star
  ratings until the level is replayed). Keyed
  by id, never position. `loadProgress`/`saveProgress`/`resetProgress`
  wrap storage in try/catch like the daily stats.
- Daily Puzzle, Creative Mode and shared links never touch progress.

### Star ratings

Par is the fewest moves that beat a level — `parMoves(level)`, the same
search as solveBFS but with waiting free (a layered search where a wait
costs 0 and a move 1), since the move counter doesn't count waiting.
`starsFor(moves, par)`: 3 stars at par or better, 2 for up to 50% over
(`floor(par × 1.5)`), 1 for any finish. `campaignPar(id)` caches each
campaign level's par for the session and is passed to startSolverMode as
`par`; other rooms (daily, shared) work theirs out at the first win.
Every run's win card shows its stars and par (`#win-modal-stars`); only
the campaign saves them (`levelStars`, `themeStars`), shown on each level
plate and as a "★ n / 36" total on the world and level screens.

### World select and level select

`#theme-select` (Play) shows one world at a time, Geometry Dash style:
a live, non-interactive `renderLevel` preview of its first level in
`#theme-card`, its name, status ("3 / 10 levels complete", "👑 All 10
levels complete", or "🔒 Locked — 5 / 8 Lava levels to unlock"), a
progress bar, one dot per world, ◀ ▶ buttons (← → / A D keys too;
wrapping), and a Levels button (disabled while locked). Locked worlds
show the preview greyscale and dimmed under a lock. The page backdrop
switches with the world shown. A "Reset progress" link sits underneath
(two-step confirm).

Switching worlds slides the screen over (`showTheme(idx, dir)`, `dir` +1
for the next world, −1 for the previous; a dot picks the direction toward
it): the world's card (`#theme-card`, in `#theme-card-slot`) and its
name/status/progress (`#theme-info`, in `#theme-info-slot`) slide in from
one side while a copy of the old ones (`.world-slide-ghost`, which keeps
its ids so the id-based styling still applies — it sits after the real
element, so lookups find the real one) slides out the other, clipped by
the panel (`overflow: hidden`). The page backdrop slides across with them
on two temporary full-screen layers (`.world-slide-backdrop`, laid out
like body's own background, behind the content). All of it is the Web
Animations API, `WORLD_SLIDE_MS` (420ms). A new switch mid-slide, leaving
the screen (`hideAllModes`), or a backstop timer (for a page that isn't
drawing frames) ends it via `finishWorldSlide`, so nothing is left
behind. Instant under `prefers-reduced-motion: reduce`.

`#level-select` shows the world's 12 levels as `.level-plate` buttons
(6 × 2; 3 columns on phones): number (or 🔒), name, best stars, and tags — ⏱ for a
timed room, 🔑 on the level that unlocks the next world, ✓ and best moves
once beaten; the level's idea is its tooltip. Clicking an open plate calls
`startCampaignLevel(id)`, which shows `#level-heading` ("Ice 6 · Icefall
· ⏱ 25s"), the level's idea as a hint under the grid, and a ← Levels
button. On a win, `handleCampaignWin` records progress and fills in the
win modal: an unlock note ("🔓 Frozen Caverns unlocked!", "👑 Every Lava
level complete!") and Next Level (hidden after level 12).

## Story and cutscenes

Why the player is in these rooms ([story.js](story.js)). The Trapwright —
the player's master, a legendary trap-maker — has vanished, leaving an
empty workshop and a note ("Look for me"). Each world ends with a page of
the master's journal, each stranger than the last, and a glimpse of a
shadow shaped like the master. In the castle, the ghost turns out to be
the master, bound there until someone beats every trap they ever built;
they hand over their tools and fade. The epilogue loops back to the
workshop: the player, now the Trapwright, leaves a note of their own.

`STORY_SCENES`: `opening` (Prologue: The Empty Workshop), `lava` (I · Fire
Is Honest), `ice` (II · Footsteps), `grass` (III · The Garden That Grew)
and `finale` (IV · The Last Lock). Each is `{ id, label, title, theme,
after, steps }`; `after` is the world whose last level plays it. Steps are
a small script — lay out a stage, fade in/out, title cards, put
actors/props on stage, walk, face, pose, fade, change a tile, captions
(`say`, typed out, click to continue), journal pages (`note`), waits,
sounds, shakes and flashes; the comment at the top of story.js lists them.

- **Stage**: 12 × 6 tiles (`STAGE_COLS`/`STAGE_ROWS`), written in the
  campaign's own `LEVEL_TOKENS` and drawn with that theme's tile art
  (`parseStageMap`, `themeTexture`).
- **Actors**: the player in the world's outfit (`THEME_PLAYER_FRAMES`), the
  master and the shadow (`STORY_ACTOR_FRAMES` in sprites.js — the player's
  own poses with a beard and their own palettes, so every pose lines up),
  and the castle ghost. Props: journal page, tools, workbench (new in
  sprites.js, `STORY_PROP_TEXTURES`), the title torch, a theme's goal gem
  and the icicle crash.
- **Sound**: `page`, `rumble` and `shimmer` effects and a `story` music
  theme in sounds.js; the music the player came from comes back after.

When they play (each by itself only once — seen ids are kept in
`progress.story`, marked the moment a scene starts, so skipping counts):

- **Prologue**: pressing Play on the title screen in a new game — nothing
  beaten and the prologue never seen (`shouldPlayOpening`). It plays over
  the world select. A player whose game was under way before the story
  existed doesn't get it automatically.
- **A world's chapter**: `STORY_AFTER_WIN_MS` after the first win on that
  world's last level (`storySceneAfterLevel`), over the win card, which is
  still there when it ends. Not if the player left the room first.
- **Finale**: the same, after castle 12 — reachable only once every level
  of every world is beaten.

Skip (the button or Escape) ends a scene at once. A click, Space or Enter
finishes typing, then moves on. While a scene plays, it takes every key
(a capture-phase listener on window), so nothing behind it reacts. The
world select's 📜 Story link opens `#story-modal`, which lists every scene
to rewatch. The prologue is always there; the others unlock once their
world's last level is beaten or they've been seen (`isStoryUnlocked`), and
locked ones say what opens them. A campaign reset forgets the seen list
too, so the next Play starts with the prologue again.

## Chapter badges

One badge per world ([badges.js](badges.js), `BADGES`): the Ember Seal
(Volcanic Depths), Frost Sigil (Frozen Caverns), Verdant Crest (Overgrown
Ruins) and Trapwright's Crown (Abandoned Castle). A badge's id is its
world's theme. It's earned by beating every level of that world
(`isBadgeEarned`) — worked out from campaign progress, never saved on its
own, so badges sync, merge across devices and clear with a campaign reset
exactly like the levels do.

- **Art** (sprites.js, `BADGE_TEXTURES`): a 24 × 28 pixel medal on a
  notched ribbon, `makeBadgeFrame(emblem)` — the world's metal and colors
  (`BADGE_PALETTES`) around its emblem (`BADGE_EMBLEMS`: flame, snowflake,
  leaf, crown).
- **The award** (`showBadgeAward`, `#badge-award`): the medal drops in
  spinning like a coin, lands with a bounce and hovers, a shine sweeps
  across it (masked to the medal's shape), light rays turn behind it, and
  the world's weather fills the screen — embers rising, snow falling,
  leaves tumbling, castle sparkles twinkling (CSS particles whose place and
  timing are random custom properties). A `badge` fanfare plays (sounds.js).
  It stays up until Nice! (or Enter/Space/Escape, after a short grace so a
  key held from the cutscene doesn't close it), and takes every key while
  up, like a cutscene. It notes the badge was added to the account (or,
  for a guest, to log in or sign up to keep it).
- **When**: the win that finishes a world (`badgeEarnedByWin`), right after
  that world's cutscene ends or is skipped. If the cutscene doesn't play
  (seen already, or the player left the room), the badge shows by itself
  `STORY_AFTER_WIN_MS` after the win. A world finished on another device
  just appears in the list.
- **The list** (`renderBadgeList`): the account panel's Badges section
  (`#account-badges`, above Your icon) shows all four — earned ones in
  color (click to see the award again), the rest as dark silhouettes whose
  tooltip says how to earn them. A guest who has earned any sees theirs
  under the log-in form (`#account-guest-badges`), with a nudge to sign up.

## Visual polish

- `#grid` gets a one-shot `.flash-win`/`.flash-fail` CSS animation
  (`flashGrid` in `startSolverMode`) on winning or hitting a spike/active
  timed spike. Removing then re-adding the class (with a forced reflow)
  restarts the animation even on repeated fails in a row.
- `favicon.svg` — a plain inline-friendly SVG using the same start/goal/
  spike colors as the tile palette, linked from `index.html`.
- `#grid`'s width is `min(90vw, 65vh, 560px)` (was `min(90vw, 560px)`) so
  it's also bounded by viewport *height*, and `#controls` wraps
  (`flex-wrap: wrap`) — together these keep the game playable without
  scrolling on a short/narrow laptop window. Small media queries
  (`max-width: 480px`, `max-height: 700px`) trim body padding and heading
  size further on very small screens.

## Accessibility

Builder-mode tiles are real `<button type="button">` elements (see
Rendering above), not divs with a click handler, so keyboard-only editing
works: they're in the tab order, Enter/Space activates them via native
button semantics (nothing in the app needs to implement this), and
`.tile-clickable:focus-visible` gives a distinct focus outline separate
from the `:hover` outline. Each tile's `aria-label` reads e.g. "Row 2,
column 3: wall". Because `renderLevel` rebuilds the entire grid on every
click, the click handler re-focuses the same `[x, y]` cell afterward so
keyboard focus doesn't jump back to the top of the page after every edit.

Control buttons (`#builder-toggle`, `#validate-btn`, etc.) are styled via
`button:not(.tile)` / `button:not(.tile):hover` specifically so that
generic button styling can never outrank a `.tile-<type>` background color
now that tiles can also be `<button>` elements — without the `:not(.tile)`
scoping, `button:hover`'s higher specificity would paint every tile grey
on hover regardless of its type.

## Title screen

`#title-screen` ([index.html](index.html)) is a `position: fixed; inset: 0`
overlay covering the whole page, shown by default (no `hidden` attribute in
the markup, unlike every other toggled overlay in this app) so it's the
first thing painted on a normal visit — no JS needed for it to appear, only
to dismiss it. It has no board of its own (`#grid` starts `hidden`), and
`#controls` also starts `hidden` so its buttons can't be reached by Tab
while visually covered. The title screen always uses the lava look.

Menu buttons, each calling one mode-entry function directly:

- **Play** → `openThemeSelect()` (the world select — see Campaign below).
- **Daily Puzzle** → `enterDailyHub()`.
- **Creative Mode** → `enterCreativeMode()`.

**How To Play** / **Credits** don't dismiss the title screen — they open
`#title-howto-modal`/`#title-credits-modal`, two more `position: fixed;
inset: 0` overlays (same `[hidden]` + explicit `display` pattern as
`#win-modal` — see The `[hidden]` + explicit `display` pitfall above) on
top of it (`z-index: 150` vs. the title screen's `100`), each with a
"Back" button that just re-hides that modal.

There's no "Continue"/"Exit" button (unlike the reference image this
screen's layout was inspired by) — progress is picked up automatically
(localStorage, or the account) and there's no meaningful way to "exit" a
browser tab, so those two
didn't get a reskinned equivalent; the five buttons instead map directly to
the app's five real entry points (the campaign, Daily Puzzle, Creative
Mode, instructions, credits). Each carries a pixel icon at its left
(`.title-btn-icon`, `TITLE_MENU_ICONS` in sprites.js): the goal gem for
Play, a calendar page for the Daily Puzzle, the master's tools for
Creative Mode, the master's journal page for How To Play, a rating star
for Credits. The tagline under the logo is "Find the master." — the
prologue's closing title card, word for word. How To Play is kept short: four numbered
steps (reach the gem, avoid traps, traps have a rhythm, start/gem are safe),
a "Good to know" list (stars, unlocking, levers, timed rooms, Creative
Mode), then a "Trap guide" of collapsed `<details>` sections (All worlds /
Volcanic Depths / Frozen Caverns / Overgrown Ruins / Abandoned Castle) so a
new player isn't handed a wall of text — the "New trap!" card teaches each
trap on first sight. Credits: title, one-line description, maker, what it's
built with, thanks, privacy link.

### Live streak sign

`#title-sign` (styled as a wooden signpost) shows the player's current
Daily Puzzle streak via `renderTitleStreakSign()`, called once at bootstrap
— it reads `loadDailyStats()`/`ensureTodayStats()` (see Daily Puzzle below;
both already existed for the hub) but never calls `saveDailyStats()`, so
opening the title screen can't itself commit a same-day stats rollover.
This makes the signpost a real (if minor) piece of game UI reusing existing
stats plumbing, not a purely decorative prop like the reference image's
signpost.

### Pixel art

The title screen's art is generated by [sprites.js](sprites.js)'s
existing bitmap-grid -> inline-SVG pipeline (see Pixel-art rendering
above), not a new one — the "Title-screen decorative sprites" and "Home
menu icons" sections of [sprites.js](sprites.js) have the frame
generators, `TITLE_SCREEN_TEXTURES` and `TITLE_MENU_ICONS` the data URLs.

- **Backdrop** (`makeHomeBackdropFrame`, 128x96, `background-size:
  cover` on `#title-screen`): the view out of the Trapwright's workshop
  door at the foot of the mountain, where the prologue starts, with
  every world of the story in one night scene. The Volcanic Depths' cone
  glows on the left, the Frozen Caverns' snow-capped peaks stand behind,
  the Abandoned Castle sits on its crag under the moon on the right, and
  the Overgrown Ruins' forest runs along the bottom with a path cut into
  it. Stone pillars and an arch (the doorway, laid in courses and
  torch-lit along its inner edge) frame it. The menu covers the middle,
  so the worlds sit to the sides and along the bottom; a phone sees only
  the middle (sky, peaks, forest). `fillPeaks()` draws straight-sided
  peaks (`{ x, h, slope }`, optionally capped flat for a crater) and
  returns each column's top, for snow caps and shading.
- **Decorations** (`#title-decor`): three of the master's journal pages
  drifting (the page that glows on the floor in the cutscenes), the
  apprentice (the lava player's idle frame) standing at the head of the
  path, embers rising off the volcano and fireflies over the forest
  (`scatterParticles` in script.js — see Daily Puzzle → world layer), plus
  the two wall torches, now on the doorway's pillars. They replace the
  old spike-silhouette "treeline". On phones the torches (whose pillars
  are cropped off) and one page go; on short windows the apprentice does.
  `prefers-reduced-motion` stills all of it.
- **Buttons**: see Shared "chrome button" styling below. The home menu's
  own buttons are a heavier version — a fourth, gold ring and brighter
  gilt (`makeMenuFrame`, `--menu-frame`, 12px in) around a two-tone face,
  labels in the logo's outlined monospace, and Play's face in the forge's
  ember red with a slow glow.
- **Signpost**: as before (the live streak sign).

The torches/pages/icons/apprentice/signpost/backdrop are plain inline
`background-image`s set in script.js's bootstrap (the same pattern
Creative Mode uses for its palette icons); the button frames go through
CSS custom properties instead — see Matching the title screen's look on
the rest of the page below for why.

### Shared-link bypass

A valid `?level=` shared link skips the title screen entirely — a friend's
link should drop the player straight into solving, in the room's own
theme, not force them through a menu first. It's handled at the very end
of the bootstrap, after every mode function exists, so `#home-btn` works
the same as everywhere else. A malformed link leaves the title screen up
with `#title-link-error` showing.

## Matching the title screen's look on the rest of the page

Leaving the title screen for Play/Daily Puzzle/Builder Mode used to hand
the player a visually unrelated set of plain gray controls — this section
is what unifies them, plus the way back.

### Returning home (`#home-btn`)

A fixed-position `← Home` button (`position: fixed; top: 16px; left: 16px`
in [style.css](style.css), so it's reachable from every mode regardless of
scroll position) is the reverse of entering the title screen.
`hideTitleScreen()` reveals it; `showTitleScreen()` is its click handler.

### Screens: `hideAllModes()`

Every screen's entry function (`showTitleScreen`, `openThemeSelect`,
`openLevelSelect`, `startCampaignLevel`, `enterCreativeMode`,
`enterDailyHub`, `startDailySolverChallenge`,
`startDailyBuilderChallenge`) starts with `hideAllModes()`: the one place
that stops any running solver session (`stopSolver()` — so keydown
listeners and intervals never stack up), resets every mode's state
(`builderMode`, `currentDailyChallenge`, `currentCampaignId`, the active
builder size/budget, drag state, open confirms), and hides every
mode-specific element. Each entry function then shows only what it
needs, which is what keeps any screen from leaking into another.

### Shared "chrome button" styling (`.pixel-btn`)

`.pixel-btn` is the framed-plate look (see Pixel art above) applied to
every "chrome" button outside the grid — `#home-btn`, `#builder-toggle`,
`#validate-btn`, the six `.daily-mode-btn`s, the win modal's buttons, and
so on (see the `class="pixel-btn"` attributes in [index.html](index.html))
— sharing one CSS rule with `.title-btn` (`.title-btn, .pixel-btn { … }`)
rather than duplicating it. The look is two layers: a bronze trim (dark
outline, a trim lit top/left and shadowed bottom/right, a dark inner
line, a bright stud at each inner corner — the chapter badges' rims and
the cutscene captions' dark boxes, in button form) drawn as a 9-slice
`border-image` (`makeButtonFrame` in sprites.js, 3px slices drawn 9px in
over the padding, with no real border — so the frame never changes a
button's size and stays the same crisp thickness on a button of any
size), around a face that's a plain background (a dark plum with a lit
top band). `.level-plate`s use the same frame and face. (This replaced a
riveted-steel plate image stretched over the whole button with
`background-size: 100% 100%`, whose trim grew chunky on wide buttons and
crowded long labels.) Two things about this rule are load-bearing, not
stylistic:

- **It's a plain class selector, not `button:not(.tile)`.** An earlier
  version of the shared button styling *was* written as
  `button:not(.tile) { … }`, on the reasoning that it's the natural place
  to put "every non-tile button's look". That was a real, silent bug: in
  CSS specificity, `:not()`'s argument counts toward the selector's own
  specificity, so `button:not(.tile)` (`button` + one class) is *more*
  specific than a plain one-class selector like `.title-btn` — and had
  been quietly winning the cascade for every property the two rules both
  set (padding, color, background sizing) the whole time `.title-btn`
  existed, which is why the title screen's buttons were rendering with the
  wrong padding/color/background-repeat despite `.title-btn` explicitly
  declaring the right ones (confirmed via `getComputedStyle` while
  debugging this). A plain class has the same specificity as any other
  plain class, so it can't out-rank one — which matters for the next
  point.
- **A more specific rule must still be able to cleanly override it** —
  `#clear-all-btn`/`#clear-all-confirm-btn`'s own id-level red background
  (a destructive action staying visually distinct) works by simply setting
  `background` (the shorthand, which resets `background-image` to `none`
  along with `background-color`) in a rule with higher specificity than
  `.pixel-btn`'s — an id outranks one class; the red fills the face inside
  the same frame. This is also why `.pixel-btn`'s
  frame reads a CSS custom property (`--plate-frame`,
  set once via `document.documentElement.style.setProperty(...)` in
  script.js's bootstrap) instead of a per-element inline style the way
  every other texture in this app is applied: an inline style always wins
  over any stylesheet rule regardless of specificity, so it could *never*
  be un-overridden this way — see `.daily-mode-btn.completed` just below
  for a case that specifically needs to un-override it. A custom property
  read through a normal (non-inline) declaration doesn't have that
  problem; it's just another value in the ordinary cascade.

`.daily-mode-btn.completed` (see Daily Puzzle below) is the case that
motivated that last point: it needs to change the button's color without
losing the plate texture underneath — a completed challenge is still the
same button, just done, not "a different kind of button". An earlier
version set `background: #2e6b4a` there, which (via the shorthand) replaced
the plate art with a flat color rectangle instead of tinting it — exactly
the "different button model" this was rewritten to avoid. The fix is an
inset box-shadow with a huge spread (`inset 0 0 0 999px rgba(46, 139, 87,
0.55)`) instead: it paints as a translucent wash *above* `.pixel-btn`'s
background but *below* its border-image frame and its text (box-shadow
paints between a box's backgrounds and its border), so the frame and the
label both stay crisp, on a green-tinted face.

`min-width: 130px` and the extra horizontal padding (`14px 22px`, up from
the title screen's own `14px 18px`) on `.title-btn, .pixel-btn` are both
sizing fixes, not aesthetic ones: a short label (Reset, Share, Cancel)
was shrink-wrapping tight enough to look like a noticeably shorter, scrawnier
bar than the title screen's own buttons right after leaving it (min-width
is a floor, not a cap — a longer label still grows past it freely), and
the single longest label in the app ("Back to Daily Puzzle") was reading
as nearly edge-to-edge against the plate art's own drawn bevel/rivets —
which sit visually inset from the button's true CSS box edge, not flush
with it — even though it never technically overflowed the box
(`scrollWidth`/`clientWidth` were equal; confirmed while debugging this).
`.daily-hub-column`'s own `min-width` (170px, up from 140px) exists for
the same reason, scoped to its one particularly tight case: a completed
`.daily-mode-btn`'s label gains a `' ✓'` suffix (see `renderDailyHubUI()`),
and "Medium ✓"/"Builder ✓"-length labels needed the extra margin most.

`button:not(.tile)` itself still exists, but reduced to a bare reset
(`font: inherit; border-style: none; cursor: pointer;`) that deliberately
declares none of the properties `.pixel-btn`/`.title-btn` control, so the
two rules can never re-collide the way the original version did. It's
`border-style`, not the `border` shorthand, because that shorthand also
resets `border-image` — and, out-ranking `.pixel-btn` the way it does,
wiped every button's frame when the frame first moved to `border-image`. The one
button that isn't `.pixel-btn` (`#trash-can`, a `.palette-item`) still
picks up this bare reset underneath its own full look, unaffected.

## Accounts and cloud saves

Optional accounts so progress follows a player across devices, on Firebase
(free "Spark" plan): Firebase Authentication for email + password logins
(it stores passwords hashed; they never touch our code or database) and
Cloud Firestore for profiles and saves. Playing without an account works
exactly as it always has.

### What syncs

Everything the game saves (`readLocalSave()` in
[cloudsave.js](cloudsave.js)): campaign progress (`trapRoomProgress`,
stars included — merging keeps the most stars — and the cutscenes seen,
merged as a union),
Daily Puzzle stats (`trapRoomDailyStats`), every best score
(`trapRoomBestScore:*`) and My Rooms (`trapRoomCreativeRooms`, merged
room by room — see My Rooms), plus the profile icon. A device running an
older version of the game drops `rooms` from the saves it uploads, so
taking the account's copy (on login, or when the tab comes back into
view) merges rooms instead of replacing them (`takeCloudSave`): any this
device still has go back up, and deletes still apply.

Every function that writes one of those (`saveProgress`, `resetProgress`,
`saveDailyStats`, `writeBestScore`) calls `notifySaveChanged()`
([script.js](script.js)); account.js listens via `saveChangeListeners`. After
downloading, account.js calls `refreshProgressViews()` (set by the
bootstrap) to repaint the title sign, world/level select or daily hub,
whichever is up. A download writes storage directly (`writeLocalSave`), not
through those save functions, so it never triggers an upload.

### Firestore data

- `users/{uid}`: `{ username, usernameKey, icon, save, updatedAt }`. `save`
  is the whole save as one JSON string (`serializeSave`: normalized, keys
  sorted, so equal saves give equal strings). A string rather than a map
  because level codes make awkward field names.
- `usernames/{usernameKey}`: `{ uid }`, where the key is the lowercased
  username. Created in the same batch as the profile, and
  [firestore.rules](firestore.rules) only accepts the pair together and
  never an existing name, which is what makes usernames unique
  (case-insensitively). Usernames: 3-16 letters, digits or `_`, permanent.

The rules let a player read, change and delete only their own `users` doc
(changing only `icon`/`save` after creation, with the icon from
`PROFILE_ICONS`'s ids), delete only the `usernames` doc that's theirs,
and let anyone `get` a `usernames` doc to check if a name is taken (it holds
no email). Login is by email; the username is the display name (logging in
by username would mean looking up someone's email from their name).

### Sync rules

`localStorage['trapRoomCloudSync']` = `{ uid, dirty, campaignReset }`: whose
account this device's save belongs to (absent for a guest), whether it has
unuploaded changes, and whether one of them is a campaign reset.

- **Saving:** a change while the save belongs to an account marks it
  dirty and uploads after 1.5s (also on tab hide and on coming back
  online). An upload is a transaction that merges this device's save into
  the account's (`mergeSaves`), so two devices' progress adds up rather
  than the last one overwriting the other; this device then takes on the
  merged result, unless it changed again mid-upload.
- **Merging** (`mergeSaves`): union of beaten levels keeping the best of
  each stat (as `recordLevelComplete` does), fewest moves per best score,
  and for daily stats the streak with the latest `lastStreakDate`, the max
  of each lifetime count, and today's completions combined when both copies
  are from the same day. A pending campaign reset makes this device's
  campaign replace the account's instead of merging, or the reset would be
  undone by the next download.
- **Logging in / page load:** a device with nothing unsynced for this
  account just takes the account's save; one with unsynced changes, or a
  guest's progress, merges in (so progress from before signing up carries
  over). A save belonging to a *different* account is replaced, not merged.
- **Switching back to the tab** re-downloads, to pick up other devices'
  progress (and icon).
- **Logging out** uploads first (and refuses to log out if that fails),
  then clears this device's save, since it lives in the account now.

### UI

`#account-btn` is `#home-btn`'s top-right twin: a square `.pixel-btn`
(`z-index: 120`, above the title screen) showing the profile icon, or the
player sprite when logged out. `#builder-panel-toggle` moved to
`right: 76px` to make room. It opens `#account-modal` (a `.title-modal`,
`z-index: 160`), whose views are `.account-view` forms swapped by
`showView()`. The modal stops keydown propagation so typing never reaches
the game's WASD/arrow handlers.

Profile icons (`PROFILE_ICONS` in [sprites.js](sprites.js)) are nine tiles:
the game's own spike, bomb, portal, goal gem, icicle, snapjaw and mushroom
textures, plus a key and a door drawn for this on the lava floor. Ids are
stored in profiles and listed in firestore.rules, so never rename one.

### Sign-up age check, privacy and deleting an account

Sign-up requires ticking "I'm 13 or older, and I've read the Privacy
Policy" (US COPPA: accounts hold an email, which under-13s can't give
without a parent's consent; playing without an account collects nothing).
[privacy.html](privacy.html) says what's stored and where, and its Contact
line is a placeholder to fill in before the game is ever made public.

"Delete account" in the account panel asks for the password again
(Firebase refuses to delete an account that hasn't logged in recently, and
it stops someone at an unlocked device), stops syncing, deletes the
`users` and `usernames` docs in one batch, then the Firebase Auth user.
This device's save stays, as a guest's.

### Password reset

"Forgot password?" calls `sendPasswordResetEmail`; Firebase sends the email
itself (free, no email service needed). With email-enumeration protection
(on by default) it succeeds whether or not the email has an account, so the
message says "if an account uses…". The email's link goes to Firebase's own
reset page unless the template's action URL (Authentication → Templates →
Password reset → Customize action URL) is set to the game's URL; then the
game opens with `?mode=resetPassword&oobCode=…`, and account.js shows its
own New Password screen, strips the code from the address bar, and logs the
player in after the change.

## Hosting

The game is deliberately **not** on the public internet: it's played on
the home network only. `Play at Home.command` (double-click it in Finder)
serves the folder on port 8080 to every device on the Wi-Fi, at
`http://<Mac name>.local:8080` or the Mac's IP (both printed in its
window). It's a tiny Python server that refuses dotfiles/folders (`.git`,
`.claude`), `.md`, `.rules` and `.command` files, sends `Cache-Control:
no-cache` so devices pick up edits, and runs under `caffeinate -i` so the
Mac doesn't idle-sleep mid-game. The Mac must be on with that window open.

Firebase email/password logins work from any address (Firebase's
"authorized domains" only matter for OAuth sign-in and custom email-link
URLs), so nothing in Firebase needed changing for this. Each address
(`localhost`, the IP, the `.local` name) is its own browser origin with
its own localStorage, which is fine: logging in pulls the account's save.
Password-reset links open Firebase's own reset page, since a home-only URL
wouldn't work from an email opened elsewhere.

The code is backed up in a private GitHub repository (no GitHub Pages:
Pages sites are public).

## Not yet implemented (future sessions)

- Saving Daily Puzzle builder rooms — only the pass/fail *result* of a
  submission is persisted, never the room itself (Creative Mode rooms save
  to My Rooms)
- Playing a saved room straight from My Rooms (today: Share it and open
  the link)
- A way to open a shared `?level=` room in Creative Mode (to remix it)
  — today a shared link can only be played
