'use strict';

// Chapter badges: one per world, earned by beating every one of its levels
// — the same moment its chapter of the story ends (see story.js). A badge
// is worked out from campaign progress rather than saved on its own, so it
// syncs with the player's account like the rest of their progress. Each
// world's badge art is in sprites.js (BADGE_TEXTURES).
//
// Earning one plays a short award (showBadgeAward) after the world's
// cutscene; the account panel lists them all (renderBadgeList). Loaded
// after story.js.

const BADGES = [
  { id: 'lava', name: 'Ember Seal', desc: 'Escaped the Volcanic Depths' },
  { id: 'ice', name: 'Frost Sigil', desc: 'Escaped the Frozen Caverns' },
  { id: 'grass', name: 'Verdant Crest', desc: 'Escaped the Overgrown Ruins' },
  { id: 'castle', name: 'Trapwright’s Crown', desc: 'Broke the Last Lock' },
];

// A badge's id is its world's theme.
function badgeInfo(id) {
  return BADGES.find((badge) => badge.id === id) || null;
}

function isBadgeEarned(progress, id) {
  return completedCount(progress, id) === themeLevels(id).length;
}

function earnedBadges(progress) {
  return BADGES.filter((badge) => isBadgeEarned(progress, badge.id)).map((badge) => badge.id);
}

// The badge a win just earned (progress before and after it), or null.
function badgeEarnedByWin(before, after) {
  const badge = BADGES.find((b) => !isBadgeEarned(before, b.id) && isBadgeEarned(after, b.id));
  return badge ? badge.id : null;
}

// --- Account panel list -----------------------------------------------------------

// Fills `container` with every badge: earned ones in color (click one to see
// its award again), the rest as dark silhouettes saying how to earn them.
function renderBadgeList(container, progress = loadProgress()) {
  container.innerHTML = '';
  BADGES.forEach((badge) => {
    const earned = isBadgeEarned(progress, badge.id);
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `badge-slot${earned ? ' earned' : ''}`;
    slot.disabled = !earned;
    const img = document.createElement('span');
    img.className = 'badge-slot-img';
    img.style.backgroundImage = `url("${BADGE_TEXTURES[badge.id]}")`;
    img.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'badge-slot-name';
    name.textContent = earned ? badge.name : '???';
    slot.append(img, name);
    const how = `Beat every level of ${THEME_INFO[badge.id].name}`;
    slot.title = earned ? `${badge.name} — ${badge.desc}` : how;
    slot.setAttribute('aria-label', earned ? `${badge.name}: ${badge.desc}` : `Locked badge. ${how}.`);
    if (earned) {
      slot.addEventListener('click', () => {
        showBadgeAward(badge.id, document.getElementById('badge-award'), { replay: true });
      });
    }
    container.appendChild(slot);
  });
}

// --- The award ------------------------------------------------------------------------

const BADGE_PARTICLES = 28;
// Ignore keys this long after the award opens, so a key still held from
// the cutscene doesn't close it before it's seen.
const BADGE_KEY_GRACE_MS = 700;

let badgeAwardOpen = false;

// The badge dropping in with a spin, light rays turning behind it and the
// world's own weather around it (embers rising, snow falling, leaves
// drifting, castle sparkles — see #badge-award in style.css). Stays up
// until dismissed. `replay` is a rewatch from the badge list.
function showBadgeAward(id, root, { onDone, replay = false } = {}) {
  const badge = badgeInfo(id);
  if (!badge || badgeAwardOpen) {
    if (onDone) onDone();
    return;
  }
  badgeAwardOpen = true;
  const openedAt = Date.now();
  const previousFocus = document.activeElement;

  root.innerHTML = '';
  root.dataset.theme = id;
  root.setAttribute('aria-label', `Badge: ${badge.name}`);
  const el = (tag, className, parent, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    parent.appendChild(node);
    return node;
  };

  el('div', 'badge-rays', root);
  const particles = el('div', 'badge-particles', root);
  for (let i = 0; i < BADGE_PARTICLES; i++) {
    const p = el('span', 'badge-p', particles);
    p.style.setProperty('--x', `${Math.random() * 100}%`);
    p.style.setProperty('--y', `${Math.random() * 100}%`);
    p.style.setProperty('--delay', `${(Math.random() * 3).toFixed(2)}s`);
    p.style.setProperty('--dur', `${(2.6 + Math.random() * 2.4).toFixed(2)}s`);
    p.style.setProperty('--size', `${4 + Math.floor(Math.random() * 3) * 2}px`);
    p.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 120)}px`);
  }

  const card = el('div', 'badge-card', root);
  el('p', 'badge-kicker', card, replay ? 'Your badge' : 'Badge earned!');
  const medal = el('div', 'badge-medal', card);
  const img = el('div', 'badge-medal-img', medal);
  img.style.backgroundImage = `url("${BADGE_TEXTURES[id]}")`;
  // The shine sweeps across the medal only, not the box around it.
  const shine = el('div', 'badge-medal-shine', medal);
  shine.style.webkitMaskImage = shine.style.maskImage = `url("${BADGE_TEXTURES[id]}")`;
  el('h2', 'badge-name', card, badge.name);
  el('p', 'badge-desc', card, badge.desc);
  if (!replay) {
    const signedIn = typeof readSyncState === 'function' && !!readSyncState().uid;
    el('p', 'badge-where', card, signedIn
      ? 'Added to the badges on your account.'
      : 'Added to your badges. Log in or sign up to keep them on an account.');
  }
  const okBtn = el('button', 'pixel-btn badge-ok', card, replay ? 'Close' : 'Nice!');
  okBtn.type = 'button';

  function close() {
    if (!badgeAwardOpen) return;
    badgeAwardOpen = false;
    window.removeEventListener('keydown', handleKey, true);
    root.hidden = true;
    root.innerHTML = '';
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
    if (onDone) onDone();
  }

  // Keys go to the award alone while it's up, like a cutscene.
  function handleKey(e) {
    e.stopImmediatePropagation();
    if (!['Enter', ' ', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    if (Date.now() - openedAt >= BADGE_KEY_GRACE_MS) close();
  }

  okBtn.addEventListener('click', close);
  window.addEventListener('keydown', handleKey, true);
  root.hidden = false;
  okBtn.focus();
  playSound('badge');
}
