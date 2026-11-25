// ─── Firebase Configuration ───────────────────────────────────────────────
// IMPORTANT: Replace the values below with YOUR Firebase project config.
// Go to: Firebase Console → Project Settings → Your Apps → Web App → Config
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendEmailVerification,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWWFXtMN8foAlJUZSRPbwsqTxjsMpiPBo",
  authDomain: "expenses-f1216.firebaseapp.com",
  projectId: "expenses-f1216",
  storageBucket: "expenses-f1216.firebasestorage.app",
  messagingSenderId: "139875989789",
  appId: "1:139875989789:web:1d5ff13fdb4156114d49f4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── State ────────────────────────────────────────────────────────────────
let currentUser = null;
let allTransactions = [];
let allBudgets = [];
let allTabung = [];
let allLoans = [];
let userSettings = { 
  currency: '$', 
  theme: 'dark', 
  avatarUrl: '', 
  creditPoolLimit: 2000, 
  creditPoolDueDay: 25,
  creditCards: [
    { id: 'legacy-default', name: 'Primary Card' }
  ],
  mykasihAllowance: 50,
  mykasihBaseBalance: 50,
  mykasihLastTopupMonth: ''
};
let activeCCCardId = 'legacy-default';
let editingCCCardId = null;
let grossIncome = 0; // User-defined gross monthly income
let expensesChart = null;
let activeFilter = 'all';
let editingTxId = null;
let editingBudgetId = null;
let editingTabungId = null;
let editingLoanId = null;
let topupTabungId = null;
let loanPayId = null;
let activeTabungDetailId = null;
let activeLoanDetailId = null;
let tabungActionType = 'add';
let pendingDeleteId = null;
let txType = 'income';
let loanType = 'owe';
let unsubscribeListener = null;
let unsubscribeBudgets = null;
let unsubscribeSettings = null;
let unsubscribeTabung = null;
let unsubscribeLoans = null;
let unsubscribeChecklist = null;
let allChecklist = [];
let isRegistering = false;
let transactionsLoaded = false;
let budgetsLoaded = false;
let settingsLoaded = false;

// Dashboard Month Selection State (SpendWise Home Month Switcher)
let dashSelectedYear  = new Date().getFullYear();
let dashSelectedMonth = new Date().getMonth(); // 0-indexed

// Budgets Month Selection State (SpendWise Budgets Month Switcher)
let budgetSelectedYear  = new Date().getFullYear();
let budgetSelectedMonth = new Date().getMonth(); // 0-indexed

// Categories Month Selection State
let catSelectedYear  = new Date().getFullYear();
let catSelectedMonth = new Date().getMonth(); // 0-indexed

// Transactions Month Selection State
let txSelectedYear  = new Date().getFullYear();
let txSelectedMonth = new Date().getMonth(); // 0-indexed

// ─── Auth State ───────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (isRegistering) return; // Skip during active registration to avoid race conditions
  if (user) {
    currentUser = user;
    showApp(user);
    subscribeToData();
  } else {
    currentUser = null;
    hideApp();
    if (unsubscribeListener) { unsubscribeListener(); unsubscribeListener = null; }
    if (unsubscribeBudgets) { unsubscribeBudgets(); unsubscribeBudgets = null; }
    if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }
    if (unsubscribeTabung) { unsubscribeTabung(); unsubscribeTabung = null; }
    if (unsubscribeLoans) { unsubscribeLoans(); unsubscribeLoans = null; }
    if (unsubscribeChecklist) { unsubscribeChecklist(); unsubscribeChecklist = null; }
    allTransactions = [];
    allBudgets = [];
    allTabung = [];
    allLoans = [];
    allChecklist = [];
    grossIncome = 0;
    userSettings = { currency: '$', theme: 'dark', avatarUrl: '' };
    transactionsLoaded = false;
    budgetsLoaded = false;
    settingsLoaded = false;
  }
});

function showApp(user) {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  const name = user.displayName || user.email.split('@')[0];
  updateMobileAvatar(name[0].toUpperCase());
  setGreeting();
  setHeroDate();

  // Populate year select and set current month/year defaults
  initMonthYearSelects();
  initCatMonthYearSelects();

  // Always start on Dashboard after login
  navigateTo('dashboard');
}

function hideApp() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('app').classList.add('hidden');
  const overlay = document.getElementById('profile-settings-overlay');
  if (overlay) overlay.classList.add('hidden');
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function initMonthYearSelects() {
  const listContainer = document.getElementById('filter-month-list');
  const hiddenInput = document.getElementById('filter-month-combined');
  if (!listContainer || !hiddenInput) return;

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth(); // 0-indexed

  txSelectedYear  = curY;
  txSelectedMonth = curM;

  listContainer.innerHTML = '';
  
  const defaultVal = `${curY}-${String(curM + 1).padStart(2, '0')}`;
  hiddenInput.value = defaultVal;
  
  updateTxMonthLabel();

  // Generate options from current month going back 36 months (3 years)
  for (let i = 0; i < 36; i++) {
    const d = new Date(curY, curM - i, 1);
    const yVal = d.getFullYear();
    const mVal = String(d.getMonth() + 1).padStart(2, '0');
    const val = `${yVal}-${mVal}`;
    const labelText = `${MONTH_NAMES[d.getMonth()]} ${yVal}`;
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'month-selector-item';
    if (i === 0) btn.classList.add('selected');
    btn.textContent = labelText;
    btn.dataset.value = val;
    btn.onclick = function() {
      selectMonthForTransactions(val, labelText, btn);
    };
    listContainer.appendChild(btn);
  }
}

function updateTxMonthLabel() {
  const label = document.getElementById('month-picker-label');
  if (!label) return;
  const d = new Date(txSelectedYear, txSelectedMonth, 1);
  label.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
  // Disable next arrow if at current month
  const now = new Date();
  const nextBtn = document.getElementById('tx-month-next');
  if (nextBtn) {
    const isCurrent = txSelectedYear === now.getFullYear() && txSelectedMonth === now.getMonth();
    nextBtn.disabled = isCurrent;
    nextBtn.style.opacity = isCurrent ? '0.3' : '1';
  }
}

window.txMonthShift = function(dir) {
  txSelectedMonth += dir;
  if (txSelectedMonth > 11) { txSelectedMonth = 0; txSelectedYear++; }
  if (txSelectedMonth < 0)  { txSelectedMonth = 11; txSelectedYear--; }

  const val = `${txSelectedYear}-${String(txSelectedMonth + 1).padStart(2, '0')}`;
  const hiddenInput = document.getElementById('filter-month-combined');
  if (hiddenInput) hiddenInput.value = val;

  // Sync selected class in custom list
  const listContainer = document.getElementById('filter-month-list');
  if (listContainer) {
    listContainer.querySelectorAll('.month-selector-item').forEach(b => {
      b.classList.toggle('selected', b.dataset.value === val);
    });
  }

  updateTxMonthLabel();
  renderAllTransactions();
};

window.selectMonthForTransactions = function(val, labelText, clickedEl) {
  const hiddenInput = document.getElementById('filter-month-combined');
  if (hiddenInput) hiddenInput.value = val;

  // Sync txSelectedYear/Month state
  const parts = val.split('-');
  txSelectedYear  = parseInt(parts[0], 10);
  txSelectedMonth = parseInt(parts[1], 10) - 1;

  updateTxMonthLabel();

  // Toggle active class
  const listContainer = document.getElementById('filter-month-list');
  if (listContainer) {
    listContainer.querySelectorAll('.month-selector-item').forEach(b => b.classList.remove('selected'));
  }
  if (clickedEl) clickedEl.classList.add('selected');

  // Close dropdown
  const dd = document.getElementById('month-picker-dropdown');
  if (dd) dd.classList.add('hidden');

  // Trigger filter
  filterByMonth();
};

window.toggleMonthPicker = function(e) {
  e.stopPropagation();
  const dd = document.getElementById('month-picker-dropdown');
  if (!dd) return;
  dd.classList.toggle('hidden');
};

// Close picker when clicking outside
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('month-picker-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('month-picker-dropdown');
    if (dd) dd.classList.add('hidden');
  }
  const catWrap = document.getElementById('cat-month-picker-wrap');
  if (catWrap && !catWrap.contains(e.target)) {
    const catDd = document.getElementById('cat-month-picker-dropdown');
    if (catDd) catDd.classList.add('hidden');
  }
  // Close CC card switcher dropdown on outside click
  const ccWrap = document.querySelector('.cc-switcher-wrap');
  if (ccWrap && !ccWrap.contains(e.target)) {
    closeCCSwitcher();
  }
});

function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning! 👋' : h < 17 ? 'Good afternoon! ☀️' : 'Good evening! 🌙';
  const mobGreet = document.getElementById('mob-greeting');
  if (mobGreet) mobGreet.textContent = greet;
}

function setHeroDate() {
  const el = document.getElementById('mob-hero-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function updateMobileAvatar(initial) {
  const el = document.getElementById('mobile-user-avatar');
  if (!el) return;
  if (userSettings && userSettings.avatarUrl) {
    el.innerHTML = `<img src="${userSettings.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  } else {
    el.innerHTML = '';
    el.textContent = initial;
  }
}

// ─── Auth Actions ──────────────────────────────────────────────────────────
window.switchAuth = function (form) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(form + '-form').classList.add('active');
  clearAuthErrors();
};

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  // Scroll into view so user sees the error
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Shake animation
  el.classList.remove('shake');
  void el.offsetWidth; // force reflow
  el.classList.add('shake');
}

// Resolve username to email via Firestore lookup
async function resolveLoginEmail(input) {
  if (input.includes('@')) return input; // it's already an email
  try {
    // Look up username in 'usernames' collection
    const snap = await getDocs(query(collection(db, 'usernames'), where('username', '==', input.toLowerCase())));
    if (snap.empty) return null;
    return snap.docs[0].data().email;
  } catch (e) {
    console.warn('Username lookup failed (permission?):', e.code || e.message);
    // If Firestore lookup fails (e.g. permission denied), return the input as-is
    // so Firebase Auth can attempt it directly (works if user typed their email)
    return null;
  }
}

window.handleLogin = async function() {
  const input = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  // Clear previous errors
  const errEl = document.getElementById('login-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (!input || !pw) return showAuthError('login-error', 'Please fill in all fields.');
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    let email = await resolveLoginEmail(input);
    if (!email) {
      if (input.includes('@')) {
        email = input;
      } else {
        showAuthError('login-error', 'Username not found. Please try signing in with your email address.');
        return;
      }
    }
    await signInWithEmailAndPassword(auth, email, pw);
    await storeCredential(input, pw);
  } catch (e) {
    console.error('Login Error:', e);
    showAuthError('login-error', friendlyAuthError(e.code || e.message || String(e)));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
};

document.getElementById('btn-login').addEventListener('click', window.handleLogin);

document.getElementById('btn-register').addEventListener('click', async () => {
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const email = document.getElementById('reg-email').value.trim();
  const pw = document.getElementById('reg-password').value;
  if (!name || !username || !email || !pw) return showAuthError('register-error', 'Please fill in all fields.');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return showAuthError('register-error', 'Username must be 3-20 characters (letters, numbers, underscore only).');
  if (pw.length < 6) return showAuthError('register-error', 'Password must be at least 6 characters.');
  const btn = document.getElementById('btn-register');
  btn.disabled = true; btn.textContent = 'Creating…';
  isRegistering = true; // Pause auth state listener to prevent race condition
  try {
    // 1. Check username availability first
    const existing = await getDocs(query(collection(db, 'usernames'), where('username', '==', username)));
    if (!existing.empty) {
      showAuthError('register-error', 'That username is already taken. Please choose another.');
      isRegistering = false;
      return;
    }
    // 2. Create Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: name });
    // 3. Save username → email mapping in Firestore (own try-catch so it's resilient)
    try {
      await setDoc(doc(db, 'usernames', cred.user.uid), { username, email, displayName: name, uid: cred.user.uid });
    } catch (fsErr) {
      console.error('Failed to save username to Firestore:', fsErr.message);
      showAuthError('register-error', '⚠️ Account created but username could not be saved. Please check Firestore rules.');
    }
    // 4. Log in immediately
    currentUser = cred.user;
    showApp(currentUser);
    subscribeToData();
  } catch (e) {
    console.error("Registration Error details:", e);
    showAuthError('register-error', friendlyAuthError(e.code || e.message || String(e)));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    isRegistering = false; // Resume auth state listener
  }
});

// ─── Email Verification Actions ────────────────────────────────────────────
window.checkVerification = async function () {
  const btn = document.getElementById('btn-check-verify');
  btn.disabled = true; btn.textContent = 'Checking…';
  try {
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      showApp(auth.currentUser);
      subscribeToData();
    } else {
      showAuthError('verify-error', 'Email not verified yet. Please click the link in your inbox.');
    }
  } catch (e) {
    showAuthError('verify-error', 'Error checking verification. Please try again.');
  } finally { btn.disabled = false; btn.textContent = "I've Verified"; }
};

window.resendVerification = async function () {
  const btn = document.getElementById('btn-resend-verify');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await sendEmailVerification(auth.currentUser);
    showAuthError('verify-error', '✅ Verification email re-sent! Check your inbox.');
    document.getElementById('verify-error').style.borderLeftColor = 'var(--accent-green)';
  } catch (e) {
    showAuthError('verify-error', 'Too many requests. Please wait a few minutes.');
  } finally { btn.disabled = false; btn.textContent = 'Resend Email'; }
};

window.logoutUser = async function () {
  await signOut(auth);
  // Reset balance visibility so next user starts fresh
  balanceHidden = false;
  // Clear all login/register fields
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  // Always redirect to login page
  switchAuth('login');
  showToast('Signed out successfully.', 'success');
};

// ─── Face ID / Touch ID (Credential Management API) ───────────────────────
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasCMA = !!window.PasswordCredential; // Chrome/Android only
const hasCreds = !!navigator.credentials;   // Available on iOS Safari too

function showFaceIdButton() {
  if (isIOS || hasCMA) {
    const btn = document.getElementById('btn-face-id');
    const orText = document.getElementById('face-id-or');
    if (btn) btn.classList.remove('hidden');
    if (orText) orText.classList.remove('hidden');
  }
}

async function storeCredential(id, password) {
  if (!hasCMA) return;
  try {
    const cred = new PasswordCredential({ id, password });
    await navigator.credentials.store(cred);
  } catch (e) { /* Silent */ }
}

// Shared login-with-credential function used by both auto-sign-in and button
async function loginWithCredential(cred) {
  if (!cred || !cred.id || !cred.password) return false;
  try {
    const email = await resolveLoginEmail(cred.id);
    if (!email) return false;
    await signInWithEmailAndPassword(auth, email, cred.password);
    return true;
  } catch (e) {
    return false;
  }
}

// On page load: silently try to log in if credentials are already saved
async function tryAutoSignIn() {
  if (!hasCreds) return;
  try {
    // mediation: 'silent' = no prompt, return saved creds if any
    const cred = await navigator.credentials.get({ password: true, mediation: 'silent' });
    if (cred) await loginWithCredential(cred);
  } catch (e) { /* No saved credentials or not supported */ }
}

// Face ID / Touch ID button tap: prompt the user to pick a credential with biometrics
window.faceIdLogin = async function () {
  if (!hasCreds) return;
  const btn = document.getElementById('btn-face-id');
  const resetBtn = () => {
    btn.disabled = false;
    btn.innerHTML = '<span class="face-id-icon">🔒</span> Sign in with Face ID / Touch ID';
  };
  btn.disabled = true;
  btn.innerHTML = '<span class="face-id-icon">🔒</span> Scanning…';

  // Step 1: Try to get credentials via the credential picker (triggers Face ID on iOS)
  let cred;
  try {
    cred = await navigator.credentials.get({ password: true, mediation: 'required' });
  } catch (e) {
    // API not supported or user dismissed → silent reset, no error shown
    resetBtn(); return;
  }
  if (!cred) { resetBtn(); return; }

  // Step 2: Got credentials — try to sign in
  btn.innerHTML = '<span class="face-id-icon">🔒</span> Signing in…';
  try {
    const email = await resolveLoginEmail(cred.id);
    if (!email) {
      showAuthError('login-error', 'No account found. Please log in with your password first.');
      resetBtn(); return;
    }
    await signInWithEmailAndPassword(auth, email, cred.password);
    // Success — onAuthStateChanged handles the rest
  } catch (e) {
    console.error("Face ID Login failure:", e);
    showAuthError('login-error', friendlyAuthError(e.code || e.message || String(e)));
    resetBtn();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  showFaceIdButton();
  tryAutoSignIn(); // Attempt silent auto-login on every page load
  initAmountInputMasks();
  
  // Read checklist open state from localStorage
  const isChecklistOpen = localStorage.getItem('checklistOpen') !== 'false';
  const checklistCard = document.getElementById('checklist-card');
  if (checklistCard) {
    if (isChecklistOpen) checklistCard.classList.add('open');
    else checklistCard.classList.remove('open');
  }

  // Read chart open state from localStorage
  // Chart card now lives on categories page — always open by default
  const chartCard = document.getElementById('expenses-chart-card');
  if (chartCard) chartCard.classList.add('open');



  // Read dashboard CC card open state from localStorage
  const isCCOpen = localStorage.getItem('dashboardCCOpen') !== 'false';
  const ccCard = document.querySelector('.cc-dashboard-card');
  if (ccCard) {
    if (isCCOpen) ccCard.classList.add('open');
    else ccCard.classList.remove('open');
  }

  const isMyKasihOpen = localStorage.getItem('mykasihOpen') !== 'false';
  const mykasihCard = document.getElementById('dashboard-mykasih-card');
  if (mykasihCard) {
    if (isMyKasihOpen) mykasihCard.classList.add('open');
    else mykasihCard.classList.remove('open');
  }
});

document.getElementById('btn-forgot').addEventListener('click', async () => {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return showAuthError('forgot-error', 'Please enter your email address.');
  const btn = document.getElementById('btn-forgot');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthError('forgot-error', '✅ Reset link sent! Check your inbox.');
    document.getElementById('forgot-error').style.borderLeftColor = 'var(--accent-green)';
  } catch (e) {
    console.error("Forgot Password Error details:", e);
    showAuthError('forgot-error', friendlyAuthError(e.code || e.message || String(e)));
  } finally { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
});

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'Email is already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password is too weak.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'permission-denied': 'Database permission denied. If using a username, please sign in with your email address directly.',
    'firestore/permission-denied': 'Database permission denied. If using a username, please sign in with your email address directly.'
  };
  
  if (!code) return 'An error occurred. Please try again.';
  
  const cleanCode = String(code).toLowerCase();
  if (cleanCode.includes('permission-denied') || cleanCode.includes('permission_denied')) {
    return 'Database permission denied. If using a username, please sign in with your email address directly.';
  }
  
  return map[code] || `An error occurred (${code}). Please try again.`;
}

// ─── Firestore Subscriptions ──────────────────────────────────────────────
function subscribeToData() {
  if (!currentUser) return;
  
  // 1. Transactions
  const q = query(
    collection(db, 'transactions'),
    where('uid', '==', currentUser.uid),
    orderBy('date', 'desc')
  );
  unsubscribeListener = onSnapshot(q, (snap) => {
    allTransactions = snap.docs.map(d => {
      const data = d.data();
      if (data.category === 'Food & Dining') data.category = 'Food';
      return { id: d.id, ...data };
    });
    // Local sort: Date descending, then createdAt descending to ensure newest additions are at the top
    allTransactions.sort((a, b) => {
      if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
      const aTime = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : Date.now();
      const bTime = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : Date.now();
      return bTime - aTime;
    });
    transactionsLoaded = true;
    checkForMonthlyReset();
    renderAll();
  }, (err) => {
    console.error('Firestore error:', err);
    if (err.code === 'failed-precondition') {
      showToast('Please create a Firestore index. Check console for link.', 'error');
    }
  });

  // 2. Budgets — split into regular budgets and checklist items client-side
  // (avoids composite index requirement for a second where clause)
  const bq = query(collection(db, 'budgets'), where('uid', '==', currentUser.uid));
  unsubscribeBudgets = onSnapshot(bq, snap => {
    const allDocs = snap.docs.map(d => {
      const data = d.data();
      if (data.category === 'Food & Dining') data.category = 'Food';
      return { id: d.id, ...data };
    });
    allBudgets = allDocs.filter(d => !d.isChecklist);
    allChecklist = allDocs.filter(d => !!d.isChecklist);
    allChecklist.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    budgetsLoaded = true;
    checkForMonthlyReset();
    renderChecklist();
    if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
  });

  unsubscribeSettings = onSnapshot(doc(db, 'settings', currentUser.uid), docSnap => {
    if (docSnap.exists()) {
      userSettings = { ...userSettings, ...docSnap.data() };
      
      // Migrate legacy per-card limit/dueDay → shared pool
      if (!userSettings.creditCards || !Array.isArray(userSettings.creditCards) || userSettings.creditCards.length === 0) {
        const legacyLimit  = docSnap.data().creditLimit  !== undefined ? docSnap.data().creditLimit  : 2000;
        const legacyDueDay = docSnap.data().creditDueDay !== undefined ? docSnap.data().creditDueDay : 25;
        userSettings.creditCards       = [{ id: 'legacy-default', name: 'Primary Card' }];
        userSettings.creditPoolLimit   = legacyLimit;
        userSettings.creditPoolDueDay  = legacyDueDay;
        setDoc(doc(db, 'settings', currentUser.uid), {
          creditCards: userSettings.creditCards,
          creditPoolLimit: userSettings.creditPoolLimit,
          creditPoolDueDay: userSettings.creditPoolDueDay
        }, { merge: true }).catch(console.error);
      } else if (!userSettings.creditPoolLimit) {
        // Promote first card's limit to pool if pool not yet set
        const firstCard = userSettings.creditCards[0];
        userSettings.creditPoolLimit  = (firstCard && firstCard.limit)  ? firstCard.limit  : 2000;
        userSettings.creditPoolDueDay = (firstCard && firstCard.dueDay) ? firstCard.dueDay : 25;
        // Strip limit/dueDay from individual cards
        userSettings.creditCards = userSettings.creditCards.map(({ id, name }) => ({ id, name }));
        setDoc(doc(db, 'settings', currentUser.uid), {
          creditCards: userSettings.creditCards,
          creditPoolLimit: userSettings.creditPoolLimit,
          creditPoolDueDay: userSettings.creditPoolDueDay
        }, { merge: true }).catch(console.error);
      }

      const cards = userSettings.creditCards;
      if (!activeCCCardId || !cards.some(c => c.id === activeCCCardId)) {
        activeCCCardId = cards[0] ? cards[0].id : 'legacy-default';
      }

      // Load gross income from settings
      if (typeof docSnap.data().grossIncome === 'number') {
        grossIncome = docSnap.data().grossIncome;
      } else {
        grossIncome = 0;
      }
      // Restore balance visibility preference from Firestore
      if (typeof docSnap.data().balanceHidden === 'boolean') {
        balanceHidden = docSnap.data().balanceHidden;
        localStorage.setItem('balanceHidden', balanceHidden ? 'true' : 'false');
        applyBalanceVisibility();
      }
      settingsLoaded = true;
      checkForMonthlyReset();
      applySettings();
      updateSummaryCards();
      if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
    } else {
      // Document doesn't exist yet for new user — start with pool defaults
      userSettings = { 
        currency: '$', 
        theme: 'dark', 
        avatarUrl: '', 
        creditPoolLimit: 2000, 
        creditPoolDueDay: 25,
        creditCards: [{ id: 'legacy-default', name: 'Primary Card' }],
        mykasihAllowance: 50,
        mykasihBaseBalance: 50,
        mykasihLastTopupMonth: ''
      };
      activeCCCardId = 'legacy-default';
      grossIncome = 0;
      balanceHidden = false;
      applyBalanceVisibility();
      settingsLoaded = true;
      checkForMonthlyReset();
      applySettings();
      updateSummaryCards();
      if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
    }
  });

  // 4. Tabung (savings)
  const tq = query(collection(db, 'tabung'), where('uid', '==', currentUser.uid));
  unsubscribeTabung = onSnapshot(tq, snap => {
    allTabung = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateSummaryCards();
    if (document.getElementById('page-tabung').classList.contains('active')) renderTabung();
    if (activeTabungDetailId) refreshTabungDetailsModal();
  });

  // 5. Loans
  const lq = query(collection(db, 'loans'), where('uid', '==', currentUser.uid));
  unsubscribeLoans = onSnapshot(lq, snap => {
    allLoans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateSummaryCards();
    if (document.getElementById('page-loans').classList.contains('active')) renderLoans();
    if (activeLoanDetailId) refreshLoanDetailsModal();
  });
}

let isResettingMonth = false;

async function checkForMonthlyReset() {
  if (!currentUser || isResettingMonth) return;
  if (!transactionsLoaded || !budgetsLoaded || !settingsLoaded) return;
  
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const lastProcessedMonth = userSettings.lastProcessedMonth;
  const migrationVersion = userSettings.migrationVersion || 0;
  
  // One-time migration to version 3 to upgrade schema without overwriting user carryover balance settings
  if (migrationVersion < 3) {
    isResettingMonth = true;
    try {
      console.log(`Running one-time migration to version 3. Upgrading schema.`);
      await setDoc(doc(db, 'settings', currentUser.uid), {
        lastProcessedMonth: userSettings.lastProcessedMonth || currentMonthStr,
        migrationVersion: 3
      }, { merge: true });
      
      userSettings.lastProcessedMonth = userSettings.lastProcessedMonth || currentMonthStr;
      userSettings.migrationVersion = 3;
    } catch (e) {
      console.error("Error during version 3 migration:", e);
    } finally {
      isResettingMonth = false;
    }
    return;
  }
  
  // If a new month has arrived
  if (lastProcessedMonth !== currentMonthStr) {
    isResettingMonth = true;
    try {
      showToast('Processing new month transitions...', 'info');
      
      // 1. Calculate previous month's ending remaining balance (ONLY cash/debit expenses, excluding Credit Card & MyKasih purchases)
      const prevGross = typeof userSettings.grossIncome === 'number' ? userSettings.grossIncome : 0;
      const prevCarry = typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : 0;
      
      const prevExpenses = allTransactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit' && !t.cardId && t.paymentMethod !== 'mykasih' && t.category !== 'Credit Card Payment' && t.date && t.date.startsWith(lastProcessedMonth))
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
      const prevIncome = allTransactions
        .filter(t => t.type === 'income' && t.date && t.date.startsWith(lastProcessedMonth))
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
      const prevRemaining = prevCarry + prevGross + prevIncome - prevExpenses;
      
      console.log(`Reset transition: calculated previous remaining balance = ${prevRemaining}`);
      
      // 2. Wipe out all checklist items (stored in budgets collection with isChecklist: true)
      const deletePromises = allChecklist.map(item => deleteDoc(doc(db, 'budgets', item.id)));
      await Promise.all(deletePromises);
      
      // 3. Preserve gross income (do not wipe to 0), save new carryOverBalance, and update lastProcessedMonth
      await setDoc(doc(db, 'settings', currentUser.uid), {
        carryOverBalance: prevRemaining,
        lastProcessedMonth: currentMonthStr
      }, { merge: true });
      
      // Update local variables in sync
      userSettings.carryOverBalance = prevRemaining;
      userSettings.lastProcessedMonth = currentMonthStr;
      
      showToast('Welcome to a new month! Checklist wiped and remaining balance carried over.', 'success');
    } catch (e) {
      console.error("Error during monthly reset:", e);
      showToast('Failed to complete monthly reset transitions.', 'error');
    } finally {
      isResettingMonth = false;
    }
  }
}

// ─── Settings ──────────────────────────────────────────────────────────────
function applySettings() {
  const metaTheme = document.getElementById('theme-color-meta');
  if (userSettings.theme === 'light') {
    document.documentElement.classList.add('light-theme');
    if(metaTheme) metaTheme.setAttribute('content', '#ffffff');
  } else {
    document.documentElement.classList.remove('light-theme');
    if(metaTheme) metaTheme.setAttribute('content', '#111827');
  }
  document.querySelectorAll('.dynamic-currency').forEach(el => el.textContent = userSettings.currency);
  
  const previewImg = document.getElementById('avatar-preview-img');
  const previewInitials = document.getElementById('avatar-preview-initials');
  const removeBtn = document.getElementById('btn-remove-avatar');
  
  const initial = (currentUser.displayName || currentUser.email)[0].toUpperCase();
  
  if (userSettings.avatarUrl) {
    updateMobileAvatar(initial); // uses avatarUrl from userSettings
    
    if (previewImg) {
      previewImg.src = userSettings.avatarUrl;
      previewImg.style.display = 'block';
      previewInitials.style.display = 'none';
      removeBtn.style.display = 'inline-flex';
    }
  } else {
    updateMobileAvatar(initial);
    
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
      previewInitials.textContent = initial;
      previewInitials.style.display = 'block';
      removeBtn.style.display = 'none';
    }
  }
  
  document.getElementById('setting-currency').value = userSettings.currency;
  document.getElementById('setting-theme').value = userSettings.theme;
  const grossInput = document.getElementById('setting-gross-income');
  if (grossInput) setAmountInputValue('setting-gross-income', grossIncome || '');

  const carryInput = document.getElementById('setting-carry-over');
  if (carryInput) setAmountInputValue('setting-carry-over', typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : '');
  
  // Sync Profile & Settings Modal elements reactively
  const modalCurrencySelect = document.getElementById('modal-setting-currency');
  if (modalCurrencySelect) modalCurrencySelect.value = userSettings.currency;
  
  const modalThemeSelect = document.getElementById('modal-setting-theme');
  if (modalThemeSelect) modalThemeSelect.value = userSettings.theme;
  
  const modalGrossInput = document.getElementById('modal-setting-gross-income');
  if (modalGrossInput) setAmountInputValue('modal-setting-gross-income', grossIncome || '');

  const modalCarryInput = document.getElementById('modal-setting-carry-over');
  if (modalCarryInput) setAmountInputValue('modal-setting-carry-over', typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : '');
  
  const modalPreviewImg = document.getElementById('modal-avatar-preview-img');
  const modalPreviewInitials = document.getElementById('modal-avatar-preview-initials');
  const modalRemoveBtn = document.getElementById('modal-btn-remove-avatar');
  
  if (userSettings.avatarUrl) {
    if (modalPreviewImg) {
      modalPreviewImg.src = userSettings.avatarUrl;
      modalPreviewImg.style.display = 'block';
    }
    if (modalPreviewInitials) modalPreviewInitials.style.display = 'none';
    if (modalRemoveBtn) modalRemoveBtn.style.display = 'inline-flex';
  } else {
    if (modalPreviewImg) {
      modalPreviewImg.src = '';
      modalPreviewImg.style.display = 'none';
    }
    if (modalPreviewInitials) {
      modalPreviewInitials.textContent = initial;
      modalPreviewInitials.style.display = 'block';
    }
    if (modalRemoveBtn) modalRemoveBtn.style.display = 'none';
  }
  
  renderAll(); // Re-render to update currency formats
}

window.saveSettings = async function () {
  const currency = document.getElementById('setting-currency').value;
  const theme = document.getElementById('setting-theme').value;
  const grossInput = document.getElementById('setting-gross-income');
  const grossVal = grossInput ? parseFloat(grossInput.value) || 0 : 0;
  
  const carryInput = document.getElementById('setting-carry-over');
  const carryVal = carryInput ? parseFloat(carryInput.value) || 0 : 0;
  
  try {
    await setDoc(doc(db, 'settings', currentUser.uid), { 
      currency, 
      theme, 
      grossIncome: grossVal,
      carryOverBalance: carryVal,
      migrationVersion: 3
    }, { merge: true });
    grossIncome = grossVal;
    userSettings.grossIncome = grossVal;
    userSettings.carryOverBalance = carryVal;
    userSettings.migrationVersion = 3;
    showToast('Settings saved!', 'success');
    updateSummaryCards();
  } catch(e) {
    console.error(e);
    showToast('Failed to save settings', 'error');
  }
};

// ─── GROSS INCOME ────────────────────────────────────────────────────────────
window.openGrossIncomeModal = function() {
  const input = document.getElementById('gross-income-input');
  if (input && grossIncome > 0) setAmountInputValue('gross-income-input', grossIncome);
  document.getElementById('gross-income-overlay').classList.remove('hidden');
  setTimeout(() => input && input.focus(), 100);
};

window.closeGrossIncomeModal = function() {
  document.getElementById('gross-income-overlay').classList.add('hidden');
};

window.closeGrossIncomeModalOnOverlay = function(e) {
  if (e.target.id === 'gross-income-overlay') closeGrossIncomeModal();
};

window.saveGrossIncome = async function() {
  const val = parseFloat(document.getElementById('gross-income-input').value);
  if (isNaN(val) || val < 0) { showToast('Please enter a valid amount', 'error'); return; }
  grossIncome = val;
  try {
    await setDoc(doc(db, 'settings', currentUser.uid), { grossIncome: val }, { merge: true });
    showToast('Net income updated!', 'success');
    const grossInput = document.getElementById('setting-gross-income');
    if (grossInput) grossInput.value = val;
    closeGrossIncomeModal();
    updateSummaryCards();
  } catch(e) {
    showToast('Failed to save', 'error'); console.error(e);
  }
};

window.handleAvatarUpload = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('Please select an image file', 'error');
  if (file.size > 2 * 1024 * 1024) return showToast('Image must be less than 2MB', 'error');

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = async function() {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 200;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const base64Avatar = canvas.toDataURL('image/jpeg', 0.8);
      try {
        await setDoc(doc(db, 'settings', currentUser.uid), { avatarUrl: base64Avatar }, { merge: true });
        showToast('Profile picture updated!', 'success');
      } catch(err) {
        showToast('Failed to upload image', 'error');
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

window.removeAvatar = async function() {
  try {
    await setDoc(doc(db, 'settings', currentUser.uid), { avatarUrl: '' }, { merge: true });
    showToast('Profile picture removed!', 'success');
  } catch(err) {
    showToast('Failed to remove image', 'error');
  }
};

// ─── Navigation ────────────────────────────────────────────────────────────
const MOB_PAGE_TITLES = {
  dashboard: 'ExpenseFlow',
  transactions: 'Transactions',
  categories: 'Categories',
  budgets: 'Budgets & Categories',
  monthly: 'Monthly Report',
  tabung: 'Savings',
  loans: 'Loans',
  tools: 'Cards & Tools',
  settings: 'Settings'
};

window.navigateTo = function (page, el) {
  // Pages housed under "Wallet / More" sheet highlight the 4th tab
  const moreSubPages = ['tools', 'tabung', 'loans', 'categories', 'monthly', 'settings'];
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
  if (moreSubPages.includes(page)) {
    document.querySelector('.bottom-nav .nav-item[data-page="more"]')?.classList.add('active');
  } else if (el) {
    el.classList.add('active');
  } else {
    document.querySelector(`.bottom-nav .nav-item[data-page="${page}"]`)?.classList.add('active');
  }
  // Show SpendWise FAB on Home & History tabs only
  const fab = document.getElementById('sw-fab');
  if (fab) fab.classList.toggle('hidden', page !== 'dashboard' && page !== 'transactions');
  // Update top app bar title
  const titleEl = document.getElementById('mob-page-title');
  if (titleEl) titleEl.textContent = MOB_PAGE_TITLES[page] || 'ExpenseFlow';
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (page === 'dashboard') updateSummaryCards();
  if (page === 'categories') {
    renderCategories();
    updateExpensesChart();
    setTimeout(() => { if (expensesChart) expensesChart.resize(); }, 400);
  }
  if (page === 'budgets') renderBudgets();
  if (page === 'transactions') renderAllTransactions();
  if (page === 'monthly') renderMonthly();
  if (page === 'tabung') renderTabung();
  if (page === 'loans') renderLoans();
};

// ─── Mobile Profile Dropdown ────────────────────────────────────────────────
window.toggleProfileDropdown = function (e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  if (!dd) return;
  dd.classList.toggle('show');
};

window.openMobileSettings = function (e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.remove('show');
  navigateTo('settings');
};

// ─── MORE MENU ────────────────────────────────────────────────────────────
window.toggleMoreMenu = function() {
  const overlay = document.getElementById('more-menu-overlay');
  if (!overlay) return;
  const isHidden = overlay.classList.contains('hidden');
  if (isHidden) {
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));
  } else {
    closeMoreMenu();
  }
};
window.closeMoreMenu = function() {
  const overlay = document.getElementById('more-menu-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => overlay.classList.add('hidden'), 280);
  // Remove active state from More tab (keep it if we navigated to a More sub-page)
  const activePage = document.querySelector('.page.active');
  const moreSubPages = ['tools', 'tabung', 'loans', 'categories', 'monthly', 'settings'];
  if (!activePage || !moreSubPages.includes(activePage.id.replace('page-',''))) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(i => {
      if (i.dataset.page === 'more') i.classList.remove('active');
    });
  }
};

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
  const dd = document.getElementById('profile-dropdown');
  const avatar = document.getElementById('mobile-user-avatar');
  if (dd && dd.classList.contains('show')) {
    if (!dd.contains(e.target) && e.target !== avatar && !avatar?.contains(e.target)) {
      dd.classList.remove('show');
    }
  }
});

// ─── Modal ─────────────────────────────────────────────────────────────────
window.handleSmartFabClick = function () {
  // Determine which page is currently active
  const activePage = document.querySelector('.page.active');
  const pageId = activePage ? activePage.id : 'page-dashboard';

  if (pageId === 'page-tabung') {
    if (typeof openTabungModal === 'function') openTabungModal();
  } else if (pageId === 'page-loans') {
    if (typeof openLoanModal === 'function') openLoanModal();
  } else {
    // Default fallback is the transaction modal (Home, History, Stats, Budget)
    if (typeof openModal === 'function') openModal();
  }
};

window.openModal = function (txId = null) {
  editingTxId = txId;
  const modal = document.getElementById('modal-overlay');
  modal.classList.remove('hidden');
  document.getElementById('modal-title').textContent = txId ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('btn-save-tx').textContent = txId ? 'Update Transaction' : 'Save Transaction';
  document.getElementById('modal-error').style.display = 'none';

  populateCCSelect();

  if (txId) {
    const tx = allTransactions.find(t => t.id === txId);
    if (tx) {
      setType(tx.type);
      document.getElementById('tx-description').value = tx.description;
      setAmountInputValue('tx-amount', tx.amount);
      document.getElementById('tx-category').value = tx.category;
      document.getElementById('tx-date').value = tx.date;
      document.getElementById('tx-notes').value = tx.notes || '';
      const pmSelect = document.getElementById('tx-pay-method');
      if (pmSelect) pmSelect.value = tx.paymentMethod || 'cash';
      
      const ccSelect = document.getElementById('tx-cc-select');
      if (ccSelect) {
        ccSelect.value = tx.cardId || activeCCCardId || 'legacy-default';
      }
      toggleCCSelectGroup();
    }
  } else {
    resetModal();
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    const ccSelect = document.getElementById('tx-cc-select');
    if (ccSelect && activeCCCardId) {
      ccSelect.value = activeCCCardId;
    }
  }
};

window.closeModal = function () {
  document.getElementById('modal-overlay').classList.add('hidden');
  resetModal();
  editingTxId = null;
};

window.closeModalOnOverlay = function (e) {
  if (e.target.id === 'modal-overlay') closeModal();
};

function resetModal() {
  setType('income');
  document.getElementById('tx-description').value = '';
  setAmountInputValue('tx-amount', '');
  document.getElementById('tx-category').value = 'General';
  document.getElementById('tx-notes').value = '';
  const pmSelect = document.getElementById('tx-pay-method');
  if (pmSelect) pmSelect.value = 'cash';
  const ccSelect = document.getElementById('tx-cc-select');
  if (ccSelect && activeCCCardId) {
    ccSelect.value = activeCCCardId;
  }
  toggleCCSelectGroup();
  document.getElementById('modal-error').style.display = 'none';
}

window.setType = function (t) {
  txType = t;
  document.getElementById('type-income').classList.toggle('active', t === 'income');
  document.getElementById('type-expense').classList.toggle('active', t === 'expense');
  
  const pmGroup = document.getElementById('tx-pay-method-group');
  if (pmGroup) {
    pmGroup.style.display = t === 'expense' ? 'block' : 'none';
  }
  toggleCCSelectGroup();
};

// ─── Save Transaction ──────────────────────────────────────────────────────
window.saveTransaction = async function () {
  const desc = document.getElementById('tx-description').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const date = document.getElementById('tx-date').value;
  const notes = document.getElementById('tx-notes').value.trim();
  const errEl = document.getElementById('modal-error');
  
  const pmSelect = document.getElementById('tx-pay-method');
  const paymentMethod = txType === 'expense' && pmSelect ? pmSelect.value : 'cash';
  const ccSelect = document.getElementById('tx-cc-select');
  const cardId = (txType === 'expense' && paymentMethod === 'credit' && ccSelect) ? ccSelect.value : null;

  if (!desc) { errEl.textContent = 'Please enter a description.'; errEl.style.display = 'block'; return; }
  if (!amount || amount <= 0) { errEl.textContent = 'Please enter a valid amount.'; errEl.style.display = 'block'; return; }
  if (!date) { errEl.textContent = 'Please select a date.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-save-tx');
  btn.disabled = true; btn.textContent = 'Saving…';

  const data = { uid: currentUser.uid, type: txType, description: desc, amount, category, date, notes, paymentMethod, cardId: cardId || null, updatedAt: serverTimestamp() };

  try {
    if (editingTxId) {
      await updateDoc(doc(db, 'transactions', editingTxId), data);
      showToast('Transaction updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'transactions'), data);
      showToast('Transaction added!', 'success');
    }
    closeModal();
  } catch (e) {
    errEl.textContent = 'Failed to save. Check your Firebase config.';
    errEl.style.display = 'block';
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = editingTxId ? 'Update Transaction' : 'Save Transaction';
  }
};

// ─── Delete Transaction ────────────────────────────────────────────────────
window.promptDelete = function (id) {
  pendingDeleteId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
  document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
      await deleteDoc(doc(db, 'transactions', pendingDeleteId));
      showToast('Transaction deleted.', 'success');
    } catch (e) { showToast('Failed to delete.', 'error'); console.error(e); }
    closeDeleteModal();
  };
};

window.closeDeleteModal = function () {
  document.getElementById('delete-modal').classList.add('hidden');
  pendingDeleteId = null;
};

// ─── Budget Modal & Logic ──────────────────────────────────────────────────
window.openBudgetModal = function (budgetId = null) {
  editingBudgetId = budgetId;
  const existing = budgetId ? allBudgets.find(b => b.id === budgetId) : null;
  const title = document.getElementById('budget-modal-title');
  const categoryEl = document.getElementById('budget-category');
  const limitEl = document.getElementById('budget-limit');
  const saveBtn = document.getElementById('btn-save-budget');

  if (title) title.textContent = existing ? 'Edit Budget' : 'Set Budget';
  if (categoryEl) {
    if (existing) categoryEl.value = existing.category;
    else categoryEl.selectedIndex = 0;
  }
  if (limitEl) setAmountInputValue('budget-limit', existing ? existing.limit : '');
  if (saveBtn) saveBtn.textContent = existing ? 'Update Budget' : 'Save Budget';

  document.getElementById('budget-modal-overlay').classList.remove('hidden');
};

window.closeBudgetModal = function () {
  document.getElementById('budget-modal-overlay').classList.add('hidden');
  editingBudgetId = null;
  const saveBtn = document.getElementById('btn-save-budget');
  if (saveBtn) saveBtn.textContent = 'Save Budget';
};

window.closeBudgetModalOnOverlay = function (e) {
  if (e.target.id === 'budget-modal-overlay') closeBudgetModal();
};

window.saveBudget = async function () {
  const category = document.getElementById('budget-category').value;
  const limit = parseFloat(document.getElementById('budget-limit').value);
  if (!limit || limit <= 0) return showToast('Please enter a valid limit', 'error');
  
  const existing = editingBudgetId
    ? allBudgets.find(b => b.id === editingBudgetId)
    : allBudgets.find(b => b.category === category);
  const duplicate = allBudgets.find(b => b.category === category && b.id !== editingBudgetId);
  if (duplicate && (!existing || duplicate.id !== existing.id)) {
    return showToast('A budget already exists for this category.', 'error');
  }
  const btn = document.getElementById('btn-save-budget');
  btn.disabled = true; btn.textContent = 'Saving…';
  
  try {
    if (existing) {
      await updateDoc(doc(db, 'budgets', existing.id), { category, limit, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'budgets'), { uid: currentUser.uid, category, limit, createdAt: serverTimestamp() });
    }
    showToast(existing ? 'Budget updated!' : 'Budget saved!', 'success');
    closeBudgetModal();
  } catch (e) {
    console.error(e);
    showToast('Failed to save budget', 'error');
  } finally {
    btn.disabled = false; btn.textContent = editingBudgetId ? 'Update Budget' : 'Save Budget';
  }
};

window.deleteBudget = async function (id) {
  if (confirm('Are you sure you want to delete this budget?')) {
    try {
      await deleteDoc(doc(db, 'budgets', id));
      showToast('Budget deleted', 'success');
    } catch(e) { showToast('Error deleting budget', 'error'); }
  }
};

// ─── Render Functions ──────────────────────────────────────────────────────
function renderAll() {
  updateSummaryCards();
  renderRecentTransactions();
  renderChecklist();
  if (document.getElementById('page-transactions').classList.contains('active')) renderAllTransactions();
  if (document.getElementById('page-categories').classList.contains('active')) {
    renderCategories();
    updateExpensesChart();
  }
  if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
}

let expensesChartTimeout = null;
function updateExpensesChart() {
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();
  const monthSubtitle = document.getElementById('chart-month-subtitle');
  if (monthSubtitle) {
    monthSubtitle.textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }

  const monthExpenses = allTransactions.filter(t => 
    t.type === 'expense' && 
    t.date && 
    t.date.startsWith(currentMonthStr)
  );

  const canvas = document.getElementById('expenses-circle-chart');
  const emptyState = document.getElementById('chart-empty-state');
  const legendContainer = document.getElementById('chart-legend-container');
  const centerText = document.getElementById('chart-center-text');
  const centerVal = document.getElementById('chart-center-val');

  if (!canvas) return;

  if (monthExpenses.length === 0) {
    canvas.style.display = 'none';
    if (centerText) centerText.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    if (legendContainer) legendContainer.innerHTML = '';
    if (expensesChart) {
      expensesChart.destroy();
      expensesChart = null;
    }
    return;
  }

  canvas.style.display = 'block';
  if (centerText) centerText.style.display = 'flex';
  if (emptyState) emptyState.classList.add('hidden');

  const categoriesMap = {};
  let totalExpenseAmount = 0;

  monthExpenses.forEach(t => {
    const cat = t.category || 'General';
    categoriesMap[cat] = (categoriesMap[cat] || 0) + t.amount;
    totalExpenseAmount += t.amount;
  });

  if (centerVal) {
    centerVal.textContent = formatCurrency(totalExpenseAmount);
  }

  const sortedCategories = Object.entries(categoriesMap)
    .sort((a, b) => b[1] - a[1]);

  const labels = sortedCategories.map(x => x[0]);
  const data = sortedCategories.map(x => x[1]);

  const categoryColors = {
    'Food': '#FF5E7E',
    'Food & Dining': '#FF5E7E',
    'Housing': '#3B82F6',
    'Rent': '#3B82F6',
    'Transport': '#F59E0B',
    'Shopping': '#EC4899',
    'Groceries': '#10B981',
    'Bills': '#8B5CF6',
    'Entertainment': '#EF4444',
    'Health': '#06B6D4',
    'Clothing': '#F97316',
    'Salary': '#10B981',
    'Freelance': '#10B981',
    'Investment': '#10B981',
    'Loan': '#EF4444',
    'Other': '#6B7280',
    'General': '#6B7280'
  };

  const defaultPalette = [
    '#FF5E7E', '#3B82F6', '#F59E0B', '#EC4899', '#10B981', 
    '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#6D28D9'
  ];

  const colors = labels.map((label, idx) => categoryColors[label] || defaultPalette[idx % defaultPalette.length]);

  if (expensesChart) {
    expensesChart.data.labels = labels;
    expensesChart.data.datasets[0].data = data;
    expensesChart.data.datasets[0].backgroundColor = colors;
    expensesChart.data.datasets[0].borderColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-card-solid').trim() || '#1c2128';
    expensesChart.update();
  } else {
    if (!window.Chart) {
      if (expensesChartTimeout) clearTimeout(expensesChartTimeout);
      expensesChartTimeout = setTimeout(updateExpensesChart, 100);
      return;
    }

    const ctx = canvas.getContext('2d');
    expensesChart = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-card-solid').trim() || '#1c2128',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: () => '',
              label: function(context) {
                const value = context.raw;
                const percentage = ((value / totalExpenseAmount) * 100).toFixed(1);
                return ` ${context.label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            },
            backgroundColor: 'rgba(22, 27, 34, 0.95)',
            bodyColor: '#e6f1ea',
            bodyFont: {
              family: "'Outfit', sans-serif",
              size: 11,
              weight: '500'
            },
            borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            padding: 8,
            cornerRadius: 8,
            displayColors: true,
            boxWidth: 6,
            boxHeight: 6,
            boxPadding: 4,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        cutout: '70%'
      }
    });
  }

  if (legendContainer) {
    legendContainer.innerHTML = sortedCategories.map(([cat, amount], idx) => {
      const percentage = ((amount / totalExpenseAmount) * 100).toFixed(0);
      const color = colors[idx];
      const icon = getCategoryIcon(cat);
      return `
        <div class="legend-item" onclick="highlightChartSegment(${idx})">
          <div class="legend-item-left">
            <span class="legend-color-dot" style="background-color: ${color}"></span>
            <span class="legend-icon">${icon}</span>
            <span class="legend-name">${cat}</span>
          </div>
          <div class="legend-item-right">
            <span class="legend-amount">${formatCurrency(amount)}</span>
            <span class="legend-percentage">${percentage}%</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.highlightChartSegment = function(index) {
  if (!expensesChart) return;
  const meta = expensesChart.getDatasetMeta(0);
  if (!meta.data[index]) return;
  const isAlreadyActive = meta.data[index].active;
  expensesChart.setActiveElements(isAlreadyActive ? [] : [{
    datasetIndex: 0,
    index: index
  }]);
  expensesChart.tooltip.setActiveElements(isAlreadyActive ? [] : [{
    datasetIndex: 0,
    index: index
  }], {
    x: 0,
    y: 0
  });
  expensesChart.update();
};

function formatCurrency(n) {
  const num = parseFloat(n) || 0;
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(num));
  const sign = num < 0 ? '-' : '';
  const sym = (userSettings.currency === 'RM' || userSettings.currency === 'Rp') ? userSettings.currency + ' ' : userSettings.currency;
  return sign + sym + formatted;
}

window.setAmountInputValue = function(idOrEl, value) {
  const inputEl = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!inputEl) return;
  
  const num = parseFloat(value);
  if (isNaN(num)) {
    inputEl.value = '';
  } else {
    inputEl.value = num.toFixed(2);
  }
};

window.initAmountInputMasks = function() {
  const inputs = document.querySelectorAll('.amount-input-wrap input, .checklist-amount-wrap input');
  
  inputs.forEach(inputEl => {
    inputEl.type = 'text';
    inputEl.inputMode = 'decimal';
    
    const format = (val) => {
      let digits = val.replace(/\D/g, '');
      if (!digits) return '';
      let parsed = parseInt(digits, 10);
      if (isNaN(parsed)) return '';
      return (parsed / 100).toFixed(2);
    };
    
    inputEl.addEventListener('input', function() {
      inputEl.value = format(inputEl.value);
    });

    inputEl.addEventListener('blur', function() {
      if (inputEl.value) {
        inputEl.value = format(inputEl.value);
      }
    });

    if (inputEl.value) {
      inputEl.value = format(inputEl.value);
    }
  });
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryIcon(cat) {
  const icons = {
    'Food': '🍔',
    'Food & Dining': '🍔', 'Housing': '🏠', 'Rent': '🏠', 'Transport': '🚗',
    'Shopping': '🛍️', 'Groceries': '🛒', 'Bills': '🧾', 
    'Entertainment': '🎬', 'Health': '💊', 'Clothing': '👕', 
    'Salary': '💼', 'Freelance': '💻', 'Investment': '📈', 
    'Loan': '🏦', 'Other': '✨', 'General': '💡'
  };
  return icons[cat] || '💡';
}

function getCCCards() {
  if (userSettings && Array.isArray(userSettings.creditCards) && userSettings.creditCards.length > 0) {
    return userSettings.creditCards;
  }
  return [{
    id: 'legacy-default',
    name: 'Primary Card',
    limit: userSettings.creditLimit !== undefined ? userSettings.creditLimit : 10000,
    dueDay: userSettings.creditDueDay !== undefined ? userSettings.creditDueDay : 25
  }];
}

function getCCCardOutstanding(cardId) {
  const cards = getCCCards();
  const targetCard = cards.find(c => c.id === cardId);
  const targetName = targetCard ? targetCard.name : null;
  const defaultCard = cards[0];
  const isDefault = defaultCard && cardId === defaultCard.id;

  const expenses = allTransactions
    .filter(t => {
      if (t.type !== 'expense') return false;
      if (t.category === 'Credit Card Payment') return false;

      // Treat as credit card if paymentMethod is credit OR if cardId is specified
      const isCredit = t.paymentMethod === 'credit' || !!t.cardId;
      if (!isCredit) return false;

      // Card matching:
      // 1. Direct ID match
      if (t.cardId === cardId) return true;
      // 2. Direct Name match (in case cardId was stored as card name or card was re-created)
      if (targetName && (t.cardId === targetName || getCardNameById(t.cardId) === targetName)) return true;
      // 3. Fallback to default card if no cardId is specified
      if (!t.cardId && isDefault) return true;

      return false;
    })
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const payments = allTransactions
    .filter(t => {
      if (t.type !== 'expense') return false;
      if (t.category !== 'Credit Card Payment') return false;

      if (t.cardId === cardId) return true;
      if (targetName && (t.cardId === targetName || getCardNameById(t.cardId) === targetName)) return true;
      if (!t.cardId && isDefault) return true;

      return false;
    })
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  return Math.max(0, expenses - payments);
}

function getCardNameById(cardId) {
  const cards = getCCCards();
  const card = cards.find(c => c.id === cardId);
  if (card) return card.name;
  const cardByName = cards.find(c => c.name === cardId);
  if (cardByName) return cardByName.name;
  return 'Primary Card';
}

function renderCCTabs() {
  const container = document.getElementById('cc-tabs-container');
  if (!container) return;
  container.innerHTML = '';

  const cards = getCCCards();
  const activeCard = cards.find(c => c.id === activeCCCardId) || cards[0];

  // ── Trigger button ──────────────────────────────────────────────────────
  const trigger = document.createElement('div');
  trigger.className = 'cc-switcher-trigger';
  trigger.id = 'cc-switcher-trigger';
  trigger.innerHTML = `
    <span class="cc-switcher-icon">💳</span>
    <span class="cc-switcher-label" id="cc-switcher-label">${activeCard ? activeCard.name : 'Select Card'}</span>
    <svg class="cc-switcher-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;
  trigger.onclick = (e) => { e.stopPropagation(); toggleCCSwitcher(); };

  // ── Dropdown list ───────────────────────────────────────────────────────
  const dropdown = document.createElement('div');
  dropdown.className = 'cc-switcher-dropdown hidden';
  dropdown.id = 'cc-switcher-dropdown';

  cards.forEach(card => {
    const item = document.createElement('div');
    item.className = `cc-switcher-option ${card.id === activeCCCardId ? 'active' : ''}`;
    item.innerHTML = `<span class="cc-switcher-opt-name">💳 ${card.name}</span>`;
    item.onclick = (e) => {
      e.stopPropagation();
      activeCCCardId = card.id;
      closeCCSwitcher();
      updateSummaryCards();
    };
    dropdown.appendChild(item);
  });

  // Add Card separator + option
  const sep = document.createElement('div');
  sep.className = 'cc-switcher-sep';
  dropdown.appendChild(sep);

  const addItem = document.createElement('div');
  addItem.className = 'cc-switcher-option add';
  addItem.innerHTML = `<span>＋ Add Card</span>`;
  addItem.onclick = (e) => {
    e.stopPropagation();
    closeCCSwitcher();
    openConfigureCCModal();
  };
  dropdown.appendChild(addItem);

  // ── Wrapper ─────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'cc-switcher-wrap';
  wrap.appendChild(trigger);
  wrap.appendChild(dropdown);

  container.appendChild(wrap);
}

window.toggleCCSwitcher = function() {
  const dd = document.getElementById('cc-switcher-dropdown');
  if (!dd) return;
  dd.classList.toggle('hidden');
};

window.closeCCSwitcher = function() {
  const dd = document.getElementById('cc-switcher-dropdown');
  if (dd) dd.classList.add('hidden');
};


window.toggleCCSelectGroup = function () {
  const pmSelect = document.getElementById('tx-pay-method');
  const ccSelectGroup = document.getElementById('tx-cc-select-group');
  if (pmSelect && ccSelectGroup) {
    ccSelectGroup.style.display = (pmSelect.value === 'credit' && txType === 'expense') ? 'block' : 'none';
  }
};

function populateCCSelect() {
  const select = document.getElementById('tx-cc-select');
  if (!select) return;
  select.innerHTML = '';
  const cards = getCCCards();
  cards.forEach(card => {
    const opt = document.createElement('option');
    opt.value = card.id;
    opt.textContent = card.name;
    select.appendChild(opt);
  });
}

window.dashMonthShift = function (delta) {
  haptic();
  dashSelectedMonth += delta;
  if (dashSelectedMonth < 0) { dashSelectedMonth = 11; dashSelectedYear--; }
  if (dashSelectedMonth > 11) { dashSelectedMonth = 0; dashSelectedYear++; }
  updateSummaryCards();
};

window.focusDashboardCC = function () {
  haptic();
  navigateTo('tools');
  const card = document.getElementById('dashboard-cc-card');
  if (!card) return;
  card.classList.add('open');
  localStorage.setItem('dashboardCCOpen', 'true');
};

window.toggleSwCategoryDropdown = function () {
  haptic();
  const card = document.getElementById('sw-cat-dropdown-card');
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  const btn = card.querySelector('.sw-cat-dropdown-header');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  localStorage.setItem('swCategoryOpen', isOpen ? 'true' : 'false');
};

function formatSpendwiseDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month} ${d.getFullYear()}`;
}

function getSpendwiseCategoryMeta(cat, type) {
  const key = (cat || '').toLowerCase();
  const svg = (path) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${path}</svg>`;
  if (key.includes('food') || key.includes('dining') || key.includes('eat') || key.includes('drink') || key.includes('coffee')) {
    return { color: '#F97316', bg: 'rgba(249, 115, 22, 0.14)', icon: svg('<path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>') };
  }
  if (key.includes('grocer')) {
    return { color: '#22C55E', bg: 'rgba(34, 197, 94, 0.14)', icon: svg('<path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>') };
  }
  if (key.includes('rent') || key.includes('hous') || key.includes('home')) {
    return { color: '#0284C7', bg: 'rgba(2, 132, 199, 0.14)', icon: svg('<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>') };
  }
  if (key.includes('bill') || key.includes('util')) {
    return { color: '#EAB308', bg: 'rgba(234, 179, 8, 0.14)', icon: svg('<path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>') };
  }
  if (key.includes('transport') || key.includes('car') || key.includes('fuel') || key.includes('petrol') || key.includes('grab')) {
    return { color: '#6366F1', bg: 'rgba(99, 102, 241, 0.14)', icon: svg('<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>') };
  }
  if (key.includes('shop') || key.includes('cloth')) {
    return { color: '#EC4899', bg: 'rgba(236, 72, 153, 0.14)', icon: svg('<path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2z"/>') };
  }
  if (key.includes('entertain') || key.includes('movie') || key.includes('game')) {
    return { color: '#A855F7', bg: 'rgba(168, 85, 247, 0.14)', icon: svg('<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>') };
  }
  if (key.includes('health') || key.includes('med') || key.includes('clinic')) {
    return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)', icon: svg('<path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>') };
  }
  if (key.includes('credit')) {
    return { color: '#0F766E', bg: 'rgba(15, 118, 110, 0.14)', icon: svg('<path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>') };
  }
  if (key.includes('salary') || key.includes('income') || type === 'income') {
    return { color: '#16A34A', bg: 'rgba(22, 163, 74, 0.14)', icon: svg('<path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z"/>') };
  }
  if (key.includes('loan')) {
    return { color: '#0284C7', bg: 'rgba(2, 132, 199, 0.14)', icon: svg('<path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z"/>') };
  }
  return { color: '#64748B', bg: 'rgba(100, 116, 139, 0.14)', icon: svg('<path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/>') };
}

function buildSpendwiseTxCardHtml(tx) {
  const trashSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
  const isExpense = tx.type === 'expense';
  const meta = getSpendwiseCategoryMeta(tx.category, tx.type);
  const title = tx.description || tx.category || 'Transaction';
  const sign = isExpense ? '-' : '+';
  const isCC = (tx.paymentMethod === 'credit' || tx.cardId) && tx.category !== 'Credit Card Payment';
  const isMK = tx.paymentMethod === 'mykasih';
  const extraTag = isCC
    ? `<div class="sw-tx-badge">💳 ${escapeHtml(getCardNameById(tx.cardId))}</div>`
    : isMK
      ? `<div class="sw-tx-badge">🎁 MyKasih</div>`
      : '';
  return `
    <div class="sw-tx-card" onclick="openTxDetails('${tx.id}', event)">
      <div class="sw-tx-icon" style="background:${meta.bg};color:${meta.color};">${meta.icon}</div>
      <div class="sw-tx-body">
        <div class="sw-tx-title">${escapeHtml(title)}</div>
        <div class="sw-tx-sub">${escapeHtml(tx.category || 'Other')} • ${formatSpendwiseDate(tx.date)}</div>
        ${extraTag}
      </div>
      <div class="sw-tx-right">
        <span class="sw-tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount)}</span>
        <button type="button" class="sw-tx-del" onclick="event.stopPropagation();haptic();promptDelete('${tx.id}')" aria-label="Delete transaction">${trashSvg}</button>
      </div>
    </div>
  `;
}

function renderSpendwiseHomeSections(monthTxs, totalExpense) {
  // 1. Spending by Category collapsible dropdown card
  const catSection = document.getElementById('sw-category-section');
  const catCard = document.getElementById('sw-cat-dropdown-card');
  const catList = document.getElementById('sw-category-breakdown-list');
  const catSub = document.getElementById('sw-cat-dropdown-sub');
  const catTotal = document.getElementById('sw-cat-dropdown-total');
  if (catSection && catList) {
    const expenseByCat = {};
    monthTxs
      .filter(t => t.type === 'expense' && t.category !== 'Credit Card Payment')
      .forEach(t => {
        const c = t.category || 'Other';
        expenseByCat[c] = (expenseByCat[c] || 0) + (parseFloat(t.amount) || 0);
      });
    const sortedCats = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);
    if (!sortedCats.length) {
      catSection.classList.add('hidden');
      catList.innerHTML = '';
    } else {
      catSection.classList.remove('hidden');
      if (catSub) catSub.textContent = `${sortedCats.length} ${sortedCats.length === 1 ? 'category' : 'categories'}`;
      if (catTotal) catTotal.dataset.value = formatCurrency(totalExpense);
      if (catCard) {
        const isOpen = localStorage.getItem('swCategoryOpen') === 'true';
        catCard.classList.toggle('open', isOpen);
        const btn = catCard.querySelector('.sw-cat-dropdown-header');
        if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
      catList.innerHTML = sortedCats.slice(0, 6).map(([cat, spent]) => {
        const pct = totalExpense > 0 ? Math.min(100, Math.round((spent / totalExpense) * 100)) : 0;
        const meta = getSpendwiseCategoryMeta(cat, 'expense');
        return `
          <div class="sw-cat-row" onclick="haptic();navigateTo('categories')">
            <div class="sw-cat-row-top">
              <div class="sw-cat-row-left">
                <span class="sw-cat-icon" style="background:${meta.bg};color:${meta.color};">${meta.icon}</span>
                <span class="sw-cat-name">${escapeHtml(cat)}</span>
              </div>
              <span class="sw-cat-val">${formatCurrency(spent)} (${pct}%)</span>
            </div>
            <div class="sw-cat-bar-track" style="background:${meta.bg};">
              <div class="sw-cat-bar-fill" style="width:${pct}%;background:${meta.color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Recent Transactions list (latest 3 only)
  const recentEl = document.getElementById('sw-recent-list');
  if (recentEl) {
    if (!monthTxs.length) {
      recentEl.innerHTML = `
        <div class="sw-empty-card">
          <div class="sw-empty-title">No transactions yet</div>
          <div class="sw-empty-sub">Tap the + button below to add your salary, food, bills, or rent.</div>
        </div>
      `;
    } else {
      recentEl.innerHTML = monthTxs.slice(0, 3).map(buildSpendwiseTxCardHtml).join('');
    }
  }
}

function updateSummaryCards() {
  const todayNow = new Date();
  const isCurrentMonth = dashSelectedYear === todayNow.getFullYear() && dashSelectedMonth === todayNow.getMonth();
  const currentMonthStr = `${dashSelectedYear}-${String(dashSelectedMonth + 1).padStart(2, '0')}`;

  // Update SpendWise Month Bar label
  const dashMonthLabel = document.getElementById('dash-month-label');
  if (dashMonthLabel) {
    const labelDate = new Date(dashSelectedYear, dashSelectedMonth, 1);
    dashMonthLabel.textContent = labelDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const monthTxs = allTransactions.filter(t => t.date && t.date.startsWith(currentMonthStr));

  // Sum selected month's income transactions categorized as "Salary" (case-insensitive)
  const salaryIncome = monthTxs
    .filter(t => t.type === 'income' && t.category && t.category.toLowerCase() === 'salary')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  // Sum selected month's other income transactions (excluding "Salary")
  const otherIncome = monthTxs
    .filter(t => t.type === 'income' && (!t.category || t.category.toLowerCase() !== 'salary'))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  // Net income = grossIncome from settings (on current month) + salary transactions
  const netIncome = (isCurrentMonth ? grossIncome : 0) + salaryIncome;
  const totalMonthlyIncome = netIncome + otherIncome;

  // Cash/Debit expenses this month (excludes Credit Card payments, Credit Card purchases, and MyKasih purchases)
  const cashExpense = monthTxs
    .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit' && !t.cardId && t.paymentMethod !== 'mykasih' && t.category !== 'Credit Card Payment')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  // Credit Card Bill Payments recorded this month
  const ccPayments = monthTxs
    .filter(t => t.type === 'expense' && t.category === 'Credit Card Payment')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  // Total actual monthly spending (Cash expenses + Credit card expenses, excluding double-counted bill payments)
  const totalExpense = monthTxs
    .filter(t => t.type === 'expense' && t.category !== 'Credit Card Payment')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const carryOver = isCurrentMonth && typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : 0;

  // Cash Balance = Cash inflows minus Cash outflows (cash expenses and cc bill payments)
  const balance = carryOver + totalMonthlyIncome - cashExpense - ccPayments;

  // ─── Credit Card Calculations (shared pool) ───
  const cards = getCCCards();
  if (!activeCCCardId || !cards.some(c => c.id === activeCCCardId)) {
    activeCCCardId = cards[0] ? cards[0].id : 'legacy-default';
  }

  // Selected card's own spending (shown in Outstanding field)
  const ccOutstanding = getCCCardOutstanding(activeCCCardId);
  // All cards' combined outstanding across all credit transactions (used for available/utilization vs shared pool)
  const allCCExpenses = allTransactions
    .filter(t => t.type === 'expense' && t.category !== 'Credit Card Payment' && (t.paymentMethod === 'credit' || !!t.cardId))
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const allCCPayments = allTransactions
    .filter(t => t.type === 'expense' && t.category === 'Credit Card Payment')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const ccTotalOutstanding = Math.max(
    cards.reduce((sum, c) => sum + getCCCardOutstanding(c.id), 0),
    Math.max(0, allCCExpenses - allCCPayments)
  );
  // Shared pool settings
  const ccLimit    = userSettings.creditPoolLimit  || 2000;
  const ccDueDay   = userSettings.creditPoolDueDay || 25;
  const ccAvailable    = Math.max(0, ccLimit - ccTotalOutstanding);
  const ccUtilization  = ccLimit > 0 ? Math.min((ccTotalOutstanding / ccLimit) * 100, 100) : 0;

  const ccCardTitleEl = document.querySelector('.cc-dashboard-title');
  if (ccCardTitleEl) ccCardTitleEl.textContent = 'Credit Card';

  // SpendWise Hero Card (Monthly Net Balance, Income, Expenses)
  const mobBal  = document.getElementById('mob-hero-balance');
  const mobInc  = document.getElementById('mob-hero-income');
  const mobExp  = document.getElementById('mob-hero-expenses');
  if (mobBal) mobBal.dataset.value = formatCurrency(balance);
  if (mobInc) mobInc.dataset.value = formatCurrency(totalMonthlyIncome);
  if (mobExp) mobExp.dataset.value = formatCurrency(totalExpense);

  // SpendWise 3-Column Mini Stats (Card Debt, Savings, Loans)
  const totalSavings = allTabung.reduce((s, t) => s + (parseFloat(t.saved) || 0), 0);
  const totalLoansOwed = allLoans
    .filter(l => l.loanType === 'owe')
    .reduce((s, l) => s + Math.max(0, (parseFloat(l.total) || 0) - (parseFloat(l.paid) || 0)), 0);

  const statDebtEl = document.getElementById('sw-stat-card-debt');
  const statSavEl  = document.getElementById('sw-stat-savings');
  const statLoanEl = document.getElementById('sw-stat-loans');
  if (statDebtEl) statDebtEl.dataset.value = formatCurrency(ccTotalOutstanding);
  if (statSavEl)  statSavEl.dataset.value  = formatCurrency(totalSavings);
  if (statLoanEl) statLoanEl.dataset.value = formatCurrency(totalLoansOwed);

  // SpendWise Home Sections (Spending by Category + Recent Transactions)
  renderSpendwiseHomeSections(monthTxs, totalExpense);

  // Render Credit Card Widget Elements
  renderCCTabs();
  const ccHolderNameEl = document.getElementById('cc-cardholder-name');
  if (ccHolderNameEl && currentUser) {
    ccHolderNameEl.textContent = (currentUser.displayName || currentUser.email.split('@')[0]).toUpperCase();
  }
  
  const ccOutstandingEl = document.getElementById('cc-outstanding-val');
  const ccAvailableEl   = document.getElementById('cc-available-val');
  const ccLimitEl       = document.getElementById('cc-limit-display');
  const ccDueDayEl      = document.getElementById('cc-due-day-val');
  const ccUtilBarEl     = document.getElementById('cc-utilization-bar');
  const ccUtilPctEl     = document.getElementById('cc-utilization-pct');
  const ccDueBoxEl      = document.getElementById('cc-due-info-box');

  if (ccOutstandingEl) {
    ccOutstandingEl.dataset.value = formatCurrency(ccOutstanding);
    ccOutstandingEl.classList.add('masked-val');
  }
  if (ccAvailableEl) {
    ccAvailableEl.dataset.value = formatCurrency(ccAvailable);
    ccAvailableEl.classList.add('masked-val');
  }
  if (ccLimitEl) {
    ccLimitEl.textContent = `Limit: ${formatCurrency(ccLimit)}`;
  }
  if (ccDueDayEl) {
    ccDueDayEl.textContent = `${ccDueDay}${getOrdinalSuffix(ccDueDay)}`;
  }
  if (ccUtilBarEl) {
    ccUtilBarEl.style.width = `${ccUtilization}%`;
    if (ccOutstanding > 0 && ccUtilization >= 80) {
      ccUtilBarEl.style.backgroundImage = 'none';
      ccUtilBarEl.style.backgroundColor = 'var(--neon-coral)';
    } else {
      ccUtilBarEl.style.backgroundImage = 'linear-gradient(90deg, var(--neon-violet), var(--neon-teal))';
    }
  }
  if (ccUtilPctEl) {
    ccUtilPctEl.textContent = `${ccUtilization.toFixed(0)}% Used`;
  }
  if (ccDueBoxEl) {
    if (ccTotalOutstanding > 0) {
      ccDueBoxEl.classList.add('warning');
      ccDueBoxEl.innerHTML = `⚠️ Outstanding balance due on the <strong>${ccDueDay}${getOrdinalSuffix(ccDueDay)}</strong>`;
    } else {
      ccDueBoxEl.classList.remove('warning');
      ccDueBoxEl.innerHTML = `✅ Card fully paid. Next billing cycle.`;
    }
  }

  // Update Collapsible Dropdown Header Elements
  const headerStatusEl = document.getElementById('dashboard-cc-current-status');
  if (headerStatusEl) {
    if (ccTotalOutstanding > 0) {
      headerStatusEl.textContent = `Outstanding: ${formatCurrency(ccTotalOutstanding)} · Available: ${formatCurrency(ccAvailable)}`;
    } else {
      headerStatusEl.textContent = `Fully Paid · Available: ${formatCurrency(ccAvailable)}`;
    }
  }

  const headerPctEl = document.getElementById('dashboard-cc-percentage');
  if (headerPctEl) {
    headerPctEl.textContent = `${ccUtilization.toFixed(0)}%`;
    headerPctEl.style.color = ccTotalOutstanding > 0 && ccAvailable <= 0 ? 'var(--neon-coral)' : 'var(--neon-violet)';
  }

  const headerProgressBar = document.getElementById('dashboard-cc-progress-bar');
  if (headerProgressBar) {
    headerProgressBar.style.width = `${ccUtilization}%`;
    if (ccOutstanding > 0 && ccUtilization >= 80) {
      headerProgressBar.style.backgroundImage = 'none';
      headerProgressBar.style.backgroundColor = 'var(--neon-coral)';
    } else {
      headerProgressBar.style.backgroundImage = 'linear-gradient(90deg, var(--neon-violet), var(--neon-teal))';
    }
  }

  // ─── MyKasih Calculations ───
  const mykasihAllowance = typeof userSettings.mykasihAllowance === 'number' ? userSettings.mykasihAllowance : 50;
  const mykasihBaseBalance = typeof userSettings.mykasihBaseBalance === 'number' ? userSettings.mykasihBaseBalance : 50;
  let lastTopup = userSettings.mykasihLastTopupMonth;
  let bonusTopups = 0;
  const now = new Date();
  const currentMonthStrVal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  if (!lastTopup) {
    userSettings.mykasihLastTopupMonth = currentMonthStrVal;
  } else if (lastTopup !== currentMonthStrVal) {
    const [lastY, lastM] = lastTopup.split('-').map(Number);
    const monthsDiff = (now.getFullYear() - lastY) * 12 + (now.getMonth() + 1 - lastM);
    if (monthsDiff > 0) {
      bonusTopups = monthsDiff * mykasihAllowance;
    }
  }

  const totalMyKasihExpenses = allTransactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'mykasih')
    .reduce((s, t) => s + t.amount, 0);

  const mykasihSpentThisMonth = allTransactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'mykasih' && t.date && t.date.startsWith(currentMonthStrVal))
    .reduce((s, t) => s + t.amount, 0);

  const currentMyKasihBal = Math.max(0, mykasihBaseBalance + bonusTopups - totalMyKasihExpenses);

  const mykasihHeaderBalEl = document.getElementById('mykasih-header-balance');
  const mykasihBalEl = document.getElementById('mykasih-balance-val');
  const mykasihSpentEl = document.getElementById('mykasih-spent-val');
  const mykasihSubEl = document.getElementById('mykasih-status-subtitle');
  if (mykasihHeaderBalEl) {
    mykasihHeaderBalEl.dataset.value = formatCurrency(currentMyKasihBal);
    mykasihHeaderBalEl.classList.add('masked-val');
  }
  if (mykasihBalEl) {
    mykasihBalEl.dataset.value = formatCurrency(currentMyKasihBal);
    mykasihBalEl.classList.add('masked-val');
  }
  if (mykasihSpentEl) {
    mykasihSpentEl.dataset.value = formatCurrency(mykasihSpentThisMonth);
    mykasihSpentEl.classList.add('masked-val');
  }
  if (mykasihSubEl) {
    mykasihSubEl.textContent = `${formatCurrency(mykasihAllowance)} auto top-up monthly`;
  }

  applyBalanceVisibility();
}

function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:  return 'st';
    case 2:  return 'nd';
    case 3:  return 'rd';
    default: return 'th';
  }
}

let balanceHidden = localStorage.getItem('balanceHidden') === 'true';
function applyBalanceVisibility() {
  const els = document.querySelectorAll('.masked-val');
  els.forEach(el => {
    if (balanceHidden) {
      el.textContent = '••••••';
    } else {
      el.textContent = el.dataset.value || el.textContent;
    }
  });
  const showIcon = document.getElementById('eye-icon-show');
  const hideIcon = document.getElementById('eye-icon-hide');
  if (showIcon) showIcon.style.display = balanceHidden ? 'none' : 'block';
  if (hideIcon) hideIcon.style.display = balanceHidden ? 'block' : 'none';
}
window.toggleBalanceVisibility = function() {
  balanceHidden = !balanceHidden;
  localStorage.setItem('balanceHidden', balanceHidden ? 'true' : 'false');
  // Persist to Firestore so the setting survives sign-out / sign-in
  if (currentUser) {
    setDoc(doc(db, 'settings', currentUser.uid), { balanceHidden }, { merge: true }).catch(() => {});
  }
  haptic();
  applyBalanceVisibility();
};

function buildTransactionItem(tx) {
  const wrapper = document.createElement('div');
  wrapper.className = 'transaction-wrapper';
  
  wrapper.innerHTML = `
    <div class="transaction-item" style="cursor: pointer;" onclick="openTxDetails('${tx.id}', event)">
      <div class="tx-icon ${tx.type}">${getCategoryIcon(tx.category)}</div>
      <div class="tx-info">
        <div class="tx-desc">${tx.description}</div>
        <div class="tx-meta">
          <span class="tx-cat">${tx.category}</span>
          <span class="tx-date">${formatDate(tx.date)}</span>
          ${tx.notes ? `<span class="tx-cat">${tx.notes}</span>` : ''}
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</span>
        ${(tx.paymentMethod === 'credit' || tx.cardId) && tx.category !== 'Credit Card Payment' ? `<span class="tx-cc-label">💳 ${getCardNameById(tx.cardId)}</span>` : ''}
        ${tx.paymentMethod === 'mykasih' ? `<span class="tx-cc-label" style="background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.3); color:var(--neon-teal);">🎁 MyKasih</span>` : ''}
      </div>
    </div>
  `;
  return wrapper;
}

function renderRecentTransactions() {
  const container = document.getElementById('recent-list');
  if (!container) return;
  const recent = allTransactions.slice(0, 5);
  container.innerHTML = '';
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state"><span>🗂️</span><p>No transactions yet. Add your first one!</p></div>';
    return;
  }
  recent.forEach((tx, i) => {
    const item = buildTransactionItem(tx);
    item.classList.add('tx-animate');
    item.style.animationDelay = `${i * 0.06}s`;
    container.appendChild(item);
  });
}

function getFilteredTransactions() {
  let list = [...allTransactions];
  const selCombined = document.getElementById('filter-month-combined');
  const monthVal = selCombined ? selCombined.value : '';
  if (monthVal) list = list.filter(t => t.date && t.date.startsWith(monthVal));

  // Update "All (N)" chip count for the selected month
  const allChipBtn = document.getElementById('tx-filter-all-btn');
  if (allChipBtn) allChipBtn.textContent = `All (${list.length})`;

  if (activeFilter !== 'all') list = list.filter(t => t.type === activeFilter);

  const pmFilterEl = document.getElementById('filter-payment-method');
  if (pmFilterEl) {
    const pmVal = pmFilterEl.value; // 'all', 'cash', 'credit', 'mykasih'
    if (pmVal === 'cash') {
      list = list.filter(t => t.paymentMethod !== 'credit' && t.paymentMethod !== 'mykasih' && (!t.cardId || t.category === 'Credit Card Payment'));
    } else if (pmVal === 'credit') {
      list = list.filter(t => (t.paymentMethod === 'credit' || t.cardId) && t.category !== 'Credit Card Payment');
    } else if (pmVal === 'mykasih') {
      list = list.filter(t => t.paymentMethod === 'mykasih');
    }
  }

  const searchEl = document.getElementById('tx-search-input');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  if (q) {
    list = list.filter(t => {
      const desc = (t.description || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const notes = (t.notes || '').toLowerCase();
      const card = t.cardId ? (getCardNameById(t.cardId) || '').toLowerCase() : '';
      return desc.includes(q) || cat.includes(q) || notes.includes(q) || card.includes(q);
    });
  }
  return list;
}

function renderAllTransactions() {
  const container = document.getElementById('all-transactions-list');
  if (!container) return;
  const list = getFilteredTransactions();
  if (!list.length) {
    container.innerHTML = `
      <div class="sw-empty-card">
        <div class="sw-empty-title">No matching transactions</div>
        <div class="sw-empty-sub">Try another month or tap + to add a new transaction.</div>
      </div>
    `;
    return;
  }
  container.innerHTML = list.map(buildSpendwiseTxCardHtml).join('');
}
window.renderAllTransactions = renderAllTransactions;

window.filterTransactions = function (type, el) {
  activeFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAllTransactions();
};

window.filterPaymentMethodChange = function () {
  renderAllTransactions();
};

window.filterByMonth = function () { renderAllTransactions(); };

// ─── Categories Month State ──────────────────────────────────────────

function getCatMonthStr() {
  return `${catSelectedYear}-${String(catSelectedMonth + 1).padStart(2, '0')}`;
}

function updateCatMonthLabel() {
  const labelText = document.getElementById('cat-month-picker-text');
  if (!labelText) return;
  const d = new Date(catSelectedYear, catSelectedMonth, 1);
  labelText.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
  // Disable next arrow if we are at current month
  const now = new Date();
  const nextBtn = document.getElementById('cat-month-next');
  if (nextBtn) {
    const isCurrentMonth = catSelectedYear === now.getFullYear() && catSelectedMonth === now.getMonth();
    nextBtn.disabled = isCurrentMonth;
    nextBtn.style.opacity = isCurrentMonth ? '0.3' : '1';
  }
}

function initCatMonthYearSelects() {
  const listContainer = document.getElementById('cat-filter-month-list');
  const hiddenInput = document.getElementById('cat-filter-month-combined');
  if (!listContainer || !hiddenInput) return;

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth(); // 0-indexed

  listContainer.innerHTML = '';
  
  const defaultVal = `${catSelectedYear}-${String(catSelectedMonth + 1).padStart(2, '0')}`;
  hiddenInput.value = defaultVal;

  // Generate options from current month going back 36 months (3 years)
  for (let i = 0; i < 36; i++) {
    const d = new Date(curY, curM - i, 1);
    const yVal = d.getFullYear();
    const mVal = String(d.getMonth() + 1).padStart(2, '0');
    const val = `${yVal}-${mVal}`;
    const labelText = `${MONTH_NAMES[d.getMonth()]} ${yVal}`;
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'month-selector-item';
    if (yVal === catSelectedYear && d.getMonth() === catSelectedMonth) {
      btn.classList.add('selected');
    }
    btn.textContent = labelText;
    btn.dataset.value = val;
    btn.onclick = function() {
      selectMonthForCategories(val, labelText, btn);
    };
    listContainer.appendChild(btn);
  }
  
  updateCatMonthLabel();
}

window.selectMonthForCategories = function(val, labelText, clickedEl) {
  const hiddenInput = document.getElementById('cat-filter-month-combined');
  if (hiddenInput) hiddenInput.value = val;
  
  const parts = val.split('-');
  catSelectedYear = parseInt(parts[0], 10);
  catSelectedMonth = parseInt(parts[1], 10) - 1;

  // Toggle active class
  const listContainer = document.getElementById('cat-filter-month-list');
  if (listContainer) {
    listContainer.querySelectorAll('.month-selector-item').forEach(b => b.classList.remove('selected'));
  }
  if (clickedEl) clickedEl.classList.add('selected');

  // Close dropdown
  const dd = document.getElementById('cat-month-picker-dropdown');
  if (dd) dd.classList.add('hidden');

  updateCatMonthLabel();
  renderCategories();
};

window.toggleCatMonthPicker = function(e) {
  e.stopPropagation();
  const dd = document.getElementById('cat-month-picker-dropdown');
  if (!dd) return;
  dd.classList.toggle('hidden');
};

window.catMonthShift = function(dir) {
  catSelectedMonth += dir;
  if (catSelectedMonth > 11) { catSelectedMonth = 0;  catSelectedYear++; }
  if (catSelectedMonth < 0)  { catSelectedMonth = 11; catSelectedYear--; }
  
  const val = `${catSelectedYear}-${String(catSelectedMonth + 1).padStart(2, '0')}`;
  const hiddenInput = document.getElementById('cat-filter-month-combined');
  if (hiddenInput) {
    hiddenInput.value = val;
  }
  
  // Update selected class in custom list
  const listContainer = document.getElementById('cat-filter-month-list');
  if (listContainer) {
    listContainer.querySelectorAll('.month-selector-item').forEach(b => {
      if (b.dataset.value === val) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });
  }
  updateCatMonthLabel();
  renderCategories();
};

function renderCategories() {
  updateCatMonthLabel();
  const container = document.getElementById('categories-content');
  const monthStr = getCatMonthStr();
  const filtered = allTransactions.filter(t => t.date && t.date.startsWith(monthStr));

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><span>🏷️</span><p>No transactions for this month.</p></div>';
    return;
  }
  const map = {};
  filtered.forEach(t => {
    if (!map[t.category]) map[t.category] = { income: 0, expense: 0, count: 0 };
    map[t.category][t.type] += t.amount;
    map[t.category].count++;
  });
  const maxTotal = Math.max(...Object.values(map).map(v => v.income + v.expense));
  container.innerHTML = '';
  Object.entries(map).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense)).forEach(([cat, vals]) => {
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-header">
        <span class="cat-name">${getCategoryIcon(cat)} ${cat}</span>
        <span class="cat-count">${vals.count} transaction${vals.count !== 1 ? 's' : ''}</span>
      </div>
      <div class="cat-totals">
        <span class="cat-income-val">+${formatCurrency(vals.income)}</span>
        <span class="cat-expense-val">-${formatCurrency(vals.expense)}</span>
      </div>
    `;
    container.appendChild(card);
  });
}



window.toggleDashboardCCDropdown = function(e) {
  if (e) e.stopPropagation();
  const card = document.querySelector('.cc-dashboard-card');
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  localStorage.setItem('dashboardCCOpen', isOpen);
};

window.toggleMyKasihDropdown = function(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('dashboard-mykasih-card');
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  localStorage.setItem('mykasihOpen', isOpen);
};



// ─── Credit Card Limit Modal ────────────────────────────────────────────────
window.openSetCCLimitModal = function() {
  openConfigureCCModal(activeCCCardId);
};

window.openConfigureCCModal = function(cardId = null) {
  editingCCCardId = cardId;
  const overlay = document.getElementById('cc-limit-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  const titleEl    = overlay.querySelector('.modal-header h2');
  const nameInput  = document.getElementById('cc-name-input');
  const limitInput = document.getElementById('cc-limit-input');
  const dueDayInput= document.getElementById('cc-due-day-input');
  const errEl      = document.getElementById('cc-limit-modal-error');
  const deleteBtn  = document.getElementById('btn-delete-cc');

  if (errEl) errEl.style.display = 'none';

  // Pool values are always pre-filled from shared settings
  if (limitInput)  setAmountInputValue('cc-limit-input', userSettings.creditPoolLimit  || 2000);
  if (dueDayInput) dueDayInput.value = userSettings.creditPoolDueDay || 25;

  if (cardId) {
    if (titleEl) titleEl.textContent = 'Edit Credit Card';
    const card = getCCCards().find(c => c.id === cardId);
    if (card && nameInput) nameInput.value = card.name;
    if (deleteBtn) deleteBtn.style.display = getCCCards().length > 1 ? 'block' : 'none';
  } else {
    if (titleEl) titleEl.textContent = 'Add Credit Card';
    if (nameInput) nameInput.value = '';
    if (deleteBtn) deleteBtn.style.display = 'none';
  }
};

window.closeCCLimitModal = function() {
  const overlay = document.getElementById('cc-limit-modal-overlay');
  if (overlay) overlay.classList.add('hidden');
};

window.closeCCLimitModalOnOverlay = function(e) {
  if (e.target.id === 'cc-limit-modal-overlay') closeCCLimitModal();
};

window.saveCCLimitSettings = async function() {
  const nameInput  = document.getElementById('cc-name-input');
  const limitInput = document.getElementById('cc-limit-input');
  const dueDayInput= document.getElementById('cc-due-day-input');
  const errEl      = document.getElementById('cc-limit-modal-error');

  const name   = nameInput  ? nameInput.value.trim() : '';
  const limit  = limitInput  ? parseFloat(limitInput.value)       : NaN;
  const dueDay = dueDayInput ? parseInt(dueDayInput.value, 10)    : NaN;

  if (!name) {
    errEl.textContent = 'Please enter a card name.';
    errEl.style.display = 'block'; return;
  }
  if (isNaN(limit) || limit < 0) {
    errEl.textContent = 'Please enter a valid shared credit limit.';
    errEl.style.display = 'block'; return;
  }
  if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
    errEl.textContent = 'Please enter a valid due day (1–31).';
    errEl.style.display = 'block'; return;
  }

  const btn = document.getElementById('btn-save-cc-limit');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    // Cards store only id + name — limit/dueDay live on the shared pool
    const cards = [...getCCCards()].map(({ id, name: n }) => ({ id, name: n }));
    if (editingCCCardId) {
      const idx = cards.findIndex(c => c.id === editingCCCardId);
      if (idx !== -1) cards[idx].name = name;
    } else {
      const newId = 'card_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      cards.push({ id: newId, name });
      activeCCCardId = newId;
    }

    await setDoc(doc(db, 'settings', currentUser.uid), {
      creditCards:      cards,
      creditPoolLimit:  limit,
      creditPoolDueDay: dueDay
    }, { merge: true });

    userSettings.creditCards      = cards;
    userSettings.creditPoolLimit  = limit;
    userSettings.creditPoolDueDay = dueDay;

    showToast(editingCCCardId ? 'Credit card updated!' : 'Credit card added!', 'success');
    closeCCLimitModal();
    updateSummaryCards();
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Failed to save. Try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Card';
  }
};

window.deleteCCCard = async function() {
  if (!editingCCCardId) return;
  const cards = getCCCards();
  if (cards.length <= 1) {
    showToast('Cannot delete the only credit card.', 'error');
    return;
  }

  const confirmed = confirm('Are you sure you want to delete this credit card? Transactions associated with this card will not be deleted, but they will no longer be grouped under this card.');
  if (!confirmed) return;

  const btn = document.getElementById('btn-delete-cc');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }

  try {
    const updatedCards = cards.filter(c => c.id !== editingCCCardId);
    if (activeCCCardId === editingCCCardId) {
      activeCCCardId = updatedCards[0].id;
    }

    await setDoc(doc(db, 'settings', currentUser.uid), {
      creditCards: updatedCards
    }, { merge: true });

    userSettings.creditCards = updatedCards;
    showToast('Credit card deleted!', 'success');
    closeCCLimitModal();
    updateSummaryCards();
  } catch (e) {
    console.error(e);
    showToast('Failed to delete credit card. Try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
  }
};

// ─── Credit Card Pay Modal ──────────────────────────────────────────────────
window.openPayCCModal = function() {
  const overlay = document.getElementById('cc-pay-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  const ccOutstanding = getCCCardOutstanding(activeCCCardId);

  const amountInput = document.getElementById('cc-pay-amount-input');
  const dateInput = document.getElementById('cc-pay-date-input');
  const errEl = document.getElementById('cc-pay-modal-error');

  const titleEl = overlay.querySelector('.modal-header h2');
  const activeCard = getCCCards().find(c => c.id === activeCCCardId);
  if (titleEl && activeCard) {
    titleEl.textContent = `Pay ${activeCard.name} Bill`;
  }

  if (amountInput) setAmountInputValue('cc-pay-amount-input', ccOutstanding > 0 ? ccOutstanding : '');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (errEl) errEl.style.display = 'none';
};

window.closeCCPayModal = function() {
  const overlay = document.getElementById('cc-pay-modal-overlay');
  if (overlay) overlay.classList.add('hidden');
};

window.closeCCPayModalOnOverlay = function(e) {
  if (e.target.id === 'cc-pay-modal-overlay') closeCCPayModal();
};

window.recordCCPayment = async function() {
  const amountInput = document.getElementById('cc-pay-amount-input');
  const dateInput = document.getElementById('cc-pay-date-input');
  const errEl = document.getElementById('cc-pay-modal-error');

  const amount = parseFloat(amountInput.value);
  const date = dateInput.value;

  if (isNaN(amount) || amount <= 0) {
    errEl.textContent = 'Please enter a valid payment amount.';
    errEl.style.display = 'block';
    return;
  }
  if (!date) {
    errEl.textContent = 'Please select a payment date.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btn-save-cc-pay');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const activeCard = getCCCards().find(c => c.id === activeCCCardId) || { name: 'Credit Card' };
    const data = {
      uid: currentUser.uid,
      type: 'expense',
      description: `Credit Card Payment (${activeCard.name})`,
      category: 'Credit Card Payment',
      amount: amount,
      date: date,
      notes: `Logged via dashboard card payment wizard for ${activeCard.name}.`,
      paymentMethod: 'cash',
      cardId: activeCCCardId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, 'transactions'), data);
    showToast('Payment recorded successfully!', 'success');
    closeCCPayModal();
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Failed to record payment. Try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Record Payment';
  }
};

window.budgetMonthShift = function (delta) {
  haptic();
  budgetSelectedMonth += delta;
  if (budgetSelectedMonth < 0) { budgetSelectedMonth = 11; budgetSelectedYear--; }
  if (budgetSelectedMonth > 11) { budgetSelectedMonth = 0; budgetSelectedYear++; }
  renderBudgets();
};

function renderBudgets() {
  const container = document.getElementById('budgets-list');
  if (!container) return;

  const monthLabel = document.getElementById('budget-month-label');
  if (monthLabel) {
    const d = new Date(budgetSelectedYear, budgetSelectedMonth, 1);
    monthLabel.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const currentMonthStr = `${budgetSelectedYear}-${String(budgetSelectedMonth + 1).padStart(2, '0')}`;

  // Calculate per-budget spending and overall monthly budget totals
  let totalBudget = 0;
  let totalSpent = 0;
  const rows = allBudgets.map(b => {
    const limit = parseFloat(b.limit) || 0;
    const spent = allTransactions
      .filter(t => t.type === 'expense' && t.category === b.category && t.date && t.date.startsWith(currentMonthStr))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    totalBudget += limit;
    totalSpent += spent;
    const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    let statusClass = 'safe';
    if (limit > 0 && spent > limit) statusClass = 'danger';
    else if (limit > 0 && (spent / limit) >= 0.8) statusClass = 'warn';
    return { b, limit, spent, pct, statusClass };
  });

  // Update Total Monthly Budget Summary Card
  const ratioEl = document.getElementById('sw-budget-total-ratio');
  const barEl   = document.getElementById('sw-budget-total-bar');
  const trackEl = document.getElementById('sw-budget-total-track');
  const remEl   = document.getElementById('sw-budget-total-rem');
  const overallPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  let overallClass = 'safe';
  if (totalBudget > 0 && totalSpent > totalBudget) overallClass = 'danger';
  else if (totalBudget > 0 && (totalSpent / totalBudget) >= 0.8) overallClass = 'warn';

  if (ratioEl) {
    ratioEl.textContent = `${formatCurrency(totalSpent)} / ${formatCurrency(totalBudget)}`;
    ratioEl.className = `sw-budget-summary-ratio ${overallClass}`;
  }
  if (barEl) {
    barEl.style.width = `${overallPct}%`;
    barEl.className = `sw-budget-fill ${overallClass}`;
  }
  if (trackEl) {
    trackEl.className = `sw-budget-track large ${overallClass}`;
  }
  if (remEl) {
    const remaining = totalBudget - totalSpent;
    if (remaining >= 0) {
      remEl.textContent = `${formatCurrency(remaining)} remaining this month`;
      remEl.className = 'sw-budget-summary-rem';
    } else {
      remEl.textContent = `Over budget by ${formatCurrency(-remaining)}`;
      remEl.className = 'sw-budget-summary-rem danger';
    }
  }

  if (!rows.length) {
    container.innerHTML = `
      <div class="sw-empty-card">
        <div class="sw-empty-title">No budgets set yet</div>
        <div class="sw-empty-sub">Tap "+ Set Budget" above to add monthly spending limits.</div>
      </div>
    `;
    return;
  }

  const editSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
  const trashSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

  container.innerHTML = '';
  rows.forEach(({ b, limit, spent, pct, statusClass }) => {
    const meta = getSpendwiseCategoryMeta(b.category, 'expense');
    const div = document.createElement('div');
    div.className = 'sw-budget-card';
    div.innerHTML = `
      <div class="sw-budget-top">
        <div class="sw-budget-icon" style="background:${meta.bg};color:${meta.color};">${meta.icon}</div>
        <div class="sw-budget-info">
          <div class="sw-budget-name">${escapeHtml(b.category)}</div>
          <div class="sw-budget-sub">${formatCurrency(spent)} of ${formatCurrency(limit)}</div>
        </div>
        <div class="sw-budget-actions">
          <button type="button" class="sw-budget-icon-btn" onclick="event.stopPropagation();haptic();openBudgetModal('${b.id}')" aria-label="Edit budget" title="Edit budget">${editSvg}</button>
          <button type="button" class="sw-budget-icon-btn danger" onclick="event.stopPropagation();haptic();deleteBudget('${b.id}')" aria-label="Delete budget" title="Delete budget">${trashSvg}</button>
        </div>
      </div>
      <div class="sw-budget-track ${statusClass}">
        <div class="sw-budget-fill ${statusClass}" style="width:${pct}%"></div>
      </div>
    `;
    div.addEventListener('click', () => openBudgetChart(b, spent, pct, statusClass));
    container.appendChild(div);
  });
}

// ─── Budget Chart Modal ────────────────────────────────────────────────────
window.openBudgetChart = function(b, spent, pct, statusClass) {
  const circumference = 2 * Math.PI * 80;
  const spentDash = (pct / 100) * circumference;
  const safePct   = Math.max(0, 100 - pct);
  const safeDash  = (safePct / 100) * circumference;
  const remaining = Math.max(0, b.limit - spent);

  document.getElementById('budget-chart-title').textContent = `${getCategoryIcon(b.category)} ${b.category}`;

  const safeArc  = document.getElementById('budget-donut-safe');
  const spentArc = document.getElementById('budget-donut-spent');
  safeArc.setAttribute('stroke-dasharray',  '0 503');
  spentArc.setAttribute('stroke-dasharray', '0 503');
  safeArc.style.strokeDashoffset  = '0';

  document.getElementById('budget-donut-pct').textContent       = `${pct.toFixed(0)}%`;
  document.getElementById('budget-legend-spent').textContent     = formatCurrency(spent);
  document.getElementById('budget-legend-remaining').textContent = formatCurrency(remaining);
  document.getElementById('budget-legend-limit').textContent     = formatCurrency(b.limit);

  const statusEl = document.getElementById('budget-chart-status');
  const labels   = { safe: '✅ Looking good!', warn: '⚠️ Nearing limit', danger: '🚨 Over budget!' };
  statusEl.textContent = labels[statusClass] || '';
  statusEl.className   = `budget-chart-status ${statusClass}`;

  document.getElementById('budget-chart-overlay').classList.remove('hidden');

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (pct > 0) {
      spentArc.setAttribute('stroke-dasharray', `${spentDash.toFixed(2)} ${circumference.toFixed(2)}`);
    }
    if (safePct > 0) {
      safeArc.style.strokeDashoffset = `-${spentDash.toFixed(2)}`;
      safeArc.setAttribute('stroke-dasharray', `${safeDash.toFixed(2)} ${circumference.toFixed(2)}`);
    }
  }));
};

window.closeBudgetChart = function() {
  document.getElementById('budget-chart-overlay').classList.add('hidden');
};

window.closeBudgetChartOnOverlay = function(e) {
  if (e.target === document.getElementById('budget-chart-overlay')) closeBudgetChart();
};

// ─── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// ─── Swipe & Haptics ───────────────────────────────────────────────────────
window.haptic = function() {
  if (navigator.vibrate) navigator.vibrate(30);
};



// ─── Keyboard shortcuts ────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteModal();
    closeMoreMenu();
    document.querySelectorAll('.modal-overlay:not(.hidden) .modal-close').forEach(btn => btn.click());
  }
});

// ─── Mobile Profile Dropdown (duplicate removed — see line 572) ───────────

// ─── MONTHLY REPORT ───────────────────────────────────────────────────────

function renderMonthly() {
  const now = new Date();
  const yearSel = document.getElementById('monthly-year-select');

  const years = [...new Set(allTransactions.map(t => t.date?.substring(0, 4)).filter(Boolean))];
  if (!years.includes(String(now.getFullYear()))) years.push(String(now.getFullYear()));
  years.sort((a, b) => b - a);
  const selectedYear = yearSel.value || String(now.getFullYear());
  yearSel.innerHTML = years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');

  const txInYear = allTransactions.filter(t => t.date && t.date.startsWith(selectedYear));
  const totalIncome = txInYear.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txInYear.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netSaving = totalIncome - totalExpense;

  const summaryEl = document.getElementById('monthly-summary-cards');
  summaryEl.innerHTML = `
    <div class="mth-year-summary">
      <div class="mth-year-stat">
        <span class="mth-year-label">Net Income</span>
        <span class="mth-year-val income">${formatCurrency(totalIncome)}</span>
      </div>
      <div class="mth-year-divider"></div>
      <div class="mth-year-stat">
        <span class="mth-year-label">Total Expenses</span>
        <span class="mth-year-val expense">${formatCurrency(totalExpense)}</span>
      </div>
      <div class="mth-year-divider"></div>
      <div class="mth-year-stat">
        <span class="mth-year-label">Net Savings</span>
        <span class="mth-year-val ${netSaving >= 0 ? 'income' : 'expense'}">${netSaving >= 0 ? '+' : ''}${formatCurrency(netSaving)}</span>
      </div>
    </div>
  `;

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const breakdown = document.getElementById('monthly-breakdown');
  breakdown.innerHTML = '';

  let hasData = false;
  months.forEach((mName, idx) => {
    const mKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
    const mTx = txInYear.filter(t => t.date && t.date.startsWith(mKey));
    if (!mTx.length) return;
    hasData = true;

    const inc = mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = inc - exp;
    const maxBar = Math.max(inc, exp, 1);

    // Category grid
    const catMap = {};
    mTx.forEach(t => {
      const c = t.category || 'General';
      if (!catMap[c]) catMap[c] = { income: 0, expense: 0, count: 0 };
      catMap[c][t.type] += t.amount;
      catMap[c].count++;
    });
    const catEntries = Object.entries(catMap).sort((a, b) => (b[1].expense + b[1].income) - (a[1].expense + a[1].income));

    const catCardsHtml = catEntries.map(([cat, data]) => `
      <div class="mth-cat-card">
        <div class="mth-cat-card-header">
          <div class="mth-cat-card-icon-wrap">${getCategoryIcon(cat)}</div>
          <span class="mth-cat-card-count">${data.count}</span>
        </div>
        <div class="mth-cat-card-name">${cat}</div>
        <div class="mth-cat-card-amounts">
          <span class="mth-cat-card-val income">+${formatCurrency(data.income)}</span>
          <span class="mth-cat-card-val expense">-${formatCurrency(data.expense)}</span>
        </div>
      </div>
    `).join('');

    // Transaction list
    const txListHtml = mTx.map(t => `
      <div class="mth-tx-item" style="cursor: pointer;" onclick="openTxDetails('${t.id}', event)">
        <div class="mth-tx-icon-wrap ${t.type}">${getCategoryIcon(t.category)}</div>
        <div class="mth-tx-info">
          <span class="mth-tx-desc">${t.description}</span>
          <span class="mth-tx-meta">${t.category} · ${formatDate(t.date)}</span>
        </div>
        <span class="mth-tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
      </div>
    `).join('');

    const rowId = `mrow-${mKey}`;
    const div = document.createElement('div');
    div.className = 'monthly-row';
    div.innerHTML = `
      <div class="monthly-month-header mth-clickable" onclick="toggleMonthDetail('${rowId}')">
        <div class="mth-header-left">
          <span class="monthly-month-name">${mName}</span>
          <span class="monthly-tx-count">${mTx.length} transaction${mTx.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="mth-header-right">
          <span class="monthly-net ${net >= 0 ? 'income' : 'expense'}">${net >= 0 ? '+' : ''}${formatCurrency(net)}</span>
          <svg class="mth-chevron-svg" id="chev-${rowId}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="monthly-bars">
        <div class="monthly-bar-row">
          <span class="monthly-bar-label">INCOME</span>
          <div class="monthly-bar-track"><div class="monthly-bar income" style="width:${(inc/maxBar*100).toFixed(1)}%"></div></div>
          <span class="monthly-bar-val income">${formatCurrency(inc)}</span>
        </div>
        <div class="monthly-bar-row">
          <span class="monthly-bar-label">EXPENSE</span>
          <div class="monthly-bar-track"><div class="monthly-bar expense" style="width:${(exp/maxBar*100).toFixed(1)}%"></div></div>
          <span class="monthly-bar-val expense">${formatCurrency(exp)}</span>
        </div>
      </div>
      <div class="mth-detail" id="${rowId}">
        <div class="mth-detail-inner">
          <div class="mth-section-title">BY CATEGORY BREAKDOWN</div>
          <div class="mth-cat-grid">${catCardsHtml}</div>
          <div class="mth-section-title" style="margin-top:1.5rem">ALL TRANSACTIONS</div>
          <div class="mth-tx-list">${txListHtml}</div>
        </div>
      </div>
    `;
    breakdown.appendChild(div);
  });

  if (!hasData) {
    breakdown.innerHTML = `<div class="empty-state"><span>📅</span><p>No transactions in ${selectedYear}.</p></div>`;
  }
}

window.toggleMonthDetail = function(rowId) {
  const detail = document.getElementById(rowId);
  const chev = document.getElementById('chev-' + rowId);
  if (!detail) return;
  const isOpen = detail.classList.toggle('open');
  if (chev) chev.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  if (isOpen) haptic();
};

// ─── TABUNG (SAVINGS) ─────────────────────────────────────────────────────

window.openTabungModal = function(tabungId = null) {
  editingTabungId = tabungId;
  document.getElementById('tabung-modal-title').textContent = tabungId ? 'Edit Tabung' : 'New Tabung';
  document.getElementById('tabung-modal-error').style.display = 'none';

  if (tabungId) {
    const t = allTabung.find(x => x.id === tabungId);
    if (t) {
      document.getElementById('tabung-name').value = t.name;
      setAmountInputValue('tabung-target', t.target);
      setAmountInputValue('tabung-saved', t.saved);
      document.getElementById('tabung-emoji').value = t.emoji || '🎯';
      document.getElementById('tabung-deadline').value = t.deadline || '';
    }
  } else {
    document.getElementById('tabung-name').value = '';
    setAmountInputValue('tabung-target', '');
    setAmountInputValue('tabung-saved', '0');
    document.getElementById('tabung-emoji').value = '🎯';
    document.getElementById('tabung-deadline').value = '';
  }
  document.getElementById('tabung-modal-overlay').classList.remove('hidden');
};

window.closeTabungModal = function() {
  document.getElementById('tabung-modal-overlay').classList.add('hidden');
  editingTabungId = null;
};

window.closeTabungModalOnOverlay = function(e) {
  if (e.target.id === 'tabung-modal-overlay') closeTabungModal();
};

window.saveTabung = async function() {
  const name = document.getElementById('tabung-name').value.trim();
  const target = parseFloat(document.getElementById('tabung-target').value);
  const saved = parseFloat(document.getElementById('tabung-saved').value) || 0;
  const emoji = document.getElementById('tabung-emoji').value.trim() || '🎯';
  const deadline = document.getElementById('tabung-deadline').value;
  const errEl = document.getElementById('tabung-modal-error');

  if (!name) { errEl.textContent = 'Please enter a name.'; errEl.style.display = 'block'; return; }
  if (!target || target <= 0) { errEl.textContent = 'Please enter a valid target amount.'; errEl.style.display = 'block'; return; }
  // Allowing saved to exceed target — no restriction

  const btn = document.getElementById('btn-save-tabung');
  btn.disabled = true; btn.textContent = 'Saving…';

  const data = { uid: currentUser.uid, name, target, saved, emoji, deadline, updatedAt: serverTimestamp() };

  try {
    if (editingTabungId) {
      await updateDoc(doc(db, 'tabung', editingTabungId), data);
      showToast('Tabung updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'tabung'), data);
      showToast('Tabung created!', 'success');
    }
    closeTabungModal();
  } catch(e) {
    errEl.textContent = 'Failed to save.'; errEl.style.display = 'block'; console.error(e);
  } finally { btn.disabled = false; btn.textContent = 'Save Tabung'; }
};

window.deleteTabung = async function(id) {
  if (confirm('Delete this tabung?')) {
    try { await deleteDoc(doc(db, 'tabung', id)); showToast('Tabung deleted', 'success'); }
    catch(e) { showToast('Error deleting tabung', 'error'); }
  }
};

window.openTopupModal = function(id) {
  topupTabungId = id;
  const t = allTabung.find(x => x.id === id);
  document.getElementById('topup-tabung-name').textContent = `${t.emoji || '🎯'} ${t.name}`;
  document.getElementById('topup-amount').value = '';
  document.getElementById('tabung-topup-overlay').classList.remove('hidden');
};

window.closeTopupModal = function() {
  document.getElementById('tabung-topup-overlay').classList.add('hidden');
  topupTabungId = null;
};

window.closeTopupModalOnOverlay = function(e) {
  if (e.target.id === 'tabung-topup-overlay') closeTopupModal();
};

window.topupTabung = async function() {
  const amount = parseFloat(document.getElementById('topup-amount').value);
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
  const t = allTabung.find(x => x.id === topupTabungId);
  if (!t) return;
  const newSaved = t.saved + amount; // Allow exceeding target
  try {
    await updateDoc(doc(db, 'tabung', topupTabungId), { saved: newSaved, updatedAt: serverTimestamp() });
    showToast(`Added ${formatCurrency(amount)} to ${t.name}!`, 'success');
    closeTopupModal();
  } catch(e) { showToast('Failed to update', 'error'); }
};

function renderTabung() {
  const container = document.getElementById('tabung-list');
  if (!allTabung.length) {
    container.innerHTML = '<div class="empty-state"><span>🪙</span><p>No tabung yet. Create your first savings goal!</p></div>';
    return;
  }
  container.innerHTML = '';
  allTabung.sort((a, b) => {
    const aT = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bT = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bT - aT;
  });
  allTabung.forEach(t => {
    const rawPct = (t.saved / t.target) * 100;
    const pct = Math.min(rawPct, 100); // Cap bar width at 100%
    const isExceeded = t.saved > t.target;
    let statusClass = 'safe', statusText = `${rawPct.toFixed(0)}% reached`;
    if (isExceeded) { statusClass = 'income-text'; statusText = `🚀 Exceeded by ${formatCurrency(t.saved - t.target)}!`; }
    else if (rawPct >= 100) { statusClass = 'income-text'; statusText = '🎉 Goal reached!'; }
    else if (rawPct >= 75) { statusClass = 'warn'; }

    let deadlineHtml = '';
    if (t.deadline) {
      const d = new Date(t.deadline + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      const label = diff < 0 ? `⚠️ ${Math.abs(diff)} days overdue` : diff === 0 ? '🔔 Due today!' : `📆 ${diff} days left`;
      deadlineHtml = `<span class="tabung-deadline-label">${label}</span>`;
    }

    const card = document.createElement('div');
    card.className = 'tabung-card';
    card.setAttribute('onclick', `openTabungDetailsModal('${t.id}', event)`);
    card.innerHTML = `
      <div class="tabung-header">
        <span class="tabung-emoji">${t.emoji || '🎯'}</span>
        <div class="tabung-title-wrap">
          <span class="tabung-name">${t.name}</span>
          ${deadlineHtml}
        </div>
        <div class="tabung-actions">
          <button class="btn-tabung-edit" onclick="event.stopPropagation(); openTabungModal('${t.id}')">✏️</button>
          <button class="btn-del-budget" onclick="event.stopPropagation(); deleteTabung('${t.id}')">✕</button>
        </div>
      </div>
      <div class="tabung-amounts">
        <span class="tabung-saved">${formatCurrency(t.saved)}</span>
        <span class="tabung-sep"> / </span>
        <span class="tabung-target-val">${formatCurrency(t.target)}</span>
      </div>
      <div class="budget-progress-wrap" style="margin:0.75rem 0;">
        <div class="budget-progress ${pct >= 100 ? 'safe' : pct >= 75 ? 'warn' : 'safe'}" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="budget-status ${pct >= 100 ? 'safe' : ''}" style="color:${pct >= 100 ? 'var(--accent-green)' : pct >= 75 ? 'var(--accent-gold)' : 'var(--text-secondary)'}">${statusText}</span>
        <button class="btn-add-tx" style="padding:0.4rem 0.9rem;font-size:0.8rem;" onclick="event.stopPropagation(); openTopupModal('${t.id}')">+ Add</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ─── LOANS / HUTANG ──────────────────────────────────────────────────────

window.setLoanType = function(type) {
  loanType = type;
  document.getElementById('loan-type-owe').classList.toggle('active', type === 'owe');
  document.getElementById('loan-type-lent').classList.toggle('active', type === 'lent');
};

window.openLoanModal = function(loanId = null) {
  editingLoanId = loanId;
  document.getElementById('loan-modal-title').textContent = loanId ? 'Edit Loan' : 'Add Loan / Hutang';
  document.getElementById('loan-modal-error').style.display = 'none';

  if (loanId) {
    const l = allLoans.find(x => x.id === loanId);
    if (l) {
      setLoanType(l.loanType || 'owe');
      document.getElementById('loan-person').value = l.person;
      document.getElementById('loan-desc').value = l.desc;
      setAmountInputValue('loan-total', l.total);
      setAmountInputValue('loan-paid', l.paid);
      document.getElementById('loan-due').value = l.due || '';
    }
  } else {
    setLoanType('owe');
    document.getElementById('loan-person').value = '';
    document.getElementById('loan-desc').value = '';
    setAmountInputValue('loan-total', '');
    setAmountInputValue('loan-paid', '0');
    document.getElementById('loan-due').value = '';
  }
  document.getElementById('loan-modal-overlay').classList.remove('hidden');
};

window.closeLoanModal = function() {
  document.getElementById('loan-modal-overlay').classList.add('hidden');
  editingLoanId = null;
};

window.closeLoanModalOnOverlay = function(e) {
  if (e.target.id === 'loan-modal-overlay') closeLoanModal();
};

window.saveLoan = async function() {
  const person = document.getElementById('loan-person').value.trim();
  const desc = document.getElementById('loan-desc').value.trim();
  const total = parseFloat(document.getElementById('loan-total').value);
  const paid = parseFloat(document.getElementById('loan-paid').value) || 0;
  const due = document.getElementById('loan-due').value;
  const errEl = document.getElementById('loan-modal-error');

  if (!person) { errEl.textContent = 'Please enter a person/institution.'; errEl.style.display = 'block'; return; }
  if (!total || total <= 0) { errEl.textContent = 'Please enter a valid amount.'; errEl.style.display = 'block'; return; }
  if (paid > total) { errEl.textContent = 'Paid cannot exceed total.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-save-loan');
  btn.disabled = true; btn.textContent = 'Saving…';

  const data = { uid: currentUser.uid, loanType, person, desc, total, paid, due, updatedAt: serverTimestamp() };

  try {
    if (editingLoanId) {
      await updateDoc(doc(db, 'loans', editingLoanId), data);
      showToast('Loan updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'loans'), data);
      showToast('Loan added!', 'success');
    }
    closeLoanModal();
  } catch(e) {
    errEl.textContent = 'Failed to save.'; errEl.style.display = 'block'; console.error(e);
  } finally { btn.disabled = false; btn.textContent = 'Save'; }
};

window.deleteLoan = async function(id) {
  if (confirm('Delete this loan record?')) {
    try { await deleteDoc(doc(db, 'loans', id)); showToast('Loan deleted', 'success'); }
    catch(e) { showToast('Error deleting', 'error'); }
  }
};

window.openLoanPayModal = function(id) {
  loanPayId = id;
  const l = allLoans.find(x => x.id === id);
  const remaining = l.total - l.paid;
  document.getElementById('loan-pay-desc').textContent = `${l.loanType === 'owe' ? '💸 I owe' : '💰 Lent to'} ${l.person} — ${formatCurrency(remaining)} remaining`;
  document.getElementById('loan-pay-amount').value = '';
  document.getElementById('loan-pay-overlay').classList.remove('hidden');
};

window.closeLoanPayModal = function() {
  document.getElementById('loan-pay-overlay').classList.add('hidden');
  loanPayId = null;
};

window.closeLoanPayOnOverlay = function(e) {
  if (e.target.id === 'loan-pay-overlay') closeLoanPayModal();
};

window.recordLoanPayment = async function() {
  const amount = parseFloat(document.getElementById('loan-pay-amount').value);
  if (!amount || amount <= 0) { showToast('Enter valid amount', 'error'); return; }
  const l = allLoans.find(x => x.id === loanPayId);
  if (!l) return;
  const newPaid = l.paid + amount; // Allow overpayment — no cap
  try {
    await updateDoc(doc(db, 'loans', loanPayId), { paid: newPaid, updatedAt: serverTimestamp() });
    showToast(`Payment of ${formatCurrency(amount)} recorded!`, 'success');
    closeLoanPayModal();
  } catch(e) { showToast('Failed to update', 'error'); }
};

function renderLoans() {
  const container = document.getElementById('loan-list');
  const summaryEl = document.getElementById('loan-summary-cards');

  const totalOwe  = allLoans.filter(l => l.loanType === 'owe' ).reduce((s, l) => s + Math.max(0, l.total - l.paid), 0);
  const totalLent = allLoans.filter(l => l.loanType === 'lent').reduce((s, l) => s + Math.max(0, l.total - l.paid), 0);

  summaryEl.innerHTML = `
    <div class="summary-card expense">
      <div class="card-icon">💸</div>
      <div class="card-info">
        <span class="card-label">Total I Owe</span>
        <span class="card-value">${formatCurrency(totalOwe)}</span>
      </div>
    </div>
    <div class="summary-card income">
      <div class="card-icon">💰</div>
      <div class="card-info">
        <span class="card-label">Total Lent Out</span>
        <span class="card-value">${formatCurrency(totalLent)}</span>
      </div>
    </div>
  `;

  if (!allLoans.length) {
    container.innerHTML = '<div class="empty-state"><span>🏦</span><p>No loans recorded. Add one to start tracking!</p></div>';
    return;
  }

  container.innerHTML = '';
  allLoans.sort((a, b) => {
    const aT = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bT = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bT - aT;
  });

  allLoans.forEach(l => {
    const remaining = l.total - l.paid;
    const isSettled = l.paid >= l.total;
    const isOverpaid = l.paid > l.total;
    const overpaidAmt = isOverpaid ? l.paid - l.total : 0;
    const pct = isOverpaid ? 100 : Math.min((l.paid / l.total) * 100, 100);

    let dueHtml = '';
    if (l.due && !isSettled) {
      const d = new Date(l.due + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      const label = diff < 0 ? `⚠️ ${Math.abs(diff)} days overdue` : diff === 0 ? '🔔 Due today!' : `📆 ${diff} days left`;
      dueHtml = `<span class="tabung-deadline-label ${diff < 0 ? 'overdue' : ''}">${label}</span>`;
    }

    const remainingDisplay = isOverpaid
      ? `<span>Overpaid: <strong style="color:var(--neon-amber)">+${formatCurrency(overpaidAmt)}</strong></span>`
      : `<span>Remaining: <strong style="color:${isSettled ? 'var(--accent-green)' : 'var(--accent-red)'}">${formatCurrency(Math.max(remaining, 0))}</strong></span>`;

    const progressClass = isOverpaid ? 'overpaid' : 'safe';
    const statusText = isOverpaid
      ? `<span style="font-size:0.8rem;color:var(--neon-amber);font-weight:700;">⚡ Overpaid by ${formatCurrency(overpaidAmt)}</span>`
      : isSettled
        ? `<span style="font-size:0.8rem;color:var(--accent-green);">✅ Settled!</span>`
        : `<span style="font-size:0.8rem;color:var(--text-secondary);">${pct.toFixed(0)}% paid</span>`;

    const card = document.createElement('div');
    card.className = `loan-card ${isSettled ? 'settled' : ''} ${l.loanType}`;
    card.setAttribute('onclick', `openLoanDetailsModal('${l.id}', event)`);
    card.innerHTML = `
      <div class="loan-type-badge ${l.loanType}">${l.loanType === 'owe' ? '💸 I Owe' : '💰 I Lent'}</div>
      <div class="loan-header">
        <div>
          <div class="loan-person">${l.person}</div>
          <div class="loan-desc-text">${l.desc || ''}</div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-shrink:0;">
          <button class="btn-tabung-edit" onclick="event.stopPropagation(); openLoanModal('${l.id}')">✏️</button>
          <button class="btn-del-budget" onclick="event.stopPropagation(); deleteLoan('${l.id}')">✕</button>
        </div>
      </div>
      ${dueHtml}
      <div class="loan-amounts">
        <span>Paid: <strong style="color:var(--accent-green)">${formatCurrency(l.paid)}</strong></span>
        ${remainingDisplay}
        <span>Total: <strong>${formatCurrency(l.total)}</strong></span>
      </div>
      <div class="budget-progress-wrap" style="margin:0.75rem 0;">
        <div class="budget-progress ${progressClass}" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        ${statusText}
        ${!isSettled ? `<button class="btn-add-tx" style="padding:0.4rem 0.9rem;font-size:0.8rem;" onclick="event.stopPropagation(); openLoanPayModal('${l.id}')">+ Pay</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

// ─── TABUNG (SAVINGS) & LOANS DETAILS MODALS ───

window.openTabungDetailsModal = function(id, event) {
  activeTabungDetailId = id;
  const amountInput = document.getElementById('detail-tabung-amount');
  const dateInput = document.getElementById('detail-tabung-date');
  const errEl = document.getElementById('detail-tabung-error');
  
  if (amountInput) amountInput.value = '';
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (errEl) errEl.textContent = '';
  
  setTabungActionType('add');
  refreshTabungDetailsModal();
  const overlay = document.getElementById('tabung-details-overlay');
  if (overlay) overlay.classList.remove('hidden');
};

window.closeTabungDetailsModal = function() {
  const overlay = document.getElementById('tabung-details-overlay');
  if (overlay) overlay.classList.add('hidden');
  activeTabungDetailId = null;
};

window.closeTabungDetailsOnOverlay = function(e) {
  if (e.target.id === 'tabung-details-overlay') {
    closeTabungDetailsModal();
  }
};

window.setTabungActionType = function(type) {
  tabungActionType = type;
  
  const addBtn = document.getElementById('tabung-action-add');
  const withdrawBtn = document.getElementById('tabung-action-withdraw');
  const titleEl = document.getElementById('tabung-action-title');
  const amountInput = document.getElementById('detail-tabung-amount');
  const submitBtn = document.getElementById('btn-tabung-action-submit');
  
  if (addBtn) addBtn.classList.toggle('active', type === 'add');
  if (withdrawBtn) withdrawBtn.classList.toggle('active', type === 'withdraw');
  
  if (titleEl) {
    titleEl.textContent = type === 'add' ? '+ Add Savings Contribution' : '- Withdraw Savings';
  }
  if (amountInput) {
    amountInput.placeholder = type === 'add' ? 'Amount to deposit' : 'Amount to withdraw';
  }
  if (submitBtn) {
    if (type === 'add') {
      submitBtn.textContent = 'Add to Savings';
      submitBtn.style.background = 'linear-gradient(135deg,var(--neon-violet),var(--neon-violet2))';
      submitBtn.style.boxShadow = '0 6px 20px rgba(124,92,252,.45)';
    } else {
      submitBtn.textContent = 'Withdraw from Savings';
      submitBtn.style.background = 'linear-gradient(135deg,var(--neon-coral),var(--neon-coral2))';
      submitBtn.style.boxShadow = '0 6px 20px rgba(255,77,106,.35)';
    }
  }
};

window.refreshTabungDetailsModal = function() {
  if (!activeTabungDetailId) return;
  const t = allTabung.find(x => x.id === activeTabungDetailId);
  if (!t) {
    closeTabungDetailsModal();
    return;
  }
  
  // Update header and meta
  const emojiEl = document.getElementById('tabung-details-emoji');
  const nameEl = document.getElementById('tabung-details-name');
  const deadlineEl = document.getElementById('tabung-details-deadline');
  
  if (emojiEl) emojiEl.textContent = t.emoji || '🎯';
  if (nameEl) nameEl.textContent = t.name;
  
  if (deadlineEl) {
    if (t.deadline) {
      const d = new Date(t.deadline + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      const label = diff < 0 ? `⚠️ ${Math.abs(diff)} days overdue` : diff === 0 ? '🔔 Due today!' : `📆 ${diff} days left`;
      deadlineEl.innerHTML = `<span class="tabung-deadline-label" style="font-size:0.8rem;">${label} (Due: ${formatDate(t.deadline)})</span>`;
    } else {
      deadlineEl.innerHTML = '<span style="font-size:0.8rem; color:var(--ink-secondary);">No deadline set</span>';
    }
  }
  
  // Progress calculations
  const rawPct = (t.saved / t.target) * 100;
  const pct = Math.min(rawPct, 100); // Cap bar width at 100%
  const isExceeded = t.saved > t.target;
  const savedEl = document.getElementById('tabung-details-saved');
  const targetEl = document.getElementById('tabung-details-target');
  const barEl = document.getElementById('tabung-details-progress-bar');
  const statusEl = document.getElementById('tabung-details-status');
  const remainingEl = document.getElementById('tabung-details-remaining');
  
  if (savedEl) savedEl.textContent = formatCurrency(t.saved);
  if (targetEl) targetEl.textContent = formatCurrency(t.target);
  
  if (barEl) {
    barEl.style.width = `${pct}%`;
    if (pct >= 100) {
      barEl.style.background = 'linear-gradient(90deg,var(--neon-teal),#16b98d)';
    } else if (pct >= 75) {
      barEl.style.background = 'linear-gradient(90deg,var(--neon-amber),#fda642)';
    } else {
      barEl.style.background = 'linear-gradient(90deg,var(--neon-violet),var(--neon-violet2))';
    }
  }
  
  if (statusEl) {
    if (isExceeded) {
      statusEl.textContent = `🚀 Exceeded by ${formatCurrency(t.saved - t.target)}!`;
      statusEl.className = 'budget-status safe income-text';
    } else if (pct >= 100) {
      statusEl.textContent = '🎉 Goal reached!';
      statusEl.className = 'budget-status safe income-text';
    } else {
      statusEl.textContent = `${rawPct.toFixed(0)}% reached`;
      statusEl.className = `budget-status ${pct >= 75 ? 'warn' : 'safe'}`;
    }
  }
  
  if (remainingEl) {
    if (isExceeded) {
      remainingEl.textContent = `🎯 ${formatCurrency(t.saved - t.target)} over target`;
    } else {
      const remaining = t.target - t.saved;
      remainingEl.textContent = remaining > 0 ? `${formatCurrency(remaining)} remaining` : 'Fully funded';
    }
  }
  
  // History loading and rendering
  let history = t.history || [];
  let displayHistory = [...history];
  
  if (displayHistory.length === 0 && t.saved > 0) {
    // Generate mock backward-compatible history item using document timestamp
    const mockDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
    const dateString = mockDate.toISOString().split('T')[0];
    displayHistory = [{
      amount: t.saved,
      date: dateString,
      createdAt: t.createdAt || new Date(),
      isMock: true,
      type: 'deposit'
    }];
  }
  
  // Sort chronologically (newest first)
  displayHistory.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
    return timeB - timeA;
  });
  
  const historyList = document.getElementById('tabung-history-list');
  if (historyList) {
    if (displayHistory.length === 0) {
      historyList.innerHTML = '<div class="empty-state" style="padding:1rem 0;"><p style="font-size:0.8rem;">No savings contributions recorded yet.</p></div>';
    } else {
      historyList.innerHTML = displayHistory.map(item => {
        const isWithdraw = item.type === 'withdraw';
        const prefix = isWithdraw ? '-' : '+';
        const amountClass = isWithdraw ? 'tabung-withdraw' : 'tabung-add';
        const subText = item.isMock ? 'Initial contribution' : (isWithdraw ? 'Withdrawal' : 'Deposit');
        
        return `
          <div class="history-item">
            <div style="display:flex; flex-direction:column; align-items:flex-start;">
              <span class="history-date">${formatDate(item.date)}</span>
              <span style="font-size:0.7rem; color:var(--ink-secondary); font-style:italic;">${subText}</span>
            </div>
            <span class="history-amount ${amountClass}">${prefix}${formatCurrency(item.amount)}</span>
          </div>
        `;
      }).join('');
    }
  }
};

window.addTabungSavingsFromDetail = async function() {
  const amountInput = document.getElementById('detail-tabung-amount');
  const dateInput = document.getElementById('detail-tabung-date');
  const errEl = document.getElementById('detail-tabung-error');
  
  if (!amountInput || !dateInput || !errEl) return;
  
  errEl.textContent = '';
  const amount = parseFloat(amountInput.value);
  const dateStr = dateInput.value;
  
  if (!amount || amount <= 0) {
    errEl.textContent = 'Please enter a valid amount.';
    return;
  }
  if (!dateStr) {
    errEl.textContent = 'Please select a transaction date.';
    return;
  }
  
  const t = allTabung.find(x => x.id === activeTabungDetailId);
  if (!t) return;
  
  let newSaved = t.saved;
  let finalAmount = amount;
  
  if (tabungActionType === 'add') {
    // Allow adding even if already at or over target
    finalAmount = amount;
    newSaved = t.saved + finalAmount;
  } else {
    // Withdraw mode
    if (t.saved <= 0) {
      errEl.textContent = 'You do not have any savings to withdraw from!';
      return;
    }
    if (amount > t.saved) {
      errEl.textContent = `You cannot withdraw more than your current savings of ${formatCurrency(t.saved)}.`;
      return;
    }
    finalAmount = amount;
    newSaved = t.saved - finalAmount;
  }
  
  let history = t.history || [];
  if (history.length === 0 && t.saved > 0) {
    const mockDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
    const dateString = mockDate.toISOString().split('T')[0];
    history.push({
      amount: t.saved,
      date: dateString,
      createdAt: t.createdAt || new Date(),
      type: 'deposit'
    });
  }
  
  // Push transaction to local history array
  history.push({
    amount: finalAmount,
    date: dateStr,
    createdAt: new Date(),
    type: tabungActionType === 'add' ? 'deposit' : 'withdraw'
  });
  
  const submitBtn = document.getElementById('btn-tabung-action-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = tabungActionType === 'add' ? 'Adding…' : 'Withdrawing…';
  }
  
  try {
    await updateDoc(doc(db, 'tabung', activeTabungDetailId), {
      saved: newSaved,
      history: history,
      updatedAt: serverTimestamp()
    });
    
    if (tabungActionType === 'add') {
      showToast(`Saved ${formatCurrency(finalAmount)} to "${t.name}"!`, 'success');
    } else {
      showToast(`Withdrew ${formatCurrency(finalAmount)} from "${t.name}"!`, 'success');
    }
    amountInput.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
  } catch(e) {
    console.error(e);
    errEl.textContent = 'Failed to record transaction. Please try again.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = tabungActionType === 'add' ? 'Add to Savings' : 'Withdraw from Savings';
    }
  }
};

window.openLoanDetailsModal = function(id, event) {
  activeLoanDetailId = id;
  const amountInput = document.getElementById('detail-loan-amount');
  const dateInput = document.getElementById('detail-loan-date');
  const errEl = document.getElementById('detail-loan-error');
  
  if (amountInput) amountInput.value = '';
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (errEl) errEl.textContent = '';
  
  refreshLoanDetailsModal();
  const overlay = document.getElementById('loan-details-overlay');
  if (overlay) overlay.classList.remove('hidden');
};

window.closeLoanDetailsModal = function() {
  const overlay = document.getElementById('loan-details-overlay');
  if (overlay) overlay.classList.add('hidden');
  activeLoanDetailId = null;
};

window.closeLoanDetailsOnOverlay = function(e) {
  if (e.target.id === 'loan-details-overlay') {
    closeLoanDetailsModal();
  }
};

window.refreshLoanDetailsModal = function() {
  if (!activeLoanDetailId) return;
  const l = allLoans.find(x => x.id === activeLoanDetailId);
  if (!l) {
    closeLoanDetailsModal();
    return;
  }
  
  const remaining = l.total - l.paid;
  const isSettled = l.paid >= l.total;
  const isOverpaid = l.paid > l.total;
  const overpaidAmt = isOverpaid ? l.paid - l.total : 0;
  const pct = isOverpaid ? 100 : Math.min((l.paid / l.total) * 100, 100);
  
  // Set basic detail texts
  const personEl = document.getElementById('loan-details-person');
  const descEl = document.getElementById('loan-details-desc');
  const badgeEl = document.getElementById('loan-details-badge');
  const dueEl = document.getElementById('loan-details-due');
  
  if (personEl) personEl.textContent = l.person;
  if (descEl) descEl.textContent = l.desc || 'No description';
  
  if (badgeEl) {
    if (l.loanType === 'owe') {
      badgeEl.textContent = '💸 I Owe';
      badgeEl.className = 'loan-type-badge owe';
    } else {
      badgeEl.textContent = '💰 I Lent';
      badgeEl.className = 'loan-type-badge lent';
    }
  }
  
  if (dueEl) {
    if (isOverpaid) {
      dueEl.innerHTML = `<span class="tabung-deadline-label" style="background:rgba(251,191,36,0.15);color:var(--neon-amber);font-size:0.8rem;border-color:rgba(251,191,36,0.3);padding:0.25rem 0.6rem;">⚡ Overpaid by ${formatCurrency(overpaidAmt)}</span>`;
    } else if (isSettled) {
      dueEl.innerHTML = '<span class="tabung-deadline-label" style="background:var(--accent-green-bg);color:var(--accent-green);font-size:0.8rem;border-color:transparent;padding:0.25rem 0.6rem;">✅ Fully Settled</span>';
    } else if (l.due) {
      const d = new Date(l.due + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      const label = diff < 0 ? `⚠️ ${Math.abs(diff)} days overdue` : diff === 0 ? '🔔 Due today!' : `📆 ${diff} days left`;
      dueEl.innerHTML = `<span class="tabung-deadline-label ${diff < 0 ? 'overdue' : ''}" style="font-size:0.8rem;">${label} (Due: ${formatDate(l.due)})</span>`;
    } else {
      dueEl.innerHTML = '<span style="font-size:0.8rem;color:var(--ink-secondary);">No due date set</span>';
    }
  }
  
  // Hide form if settled or overpaid
  const payBox = document.getElementById('loan-details-pay-box');
  if (payBox) {
    payBox.style.display = isSettled ? 'none' : 'block';
  }
  
  // Amounts — show overpaid label when applicable
  const paidEl = document.getElementById('loan-details-paid');
  const remainingValEl = document.getElementById('loan-details-remaining-val');
  const totalEl = document.getElementById('loan-details-total');
  
  if (paidEl) paidEl.textContent = formatCurrency(l.paid);
  if (remainingValEl) {
    if (isOverpaid) {
      remainingValEl.textContent = `+${formatCurrency(overpaidAmt)} over`;
      remainingValEl.style.color = 'var(--neon-amber)';
    } else {
      remainingValEl.textContent = formatCurrency(Math.max(remaining, 0));
      remainingValEl.style.color = isSettled ? 'var(--accent-green)' : 'var(--accent-red)';
    }
  }
  if (totalEl) totalEl.textContent = formatCurrency(l.total);
  
  // Progress Bar & Status Text
  const barEl = document.getElementById('loan-details-progress-bar');
  const statusEl = document.getElementById('loan-details-status');
  
  if (barEl) {
    barEl.style.width = `${pct}%`;
    if (isOverpaid) {
      barEl.style.background = 'linear-gradient(90deg,var(--neon-amber),#f59e0b)';
    } else if (isSettled) {
      barEl.style.background = 'linear-gradient(90deg,var(--accent-green),#16b98d)';
    } else {
      barEl.style.background = 'linear-gradient(90deg,var(--accent-purple),var(--accent-purple-light))';
    }
  }
  
  if (statusEl) {
    if (isOverpaid) {
      statusEl.textContent = `⚡ Overpaid by ${formatCurrency(overpaidAmt)}`;
      statusEl.style.color = 'var(--neon-amber)';
    } else if (isSettled) {
      statusEl.textContent = '✅ Settled!';
      statusEl.style.color = 'var(--accent-green)';
    } else {
      statusEl.textContent = `${pct.toFixed(0)}% paid`;
      statusEl.style.color = 'var(--text-secondary)';
    }
  }
  
  // Repayment History List
  let history = l.history || [];
  let displayHistory = [...history];
  
  if (displayHistory.length === 0 && l.paid > 0) {
    const mockDate = l.createdAt?.toDate ? l.createdAt.toDate() : new Date();
    const dateString = mockDate.toISOString().split('T')[0];
    displayHistory = [{
      amount: l.paid,
      date: dateString,
      createdAt: l.createdAt || new Date(),
      isMock: true
    }];
  }
  
  // Sort chronologically (newest first)
  displayHistory.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
    return timeB - timeA;
  });
  
  const historyList = document.getElementById('loan-history-list');
  if (historyList) {
    if (displayHistory.length === 0) {
      historyList.innerHTML = '<div class="empty-state" style="padding:1rem 0;"><p style="font-size:0.8rem;">No payment records found.</p></div>';
    } else {
      historyList.innerHTML = displayHistory.map(item => {
        return `
          <div class="history-item">
            <div style="display:flex; flex-direction:column; align-items:flex-start;">
              <span class="history-date">${formatDate(item.date)}</span>
              ${item.isMock ? '<span style="font-size:0.7rem; color:var(--ink-secondary); font-style:italic;">Initial payment</span>' : ''}
            </div>
            <span class="history-amount loan-add">+${formatCurrency(item.amount)}</span>
          </div>
        `;
      }).join('');
    }
  }
};

window.addLoanPaymentFromDetail = async function() {
  const amountInput = document.getElementById('detail-loan-amount');
  const dateInput = document.getElementById('detail-loan-date');
  const errEl = document.getElementById('detail-loan-error');
  
  if (!amountInput || !dateInput || !errEl) return;
  
  errEl.textContent = '';
  const amount = parseFloat(amountInput.value);
  const dateStr = dateInput.value;
  
  if (!amount || amount <= 0) {
    errEl.textContent = 'Please enter a valid amount.';
    return;
  }
  if (!dateStr) {
    errEl.textContent = 'Please select a date.';
    return;
  }
  
  const l = allLoans.find(x => x.id === activeLoanDetailId);
  if (!l) return;
  
  const remaining = l.total - l.paid;
  // Allow overpayment — no longer block when remaining <= 0
  const finalAmount = amount; // record exactly what was paid, even if it exceeds the loan total
  const newPaid = l.paid + finalAmount;
  
  let history = l.history || [];
  if (history.length === 0 && l.paid > 0) {
    const mockDate = l.createdAt?.toDate ? l.createdAt.toDate() : new Date();
    const dateString = mockDate.toISOString().split('T')[0];
    history.push({
      amount: l.paid,
      date: dateString,
      createdAt: l.createdAt || new Date()
    });
  }
  
  history.push({
    amount: finalAmount,
    date: dateStr,
    createdAt: new Date()
  });
  
  const submitBtn = document.querySelector('#loan-details-overlay .btn-primary');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording…';
  }
  
  try {
    await updateDoc(doc(db, 'loans', activeLoanDetailId), {
      paid: newPaid,
      history: history,
      updatedAt: serverTimestamp()
    });
    
    showToast(`Recorded payment of ${formatCurrency(finalAmount)}!`, 'success');
    amountInput.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
  } catch(e) {
    console.error(e);
    errEl.textContent = 'Failed to record payment. Please try again.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record Payment';
    }
  }
};

// ─── Monthly Payment Checklist Functions ────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.toggleChecklistDropdown = function() {
  const card = document.getElementById('checklist-card');
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  localStorage.setItem('checklistOpen', isOpen);
};

window.toggleChartDropdown = function() {
  const card = document.getElementById('expenses-chart-card');
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  localStorage.setItem('chartOpen', isOpen);
  if (isOpen && expensesChart) {
    setTimeout(() => {
      expensesChart.resize();
    }, 400);
  }
};

window.renderChecklist = function() {
  const listEl = document.getElementById('checklist-list');
  const barEl = document.getElementById('checklist-progress-bar');
  const subtitleEl = document.getElementById('checklist-subtitle');
  const percentageEl = document.getElementById('checklist-percentage');
  const titleEl = document.getElementById('checklist-title');
  
  if (titleEl) {
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    titleEl.textContent = `Monthly Checklist - ${currentMonth}`;
  }
  
  if (!listEl || !barEl || !subtitleEl || !percentageEl) return;
  
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  // Totals & Progress — item is "paid" only if it was marked paid THIS month
  const totalItems = allChecklist.length;
  const paidItems = allChecklist.filter(item => item.paid && item.paidMonth === currentMonthStr).length;
  const pct = totalItems > 0 ? (paidItems / totalItems) * 100 : 0;
  const pctRound = Math.round(pct);
  
  barEl.style.width = `${pct}%`;
  subtitleEl.textContent = `${paidItems} of ${totalItems} paid`;
  percentageEl.textContent = `${pctRound}%`;
  
  // Dynamic color for percentage text
  if (pctRound === 100) {
    percentageEl.style.color = 'var(--neon-teal)';
  } else {
    percentageEl.style.color = 'var(--neon-violet)';
  }
  
  if (totalItems === 0) {
    listEl.innerHTML = '<div class="checklist-empty">No items yet. Add your first payment below.</div>';
    return;
  }
  
  listEl.innerHTML = allChecklist.map(item => {
    const isPaidThisMonth = item.paid && item.paidMonth === currentMonthStr;
    const isPaid = isPaidThisMonth ? 'paid' : '';
    const isChecked = isPaidThisMonth ? 'checked' : '';
    return `
      <div class="checklist-item ${isPaid}">
        <div class="checklist-check ${isChecked}" onclick="toggleChecklistItem('${item.id}', ${item.paid})"></div>
        <div class="checklist-item-info">
          <span class="checklist-item-name">${escapeHtml(item.name)}</span>
        </div>
        <span class="checklist-item-amount">${formatCurrency(item.amount || 0)}</span>
        <button class="checklist-delete-btn" onclick="deleteChecklistItem('${item.id}')">×</button>
      </div>
    `;
  }).join('');
};

window.addChecklistItem = async function() {
  const nameInput = document.getElementById('checklist-name');
  const amountInput = document.getElementById('checklist-amount');
  
  if (!nameInput || !amountInput) return;
  
  const name = nameInput.value.trim();
  const amountVal = amountInput.value.trim();
  
  if (!name) {
    showToast('Please enter an item name.', 'error');
    return;
  }
  
  if (!amountVal) {
    showToast('Please enter an amount.', 'error');
    return;
  }
  
  const amount = parseFloat(amountVal);
  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount greater than 0.', 'error');
    return;
  }
  
  const addBtn = document.querySelector('.checklist-add-btn');
  if (addBtn) {
    addBtn.disabled = true;
    addBtn.textContent = 'Adding…';
  }
  
  try {
    // Store checklist items as budget documents with isChecklist: true
    // This works within existing Firestore security rules that allow writes to /budgets
    await addDoc(collection(db, 'budgets'), {
      uid: currentUser.uid,
      isChecklist: true,
      name: name,
      amount: amount,
      paid: false,
      createdAt: Date.now()
    });
    
    nameInput.value = '';
    amountInput.value = '';
    showToast('Item added successfully!', 'success');
  } catch(e) {
    console.error('Error adding checklist item:', e);
    showToast('Failed to add checklist item.', 'error');
  } finally {
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.textContent = '+ Add';
    }
  }
};

function matchCategory(name) {
  const lowercaseName = name.toLowerCase();
  if (lowercaseName.includes('rent') || lowercaseName.includes('sewa') || lowercaseName.includes('house') || lowercaseName.includes('bilik')) {
    return 'Rent';
  }
  if (lowercaseName.includes('food') || lowercaseName.includes('makan') || lowercaseName.includes('dinner') || lowercaseName.includes('lunch') || lowercaseName.includes('restoran') || lowercaseName.includes('cafe')) {
    return 'Food';
  }
  if (lowercaseName.includes('car') || lowercaseName.includes('kereta') || lowercaseName.includes('petrol') || lowercaseName.includes('fuel') || lowercaseName.includes('toll') || lowercaseName.includes('transport') || lowercaseName.includes('mrt') || lowercaseName.includes('grab')) {
    return 'Transport';
  }
  if (lowercaseName.includes('grocery') || lowercaseName.includes('groceries') || lowercaseName.includes('pasar') || lowercaseName.includes('supermarket')) {
    return 'Groceries';
  }
  if (lowercaseName.includes('bill') || lowercaseName.includes('bil') || lowercaseName.includes('electric') || lowercaseName.includes('water') || lowercaseName.includes('phone') || lowercaseName.includes('unifi') || lowercaseName.includes('internet') || lowercaseName.includes('utility') || lowercaseName.includes('utilities')) {
    return 'Bills';
  }
  if (lowercaseName.includes('netflix') || lowercaseName.includes('spotify') || lowercaseName.includes('disney') || lowercaseName.includes('youtube') || lowercaseName.includes('movie') || lowercaseName.includes('cinema') || lowercaseName.includes('game') || lowercaseName.includes('entertainment')) {
    return 'Entertainment';
  }
  if (lowercaseName.includes('health') || lowercaseName.includes('medical') || lowercaseName.includes('doctor') || lowercaseName.includes('clinic') || lowercaseName.includes('pharmacy') || lowercaseName.includes('ubat') || lowercaseName.includes('hospital')) {
    return 'Health';
  }
  if (lowercaseName.includes('clothing') || lowercaseName.includes('baju') || lowercaseName.includes('clothes') || lowercaseName.includes('shirt') || lowercaseName.includes('pants') || lowercaseName.includes('shoe') || lowercaseName.includes('kasut')) {
    return 'Clothing';
  }
  if (lowercaseName.includes('loan') || lowercaseName.includes('hutang') || lowercaseName.includes('bank') || lowercaseName.includes('installment') || lowercaseName.includes('bayar')) {
    return 'Loan';
  }
  return 'General';
}

window.toggleChecklistItem = async function(id, currentPaid) {
  if (window.haptic) window.haptic();
  
  const isMarkingPaid = !currentPaid;
  const item = allChecklist.find(i => i.id === id);
  
  let recordTransaction = false;
  if (isMarkingPaid && item && item.amount > 0) {
    recordTransaction = confirm(`Would you like to automatically record this payment of ${formatCurrency(item.amount)} as an Expense transaction?`);
  }
  
  try {
    // 1. Update checklist item status
    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    await updateDoc(doc(db, 'budgets', id), {
      paid: isMarkingPaid,
      paidMonth: isMarkingPaid ? currentMonthStr : null
    });
    
    // 2. If user confirmed, create corresponding transaction
    if (recordTransaction && item) {
      const matchedCat = matchCategory(item.name);
      const todayStr = new Date().toISOString().split('T')[0];
      const txData = {
        uid: currentUser.uid,
        type: 'expense',
        description: item.name,
        amount: item.amount,
        category: matchedCat,
        date: todayStr,
        notes: 'Auto-recorded from checklist',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'transactions'), txData);
      showToast(`Recorded expense of ${formatCurrency(item.amount)} under "${matchedCat}"!`, 'success');
    }
  } catch(e) {
    console.error('Error toggling checklist item:', e);
    showToast('Failed to update item status.', 'error');
  }
};

window.deleteChecklistItem = async function(id) {
  if (window.haptic) window.haptic();
  if (confirm('Are you sure you want to remove this?')) {
    try {
      // Delete the individual budget document
      await deleteDoc(doc(db, 'budgets', id));
      showToast('Item removed.', 'success');
    } catch(e) {
      console.error('Error deleting checklist item:', e);
      showToast('Failed to delete item.', 'error');
    }
  }
};

// ─── PROFILE & SETTINGS MODAL ────────────────────────────────────────────────
window.openProfileSettingsModal = function() {
  if (window.haptic) window.haptic();
  
  // Close mobile dropdown if open
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.remove('show');
  
  // Populate fields
  const nameEl = document.getElementById('modal-user-name');
  if (nameEl) nameEl.value = currentUser.displayName || currentUser.email.split('@')[0];
  
  const emailEl = document.getElementById('modal-user-email');
  if (emailEl) emailEl.textContent = currentUser.email;
  
  const currencySelect = document.getElementById('modal-setting-currency');
  if (currencySelect) currencySelect.value = userSettings.currency;
  
  const themeSelect = document.getElementById('modal-setting-theme');
  if (themeSelect) themeSelect.value = userSettings.theme;
  
  const grossInput = document.getElementById('modal-setting-gross-income');
  if (grossInput) setAmountInputValue('modal-setting-gross-income', grossIncome || '');
  
  const carryInput = document.getElementById('modal-setting-carry-over');
  if (carryInput) setAmountInputValue('modal-setting-carry-over', typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : '');
  
  // Sync avatar picture
  const previewImg = document.getElementById('modal-avatar-preview-img');
  const previewInitials = document.getElementById('modal-avatar-preview-initials');
  const removeBtn = document.getElementById('modal-btn-remove-avatar');
  const initial = (currentUser.displayName || currentUser.email)[0].toUpperCase();
  
  if (userSettings.avatarUrl) {
    if (previewImg) {
      previewImg.src = userSettings.avatarUrl;
      previewImg.style.display = 'block';
    }
    if (previewInitials) previewInitials.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (previewInitials) {
      previewInitials.textContent = initial;
      previewInitials.style.display = 'block';
    }
    if (removeBtn) removeBtn.style.display = 'none';
  }
  
  document.getElementById('profile-settings-overlay').classList.remove('hidden');
};

window.closeProfileSettingsModal = function() {
  document.getElementById('profile-settings-overlay').classList.add('hidden');
};

window.closeProfileSettingsModalOnOverlay = function(e) {
  if (e.target.id === 'profile-settings-overlay') closeProfileSettingsModal();
};

window.updateProfileName = async function() {
  const newName = document.getElementById('modal-user-name').value.trim();
  if (!newName) return;
  try {
    await updateProfile(currentUser, { displayName: newName });
    
    // Update local UI name displays
    const nameEl = document.getElementById('user-name-display');
    if (nameEl) nameEl.textContent = newName;
    
    // Update initials if no avatar exists
    if (!userSettings.avatarUrl) {
      const initial = newName[0].toUpperCase();
      const avatarEl = document.getElementById('user-avatar');
      if (avatarEl) avatarEl.textContent = initial;
      updateMobileAvatar(initial);
      const modalInitials = document.getElementById('modal-avatar-preview-initials');
      if (modalInitials) modalInitials.textContent = initial;
    }
    
    showToast('Profile name updated!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to update name', 'error');
  }
};

window.saveModalSettings = async function() {
  const currency = document.getElementById('modal-setting-currency').value;
  const theme = document.getElementById('modal-setting-theme').value;
  const grossVal = parseFloat(document.getElementById('modal-setting-gross-income').value) || 0;
  
  const carryInput = document.getElementById('modal-setting-carry-over');
  const carryVal = carryInput ? parseFloat(carryInput.value) || 0 : 0;
  
  try {
    await setDoc(doc(db, 'settings', currentUser.uid), { 
      currency, 
      theme, 
      grossIncome: grossVal,
      carryOverBalance: carryVal 
    }, { merge: true });
    grossIncome = grossVal;
    userSettings.carryOverBalance = carryVal;
    showToast('Settings saved!', 'success');
    updateSummaryCards();
  } catch(e) {
    console.error(e);
    showToast('Failed to save settings', 'error');
  }
};

window.handleModalAvatarUpload = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('Please select an image file', 'error');
  if (file.size > 2 * 1024 * 1024) return showToast('Image must be less than 2MB', 'error');

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = async function() {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 200;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const base64Avatar = canvas.toDataURL('image/jpeg', 0.8);
      try {
        await setDoc(doc(db, 'settings', currentUser.uid), { avatarUrl: base64Avatar }, { merge: true });
        showToast('Profile picture updated!', 'success');
      } catch(err) {
        showToast('Failed to upload image', 'error');
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

window.removeModalAvatar = async function() {
  try {
    await setDoc(doc(db, 'settings', currentUser.uid), { avatarUrl: '' }, { merge: true });
    showToast('Profile picture removed!', 'success');
  } catch(err) {
    showToast('Failed to remove image', 'error');
  }
};


// 📑 Transaction Details Modal Functions
let activeTxDetailId = null;

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

window.openTxDetails = function (txId, event) {
  const tx = allTransactions.find(t => t.id === txId);
  if (!tx) return;

  activeTxDetailId = txId;

  // Set Hero Content
  const iconEl = document.getElementById('tx-details-icon');
  if (iconEl) {
    iconEl.textContent = getCategoryIcon(tx.category);
    iconEl.className = `tx-icon ${tx.type}`;
  }

  const descEl = document.getElementById('tx-details-desc');
  if (descEl) descEl.textContent = tx.description;

  const catEl = document.getElementById('tx-details-cat');
  if (catEl) catEl.textContent = tx.category;

  const amountEl = document.getElementById('tx-details-amount');
  if (amountEl) {
    amountEl.className = `tx-amount ${tx.type}`;
    amountEl.textContent = (tx.type === 'income' ? '+' : '-') + formatCurrency(tx.amount);
  }

  // Set Details List
  const dateEl = document.getElementById('tx-details-date');
  if (dateEl) dateEl.textContent = formatFullDate(tx.date);

  const methodEl = document.getElementById('tx-details-method');
  if (methodEl) {
    if ((tx.paymentMethod === 'credit' || tx.cardId) && tx.category !== 'Credit Card Payment') {
      methodEl.innerHTML = `Credit Card <span class="tx-method-badge" style="background: rgba(138, 75, 243, 0.12); color: var(--neon-violet); border: 1px solid rgba(138, 75, 243, 0.25); border-radius: 4px; padding: 1px 5px; font-size: 0.68rem; font-weight: 600; margin-left: 4px; display: inline-flex; align-items: center; gap: 2px;">💳 ${getCardNameById(tx.cardId)}</span>`;
    } else if (tx.paymentMethod === 'mykasih') {
      methodEl.innerHTML = `MyKasih <span class="tx-method-badge" style="background: rgba(16, 185, 129, 0.12); color: var(--neon-teal); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 4px; padding: 1px 5px; font-size: 0.68rem; font-weight: 600; margin-left: 4px; display: inline-flex; align-items: center; gap: 2px;">🎁 MyKasih</span>`;
    } else {
      methodEl.textContent = tx.paymentMethod ? tx.paymentMethod.toUpperCase() : 'CASH';
    }
  }

  // Set Notes
  const notesEl = document.getElementById('tx-details-notes');
  if (notesEl) {
    if (tx.notes && tx.notes.trim()) {
      notesEl.textContent = tx.notes;
      notesEl.style.fontStyle = 'normal';
      notesEl.style.color = 'var(--ink-primary)';
    } else {
      notesEl.textContent = 'No extra details or notes.';
      notesEl.style.fontStyle = 'italic';
      notesEl.style.color = 'var(--ink-muted)';
    }
  }

  const overlay = document.getElementById('tx-details-overlay');
  if (overlay) overlay.classList.remove('hidden');
};

window.closeTxDetailsModal = function () {
  const overlay = document.getElementById('tx-details-overlay');
  if (overlay) overlay.classList.add('hidden');
  activeTxDetailId = null;
};

window.closeTxDetailsOnOverlay = function (e) {
  if (e.target.id === 'tx-details-overlay') {
    closeTxDetailsModal();
  }
};

window.editTxFromDetails = function () {
  if (!activeTxDetailId) return;
  const id = activeTxDetailId;
  closeTxDetailsModal();
  openModal(id);
};

window.deleteTxFromDetails = function () {
  if (!activeTxDetailId) return;
  const id = activeTxDetailId;
  closeTxDetailsModal();
  promptDelete(id);
};

// ─── MyKasih Functions ──────────────────────────────────────────────────────
window.openEditMyKasihModal = function() {
  const currentMonthStrVal = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  let lastTopup = userSettings.mykasihLastTopupMonth;
  let bonusTopups = 0;
  const allowance = typeof userSettings.mykasihAllowance === 'number' ? userSettings.mykasihAllowance : 50;
  const baseBalance = typeof userSettings.mykasihBaseBalance === 'number' ? userSettings.mykasihBaseBalance : 50;

  if (lastTopup && lastTopup !== currentMonthStrVal) {
    const [lastY, lastM] = lastTopup.split('-').map(Number);
    const monthsDiff = (new Date().getFullYear() - lastY) * 12 + (new Date().getMonth() + 1 - lastM);
    if (monthsDiff > 0) bonusTopups = monthsDiff * allowance;
  }

  const totalMyKasihExpenses = allTransactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'mykasih')
    .reduce((s, t) => s + t.amount, 0);

  const curBal = Math.max(0, baseBalance + bonusTopups - totalMyKasihExpenses);

  const balInput = document.getElementById('mykasih-balance-input');
  const allowInput = document.getElementById('mykasih-allowance-input');
  const errEl = document.getElementById('mykasih-modal-error');
  if (errEl) errEl.style.display = 'none';

  if (balInput) setAmountInputValue('mykasih-balance-input', curBal);
  if (allowInput) setAmountInputValue('mykasih-allowance-input', allowance);

  const modal = document.getElementById('mykasih-modal-overlay');
  if (modal) modal.classList.remove('hidden');
};

window.closeMyKasihModal = function() {
  const modal = document.getElementById('mykasih-modal-overlay');
  if (modal) modal.classList.add('hidden');
};

window.closeMyKasihModalOnOverlay = function(e) {
  if (e.target.id === 'mykasih-modal-overlay') closeMyKasihModal();
};

window.saveMyKasihSettings = async function() {
  const balInput = document.getElementById('mykasih-balance-input');
  const allowInput = document.getElementById('mykasih-allowance-input');
  const errEl = document.getElementById('mykasih-modal-error');

  const newBal = balInput ? parseFloat(balInput.value) : 50;
  const newAllowance = allowInput ? parseFloat(allowInput.value) : 50;

  if (isNaN(newBal) || newBal < 0) {
    if (errEl) { errEl.textContent = 'Please enter a valid balance.'; errEl.style.display = 'block'; }
    return;
  }
  if (isNaN(newAllowance) || newAllowance < 0) {
    if (errEl) { errEl.textContent = 'Please enter a valid monthly allowance.'; errEl.style.display = 'block'; }
    return;
  }

  const totalMyKasihExpenses = allTransactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'mykasih')
    .reduce((s, t) => s + t.amount, 0);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const newBaseBalance = newBal + totalMyKasihExpenses;

  const btn = document.getElementById('btn-save-mykasih');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    if (currentUser) {
      await setDoc(doc(db, 'settings', currentUser.uid), {
        mykasihBaseBalance: newBaseBalance,
        mykasihAllowance: newAllowance,
        mykasihLastTopupMonth: currentMonthStr
      }, { merge: true });
    }

    userSettings.mykasihBaseBalance = newBaseBalance;
    userSettings.mykasihAllowance = newAllowance;
    userSettings.mykasihLastTopupMonth = currentMonthStr;

    showToast('MyKasih settings saved!', 'success');
    closeMyKasihModal();
    updateSummaryCards();
  } catch(e) {
    console.error(e);
    if (errEl) { errEl.textContent = 'Failed to save settings.'; errEl.style.display = 'block'; }
    showToast('Error saving MyKasih settings', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save MyKasih Settings'; }
  }
};

window.openAddMyKasihTxModal = function() {
  openModal();
  setType('expense');
  const pmSelect = document.getElementById('tx-pay-method');
  if (pmSelect) pmSelect.value = 'mykasih';
  toggleCCSelectGroup();
};
