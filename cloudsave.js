'use strict';

// Cloud saves: the player's whole save as one object, read from and written
// to localStorage, and the rules for merging two copies of it. No Firebase
// here (account.js does the uploading and downloading), so tests.js can
// check the merge rules on their own. Loaded after levels.js.
//
// A save is { progress, dailyStats, bestScores } — everything the game keeps
// in localStorage: campaign progress and cutscenes seen (loadProgress in
// levels.js), Daily
// Puzzle stats (loadDailyStats in script.js), and best move counts per room
// (readBestScore in script.js), as { [levelCode]: moves }.

const BEST_SCORE_KEY_PREFIX = bestScoreKeyFor('');

function emptySave() {
  return { progress: defaultProgress(), dailyStats: defaultDailyStats(), bestScores: {} };
}

function finiteOrNull(value) {
  const n = Number(value);
  return value !== null && value !== '' && Number.isFinite(n) ? n : null;
}

// Cleans up a save from anywhere (localStorage, a cloud document another
// version of the game wrote) into the exact shape above.
function normalizeSave(save) {
  const s = save && typeof save === 'object' ? save : {};
  const progress = normalizeProgress(s.progress);
  const levels = {};
  Object.entries(progress.levels).forEach(([id, rec]) => {
    if (!rec || typeof rec !== 'object') return;
    levels[id] = { moves: finiteOrNull(rec.moves), timeMs: finiteOrNull(rec.timeMs), deaths: finiteOrNull(rec.deaths) };
    const stars = finiteOrNull(rec.stars);
    if (stars !== null && stars >= 1 && stars <= 3) levels[id].stars = Math.round(stars);
  });
  const bestScores = {};
  Object.entries(s.bestScores && typeof s.bestScores === 'object' ? s.bestScores : {}).forEach(([code, moves]) => {
    const n = finiteOrNull(moves);
    if (n !== null) bestScores[code] = n;
  });
  return {
    progress: { version: 1, levels, story: normalizeStorySeen(progress.story) },
    dailyStats: normalizeDailyStats(s.dailyStats),
    bestScores,
  };
}

function bestScoreKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(BEST_SCORE_KEY_PREFIX)) keys.push(key);
    }
  } catch (e) {
    // storage blocked: there are no best scores to find
  }
  return keys;
}

function readLocalSave() {
  const bestScores = {};
  bestScoreKeys().forEach((key) => {
    bestScores[key.slice(BEST_SCORE_KEY_PREFIX.length)] = readBestScore(key.slice(BEST_SCORE_KEY_PREFIX.length));
  });
  return normalizeSave({ progress: loadProgress(), dailyStats: loadDailyStats(), bestScores });
}

// Replaces everything saved on this device with `save`. Writes storage
// directly rather than through saveProgress/saveDailyStats/writeBestScore,
// since those report a change to upload and this *is* the download.
function writeLocalSave(save) {
  const s = normalizeSave(save);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(s.progress));
    localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(s.dailyStats));
    bestScoreKeys().forEach((key) => localStorage.removeItem(key));
    Object.entries(s.bestScores).forEach(([code, moves]) => {
      localStorage.setItem(bestScoreKeyFor(code), String(moves));
    });
  } catch (e) {
    // best-effort, like every other save in the game
  }
}

function clearLocalSave() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(DAILY_STATS_KEY);
    bestScoreKeys().forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    // nothing saved to clear
  }
}

// --- Merging ---------------------------------------------------------------
//
// Two copies of a save (this device's and the account's) combine so nothing
// earned on either is lost: a level beaten on either counts, keeping the best
// of each stat, and the most stars (the same rule recordLevelComplete uses), and
// a cutscene seen on either counts as seen; best scores keep the
// fewest moves; daily stats keep the most advanced streak and the higher
// lifetime counts, and combine today's completions when both are from the
// same day.

function fewer(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function mergeProgress(a, b) {
  const levels = { ...a.levels };
  Object.entries(b.levels).forEach(([id, rec]) => {
    const prev = levels[id];
    if (!prev) {
      levels[id] = rec;
      return;
    }
    levels[id] = { moves: fewer(prev.moves, rec.moves), timeMs: fewer(prev.timeMs, rec.timeMs), deaths: fewer(prev.deaths, rec.deaths) };
    const stars = Math.max(prev.stars || 0, rec.stars || 0);
    if (stars) levels[id].stars = stars;
  });
  // A cutscene seen on either device counts as seen.
  return { version: 1, levels, story: normalizeStorySeen([...a.story, ...b.story]) };
}

function mergeBestScores(a, b) {
  const scores = { ...a };
  Object.entries(b).forEach(([code, moves]) => {
    scores[code] = code in scores ? Math.min(scores[code], moves) : moves;
  });
  return scores;
}

// null (never) sorts before any "YYYY-MM-DD" date.
function laterDate(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a > b ? 1 : -1;
}

function mergeDailyStats(a, b) {
  const byStreakDate = laterDate(a.lastStreakDate, b.lastStreakDate);
  const streakFrom = byStreakDate > 0 || (byStreakDate === 0 && a.currentStreak >= b.currentStreak) ? a : b;

  let today;
  if (a.today.date === b.today.date) {
    const completed = { solver: {}, builder: {} };
    ['solver', 'builder'].forEach((type) => {
      DIFFICULTIES.forEach((d) => {
        if (a.today.completed[type][d] || b.today.completed[type][d]) completed[type][d] = true;
      });
    });
    today = { date: a.today.date, completed, streakEarned: !!(a.today.streakEarned || b.today.streakEarned) };
  } else {
    today = laterDate(a.today.date, b.today.date) > 0 ? a.today : b.today;
  }

  const perDifficultyCompletions = {};
  DIFFICULTIES.forEach((d) => {
    perDifficultyCompletions[d] = Math.max(a.perDifficultyCompletions[d] || 0, b.perDifficultyCompletions[d] || 0);
  });

  return {
    ...defaultDailyStats(),
    currentStreak: streakFrom.currentStreak,
    lastStreakDate: streakFrom.lastStreakDate,
    bestStreak: Math.max(a.bestStreak, b.bestStreak, streakFrom.currentStreak),
    totalDaysCompleted: Math.max(a.totalDaysCompleted, b.totalDaysCompleted),
    perDifficultyCompletions,
    today,
  };
}

// campaignReset: this device reset its campaign since it last synced, so its
// (empty) campaign replaces the other copy's instead of merging with it —
// otherwise the reset would be undone by the next download.
function mergeSaves(local, other, { campaignReset = false } = {}) {
  const a = normalizeSave(local);
  const b = normalizeSave(other);
  return {
    progress: campaignReset ? a.progress : mergeProgress(a.progress, b.progress),
    dailyStats: mergeDailyStats(a.dailyStats, b.dailyStats),
    bestScores: mergeBestScores(a.bestScores, b.bestScores),
  };
}

// --- Serializing -------------------------------------------------------------
//
// The cloud keeps the save as one JSON string (level codes make awkward
// database field names). Keys are sorted so two equal saves always produce
// the same string, which is how account.js tells whether anything changed.

function sortedKeysCopy(value) {
  if (Array.isArray(value)) return value.map(sortedKeysCopy);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value).sort().forEach((key) => { out[key] = sortedKeysCopy(value[key]); });
  return out;
}

function serializeSave(save) {
  return JSON.stringify(sortedKeysCopy(normalizeSave(save)));
}

function parseSave(text) {
  try {
    return normalizeSave(JSON.parse(text));
  } catch (e) {
    return emptySave();
  }
}
