'use strict';

// Accounts and cloud saves, on Firebase (Authentication for email/password
// logins, Cloud Firestore for profiles and saves). The account button in the
// top-right corner opens #account-modal, which holds every account screen.
//
// Firestore layout (firestore.rules enforces who can read and write what):
//   users/{uid}      { username, usernameKey, icon, save, updatedAt }
//                    save is the whole save as a JSON string (cloudsave.js)
//   usernames/{key}  { uid } — key is the lowercased username; one per
//                    account, which is what makes usernames unique
//
// Syncing: while logged in, every saved change (see notifySaveChanged in
// script.js) marks this device "dirty" and uploads shortly after. An upload
// merges this device's save into the account's (mergeSaves), so progress
// made on two devices adds up instead of one overwriting the other. On
// login, a device that has nothing unsynced simply takes the account's
// save; guest progress made before logging in is merged in. Logging out
// clears this device's save, since it now lives in the account.

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const MIN_PASSWORD_LENGTH = 6; // Firebase's own minimum
const UPLOAD_DELAY_MS = 1500;

// { uid, dirty, campaignReset } — whose account this device's save belongs
// to (null for a guest), whether it has changes not yet uploaded, and
// whether one of those is a campaign reset (see mergeSaves).
const SYNC_STATE_KEY = 'trapRoomCloudSync';

function readSyncState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_STATE_KEY));
    if (parsed && typeof parsed.uid === 'string') {
      return { uid: parsed.uid, dirty: !!parsed.dirty, campaignReset: !!parsed.campaignReset };
    }
  } catch (e) {
    // fall through to "guest"
  }
  return { uid: null, dirty: false, campaignReset: false };
}

function writeSyncState(state) {
  try {
    if (state) localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SYNC_STATE_KEY);
  } catch (e) {
    // without storage there's nothing to keep in sync anyway
  }
}

function friendlyError(message) {
  const err = new Error(message);
  err.friendly = true;
  return err;
}

// Firebase error codes -> something a player can act on. With Firebase's
// email-enumeration protection (on by default), a wrong password and an
// unknown email both come back as invalid-credential, by design.
const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-email': 'Enter your email address.',
  'auth/email-already-in-use': 'An account already uses that email. Try logging in.',
  'auth/weak-password': `Pick a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  'auth/password-does-not-meet-requirements': 'That password is too weak. Try a longer one.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'Couldn’t reach the server. Check your connection.',
  'auth/expired-action-code': 'This reset link has expired. Ask for a new one.',
  'auth/invalid-action-code': 'This reset link has already been used or has expired. Ask for a new one.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/operation-not-allowed': 'Email/password logins aren’t switched on in Firebase yet.',
  unavailable: 'Couldn’t reach the server. Check your connection.',
  'permission-denied': 'The server refused that. Try again, or log out and back in.',
};

function accountErrorMessage(err) {
  if (err && err.friendly) return err.message;
  return (err && AUTH_ERROR_MESSAGES[err.code]) || 'Something went wrong. Please try again.';
}

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const accountBtn = $('account-btn');
  if (!accountBtn) return; // no game UI on this page (e.g. tests.html)

  const accountBtnIcon = $('account-btn-icon');
  const modal = $('account-modal');
  const titleEl = $('account-modal-title');
  const messageEl = $('account-message');
  const views = {
    login: $('account-login-form'),
    signup: $('account-signup-form'),
    forgot: $('account-forgot-form'),
    reset: $('account-reset-form'),
    claim: $('account-claim-form'),
    profile: $('account-profile-view'),
    notice: $('account-notice-view'),
  };
  const noticeTextEl = $('account-notice-text');
  const resetForEl = $('account-reset-for');
  const profileIconEl = $('account-profile-icon');
  const profileNameEl = $('account-profile-name');
  const syncStatusEl = $('account-sync-status');
  const iconGridEl = $('account-icon-grid');

  // --- The panel ---------------------------------------------------------------

  function setMessage(text, kind = '') {
    messageEl.textContent = text;
    messageEl.className = kind;
  }

  function showView(name, notice) {
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    titleEl.textContent = views[name].dataset.title;
    if (name === 'notice') noticeTextEl.textContent = notice;
    if (name === 'profile') renderProfile();
    setMessage('');
    modal.hidden = false;
    const first = views[name].querySelector('input, button');
    if (first) first.focus();
  }

  function closeModal() {
    modal.hidden = true;
    accountBtn.focus();
  }

  $('account-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('keydown', (e) => {
    // Typing in the panel must never reach the game's own key handlers
    // (WASD moves the player, A/D flips worlds).
    e.stopPropagation();
    if (e.key === 'Escape') closeModal();
  });
  modal.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Carry a typed email over (e.g. into "Forgot password?").
      const fromForm = btn.closest('form');
      const email = fromForm && fromForm.elements.email ? fromForm.elements.email.value : '';
      showView(btn.dataset.view);
      const toForm = views[btn.dataset.view];
      if (email && toForm.elements && toForm.elements.email && !toForm.elements.email.value) {
        toForm.elements.email.value = email;
      }
    });
  });

  // Runs a form's async action with its buttons disabled, showing any error.
  function handleSubmit(form, action) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const buttons = form.querySelectorAll('button');
      buttons.forEach((b) => { b.disabled = true; });
      setMessage('');
      try {
        await action(new FormData(form));
      } catch (err) {
        setMessage(accountErrorMessage(err), 'error');
      } finally {
        buttons.forEach((b) => { b.disabled = false; });
      }
    });
  }

  // --- Account button --------------------------------------------------------------

  let user = null;    // the signed-in Firebase user
  let profile = null; // { username, icon } once their profile has loaded

  function paintAccountButton() {
    if (profile) {
      accountBtnIcon.style.backgroundImage = `url("${profileIconUrl(profile.icon)}")`;
      accountBtn.classList.add('has-profile');
      accountBtn.setAttribute('aria-label', `Account: ${profile.username}`);
      accountBtn.title = profile.username;
    } else {
      accountBtnIcon.style.backgroundImage = `url("${PLAYER_FRAMES.idle}")`;
      accountBtn.classList.remove('has-profile');
      accountBtn.setAttribute('aria-label', 'Log in or sign up');
      accountBtn.title = 'Log in';
    }
  }
  paintAccountButton();

  const configured = typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined' && !!FIREBASE_CONFIG.apiKey;
  if (!configured) {
    const why = typeof FIREBASE_CONFIG !== 'undefined' && !FIREBASE_CONFIG.apiKey
      ? 'Accounts aren’t switched on yet.'
      : 'Couldn’t reach the account server.';
    accountBtn.addEventListener('click', () => {
      showView('notice', `${why} Your progress is still saved on this device.`);
    });
    return;
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
  const userDoc = (uid) => db.collection('users').doc(uid);
  const usernameDoc = (key) => db.collection('usernames').doc(key);

  // Set while this file signs someone in itself (log in, sign up, reset),
  // so onAuthStateChanged leaves that sign-in to it.
  let signingIn = false;
  // The page-load session restore, while it's still loading.
  let pendingSession = null;
  let sessionLoadFailed = false;

  accountBtn.addEventListener('click', async () => {
    if (pendingSession) {
      showView('notice', 'Loading your account…');
      await pendingSession;
    }
    if (profile) showView('profile');
    else if (user && sessionLoadFailed) showView('notice', 'Couldn’t reach your account. Check your connection, then try again.');
    else if (user) showView('claim');
    else showView('login');
  });

  // --- Syncing -------------------------------------------------------------------

  let uploadTimer = null;
  let uploadChain = Promise.resolve(true);
  let changeCount = 0;
  let syncStatus = 'saved';

  function setSyncStatus(status) {
    syncStatus = status;
    if (!views.profile.hidden) renderSyncStatus();
  }

  function renderSyncStatus() {
    syncStatusEl.textContent = {
      saved: '✓ Progress saved to your account',
      saving: 'Saving…',
      error: '⚠ Not saved yet. It will retry when you’re online.',
    }[syncStatus];
    syncStatusEl.className = syncStatus;
  }

  saveChangeListeners.push(({ campaignReset }) => {
    const state = readSyncState();
    if (!state.uid) return; // a guest's save: merged into their account when they log in
    changeCount++;
    writeSyncState({ ...state, dirty: true, campaignReset: state.campaignReset || !!campaignReset });
    if (!profile) return; // uploads once the account has loaded (startSession)
    setSyncStatus('saving');
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(uploadNow, UPLOAD_DELAY_MS);
  });

  // Queues an upload of this device's unsynced changes. Resolves to true once
  // nothing is left unsynced, false if the upload failed (e.g. offline).
  function uploadNow() {
    clearTimeout(uploadTimer);
    uploadTimer = null;
    uploadChain = uploadChain.then(uploadOnce);
    return uploadChain;
  }

  async function uploadOnce() {
    const state = readSyncState();
    if (!state.dirty) return true;
    if (!user || !profile || state.uid !== user.uid) return false;
    const uid = user.uid;
    const countAtStart = changeCount;
    try {
      const merged = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userDoc(uid));
        const cloudText = serializeSave(parseSave(snap.data().save));
        const next = mergeSaves(readLocalSave(), parseSave(cloudText), { campaignReset: state.campaignReset });
        const nextText = serializeSave(next);
        if (nextText !== cloudText) tx.update(userDoc(uid), { save: nextText, updatedAt: serverTime() });
        return next;
      });
      // Only take on the merged save (which can include other devices'
      // progress) if nothing changed here mid-upload; if something did,
      // it's already queued another upload that will merge it in.
      if (changeCount === countAtStart) {
        const changedHere = serializeSave(merged) !== serializeSave(readLocalSave());
        writeLocalSave(merged);
        writeSyncState({ uid, dirty: false, campaignReset: false });
        if (changedHere) refreshProgressViews();
        setSyncStatus('saved');
      }
      return true;
    } catch (err) {
      setSyncStatus('error');
      return false;
    }
  }

  // Loads a signed-in player's profile and brings this device's save in line
  // with their account's. Returns false if they have no profile yet (their
  // sign-up didn't finish), so they need to pick a username.
  async function startSession(signedIn) {
    const snap = await userDoc(signedIn.uid).get();
    user = signedIn;
    sessionLoadFailed = false;
    if (!snap.exists) {
      profile = null;
      paintAccountButton();
      return false;
    }
    const data = snap.data();
    profile = { username: data.username, icon: data.icon };

    const cloud = parseSave(data.save);
    const state = readSyncState();
    const sameAccount = state.uid === signedIn.uid;
    let next;
    if (sameAccount && !state.dirty) next = cloud; // nothing new here: the account's copy is newest
    else if (state.uid && !sameAccount) next = cloud; // what's here belongs to a different account
    else next = mergeSaves(readLocalSave(), cloud, { campaignReset: sameAccount && state.campaignReset });

    writeLocalSave(next);
    const dirty = serializeSave(next) !== serializeSave(cloud);
    writeSyncState({ uid: signedIn.uid, dirty, campaignReset: dirty && sameAccount && state.campaignReset });
    refreshProgressViews();
    paintAccountButton();
    setSyncStatus('saved');
    if (dirty) uploadNow();
    return true;
  }

  // Picks up progress made on another device since this page loaded — the
  // player switching back to this tab is the natural moment to check.
  async function pullLatest() {
    if (!user || !profile) return;
    if (readSyncState().dirty) {
      uploadNow(); // the upload merges in the account's copy too
      return;
    }
    try {
      const snap = await userDoc(user.uid).get();
      if (!snap.exists || !profile || readSyncState().dirty) return;
      const data = snap.data();
      if (data.icon !== profile.icon) {
        profile.icon = data.icon;
        paintAccountButton();
        if (!views.profile.hidden) renderProfile();
      }
      const cloud = parseSave(data.save);
      if (serializeSave(cloud) !== serializeSave(readLocalSave())) {
        writeLocalSave(cloud);
        refreshProgressViews();
      }
    } catch (err) {
      // offline: try again next time
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (readSyncState().dirty) uploadNow();
    } else {
      pullLatest();
    }
  });
  window.addEventListener('online', () => {
    if (readSyncState().dirty) uploadNow();
  });

  auth.onAuthStateChanged((signedIn) => {
    if (signingIn) return;
    if (!signedIn) {
      // Signed out (here, or elsewhere, e.g. by a password reset). This
      // device keeps its save; if the same player logs back in, unsynced
      // changes are merged in then.
      user = null;
      profile = null;
      paintAccountButton();
      return;
    }
    pendingSession = startSession(signedIn)
      .catch(() => {
        user = signedIn;
        sessionLoadFailed = true;
      })
      .finally(() => { pendingSession = null; });
  });

  // Signs in via `signInAction` (which resolves to a Firebase credential),
  // loads the account and shows its panel.
  async function signInAndOpen(signInAction, message) {
    signingIn = true;
    try {
      const cred = await signInAction();
      const hasProfile = await startSession(cred.user);
      showView(hasProfile ? 'profile' : 'claim');
      if (message) setMessage(message, 'ok');
    } finally {
      signingIn = false;
    }
  }

  // --- Log in / sign up ----------------------------------------------------------

  function checkUsername(username) {
    if (!USERNAME_PATTERN.test(username)) {
      throw friendlyError('Usernames are 3–16 letters, numbers or underscores.');
    }
  }

  function checkPassword(password) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw friendlyError(`Pick a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
  }

  // Creates the player's profile and reserves their username in one batch;
  // firestore.rules only accepts the pair together, and refuses a username
  // someone else already holds.
  async function claimUsername(signedIn, username) {
    const key = username.toLowerCase();
    const state = readSyncState();
    // A guest's progress comes along into their new account.
    const save = state.uid && state.uid !== signedIn.uid ? emptySave() : readLocalSave();
    const batch = db.batch();
    batch.set(usernameDoc(key), { uid: signedIn.uid });
    batch.set(userDoc(signedIn.uid), {
      username, usernameKey: key, icon: DEFAULT_PROFILE_ICON, save: serializeSave(save), updatedAt: serverTime(),
    });
    try {
      await batch.commit();
    } catch (err) {
      if (err.code === 'permission-denied') throw friendlyError('That username is taken. Try another.');
      throw err;
    }
    writeSyncState({ uid: signedIn.uid, dirty: false, campaignReset: false });
  }

  async function ensureUsernameFree(username) {
    const taken = await usernameDoc(username.toLowerCase()).get();
    if (taken.exists) throw friendlyError('That username is taken. Try another.');
  }

  handleSubmit(views.login, (data) => signInAndOpen(
    () => auth.signInWithEmailAndPassword(String(data.get('email')).trim(), String(data.get('password'))),
  ));

  handleSubmit(views.signup, async (data) => {
    const username = String(data.get('username')).trim();
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    checkUsername(username);
    checkPassword(password);
    await ensureUsernameFree(username);
    await signInAndOpen(async () => {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      try {
        await claimUsername(cred.user, username);
      } catch (err) {
        // Don't leave an account behind with no username.
        await cred.user.delete().catch(() => auth.signOut());
        throw err;
      }
      return cred;
    }, `Welcome, ${username}! Your progress now saves to your account.`);
  });

  handleSubmit(views.claim, async (data) => {
    const username = String(data.get('username')).trim();
    checkUsername(username);
    await ensureUsernameFree(username);
    await claimUsername(user, username);
    await startSession(user);
    showView('profile');
  });
  $('account-claim-logout-btn').addEventListener('click', () => logOut());

  // --- Forgot / reset password -----------------------------------------------------
  //
  // Firebase emails the reset link. With the email template's action URL
  // pointed at the game (see SPEC.md), the link opens the game with
  // ?mode=resetPassword&oobCode=…, handled below; otherwise it opens
  // Firebase's own plain reset page, which works just as well.

  handleSubmit(views.forgot, async (data) => {
    const email = String(data.get('email')).trim();
    await auth.sendPasswordResetEmail(email);
    setMessage(`If an account uses ${email}, a reset link is on its way. Check your inbox and spam folder.`, 'ok');
  });

  let resetCode = null;
  let resetEmail = null;

  handleSubmit(views.reset, async (data) => {
    const password = String(data.get('password'));
    checkPassword(password);
    await auth.confirmPasswordReset(resetCode, password);
    await signInAndOpen(
      () => auth.signInWithEmailAndPassword(resetEmail, password),
      'Password changed. You’re logged in.',
    );
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'resetPassword' && params.get('oobCode')) {
    resetCode = params.get('oobCode');
    // Keep the one-time code out of the address bar (and out of reloads).
    history.replaceState(null, '', window.location.pathname);
    showView('notice', 'Checking your reset link…');
    auth.verifyPasswordResetCode(resetCode)
      .then((email) => {
        resetEmail = email;
        showView('reset');
        resetForEl.textContent = `Choose a new password for ${email}.`;
      })
      .catch((err) => {
        showView('forgot');
        setMessage(accountErrorMessage(err), 'error');
      });
  }

  // --- Account panel ------------------------------------------------------------------

  function renderProfile() {
    if (!profile) return;
    profileIconEl.style.backgroundImage = `url("${profileIconUrl(profile.icon)}")`;
    profileNameEl.textContent = profile.username;
    renderSyncStatus();
    iconGridEl.innerHTML = '';
    PROFILE_ICONS.forEach((icon) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'account-icon-choice';
      btn.style.backgroundImage = `url("${icon.url}")`;
      btn.title = icon.name;
      btn.setAttribute('aria-label', icon.name);
      btn.setAttribute('aria-pressed', String(icon.id === profile.icon));
      btn.addEventListener('click', () => chooseIcon(icon.id));
      iconGridEl.appendChild(btn);
    });
  }

  async function chooseIcon(id) {
    if (!profile || id === profile.icon) return;
    const previous = profile.icon;
    profile.icon = id;
    paintAccountButton();
    renderProfile();
    iconGridEl.querySelector('[aria-pressed="true"]').focus();
    try {
      await userDoc(user.uid).update({ icon: id, updatedAt: serverTime() });
    } catch (err) {
      profile.icon = previous;
      paintAccountButton();
      renderProfile();
      setMessage('Couldn’t save your icon. Try again.', 'error');
    }
  }

  async function logOut() {
    setMessage('Saving your progress…');
    if (!(await uploadNow())) {
      setMessage('Couldn’t save your latest progress to your account. Check your connection and try again.', 'error');
      return;
    }
    await auth.signOut();
    user = null;
    profile = null;
    if (readSyncState().uid) clearLocalSave(); // only an account's save, never a guest's
    writeSyncState(null);
    refreshProgressViews();
    paintAccountButton();
    showView('login');
    setMessage('Logged out. Your progress is safe in your account.', 'ok');
  }
  $('account-logout-btn').addEventListener('click', () => logOut());
});
