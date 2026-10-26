'use strict';

// Campaign levels, their unlock rules, and saved progress. Loaded after
// script.js (it uses tile rules like tileFamily and THEMES from there).
//
// Levels are written as readable maps: one string per row, one
// space-separated token per tile (see LEVEL_TOKENS). Every level is square,
// and tests.js checks each one with solveBFS, so an unsolvable level can
// never ship.

const LEVEL_TOKENS = {
  '#': 'wall', '.': 'empty', S: 'start', G: 'goal',
  '^': 'spike', t: 'timedspike', h: 'hiddenspike',
  'o^': 'oneway-up', 'o>': 'oneway-right', ov: 'oneway-down', 'o<': 'oneway-left',
  'T^': 'turret-up', 'T>': 'turret-right', Tv: 'turret-down', 'T<': 'turret-left',
  'V^': 'vent-up', 'V>': 'vent-right', Vv: 'vent-down', 'V<': 'vent-left',
  'C^': 'current-up', 'C>': 'current-right', Cv: 'current-down', 'C<': 'current-left',
  'I-': 'imp-h', 'I|': 'imp-v', 'B-': 'boar-h', 'B|': 'boar-v',
  b: 'bomb', i: 'ice', pa: 'portal-a', pb: 'portal-b',
  '=': 'thinice', '*': 'frost', '!': 'icicle', '%': 'vines', m: 'mushroom', J: 'snapjaw',
  L: 'lever',
  X: 'crusher', P: 'plate', g: 'gate', '@': 'ghost',
};

// Turns a map (array of row strings) into a level object. Throws on an
// unknown token or a non-square map, so a typo fails loudly in tests.js.
function parseLevelMap(rows, theme) {
  const size = rows.length;
  const level = createEmptyLevel(size);
  level.theme = theme;
  rows.forEach((row, y) => {
    const tokens = row.trim().split(/\s+/);
    if (tokens.length !== size) throw new Error(`row ${y} has ${tokens.length} tiles, expected ${size}`);
    tokens.forEach((token, x) => {
      const type = LEVEL_TOKENS[token];
      if (!type) throw new Error(`unknown map token "${token}" at ${x},${y}`);
      setTileType(level, x, y, type);
    });
  });
  return level;
}

// id, theme, name, a one-line idea (shown on the level card), the map, and
// an optional timeLimit in seconds (a timed room: reach the goal before the
// clock runs out, or the room restarts).
const CAMPAIGN_LEVELS = [
  // --- Lava: Volcanic Depths ---------------------------------------------
  {
    id: 'lava-01', theme: 'lava', name: 'First Steps',
    idea: 'Find the safe way through a short maze of spikes.',
    map: [
      '#  #  #  #  #  #',
      '#  S  .  ^  G  #',
      '#  #  .  #  .  #',
      '#  ^  .  .  .  #',
      '#  .  .  ^  #  #',
      '#  #  #  #  #  #',
    ],
  },
  {
    id: 'lava-02', theme: 'lava', name: 'Cooling Off',
    idea: 'Wait on the rock for each row of spikes to cool, then cross.',
    map: [
      '#  #  #  #  #  #',
      '#  S  t  .  t  #',
      '#  #  #  #  .  #',
      '#  .  t  .  t  #',
      '#  G  #  #  #  #',
      '#  #  #  #  #  #',
    ],
  },
  {
    id: 'lava-03', theme: 'lava', name: 'No Turning Back',
    idea: 'One-way runes decide the long way round.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  .  .  .  .  #',
      '#  .  #  #  #  .  #',
      '#  o^ #  G  #  ov #',
      '#  .  #  o^ #  .  #',
      '#  .  ^  .  .  .  #',
      '#  #  #  #  #  #  #',
    ],
  },
  {
    id: 'lava-04', theme: 'lava', name: 'Glassfloor',
    idea: 'Aim your slides so they glance off the walls onto the gem.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  #  i  i  i  #',
      '#  i  i  .  i  i  #',
      '#  .  i  ^  i  i  #',
      '#  i  i  #  ^  .  #',
      '#  .  .  ^  i  G  #',
      '#  #  #  #  #  #  #',
    ],
  },
  {
    id: 'lava-05', theme: 'lava', name: 'Undertow', timeLimit: 15,
    idea: 'Timed room: only one lava current carries you to the portal. Read them fast.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  .  #',
      '#  #  Cv Cv Cv Cv #  #',
      '#  #  C> Cv C< Cv #  #',
      '#  #  Cv Cv Cv C< #  #',
      '#  #  ^  ^  pa ^  #  #',
      '#  pa .  .  G  #  #  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'lava-06', theme: 'lava', name: 'Crossfire',
    idea: 'Walk with the fireballs, never against them. The obvious gaps hide spikes.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  #  .  .  .  #',
      'T> .  .  .  .  .  .  #',
      '#  #  #  h  #  .  #  #',
      '#  .  .  .  .  .  .  T<',
      '#  .  #  #  #  #  h  #',
      'T> .  .  .  .  .  .  #',
      '#  #  #  G  #  #  #  #',
    ],
  },
  {
    id: 'lava-07', theme: 'lava', name: 'Ember Hall',
    idea: 'Duck into the alcove to let the imp pass, then slip between vent eruptions.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  .  .  #',
      '#  #  #  #  #  #  #  .  #',
      '#  .  .  .  .  I- .  .  #',
      '#  .  #  .  #  #  #  #  #',
      '#  .  #  #  #  #  #  #  #',
      '#  .  .  Vv .  Vv .  .  #',
      '#  #  #  #  #  #  #  .  #',
      '#  G  .  V^ .  V^ .  .  #',
    ],
  },
  {
    id: 'lava-08', theme: 'lava', name: 'Short Fuse',
    idea: 'Light the bomb chain at the right moment — the spike gate after it will not wait.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  .  .  #',
      '#  #  #  #  #  #  #  .  #',
      '#  .  t  .  b  b  b  b  #',
      '#  .  #  #  #  #  #  #  #',
      '#  .  .  .  .  .  .  .  #',
      '#  #  h  #  #  #  #  .  #',
      '#  .  .  .  .  .  .  .  T<',
      '#  G  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'lava-09', theme: 'lava', name: 'Caldera',
    idea: 'Slide into the current, ride it to the portal, and dodge the imp — all under turret fire.',
    map: [
      '#  #  #  #  Tv #  #  #  #',
      '#  S  .  .  .  .  .  .  #',
      '#  #  #  #  .  #  #  .  #',
      '#  .  i  i  i  i  i  .  #',
      '#  .  #  #  #  #  #  #  #',
      '#  .  C> C> C> C> pa #  #',
      '#  #  #  .  #  #  #  #  #',
      '#  pa .  .  .  I- .  .  #',
      '#  #  #  #  #  #  #  G  #',
    ],
  },
  {
    id: 'lava-10', theme: 'lava', name: 'Heart of the Mountain',
    idea: 'Every trap in the mountain, in one room.',
    map: [
      '#  #  #  #  #  Tv #  #  #  #',
      '#  S  .  .  .  .  .  .  .  #',
      '#  #  #  #  #  .  #  #  t  #',
      '#  .  b  b  .  .  .  .  .  #',
      '#  .  #  #  V^ #  #  #  #  #',
      '#  .  i  i  i  i  i  i  .  #',
      '#  #  #  #  #  #  #  .  Cv #',
      '#  .  .  .  h  .  .  .  .  T<',
      '#  .  #  .  #  #  .  #  #  #',
      '#  G  #  .  .  I- .  .  .  #',
    ],
  },
  // Levels 11-12 of each world are its lever rooms and its hardest: long
  // routes where levers meet one-ways, thin ice and bombs you can't undo.
  {
    id: 'lava-11', theme: 'lava', name: 'Switchback',
    idea: 'One-way runes and two bombs guard three levers, and most wrong turns can\'t be undone. Every lever must be on when you reach the gem.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  #  .  .  .  #  #',
      '#  .  .  t  o^ .  o< #',
      '#  #  #  C^ #  ov b  #',
      '#  L  #  .  .  ov .  #',
      '#  .  .  #  L  #  b  #',
      '#  #  C< L  .  o^ G  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'lava-12', theme: 'lava', name: 'Powder Keg',
    idea: 'The mountain\'s hardest room: four levers behind one-way runes, ice and a chain of bombs. Plan the whole route before you move.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  #  b  L  #  .  L  #',
      '#  ov .  .  #  #  .  #  #',
      '#  b  .  #  .  o< .  L  #',
      '#  ov o> i  .  i  o^ #  #',
      '#  .  o> C< .  ^  .  .  #',
      '#  b  .  ^  Cv .  i  .  #',
      '#  .  b  L  o^ .  .  G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },

  // --- Ice: Frozen Caverns -------------------------------------------------
  {
    id: 'ice-01', theme: 'ice', name: 'Frozen Threshold',
    idea: 'Slick ice again — aim each slide so it stops where you need it.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  i  i  i  i  #',
      '#  i  i  ^  i  i  #',
      '#  ^  .  .  .  .  #',
      '#  #  i  ^  ^  ^  #',
      '#  .  i  i  .  G  #',
      '#  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-02', theme: 'ice', name: 'Cracking Up',
    idea: 'The crystal is right there. Loop round the lake without stepping on the same ice twice.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  =  #  =  =  #',
      '#  =  =  =  ^  #  #',
      '#  ^  =  =  =  .  #',
      '#  G  #  =  =  =  #',
      '#  =  =  .  =  ^  #',
      '#  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-03', theme: 'ice', name: "Don't Stop",
    idea: 'Frostbite everywhere — only the snow is safe to wait on.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  *  *  t  .  #',
      '#  #  #  #  #  *  #',
      '#  .  t  *  *  *  #',
      '#  *  #  #  #  #  #',
      '#  *  *  t  *  G  #',
      '#  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-04', theme: 'ice', name: 'One-Way Glide',
    idea: 'Slides stop dead on thin ice, and stepping off breaks it. Choose the order.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  #  =  =  G  #',
      '#  .  #  .  i  i  #',
      '#  i  i  i  =  i  #',
      '#  i  =  #  #  =  #',
      '#  =  =  #  =  .  #',
      '#  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-05', theme: 'ice', name: 'Snowblind', timeLimit: 25,
    idea: 'Timed room: aurora portals over buried spikes. Spikes you find stay found.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  .  #  .  .  #',
      '#  .  h  .  #  pb h  #',
      '#  .  h  pa #  .  G  #',
      '#  #  #  #  #  #  #  #',
      '#  pa .  h  .  #  #  #',
      '#  .  .  .  pb #  #  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-06', theme: 'ice', name: 'Icefall',
    idea: 'Knock the icicle down on purpose — the fallen ice is the stopper your slide needs.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  .  #',
      '#  .  #  #  #  #  .  #',
      '#  .  i  i  i  !  i  #',
      '#  .  #  #  G  #  .  #',
      '#  .  ^  #  ^  #  .  #',
      '#  .  .  .  .  .  .  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-07', theme: 'ice', name: 'Cannon Ridge',
    idea: 'You can never walk against the shots — unless an icicle falls into their path.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  .  #  .  G  #',
      '#  .  #  #  .  #  #',
      'T> .  !  ^  .  .  #',
      '#  #  .  #  #  .  #',
      '#  .  .  *  *  .  #',
      '#  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-08', theme: 'ice', name: 'Whiteout',
    idea: 'Thin ice, frostbite, cannons and frosted arrows, all at once.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  =  =  =  .  .  #',
      '#  #  #  =  #  =  #  o> #',
      'T> .  *  =  =  =  *  .  #',
      '#  ov #  #  #  #  #  ov #',
      '#  .  i  i  i  i  i  .  #',
      '#  =  #  #  t  #  #  #  #',
      '#  .  =  =  .  *  *  G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-09', theme: 'ice', name: 'Crevasse',
    idea: 'A thin-ice maze: slides stop on it, leaving breaks it, and most moves leave you stranded.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  i  i  i  i  i  =  #',
      '#  i  =  i  .  =  #  i  #',
      '#  i  =  .  #  =  i  #  #',
      '#  #  i  i  #  =  i  =  #',
      '#  =  i  =  i  i  ^  .  #',
      '#  #  #  i  =  i  .  =  #',
      '#  i  =  =  i  ^  i  G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-10', theme: 'ice', name: 'Heart of the Glacier',
    idea: 'Every trap of the frozen caverns, in one room.',
    map: [
      '#  #  #  #  #  #  #  #  #  #',
      '#  S  .  #  .  .  =  =  .  #',
      '#  .  #  #  .  #  =  ^  =  #',
      'T> .  !  ^  .  .  #  =  =  #',
      '#  #  .  #  #  .  #  #  ov #',
      '#  .  .  *  *  .  #  .  .  #',
      '#  #  #  #  #  #  #  i  #  #',
      '#  .  .  .  t  .  i  i  i  T<',
      '#  .  h  #  .  pb #  #  pb #',
      '#  .  .  G  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-11', theme: 'ice', name: 'Brittle Switches',
    idea: 'Three levers across thin ice that holds you once. Find the one loop that leaves every lever on.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  .  #  #  #  #',
      '#  L  #  =  o^ *  L  #',
      '#  i  L  #  .  =  .  #',
      '#  i  =  i  #  #  .  #',
      '#  .  #  .  .  .  =  #',
      '#  .  .  .  #  =  G  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'ice-12', theme: 'ice', name: 'Cold Circuit',
    idea: 'The glacier\'s last lock: four levers, thin ice, slides and frosted arrows. Nearly every misstep strands you.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  o< L  #',
      '#  .  .  #  =  .  =  .  #',
      '#  .  #  ov i  .  .  #  #',
      '#  =  L  #  .  #  .  .  #',
      '#  L  =  i  #  .  o< .  #',
      '#  i  =  .  .  =  i  o> #',
      '#  i  #  .  L  #  #  G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },

  // --- Grass: Overgrown Ruins ----------------------------------------------
  {
    id: 'grass-01', theme: 'grass', name: 'Overgrowth',
    idea: 'Pick a path through the thorns, and wait out the snapping ones.',
    map: [
      '#  #  #  #  #  #',
      '#  S  .  ^  .  #',
      '#  ^  .  t  .  #',
      '#  .  t  ^  .  #',
      '#  .  .  t  G  #',
      '#  #  #  #  #  #',
    ],
  },
  {
    id: 'grass-02', theme: 'grass', name: 'Tangled',
    idea: 'Vines hold you for two beats — time the grab so the thorns are down when they let go.',
    map: [
      '#  #  #  #  #  #',
      '#  S  %  t  .  #',
      '#  #  #  #  t  #',
      '#  .  t  %  .  #',
      '#  G  #  #  #  #',
      '#  #  #  #  #  #',
    ],
  },
  {
    id: 'grass-03', theme: 'grass', name: 'Bounce House',
    idea: 'Mushroom pads launch you clean over the thorns. Some launch you into them.',
    map: [
      '#  #  #  #  #  #  #',
      '#  S  m  ^  .  .  #',
      '#  #  #  #  m  #  #',
      '#  .  .  .  ^  ^  #',
      '#  .  ^  m  .  m  #',
      '#  .  #  ^  #  ^  #',
      '#  #  #  G  #  .  #',
    ],
  },
  {
    id: 'grass-04', theme: 'grass', name: 'Downstream',
    idea: 'The river goes round and round. Vines stop you; the mushroom is the way onto the island.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  .  #',
      '#  Cv C< C< C< C< C< #',
      '#  Cv #  #  #  #  C^ #',
      '#  t  #  G  ^  m  C< #',
      '#  Cv #  #  #  #  C^ #',
      '#  C> C> C> %  C> C^ #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'grass-05', theme: 'grass', name: 'Snapjaw Garden', timeLimit: 28,
    idea: 'Timed room: slip past the flytraps between bites.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  .  .  #  .  #',
      '#  #  J  #  .  J  .  #',
      '#  .  .  .  .  .  .  #',
      '#  .  #  J  #  #  J  #',
      '#  .  .  .  .  .  .  #',
      '#  J  #  #  J  #  G  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'grass-06', theme: 'grass', name: 'Fairy Circle',
    idea: 'Hop between fairy rings — the shortest way always hides a pit.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  .  #  .  .  .  #',
      '#  .  h  #  pb h  .  #',
      '#  .  pa #  .  #  G  #',
      '#  #  #  #  #  #  #  #',
      '#  pa .  h  .  #  #  #',
      '#  .  .  .  pb #  #  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'grass-07', theme: 'grass', name: 'Stampede',
    idea: 'Cross the boar lanes one at a time, between charges.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  .  #  #  #  #  #',
      '#  #  #  .  #  #  #  #  #',
      '#  B- .  .  .  .  .  .  #',
      '#  #  #  .  .  .  #  #  #',
      '#  .  .  .  B- .  .  .  #',
      '#  #  #  #  #  .  .  .  #',
      '#  .  .  .  .  .  B- .  #',
      '#  #  #  #  #  #  #  G  #',
    ],
  },
  {
    id: 'grass-08', theme: 'grass', name: 'The Old Temple',
    idea: 'Everything the ruins have thrown at you, through carved vine arrows.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  %  t  .  .  .  #',
      '#  #  #  #  #  J  #  ov #',
      '#  .  .  ^  m  .  .  .  #',
      '#  ov #  #  #  #  #  #  #',
      '#  .  .  .  B- .  .  .  #',
      '#  .  #  #  #  #  #  pa #',
      '#  C> C> C> C> pa #  .  #',
      '#  #  #  #  #  #  #  G  #',
    ],
  },
  {
    id: 'grass-09', theme: 'grass', name: 'Jungle Canopy',
    idea: 'Only vines near the end of a boar run let go in time. Pick your crossings.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  .  .  #',
      '#  #  #  .  #  #  #  .  #',
      '#  B- .  %  .  .  .  %  #',
      '#  #  .  .  .  .  .  .  #',
      '#  .  %  .  %  B- .  .  #',
      '#  #  .  #  .  #  #  #  #',
      '#  .  %  .  %  .  .  B- #',
      '#  #  G  #  .  #  #  #  #',
    ],
  },
  {
    id: 'grass-10', theme: 'grass', name: 'Heart of the Grove',
    idea: 'Every trap of the overgrown ruins, in one room.',
    map: [
      '#  #  #  #  #  #  #  #  #  #',
      '#  S  .  %  t  .  m  ^  .  #',
      '#  #  #  #  #  J  #  #  .  #',
      '#  .  .  .  .  .  .  .  .  #',
      '#  .  #  #  #  #  #  #  #  #',
      '#  .  .  .  B- .  .  .  .  #',
      '#  .  .  .  .  #  #  #  #  #',
      '#  .  .  h  .  .  %  .  .  #',
      '#  #  #  #  #  #  #  #  Cv #',
      '#  G  pa #  #  #  #  #  pa #',
    ],
  },
  {
    id: 'grass-11', theme: 'grass', name: 'Leapfrog Levers',
    idea: 'Mushrooms hop you over tiles and vine arrows only let you one way. Reach all three levers without cutting yourself off.',
    map: [
      '#  #  #  #  #  #  #  #',
      '#  S  #  #  %  #  m  #',
      '#  .  .  .  o> .  #  #',
      '#  o> o> m  ov m  L  #',
      '#  L  .  #  .  o^ L  #',
      '#  Cv .  m  .  #  ^  #',
      '#  %  #  %  Cv .  G  #',
      '#  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'grass-12', theme: 'grass', name: 'Switchyard',
    idea: 'The ruins\' final maze: four levers, streams and one-way vines. The long way round is the only way round.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  o< .  .  .  .  #  #',
      '#  .  #  .  L  #  o< C^ #',
      '#  ov .  o< #  .  .  .  #',
      '#  L  o> L  C> C^ .  #  #',
      '#  #  Cv #  .  .  .  #  #',
      '#  .  %  #  .  #  .  .  #',
      '#  o< .  #  .  L  o< G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },

  // --- Castle: Abandoned Castle (the bonus world) ---------------------------
  // Opens only once every level of the other three is beaten, and gets
  // harder every level: the par rises each time, and The Last Lock has the
  // longest par in the game.
  {
    id: 'castle-01', theme: 'castle', name: 'Gatehouse',
    idea: 'Crushers drop across every passage. Wait for each to lift, then run — two in a row is all one lift allows.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  #  X  #  .  .  X  #',
      '#  .  #  X  #  .  #  X  #',
      '#  t  #  .  o^ .  #  .  #',
      '#  .  #  #  .  #  #  X  #',
      '#  .  #  .  X  .  #  .  #',
      '#  t  #  .  #  .  #  .  #',
      '#  .  X  .  #  o> .  G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-02', theme: 'castle', name: 'Portcullis',
    idea: 'Every plate flips every portcullis. Press them in the order that leaves the right gates open.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  .  .  .  .  t  .  #',
      '#  #  #  #  #  P  #  .  #',
      '#  g  #  .  .  ^  #  .  #',
      '#  .  #  o^ #  g  P  g  #',
      '#  .  .  .  .  .  .  .  #',
      '#  .  #  #  #  #  #  #  #',
      '#  .  X  .  .  X  X  G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-03', theme: 'castle', name: 'Rotten Floorboards',
    idea: 'The boards give way behind you, and one plate decides which gates you meet. Most routes strand you.',
    map: [
      '#  #  #  #  #  #  #  #  #',
      '#  S  #  .  .  .  .  .  #',
      '#  .  #  =  #  #  #  g  #',
      '#  ov .  .  #  .  .  .  #',
      '#  .  #  .  #  o> =  g  #',
      '#  =  ^  X  .  =  #  .  #',
      '#  .  #  #  #  .  #  .  #',
      '#  .  P  .  .  .  #  G  #',
      '#  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-04', theme: 'castle', name: 'Arrow Slits',
    idea: 'Crossbows sweep the halls while crushers and floorboards box you in.',
    map: [
      '#  #  #  #  #  Tv #  #  #  #  #',
      '#  S  .  =  .  .  .  .  #  .  #',
      '#  #  .  #  #  #  #  g  .  o^ #',
      '#  .  .  =  t  .  #  X  #  .  #',
      '#  .  #  g  #  #  #  X  #  .  #',
      '#  .  #  X  .  .  #  =  #  .  #',
      '#  .  #  #  #  .  #  .  X  .  #',
      '#  .  .  .  #  .  #  .  .  .  T<',
      '#  #  =  =  #  .  #  X  #  .  #',
      '#  .  .  P  #  .  o> t  .  G  #',
      '#  #  #  #  #  #  #  #  #  T^ #',
    ],
  },
  {
    id: 'castle-05', theme: 'castle', name: 'The Haunting',
    idea: 'A ghost drifts through the walls after you, a tile every other beat. Only the start and the gem are safe from it.',
    map: [
      '#  #  #  #  #  #  #  #  #  #  #',
      '#  S  #  =  .  .  .  =  g  .  #',
      '#  .  #  X  #  .  #  .  #  .  #',
      '#  t  g  .  .  .  #  .  #  X  #',
      '#  .  #  t  #  #  #  .  #  .  #',
      '#  .  #  .  .  .  .  .  #  .  #',
      '#  X  #  .  #  #  #  #  #  .  #',
      '#  .  #  .  =  .  #  @  X  =  T<',
      '#  .  #  .  #  P  #  #  #  X  #',
      '#  .  .  .  .  .  ov o> =  G  #',
      '#  #  #  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-06', theme: 'castle', name: 'Powder Store', timeLimit: 39,
    idea: 'Timed room: powder barrels line the only road out. Light them, outrun the blasts, and beat the clock.',
    map: [
      '#  #  #  #  #  #  #  #  #  #  #',
      '#  S  .  t  #  .  .  =  o> .  #',
      '#  #  #  =  #  .  #  .  #  .  #',
      '#  .  .  .  .  .  .  ^  #  .  #',
      '#  .  .  #  #  #  #  #  #  b  #',
      '#  .  .  .  g  .  .  b  #  .  #',
      '#  P  #  #  #  #  #  #  #  .  #',
      '#  .  t  .  o< .  .  .  o< X  #',
      'T> .  #  #  .  #  #  #  #  #  #',
      '#  o< .  .  b  X  =  g  .  G  #',
      '#  #  #  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-07', theme: 'castle', name: 'Hall of Mirrors',
    idea: 'Magic mirrors throw the ghost off your trail — but the boards behind you only hold once.',
    map: [
      '#  #  #  #  #  #  #  #  #  #  #',
      '#  S  #  =  t  =  =  ^  .  .  #',
      '#  .  #  .  #  #  #  #  #  .  #',
      '#  .  .  .  #  .  ^  .  #  X  #',
      '#  #  #  .  =  .  #  .  #  pa #',
      '#  X  .  .  .  .  #  @  #  =  #',
      '#  t  #  .  #  #  #  #  #  .  #',
      '#  .  #  g  .  P  .  .  .  .  #',
      '#  .  #  #  #  #  #  #  #  #  #',
      '#  X  .  pa .  .  g  =  .  G  #',
      '#  #  #  #  #  T^ #  #  #  #  #',
    ],
  },
  {
    id: 'castle-08', theme: 'castle', name: 'Throne Room',
    idea: 'Every castle trap so far on one long road to the throne — and a trapdoor where you least want one.',
    map: [
      '#  #  #  #  #  #  #  #  #  #  #',
      '#  S  #  .  .  @  .  .  b  .  #',
      '#  .  #  .  #  #  #  #  #  .  #',
      'T> .  #  .  .  .  .  .  #  .  #',
      '#  .  #  #  .  #  #  .  #  .  #',
      '#  ov #  X  .  h  =  P  #  pa #',
      '#  .  #  .  #  #  #  #  #  .  #',
      '#  .  #  o^ g  =  .  =  #  g  #',
      '#  X  #  #  #  #  #  g  P  .  T<',
      '#  pa .  .  X  .  .  b  #  G  #',
      '#  #  #  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-09', theme: 'castle', name: 'The Oubliette', timeLimit: 57,
    idea: 'Timed room: the ghost, the floorboards and the crushers, with dead ends everywhere and no time to back out of them.',
    map: [
      '#  #  #  #  #  #  Tv #  #  #  #',
      '#  S  #  .  .  .  =  =  =  .  #',
      '#  .  #  #  #  #  #  #  #  .  #',
      '#  .  .  .  =  .  =  .  g  .  #',
      '#  #  #  .  #  .  #  g  #  b  #',
      '#  @  #  .  =  .  #  P  .  X  #',
      '#  .  #  X  #  #  #  .  #  #  #',
      '#  =  P  b  #  .  .  g  #  .  #',
      'T> =  #  #  #  .  #  #  #  .  #',
      '#  o> .  .  X  =  .  .  .  G  #',
      '#  #  #  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-10', theme: 'castle', name: 'Heart of the Castle',
    idea: 'Every trap in the castle, in one room. The ghost starts close.',
    map: [
      '#  #  #  #  #  #  #  #  #  #  #',
      '#  S  .  .  #  .  X  .  ov t  #',
      '#  #  #  =  #  .  #  #  .  b  #',
      '#  @  #  .  #  .  #  .  h  o> T<',
      '#  g  #  .  #  #  #  .  #  .  #',
      '#  .  #  .  #  g  .  .  #  pa #',
      '#  .  .  .  #  .  #  #  #  .  #',
      '#  .  #  X  .  P  #  .  o< pa #',
      'T> g  #  #  #  #  #  .  #  #  #',
      '#  P  b  .  =  =  g  .  .  G  #',
      '#  #  #  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-11', theme: 'castle', name: 'Lever Tower',
    idea: "Three castle levers at the ends of the tower's halls — and plates that keep resealing the gates between them. Every lever must be on when you reach the gem.",
    map: [
      '#  #  #  #  #  #  #  #  Tv #  #',
      '#  S  .  =  .  =  #  =  .  o< #',
      '#  #  #  #  #  .  #  t  #  .  #',
      '#  .  .  .  #  .  #  P  X  .  #',
      '#  .  .  .  #  t  #  .  #  g  #',
      '#  .  #  L  #  =  #  .  #  L  #',
      '#  .  #  #  #  .  #  g  #  #  #',
      '#  .  .  P  #  .  #  .  .  .  #',
      '#  .  #  .  .  .  #  #  .  .  #',
      '#  L  #  =  .  =  g  .  .  G  #',
      '#  #  #  #  #  #  #  #  #  #  #',
    ],
  },
  {
    id: 'castle-12', theme: 'castle', name: 'The Last Lock',
    idea: 'The hardest room in the game: four levers, two plates, the ghost, a crusher and rotten boards. Plan the whole route before you move.',
    map: [
      '#  #  #  Tv #  #  #  #  #  #  #',
      '#  S  #  @  .  .  .  .  X  L  #',
      '#  .  #  #  #  .  #  .  #  #  #',
      '#  .  =  .  #  L  #  .  .  P  #',
      '#  #  #  .  #  #  #  #  #  .  #',
      '#  L  #  .  .  .  .  .  #  t  #',
      '#  t  #  #  #  #  #  .  #  .  #',
      '#  .  .  .  .  g  #  .  .  .  #',
      'T> .  #  #  #  .  #  .  #  .  #',
      '#  P  g  L  #  .  g  .  .  G  #',
      '#  #  #  #  #  #  #  #  #  #  #',
    ],
  },
];

const LEVELS_PER_THEME = 12;
// How many of a theme's levels unlock the next theme. Levels are played in
// order, so in practice this means beating levels 1-8; 9-12 (the lever
// rooms, 11 and 12, are the hardest of all) don't gate anything.
const UNLOCK_REQUIREMENT = 8;

function themeLevels(theme) {
  return CAMPAIGN_LEVELS.filter((def) => def.theme === theme);
}

function levelDef(id) {
  return CAMPAIGN_LEVELS.find((def) => def.id === id) || null;
}

// A fresh, playable level object for a campaign level (a new object every
// call, so nothing can mutate the source data).
function campaignLevel(id) {
  const def = levelDef(id);
  const level = parseLevelMap(def.map, def.theme);
  if (def.timeLimit) level.timeLimit = def.timeLimit;
  return level;
}

// A campaign level's par (the fewest moves that beat it — see parMoves),
// worked out once per session and remembered, since the maps never change.
const campaignParCache = new Map();

function campaignPar(id) {
  if (!campaignParCache.has(id)) campaignParCache.set(id, parMoves(campaignLevel(id)));
  return campaignParCache.get(id);
}

// Tile types that stand for "a trap" when deciding what's new in a level:
// one representative per family, so four one-way arrows or two portal
// colors count as one trap.
function introKeyFor(type) {
  if (['empty', 'wall', 'start', 'goal'].includes(type)) return null;
  return tileFamily(type);
}

// The traps (as one representative tile type each, in map order) that
// appear in this level but in no earlier level of the same theme — what the
// "New trap" card shows before the level starts.
function levelIntroductions(id) {
  const def = levelDef(id);
  const seen = new Set();
  for (const earlier of themeLevels(def.theme)) {
    if (earlier.id === id) break;
    campaignLevel(earlier.id).tiles.forEach((type) => seen.add(introKeyFor(type)));
  }
  const fresh = [];
  const freshKeys = new Set();
  campaignLevel(id).tiles.forEach((type) => {
    const key = introKeyFor(type);
    if (!key || seen.has(key) || freshKeys.has(key)) return;
    freshKeys.add(key);
    fresh.push(type);
  });
  return fresh;
}

// --- Progress (localStorage) ------------------------------------------------
//
// { version: 1, levels: { 'lava-01': { moves, timeMs, deaths, stars }, ... } }
// — a level is completed once it has an entry; the entry keeps the best
// moves, best time, fewest deaths and most stars (1-3, see starsFor) seen.
// `stars` is missing from wins recorded before star ratings existed. Keyed by level id, never by position,
// so levels can be reordered later without corrupting anyone's save.
// Daily Puzzle, Creative Mode and shared links never touch this.

const PROGRESS_KEY = 'trapRoomProgress';

// `story` lists the cutscenes the player has seen (ids from STORY_SCENES in
// story.js), so each plays by itself only once.
function defaultProgress() {
  return { version: 1, levels: {}, story: [] };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return defaultProgress();
    return normalizeProgress(JSON.parse(raw));
  } catch (e) {
    return defaultProgress();
  }
}

// For progress from any source (localStorage, or a cloud save — see
// cloudsave.js).
function normalizeProgress(parsed) {
  const levels = parsed && typeof parsed.levels === 'object' && parsed.levels ? parsed.levels : {};
  return { version: 1, levels, story: normalizeStorySeen(parsed && parsed.story) };
}

// A sorted list of unique scene ids, so two equal saves serialize the same.
function normalizeStorySeen(story) {
  if (!Array.isArray(story)) return [];
  return [...new Set(story.filter((id) => typeof id === 'string' && id))].sort();
}

function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    // best-effort persistence, same as best scores and daily stats
  }
  notifySaveChanged();
}

function resetProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch (e) {
    // nothing saved to clear
  }
  // A reset must replace the cloud copy, not be merged back into it.
  notifySaveChanged({ campaignReset: true });
}

// The better (lower) of two stats, where null is a stat never recorded.
function bestStat(a, b) {
  if (a === null || a === undefined) return b;
  if (b === null || b === undefined) return a;
  return Math.min(a, b);
}

// Records a win, keeping the best of each stat. Returns the saved progress.
function recordLevelComplete(id, { moves, timeMs, deaths, stars = null }) {
  const progress = loadProgress();
  const prev = progress.levels[id];
  const record = prev
    ? { moves: bestStat(prev.moves, moves), timeMs: bestStat(prev.timeMs, timeMs), deaths: bestStat(prev.deaths, deaths) }
    : { moves, timeMs, deaths };
  const bestStars = Math.max(stars || 0, (prev && prev.stars) || 0);
  if (bestStars) record.stars = bestStars;
  progress.levels[id] = record;
  saveProgress(progress);
  return progress;
}

// A level's best star rating (0 if never beaten, or beaten before star
// ratings existed without a replay since).
function levelStars(progress, id) {
  const record = progress.levels[id];
  return (record && record.stars) || 0;
}

// Stars earned across a theme's levels, out of 3 per level.
function themeStars(progress, theme) {
  return themeLevels(theme).reduce((sum, def) => sum + levelStars(progress, def.id), 0);
}

function isLevelCompleted(progress, id) {
  return !!progress.levels[id];
}

function completedCount(progress, theme) {
  return themeLevels(theme).filter((def) => isLevelCompleted(progress, def.id)).length;
}

// The theme whose levels unlock this one in the main chain (null for lava,
// always open, and for a bonus world, which has its own rule).
function previousTheme(theme) {
  if (BONUS_THEMES.includes(theme)) return null;
  const i = MAIN_THEMES.indexOf(theme);
  return i > 0 ? MAIN_THEMES[i - 1] : null;
}

// The next world in the main chain after this one, or null.
function nextMainTheme(theme) {
  const i = MAIN_THEMES.indexOf(theme);
  return i >= 0 && i < MAIN_THEMES.length - 1 ? MAIN_THEMES[i + 1] : null;
}

// Progress toward a bonus world: every level of every main world, beaten.
// Counts whatever levels those worlds hold, so adding levels later keeps
// the rule honest.
function bonusProgress(progress) {
  const total = MAIN_THEMES.reduce((sum, t) => sum + themeLevels(t).length, 0);
  const done = MAIN_THEMES.reduce((sum, t) => sum + completedCount(progress, t), 0);
  return { done, total };
}

// Main worlds: lava is always open; each other opens once
// UNLOCK_REQUIREMENT levels of the one before are beaten. The bonus world
// (the castle) opens once every main-world level is beaten.
function isThemeUnlocked(progress, theme) {
  if (BONUS_THEMES.includes(theme)) {
    const { done, total } = bonusProgress(progress);
    return done >= total;
  }
  const prev = previousTheme(theme);
  return !prev || completedCount(progress, prev) >= UNLOCK_REQUIREMENT;
}

// Level n (0-based) of a theme is open once the theme is and level n-1 has
// been beaten.
function isLevelUnlocked(progress, theme, n) {
  if (!isThemeUnlocked(progress, theme)) return false;
  if (n === 0) return true;
  const levels = themeLevels(theme);
  return isLevelCompleted(progress, levels[n - 1].id);
}
