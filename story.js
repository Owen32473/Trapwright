'use strict';

// The story: why the player is in these rooms at all. The Trapwright — a
// legendary trap-maker, and the player's master — has vanished, leaving an
// empty workshop and a note. Every world ends with a page of the master's
// journal (each stranger than the last) and a glimpse of a shadow that
// looks like them; the castle's ghost turns out to be the master, bound
// there until someone beats every trap they ever built. See STORY_SCENES.
//
// Cutscenes are short animated scenes on a small stage built from the
// game's own tiles and sprites (the player's frames per world, plus the
// master, the shadow and a few props from sprites.js). Each plays by itself
// once — the opening when a new game starts, a world's scene the first time
// its last level is beaten, the finale after the castle's — and can be
// rewatched from the Story list on the world select. Which ones the player
// has seen is part of their campaign progress (`progress.story`, see
// levels.js), so it syncs with their account like the rest of the save.
//
// The top half (the scenes and when they play) is pure data and rules, so
// tests.js can check it; playCutscene() at the bottom is the player.

// --- Scenes -------------------------------------------------------------------
//
// A scene is { id, label, title, theme, after, steps }. `after` is the world whose
// last level plays it (null for the opening). `steps` run in order:
//
//   { stage: { theme, map } }        lay out the set: rows of LEVEL_TOKENS
//                                    (levels.js), STAGE_COLS x STAGE_ROWS
//   { fadeIn: ms } / { fadeOut: ms } lift or drop the black curtain
//   { chapter: text, sub, ms }       a title card over black (or over the
//                                    stage, if it's already up); a click
//                                    moves on sooner
//   { actor: id, look, at, face, opacity, theme }
//                                    put a character on stage. look: 'hero'
//                                    (the player, dressed for `theme`),
//                                    'master', 'shadow' or 'ghost'
//   { prop: id, img, at, glow, theme } put an object on stage (see PROP_ART)
//   { walk: id, to, ms, wait }       walk (or, for a prop, slide) in a straight
//                                    line; ms per tile. wait: false carries
//                                    on straight away
//   { face: id, dir }                'left' | 'right'
//   { act: id, pose }                'idle' | 'win' | 'hit' | 'float' | 'wave'
//   { fade: id, to, ms }             change an actor's or prop's opacity
//   { remove: id }                   fade it out and take it off
//   { tile: [x, y], type }           change one tile of the set (a wall opening)
//   { say: text, who }               a caption, typed out; waits for a click.
//                                    No `who` is narration
//   { note: text }                   a journal page held up; waits for a click
//   { wait: ms }, { sound: name }, { shake: ms }, { flash: color }

const STAGE_COLS = 12;
const STAGE_ROWS = 6;

const WORKSHOP_MAP = [
  '# # # # # # # # # # # #',
  '# . . . . . . . . . . #',
  '# . . . . . . . . . . #',
  '. . . . . . . . . . . #',
  '# . . . . . . . . . . #',
  '# # # # # # # # # # # #',
];

// The workshop, shared by the opening and the finale's epilogue: two
// torches, a bench with its tools missing, and a door at the far right
// hidden in the wall.
const WORKSHOP_PROPS = [
  { prop: 'torch-1', img: 'torch', at: [2, 0] },
  { prop: 'torch-2', img: 'torch', at: [9, 0] },
  { prop: 'bench', img: 'workbench', at: [5, 1] },
];

const STORY_SCENES = [
  {
    id: 'opening',
    label: 'Prologue',
    title: 'The Empty Workshop',
    theme: 'lava',
    after: null,
    steps: [
      { stage: { theme: 'lava', map: WORKSHOP_MAP } },
      ...WORKSHOP_PROPS,
      { prop: 'page', img: 'journal', at: [7, 3], glow: true },
      { actor: 'hero', look: 'hero', theme: 'lava', at: [-1, 3] },
      { fadeIn: 1200 },
      { say: 'The Trapwright’s workshop, at the foot of the mountain. Silent for three days.' },
      { walk: 'hero', to: [3, 3] },
      { say: 'Master? I brought the iron you asked for…', who: 'You' },
      { face: 'hero', dir: 'left' },
      { wait: 500 },
      { face: 'hero', dir: 'right' },
      { wait: 400 },
      { say: 'The forge was cold. The tools were gone. On the floor lay a single page.' },
      { walk: 'hero', to: [7, 3] },
      { remove: 'page' },
      { sound: 'page' },
      { note: 'Apprentice —\n\nIf you are reading this, I did not come back. Do not look for me.\n\n…No. Look for me. You are the only one who can.\n\nThe way down opens for you alone.\n\n— T.' },
      { shake: 900 },
      { sound: 'rumble' },
      { tile: [11, 3], type: 'empty' },
      { flash: 'rgba(255, 122, 31, 0.35)' },
      { wait: 500 },
      { say: 'Behind the wall, steps led down into the mountain — and to the first of the traps.' },
      { walk: 'hero', to: [12, 3], wait: false },
      { wait: 700 },
      { fadeOut: 900 },
      { chapter: 'Trapwright', sub: 'Find the master.' },
    ],
  },
  {
    id: 'lava',
    label: 'Chapter I',
    title: 'Fire Is Honest',
    theme: 'lava',
    after: 'lava',
    steps: [
      { chapter: 'I · Fire Is Honest', sub: 'Volcanic Depths' },
      { stage: {
        theme: 'lava',
        map: [
          '# # # # # # # # # # # #',
          '# . . ^ . . . . ^ . . #',
          '. . . . . . . . . . . .',
          '# . V^ . . . . . . V^ . #',
          '# . . . ^ . . . ^ . . #',
          '# # # # # # # # # # # #',
        ],
      } },
      { prop: 'heart', img: 'gem', theme: 'lava', at: [6, 1], glow: true },
      { prop: 'page', img: 'journal', at: [6, 2], glow: true },
      { actor: 'hero', look: 'hero', theme: 'lava', at: [-1, 2] },
      { fadeIn: 1000 },
      { walk: 'hero', to: [4, 2] },
      { say: 'At the heart of the mountain, the heat itself seemed to be waiting.' },
      { walk: 'hero', to: [6, 2] },
      { remove: 'page' },
      { sound: 'page' },
      { note: 'Day 1.\n\nThe mountain has agreed to hold my traps. Fire is honest — it shows you exactly where it will burn.\n\nI am building these rooms for someone. I do not know who yet.\n\nWhoever gets this far: the cold comes next. Dress warmly.' },
      { actor: 'shadow', look: 'shadow', at: [11, 2], face: 'left', opacity: 0 },
      { fade: 'shadow', to: 0.9, ms: 1200 },
      { face: 'hero', dir: 'right' },
      { say: 'Master?!', who: 'You' },
      { face: 'shadow', dir: 'right' },
      { walk: 'shadow', to: [13, 2], ms: 260, wait: false },
      { walk: 'hero', to: [10, 2], ms: 180 },
      { say: 'Gone. Only a cold wind rising from the passage below — and on it, the smell of snow.' },
      { fadeOut: 1000 },
    ],
  },
  {
    id: 'ice',
    label: 'Chapter II',
    title: 'Footsteps',
    theme: 'ice',
    after: 'ice',
    steps: [
      { chapter: 'II · Footsteps', sub: 'Frozen Caverns' },
      { stage: {
        theme: 'ice',
        map: [
          '# # # # # # # # # # # #',
          '# . ! . . ! . . . ! . #',
          '. . . i i i i . * . . .',
          '# . . i i i i . . . . #',
          '# * . . . . . . . . * #',
          '# # # # # # # # # # # #',
        ],
      } },
      { prop: 'page', img: 'journal', at: [7, 3], glow: true },
      { actor: 'hero', look: 'hero', theme: 'ice', at: [-1, 2] },
      { fadeIn: 1000 },
      { walk: 'hero', to: [2, 2] },
      { walk: 'hero', to: [7, 2], ms: 140 },
      { walk: 'hero', to: [7, 3] },
      { remove: 'page' },
      { sound: 'page' },
      { note: 'Day 40.\n\nThe ice tests patience. I have made it very patient.\n\nSomething is wrong. I hear footsteps in rooms I have not built yet. When I turn, no one is there — only my own shadow, standing a little too far away.\n\nIf you see it, do not be afraid of it.\n\nBe afraid for it.' },
      { actor: 'shadow', look: 'shadow', at: [10, 2], face: 'left', opacity: 0 },
      { fade: 'shadow', to: 0.9, ms: 1000 },
      { face: 'hero', dir: 'right' },
      { act: 'shadow', pose: 'wave' },
      { say: 'Wait — who are you?', who: 'You' },
      { walk: 'hero', to: [8, 3], wait: false },
      { sound: 'icicle-crash' },
      { prop: 'icicle', img: 'icicle-crash', theme: 'ice', at: [9, 2] },
      { shake: 400 },
      { remove: 'shadow' },
      { wait: 600 },
      { remove: 'icicle' },
      { say: 'Where it had stood, the frost held no footprints at all. Past the glacier, the air turned warm and green.' },
      { fadeOut: 1000 },
    ],
  },
  {
    id: 'grass',
    label: 'Chapter III',
    title: 'The Garden That Grew',
    theme: 'grass',
    after: 'grass',
    steps: [
      { chapter: 'III · The Garden That Grew', sub: 'Overgrown Ruins' },
      { stage: {
        theme: 'grass',
        map: [
          '# # # # # # # # # # # #',
          '# % . . m . . J . . % #',
          '. . . . . . . . . . . #',
          '# . . % . . . . . % . #',
          '# m . . . J . . . . . #',
          '# # # # # # # # # # # #',
        ],
      } },
      { prop: 'page', img: 'journal', at: [6, 3], glow: true },
      { actor: 'hero', look: 'hero', theme: 'grass', at: [-1, 2] },
      { fadeIn: 1000 },
      { walk: 'hero', to: [6, 2] },
      { walk: 'hero', to: [6, 3] },
      { remove: 'page' },
      { sound: 'page' },
      { note: 'Day — I have lost count.\n\nThe garden grows traps I never planted. The rooms are building themselves now. They want to be finished.\n\nThe castle calls to me. It says a Trapwright can never leave until every trap they ever built has been beaten.\n\nI have beaten none of mine. I only ever built them.\n\nIf I do not come back — finish them for me.' },
      { actor: 'shadow', look: 'shadow', at: [9, 2], face: 'left', opacity: 0 },
      { fade: 'shadow', to: 0.9, ms: 1000 },
      { face: 'hero', dir: 'right' },
      { say: 'This time the shadow did not run.' },
      { walk: 'hero', to: [7, 2] },
      { say: '…Finish them.', who: '???' },
      { act: 'shadow', pose: 'win' },
      { sound: 'shimmer' },
      { fade: 'shadow', to: 0, ms: 1600 },
      { remove: 'shadow' },
      { say: 'Far above the ruins, a castle stood against the moon. Its gate would open only once every trap below had been beaten.' },
      { fadeOut: 1000 },
    ],
  },
  {
    id: 'finale',
    label: 'Chapter IV',
    title: 'The Last Lock',
    theme: 'castle',
    after: 'castle',
    steps: [
      { chapter: 'IV · The Last Lock', sub: 'Abandoned Castle' },
      { stage: {
        theme: 'castle',
        map: [
          '# # # # # # # # # # # #',
          '# X . . . . . . . . X #',
          '. . . . . . . . . . . #',
          '# . . P . . . . P . . #',
          '# X . . . . . . . . X #',
          '# # # # # # # # # # # #',
        ],
      } },
      { prop: 'heart', img: 'gem', theme: 'castle', at: [10, 2], glow: true },
      { actor: 'hero', look: 'hero', theme: 'castle', at: [-1, 2] },
      { fadeIn: 1000 },
      { walk: 'hero', to: [4, 2] },
      { say: 'Behind the last lock, the castle was very still.' },
      { actor: 'ghost', look: 'ghost', at: [9, 2], opacity: 0 },
      { sound: 'shimmer' },
      { fade: 'ghost', to: 0.85, ms: 1000 },
      { walk: 'ghost', to: [6, 2], ms: 380, wait: false },
      { walk: 'hero', to: [3, 2], ms: 380 },
      { face: 'hero', dir: 'right' },
      { act: 'hero', pose: 'hit' },
      { wait: 500 },
      { act: 'hero', pose: 'idle' },
      { actor: 'master', look: 'master', at: [6, 2], face: 'left', opacity: 0 },
      { fade: 'ghost', to: 0, ms: 1400, wait: false },
      { fade: 'master', to: 0.75, ms: 1400 },
      { remove: 'ghost' },
      { act: 'master', pose: 'float' },
      { say: 'You came. I hoped it would be you.', who: 'Master' },
      { say: 'Master! You’re—', who: 'You' },
      { say: 'Bound here. The castle took me the day I finished its last lock. A Trapwright cannot leave until someone beats every trap they ever built.', who: 'Master' },
      { say: 'Every room you escaped, I built. And you beat every one.', who: 'Master' },
      { prop: 'tools', img: 'tools', at: [6, 2], opacity: 0 },
      { fade: 'tools', to: 1, ms: 600 },
      { walk: 'tools', to: [4, 2], ms: 500 },
      { sound: 'unlock' },
      { say: 'Take my tools. The workshop is yours now. Build well — one day, someone will come looking for you.', who: 'Master' },
      { walk: 'hero', to: [4, 2] },
      { remove: 'tools' },
      { act: 'master', pose: 'win' },
      { sound: 'shimmer' },
      { fade: 'master', to: 0, ms: 2000 },
      { remove: 'master' },
      { wait: 600 },
      { say: 'Thank you, Master.', who: 'You' },
      { fadeOut: 1400 },
      { chapter: 'Some time later…' },
      { stage: { theme: 'lava', map: WORKSHOP_MAP } },
      ...WORKSHOP_PROPS,
      { prop: 'tools', img: 'tools', at: [6, 1] },
      { actor: 'hero', look: 'hero', theme: 'castle', at: [5, 2], face: 'right' },
      { fadeIn: 1200 },
      { say: 'The forge burned again. There was a new trap on the bench, and a page to leave behind.' },
      { walk: 'hero', to: [7, 3] },
      { prop: 'page', img: 'journal', at: [7, 3], glow: true },
      { sound: 'page' },
      { walk: 'hero', to: [9, 3] },
      { note: 'To whoever finds this —\n\nThe way down opens for you alone.\n\nCome find me.\n\n— T.' },
      { tile: [11, 3], type: 'empty' },
      { sound: 'rumble' },
      { shake: 600 },
      { walk: 'hero', to: [12, 3], ms: 380 },
      { tile: [11, 3], type: 'wall' },
      { sound: 'rumble' },
      { shake: 600 },
      { wait: 800 },
      { fadeOut: 1400 },
      { chapter: 'The End', sub: 'Thank you for playing Trapwright.', ms: 5000 },
    ],
  },
];

// Props: sprites from sprites.js. A tile texture (the gem, the icicle)
// is drawn in the prop's own theme.
const PROP_ART = {
  journal: () => STORY_PROP_TEXTURES.journal,
  tools: () => STORY_PROP_TEXTURES.tools,
  workbench: () => STORY_PROP_TEXTURES.workbench,
  torch: () => STORY_PROP_TEXTURES.torch,
  gem: (theme) => themeTexture(theme, 'goal'),
  'icicle-crash': (theme) => themeHazardTexture(theme, 'icicle-crash'),
};

function storyScene(id) {
  return STORY_SCENES.find((scene) => scene.id === id) || null;
}

function isStorySeen(progress, id) {
  return progress.story.includes(id);
}

// The scene a win on this level plays: a world's own scene, after its last
// level.
function storySceneAfterLevel(levelId) {
  const def = levelDef(levelId);
  if (!def) return null;
  const levels = themeLevels(def.theme);
  if (levels[levels.length - 1].id !== levelId) return null;
  const scene = STORY_SCENES.find((s) => s.after === def.theme);
  return scene ? scene.id : null;
}

// Rewatchable: the opening always; a world's scene once that world's last
// level is beaten (or it's been seen — say, on another device).
function isStoryUnlocked(progress, id) {
  const scene = storyScene(id);
  if (!scene) return false;
  if (!scene.after || isStorySeen(progress, id)) return true;
  const levels = themeLevels(scene.after);
  return isLevelCompleted(progress, levels[levels.length - 1].id);
}

// A new game: nothing beaten yet, and the opening never shown. (A player
// who was already playing before the story existed can watch it from the
// Story list instead.)
function shouldPlayOpening(progress) {
  return !isStorySeen(progress, 'opening') && Object.keys(progress.levels).length === 0;
}

function markStorySeen(id) {
  const progress = loadProgress();
  if (isStorySeen(progress, id)) return;
  progress.story = normalizeStorySeen([...progress.story, id]);
  saveProgress(progress);
}

// Parses a stage map (rows of LEVEL_TOKENS) into tile types, row by row.
function parseStageMap(rows) {
  if (rows.length !== STAGE_ROWS) throw new Error(`stage has ${rows.length} rows, expected ${STAGE_ROWS}`);
  return rows.map((row, y) => {
    const tokens = row.trim().split(/\s+/);
    if (tokens.length !== STAGE_COLS) throw new Error(`stage row ${y} has ${tokens.length} tiles, expected ${STAGE_COLS}`);
    return tokens.map((token, x) => {
      const type = LEVEL_TOKENS[token];
      if (!type) throw new Error(`unknown stage token "${token}" at ${x},${y}`);
      return type;
    });
  });
}

// --- The player ---------------------------------------------------------------

// How long a winning room gets to celebrate before its cutscene starts.
const STORY_AFTER_WIN_MS = 1400;
const TYPE_MS_PER_CHAR = 24;
const WALK_MS_PER_TILE = 320;
const WALK_FRAME_MS = 150;

let activeCutscene = null;

function isCutscenePlaying() {
  return activeCutscene !== null;
}

// Plays a scene in `root` (the #cutscene overlay), then calls onDone —
// whether it ran to the end or was skipped. Returns a function that skips it.
function playCutscene(id, root, { onDone } = {}) {
  const scene = storyScene(id);
  if (!scene) {
    if (onDone) onDone();
    return () => {};
  }
  if (activeCutscene) activeCutscene.skip();

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = new Set();
  const intervals = new Set();
  const entities = new Map();
  let tiles = [];
  let stageTheme = scene.theme;
  let finished = false;
  // What a click / Space / Enter does right now: finish the typing, or move on.
  let advance = null;

  const el = (tag, className, parent) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
  };

  root.innerHTML = '';
  root.setAttribute('aria-label', `Story: ${scene.title}`);
  const frame = el('div', 'cs-frame', root);
  const stage = el('div', 'cs-stage', frame);
  stage.style.setProperty('--cs-cols', STAGE_COLS);
  stage.style.setProperty('--cs-rows', STAGE_ROWS);
  const tileLayer = el('div', 'cs-tiles', stage);
  const entityLayer = el('div', 'cs-entities', stage);
  const flashEl = el('div', 'cs-flash', stage);
  // The journal page sits over the whole screen, not just the stage, so a
  // long entry still fits on a phone.
  const noteEl = el('div', 'cs-note', root);
  noteEl.hidden = true;
  const noteText = el('p', 'cs-note-text', noteEl);
  const noteMore = el('span', 'cs-more', noteEl);
  noteMore.textContent = '▼';
  noteMore.setAttribute('aria-hidden', 'true');
  const curtain = el('div', 'cs-curtain', stage);
  const chapterEl = el('div', 'cs-chapter', stage);
  chapterEl.hidden = true;
  const chapterTitle = el('h2', null, chapterEl);
  const chapterSub = el('p', null, chapterEl);

  const caption = el('div', 'cs-caption', frame);
  caption.setAttribute('aria-live', 'polite');
  const captionWho = el('span', 'cs-who', caption);
  const captionText = el('p', 'cs-text', caption);
  const captionMore = el('span', 'cs-more', caption);
  captionMore.textContent = '▼';
  captionMore.setAttribute('aria-hidden', 'true');
  captionMore.hidden = true;

  const skipBtn = el('button', 'pixel-btn cs-skip', root);
  skipBtn.type = 'button';
  skipBtn.textContent = 'Skip ▸▸';

  const sleep = (ms) => new Promise((resolve) => {
    const t = setTimeout(() => {
      timers.delete(t);
      resolve();
    }, ms);
    timers.add(t);
  });
  const waitForAdvance = () => new Promise((resolve) => { advance = resolve; });
  const pos = (node, [x, y]) => {
    node.style.left = `${(x / STAGE_COLS) * 100}%`;
    node.style.top = `${(y / STAGE_ROWS) * 100}%`;
  };

  function buildStage({ theme, map }) {
    stageTheme = theme;
    root.dataset.theme = theme;
    tiles = parseStageMap(map);
    entities.forEach((entity) => entity.stop());
    entities.clear();
    entityLayer.innerHTML = '';
    tileLayer.innerHTML = '';
    tiles.forEach((row) => row.forEach((type) => {
      const tile = el('div', 'cs-tile', tileLayer);
      tile.style.backgroundImage = `url("${themeTexture(theme, textureKeyForTile(type, 0))}")`;
    }));
  }

  function setTile([x, y], type) {
    tiles[y][x] = type;
    tileLayer.children[y * STAGE_COLS + x].style.backgroundImage =
      `url("${themeTexture(stageTheme, textureKeyForTile(type, 0))}")`;
  }

  // An actor: a sprite whose frames come from the player's own poses (or the
  // ghost's single frame), with a facing flip on the outer element and the
  // pose's motion on the inner one — the same split as the in-game player.
  function addActor({ actor: id, look, at, face = 'right', opacity = 1, theme }) {
    const outer = el('div', 'cs-entity cs-actor', entityLayer);
    const inner = el('div', 'cs-sprite', outer);
    const frames = look === 'hero' ? THEME_PLAYER_FRAMES[theme || stageTheme]
      : look === 'ghost' ? null
        : STORY_ACTOR_FRAMES[look];
    const ghostUrl = themeHazardTexture('castle', 'ghost');
    let cycle = null;
    const entity = {
      node: outer,
      at: [...at],
      isActor: true,
      show(frameName) {
        inner.style.backgroundImage = `url("${frames ? frames[frameName] : ghostUrl}")`;
      },
      cycleFrames(names, ms) {
        this.stopCycle();
        let i = 0;
        this.show(names[0]);
        cycle = setInterval(() => {
          i = (i + 1) % names.length;
          this.show(names[i]);
        }, ms);
        intervals.add(cycle);
      },
      stopCycle() {
        if (cycle) {
          clearInterval(cycle);
          intervals.delete(cycle);
          cycle = null;
        }
      },
      setPose(pose) {
        this.stopCycle();
        inner.className = `cs-sprite pose-${pose}`;
        if (pose === 'win') this.cycleFrames(['win', 'idle'], 300);
        else if (pose === 'wave') this.cycleFrames(['win', 'idle'], 500);
        else if (pose === 'walking') this.cycleFrames(['walkA', 'walkB'], WALK_FRAME_MS);
        else this.show(pose === 'hit' ? 'hit' : 'idle');
      },
      face(dir) {
        outer.classList.toggle('facing-left', dir === 'left');
      },
      stop() {
        this.stopCycle();
      },
    };
    outer.classList.add(`cs-${look}`);
    outer.style.opacity = opacity;
    pos(outer, at);
    entity.face(face);
    entity.setPose(look === 'ghost' ? 'float' : 'idle');
    entities.set(id, entity);
  }

  function addProp({ prop: id, img, at, glow = false, opacity = 1, theme }) {
    const outer = el('div', `cs-entity cs-prop${glow ? ' cs-glow' : ''}${img === 'torch' ? ' cs-torch' : ''}`, entityLayer);
    const inner = el('div', 'cs-sprite', outer);
    inner.style.backgroundImage = `url("${PROP_ART[img](theme || stageTheme)}")`;
    outer.style.opacity = opacity;
    pos(outer, at);
    entities.set(id, { node: outer, at: [...at], isActor: false, stop() {} });
  }

  async function walk({ walk: id, to, ms = WALK_MS_PER_TILE, wait = true }) {
    const entity = entities.get(id);
    const [x0, y0] = entity.at;
    const dist = Math.hypot(to[0] - x0, to[1] - y0);
    if (!dist) return;
    const duration = dist * ms;
    if (entity.isActor) {
      if (to[0] !== x0) entity.face(to[0] < x0 ? 'left' : 'right');
      entity.setPose('walking');
    }
    entity.node.style.transition = `left ${duration}ms linear, top ${duration}ms linear, opacity 0.4s`;
    // Read layout so the transition starts from where the entity is now.
    void entity.node.offsetWidth;
    pos(entity.node, to);
    entity.at = [...to];
    const arrive = sleep(duration).then(() => {
      if (finished) return;
      entity.node.style.transition = 'opacity 0.4s';
      if (entity.isActor) entity.setPose('idle');
    });
    if (wait) await arrive;
  }

  async function fade({ fade: id, to, ms = 600, wait = true }) {
    const entity = entities.get(id);
    entity.node.style.transition = `opacity ${ms}ms ease`;
    void entity.node.offsetWidth;
    entity.node.style.opacity = to;
    if (wait) await sleep(ms);
  }

  async function remove({ remove: id }) {
    const entity = entities.get(id);
    if (!entity) return;
    entity.node.style.transition = 'opacity 0.35s ease';
    entity.node.style.opacity = 0;
    await sleep(350);
    entity.stop();
    entity.node.remove();
    entities.delete(id);
  }

  async function curtainTo(opacity, ms) {
    curtain.style.transition = `opacity ${ms}ms ease`;
    curtain.style.opacity = opacity;
    await sleep(ms);
  }

  async function say({ say: text, who }) {
    caption.classList.add('open');
    caption.classList.toggle('narration', !who);
    captionWho.textContent = who || '';
    captionWho.hidden = !who;
    captionMore.hidden = true;
    captionText.textContent = '';
    let typing = true;
    let shown = 0;
    const typer = setInterval(() => {
      shown += 1;
      captionText.textContent = text.slice(0, shown);
      if (shown >= text.length) stopTyping();
    }, TYPE_MS_PER_CHAR);
    intervals.add(typer);
    function stopTyping() {
      clearInterval(typer);
      intervals.delete(typer);
      captionText.textContent = text;
      typing = false;
      captionMore.hidden = false;
    }
    // The first click only finishes the typing; the next one moves on.
    for (;;) {
      await waitForAdvance();
      if (!typing) break;
      stopTyping();
    }
    caption.classList.remove('open');
    captionMore.hidden = true;
  }

  async function note({ note: text }) {
    noteText.textContent = text;
    noteEl.hidden = false;
    void noteEl.offsetWidth;
    noteEl.classList.add('open');
    await sleep(400);
    await waitForAdvance();
    noteEl.classList.remove('open');
    await sleep(300);
    noteEl.hidden = true;
  }

  async function chapter({ chapter: title, sub = '', ms = 2600 }) {
    chapterTitle.textContent = title;
    chapterSub.textContent = sub;
    chapterSub.hidden = !sub;
    chapterEl.hidden = false;
    void chapterEl.offsetWidth;
    chapterEl.classList.add('open');
    await Promise.race([sleep(ms), waitForAdvance()]);
    advance = null;
    chapterEl.classList.remove('open');
    await sleep(600);
    chapterEl.hidden = true;
  }

  async function shake({ shake: ms }) {
    if (reducedMotion) return;
    stage.classList.remove('cs-shaking');
    void stage.offsetWidth;
    stage.classList.add('cs-shaking');
    await sleep(ms);
    stage.classList.remove('cs-shaking');
  }

  async function flash({ flash: color }) {
    flashEl.style.background = color;
    flashEl.classList.remove('cs-flashing');
    void flashEl.offsetWidth;
    flashEl.classList.add('cs-flashing');
  }

  async function runStep(step) {
    if ('stage' in step) buildStage(step.stage);
    else if ('fadeIn' in step) await curtainTo(0, step.fadeIn);
    else if ('fadeOut' in step) await curtainTo(1, step.fadeOut);
    else if ('chapter' in step) await chapter(step);
    else if ('actor' in step) addActor(step);
    else if ('prop' in step) addProp(step);
    else if ('walk' in step) await walk(step);
    else if ('face' in step) entities.get(step.face).face(step.dir);
    else if ('act' in step) entities.get(step.act).setPose(step.pose);
    else if ('fade' in step) await fade(step);
    else if ('remove' in step) await remove(step);
    else if ('tile' in step) setTile(step.tile, step.type);
    else if ('say' in step) await say(step);
    else if ('note' in step) await note(step);
    else if ('wait' in step) await sleep(step.wait);
    else if ('sound' in step) playSound(step.sound);
    else if ('shake' in step) await shake(step);
    else if ('flash' in step) await flash(step);
  }

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    intervals.forEach(clearInterval);
    entities.forEach((entity) => entity.stop());
    window.removeEventListener('keydown', handleKey, true);
    root.hidden = true;
    root.innerHTML = '';
    activeCutscene = null;
    setMusic(previousMusic);
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
    if (onDone) onDone();
  }

  // Keys go to the cutscene alone while it plays (capture phase, stopped
  // there), so nothing behind it — the world select, a won room — reacts.
  function handleKey(e) {
    e.stopImmediatePropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      finish();
    } else if ([' ', 'Enter'].includes(e.key) && document.activeElement !== skipBtn) {
      e.preventDefault();
      if (advance) {
        const next = advance;
        advance = null;
        next();
      }
    }
  }

  root.addEventListener('click', (e) => {
    if (e.target === skipBtn || !advance) return;
    const next = advance;
    advance = null;
    next();
  });
  skipBtn.addEventListener('click', finish);
  window.addEventListener('keydown', handleKey, true);

  const previousMusic = typeof musicArea === 'undefined' ? null : musicArea;
  const previousFocus = document.activeElement;
  setMusic('story');
  root.hidden = false;
  skipBtn.focus();
  activeCutscene = { skip: finish };
  if (!isStorySeen(loadProgress(), id)) markStorySeen(id);

  (async () => {
    for (const step of scene.steps) {
      if (finished) return;
      await runStep(step);
    }
    await sleep(400);
    finish();
  })();

  return finish;
}
