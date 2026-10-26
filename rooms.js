'use strict';

// Creative Mode rooms the player has saved ("My Rooms"): kept in
// localStorage, and part of the cloud save (cloudsave.js) so they follow
// the player's account. Pure storage and merge rules — the My Rooms screen
// itself is in script.js. Loaded after levels.js, before cloudsave.js.
//
// localStorage['trapRoomCreativeRooms'] = { rooms: { [id]: { name, level,
// updatedAt } }, deleted: { [id]: deletedAt } }. A deleted room leaves its
// id and time behind, so merging with a device that still has the room
// doesn't bring it back; an edit made after the delete (on a device that
// hadn't heard of it yet) wins, and the room returns.

const ROOMS_KEY = 'trapRoomCreativeRooms';
const MAX_ROOMS = 50;
const MAX_ROOM_NAME = 32;
// Timed rooms: the choices Creative Mode offers, in seconds (0 = untimed).
const ROOM_TIME_LIMITS = [0, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150, 180];
const MAX_TIME_LIMIT = 600;

function defaultRooms() {
  return { rooms: {}, deleted: {} };
}

function cleanRoomName(name) {
  const trimmed = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_ROOM_NAME);
  return trimmed || 'Untitled room';
}

// A time limit worth keeping on a level: whole seconds, 5 to MAX_TIME_LIMIT.
// Anything else (missing, zero, garbage from a shared link) means untimed.
function cleanTimeLimit(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 5 && n <= MAX_TIME_LIMIT ? n : 0;
}

// A room's level, reduced to exactly what a level holds — so a save from
// anywhere can't smuggle anything else into the game.
function cleanRoomLevel(level) {
  if (!isValidLevel(level) || level.size < 2 || level.size > 16) return null;
  if (!level.tiles.every((t) => typeof t === 'string')) return null;
  const clean = {
    size: level.size,
    tiles: [...level.tiles],
    start: level.start.every(Number.isInteger) ? [...level.start] : null,
    goal: level.goal.every(Number.isInteger) ? [...level.goal] : null,
    theme: normalizeTheme(level.theme),
  };
  const timeLimit = cleanTimeLimit(level.timeLimit);
  if (timeLimit) clean.timeLimit = timeLimit;
  return clean;
}

// Unlike a shared link, a room being built may not have a start or goal
// yet, so this accepts null for either.
function cleanDraftLevel(level) {
  if (!level || typeof level !== 'object') return null;
  const withEnds = {
    ...level,
    start: Array.isArray(level.start) ? level.start : [0, 0],
    goal: Array.isArray(level.goal) ? level.goal : [0, 0],
  };
  const clean = cleanRoomLevel(withEnds);
  if (!clean) return null;
  if (!Array.isArray(level.start)) clean.start = null;
  if (!Array.isArray(level.goal)) clean.goal = null;
  return clean;
}

function normalizeRooms(parsed) {
  const out = defaultRooms();
  const src = parsed && typeof parsed === 'object' ? parsed : {};
  const deleted = src.deleted && typeof src.deleted === 'object' ? src.deleted : {};
  Object.entries(deleted).forEach(([id, at]) => {
    if (Number.isFinite(at)) out.deleted[id] = at;
  });
  const rooms = src.rooms && typeof src.rooms === 'object' ? src.rooms : {};
  Object.entries(rooms).forEach(([id, room]) => {
    if (!room || typeof room !== 'object' || !Number.isFinite(room.updatedAt)) return;
    const level = cleanDraftLevel(room.level);
    if (!level) return;
    if (id in out.deleted && out.deleted[id] >= room.updatedAt) return;
    out.rooms[id] = { name: cleanRoomName(room.name), level, updatedAt: room.updatedAt };
  });
  return out;
}

function loadRooms() {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    return raw ? normalizeRooms(JSON.parse(raw)) : defaultRooms();
  } catch (e) {
    return defaultRooms();
  }
}

function saveRooms(rooms) {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch (e) {
    // best-effort, like every other save
  }
  notifySaveChanged();
}

// Newest first.
function roomList(rooms) {
  return Object.entries(rooms.rooms)
    .map(([id, room]) => ({ id, ...room }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function newRoomId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Saves `level` as room `id` (a new id makes a new room). Returns the saved
// room, or null when there's no room for another one.
function putRoom(id, name, level, now = Date.now()) {
  const rooms = loadRooms();
  if (!rooms.rooms[id] && Object.keys(rooms.rooms).length >= MAX_ROOMS) return null;
  const clean = cleanDraftLevel(level);
  if (!clean) return null;
  rooms.rooms[id] = { name: cleanRoomName(name), level: clean, updatedAt: now };
  delete rooms.deleted[id];
  saveRooms(rooms);
  return rooms.rooms[id];
}

function deleteRoom(id, now = Date.now()) {
  const rooms = loadRooms();
  delete rooms.rooms[id];
  rooms.deleted[id] = now;
  saveRooms(rooms);
}

// Two copies of the rooms (this device's and the account's): each room's
// newest edit wins, and a delete wins over any edit made before it.
function mergeRooms(a, b) {
  const x = normalizeRooms(a);
  const y = normalizeRooms(b);
  const deleted = { ...x.deleted };
  Object.entries(y.deleted).forEach(([id, at]) => {
    deleted[id] = Math.max(deleted[id] || 0, at);
  });
  const rooms = { ...x.rooms };
  Object.entries(y.rooms).forEach(([id, room]) => {
    if (!rooms[id] || room.updatedAt > rooms[id].updatedAt) rooms[id] = room;
  });
  return normalizeRooms({ rooms, deleted });
}
