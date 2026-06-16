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
  creditLimit: 10000, 
  creditDueDay: 25,
  creditCards: [
    { id: 'legacy-default', name: 'Primary Card', limit: 10000, dueDay: 25 }
  ]
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
  document.getElementById('user-name-display').textContent = name;
  document.getElementById('user-email-display').textContent = user.email;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  updateMobileAvatar(name[0].toUpperCase());
  setGreeting();
  setHeroDate();

  // Populate year select and set current month/year defaults
  initMonthYearSelects();
  initCatMonthYearSelects();

  // Always start on Dashboard after login
  navigateTo('dashboard', document.querySelector('[data-page="dashboard"]'));
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
});

function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning! 👋' : h < 17 ? 'Good afternoon! ☀️' : 'Good evening! 🌙';
  document.getElementById('greeting').textContent = greet;
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

  // Read dashboard weekly budget open state from localStorage
  const isWeeklyOpen = localStorage.getItem('dashboardWeeklyOpen') !== 'false';
  const weeklyCard = document.getElementById('dashboard-weekly-budget-card');
  if (weeklyCard) {
    if (isWeeklyOpen) weeklyCard.classList.add('open');
    else weeklyCard.classList.remove('open');
  }

  // Read dashboard CC card open state from localStorage
  const isCCOpen = localStorage.getItem('dashboardCCOpen') !== 'false';
  const ccCard = document.querySelector('.cc-dashboard-card');
  if (ccCard) {
    if (isCCOpen) ccCard.classList.add('open');
    else ccCard.classList.remove('open');
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
    allTransactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
      
      // Migrate legacy settings to creditCards array if needed
      if (!userSettings.creditCards || !Array.isArray(userSettings.creditCards) || userSettings.creditCards.length === 0) {
        const legacyLimit = docSnap.data().creditLimit !== undefined ? docSnap.data().creditLimit : 10000;
        const legacyDueDay = docSnap.data().creditDueDay !== undefined ? docSnap.data().creditDueDay : 25;
        userSettings.creditCards = [{
          id: 'legacy-default',
          name: 'Primary Card',
          limit: legacyLimit,
          dueDay: legacyDueDay
        }];
        setDoc(doc(db, 'settings', currentUser.uid), { creditCards: userSettings.creditCards }, { merge: true }).catch(console.error);
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
      renderDashboardWeeklyBudget();
      if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
    } else {
      // Document doesn't exist yet for new user, reset to default settings and 0 gross income
      userSettings = { 
        currency: '$', 
        theme: 'dark', 
        avatarUrl: '', 
        creditLimit: 10000, 
        creditDueDay: 25,
        creditCards: [{
          id: 'legacy-default',
          name: 'Primary Card',
          limit: 10000,
          dueDay: 25
        }]
      };
      activeCCCardId = 'legacy-default';
      grossIncome = 0;
      balanceHidden = false;
      applyBalanceVisibility();
      settingsLoaded = true;
      checkForMonthlyReset();
      applySettings();
      updateSummaryCards();
      renderDashboardWeeklyBudget();
      if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
    }
  });

  // 4. Tabung (savings)
  const tq = query(collection(db, 'tabung'), where('uid', '==', currentUser.uid));
  unsubscribeTabung = onSnapshot(tq, snap => {
    allTabung = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-tabung').classList.contains('active')) renderTabung();
    if (activeTabungDetailId) refreshTabungDetailsModal();
  });

  // 5. Loans
  const lq = query(collection(db, 'loans'), where('uid', '==', currentUser.uid));
  unsubscribeLoans = onSnapshot(lq, snap => {
    allLoans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  
  // One-time migration to version 2 to correct users who had settings initialized under the first deployment
  if (migrationVersion < 2) {
    isResettingMonth = true;
    try {
      const prevGross = typeof userSettings.grossIncome === 'number' ? userSettings.grossIncome : 0;
      const prevCarry = typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : 0;
      
      // Determine what the previous active month was
      let prevMonth = lastProcessedMonth;
      if (!prevMonth || prevMonth === currentMonthStr) {
        const now = new Date();
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth()+1).padStart(2,'0')}`;
      }
      
      console.log(`Running one-time migration to version 2. Previous month: ${prevMonth}`);
      
      // Calculate previous month's ending balance
      const prevExpenses = allTransactions
        .filter(t => t.type === 'expense' && t.date && t.date.startsWith(prevMonth))
        .reduce((sum, t) => sum + t.amount, 0);
        
      const prevIncome = allTransactions
        .filter(t => t.type === 'income' && t.date && t.date.startsWith(prevMonth))
        .reduce((sum, t) => sum + t.amount, 0);
        
      const prevRemaining = prevCarry + prevGross + prevIncome - prevExpenses;
      
      console.log(`Migration calc: carry=${prevCarry}, gross=${prevGross}, inc=${prevIncome}, exp=${prevExpenses} => remaining=${prevRemaining}`);
      
      // Wipe out checklist if transitioning to a new month
      if (prevMonth !== currentMonthStr) {
        const deletePromises = allChecklist.map(item => deleteDoc(doc(db, 'budgets', item.id)));
        await Promise.all(deletePromises);
      }
      
      // Save settings with version 2
      await setDoc(doc(db, 'settings', currentUser.uid), {
        grossIncome: 0,
        carryOverBalance: prevRemaining,
        lastProcessedMonth: currentMonthStr,
        migrationVersion: 2
      }, { merge: true });
      
      // Sync local state
      grossIncome = 0;
      userSettings.grossIncome = 0;
      userSettings.carryOverBalance = prevRemaining;
      userSettings.lastProcessedMonth = currentMonthStr;
      userSettings.migrationVersion = 2;
      
      showToast('Account synchronized and remaining balance carried over!', 'success');
    } catch (e) {
      console.error("Error during version 2 migration:", e);
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
      
      // 1. Calculate previous month's ending remaining balance
      const prevGross = typeof userSettings.grossIncome === 'number' ? userSettings.grossIncome : 0;
      const prevCarry = typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : 0;
      
      const prevExpenses = allTransactions
        .filter(t => t.type === 'expense' && t.date && t.date.startsWith(lastProcessedMonth))
        .reduce((sum, t) => sum + t.amount, 0);
        
      const prevIncome = allTransactions
        .filter(t => t.type === 'income' && t.date && t.date.startsWith(lastProcessedMonth))
        .reduce((sum, t) => sum + t.amount, 0);
        
      const prevRemaining = prevCarry + prevGross + prevIncome - prevExpenses;
      
      console.log(`Reset transition: calculated previous remaining balance = ${prevRemaining}`);
      
      // 2. Wipe out all checklist items (stored in budgets collection with isChecklist: true)
      const deletePromises = allChecklist.map(item => deleteDoc(doc(db, 'budgets', item.id)));
      await Promise.all(deletePromises);
      
      // 3. Reset gross income to 0, save new carryOverBalance, and update lastProcessedMonth
      await setDoc(doc(db, 'settings', currentUser.uid), {
        grossIncome: 0,
        carryOverBalance: prevRemaining,
        lastProcessedMonth: currentMonthStr
      }, { merge: true });
      
      // Update local variables in sync
      grossIncome = 0;
      userSettings.grossIncome = 0;
      userSettings.carryOverBalance = prevRemaining;
      userSettings.lastProcessedMonth = currentMonthStr;
      
      showToast('Welcome to a new month! Net income reset to 0, checklist wiped, and remaining balance carried over.', 'success');
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
    if(metaTheme) metaTheme.setAttribute('content', '#f4f7fe');
  } else {
    document.documentElement.classList.remove('light-theme');
    if(metaTheme) metaTheme.setAttribute('content', '#0d0f1a');
  }
  document.querySelectorAll('.dynamic-currency').forEach(el => el.textContent = userSettings.currency);
  
  const avatarEl = document.getElementById('user-avatar');
  const previewImg = document.getElementById('avatar-preview-img');
  const previewInitials = document.getElementById('avatar-preview-initials');
  const removeBtn = document.getElementById('btn-remove-avatar');
  
  const initial = (currentUser.displayName || currentUser.email)[0].toUpperCase();
  
  if (userSettings.avatarUrl) {
    const imgHtml = `<img src="${userSettings.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    avatarEl.innerHTML = imgHtml;
    avatarEl.style.background = 'transparent';
    updateMobileAvatar(initial); // uses avatarUrl from userSettings
    
    if (previewImg) {
      previewImg.src = userSettings.avatarUrl;
      previewImg.style.display = 'block';
      previewInitials.style.display = 'none';
      removeBtn.style.display = 'inline-flex';
    }
  } else {
    avatarEl.innerHTML = '';
    avatarEl.textContent = initial;
    avatarEl.style.background = 'linear-gradient(135deg, var(--accent-purple), var(--accent-green))';
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
  if (grossInput) grossInput.value = grossIncome || '';

  const carryInput = document.getElementById('setting-carry-over');
  if (carryInput) carryInput.value = typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : '';
  
  // Sync Profile & Settings Modal elements reactively
  const modalCurrencySelect = document.getElementById('modal-setting-currency');
  if (modalCurrencySelect) modalCurrencySelect.value = userSettings.currency;
  
  const modalThemeSelect = document.getElementById('modal-setting-theme');
  if (modalThemeSelect) modalThemeSelect.value = userSettings.theme;
  
  const modalGrossInput = document.getElementById('modal-setting-gross-income');
  if (modalGrossInput) modalGrossInput.value = grossIncome || '';

  const modalCarryInput = document.getElementById('modal-setting-carry-over');
  if (modalCarryInput) modalCarryInput.value = typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : '';
  
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

// ─── GROSS INCOME ────────────────────────────────────────────────────────────
window.openGrossIncomeModal = function() {
  const input = document.getElementById('gross-income-input');
  if (input && grossIncome > 0) input.value = grossIncome;
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
  budgets: 'Budgets',
  monthly: 'Monthly Report',
  tabung: 'Savings',
  loans: 'Loans',
  settings: 'Settings'
};

window.navigateTo = function (page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  }
  // Update mobile header title
  const titleEl = document.getElementById('mob-page-title');
  if (titleEl) titleEl.textContent = MOB_PAGE_TITLES[page] || 'ExpenseFlow';
  closeSidebar();
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

window.toggleSidebar = function () {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('open');
  let ov = document.getElementById('sidebar-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sidebar-overlay'; ov.className = 'sidebar-overlay';
    ov.onclick = closeSidebar; document.body.appendChild(ov);
  }
  ov.classList.toggle('visible', sb.classList.contains('open'));
};

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

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
  navigateTo('settings', document.querySelector('[data-page="settings"]'));
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
  // Remove active state from More tab
  document.querySelectorAll('.bottom-nav .nav-item').forEach(i => {
    if (i.dataset.page === 'more') i.classList.remove('active');
  });
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
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-category').value = tx.category;
      document.getElementById('tx-date').value = tx.date;
      document.getElementById('tx-notes').value = tx.notes || '';
      const pmSelect = document.getElementById('tx-pay-method');
      if (pmSelect) pmSelect.value = tx.paymentMethod || 'cash';
      
      const ccSelect = document.getElementById('tx-cc-select');
      if (ccSelect) {
        ccSelect.value = tx.cardId || 'legacy-default';
      }
      toggleCCSelectGroup();
    }
  } else {
    resetModal();
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
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
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-category').value = 'General';
  document.getElementById('tx-notes').value = '';
  const pmSelect = document.getElementById('tx-pay-method');
  if (pmSelect) pmSelect.value = 'cash';
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
  if (limitEl) limitEl.value = existing ? existing.limit : '';
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
  renderDashboardWeeklyBudget();
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
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return userSettings.currency + formatted;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryIcon(cat) {
  const icons = {
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
  const defaultCard = cards[0];
  const isDefault = defaultCard && cardId === defaultCard.id;

  const expenses = allTransactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'credit' && (t.cardId === cardId || (!t.cardId && isDefault)))
    .reduce((s, t) => s + t.amount, 0);

  const payments = allTransactions
    .filter(t => t.type === 'expense' && t.category === 'Credit Card Payment' && (t.cardId === cardId || (!t.cardId && isDefault)))
    .reduce((s, t) => s + t.amount, 0);

  return Math.max(0, expenses - payments);
}

function getCardNameById(cardId) {
  const cards = getCCCards();
  const card = cards.find(c => c.id === cardId);
  if (card) return card.name;
  return 'Primary Card';
}

function renderCCTabs() {
  const container = document.getElementById('cc-tabs-container');
  if (!container) return;
  container.innerHTML = '';

  // Wrapper: flex row — scrollable tabs + pinned add button
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'cc-tabs-scroll';

  const addBtn = document.createElement('div');
  addBtn.className = 'cc-tab-add';
  addBtn.innerHTML = '<span>＋</span>';
  addBtn.title = 'Add Card';
  addBtn.onclick = (e) => {
    e.stopPropagation();
    openConfigureCCModal();
  };

  const cards = getCCCards();
  cards.forEach(card => {
    const outstanding = getCCCardOutstanding(card.id);
    const tab = document.createElement('div');
    tab.className = `cc-tab ${card.id === activeCCCardId ? 'active' : ''}`;
    tab.textContent = `${card.name} (${formatCurrency(outstanding)})`;
    tab.onclick = (e) => {
      e.stopPropagation();
      activeCCCardId = card.id;
      updateSummaryCards();
    };
    scrollWrap.appendChild(tab);
  });

  container.appendChild(scrollWrap);
  container.appendChild(addBtn);
}


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
    opt.textContent = `${card.name} (Limit: ${formatCurrency(card.limit)})`;
    select.appendChild(opt);
  });
}

function updateSummaryCards() {
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  
  // Sum current month's income transactions categorized as "Salary" (case-insensitive)
  const salaryIncome = allTransactions
    .filter(t => t.type === 'income' && t.category && t.category.toLowerCase() === 'salary' && t.date && t.date.startsWith(currentMonthStr))
    .reduce((s, t) => s + t.amount, 0);

  // Sum current month's other income transactions (excluding "Salary")
  const otherIncome = allTransactions
    .filter(t => t.type === 'income' && (!t.category || t.category.toLowerCase() !== 'salary') && t.date && t.date.startsWith(currentMonthStr))
    .reduce((s, t) => s + t.amount, 0);

  // Net income = grossIncome from settings + any salary income transactions
  const netIncome = grossIncome + salaryIncome;
  
  // Cash/Debit expenses this month (excludes Credit Card payments and Credit Card purchases)
  const cashExpense = allTransactions
    .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit' && t.category !== 'Credit Card Payment' && t.date && t.date.startsWith(currentMonthStr))
    .reduce((s, t) => s + t.amount, 0);

  // Credit Card Bill Payments recorded this month
  const ccPayments = allTransactions
    .filter(t => t.type === 'expense' && t.category === 'Credit Card Payment' && t.date && t.date.startsWith(currentMonthStr))
    .reduce((s, t) => s + t.amount, 0);

  // Total actual monthly spending (Cash expenses + Credit card expenses, excluding double-counted bill payments)
  const totalExpense = allTransactions
    .filter(t => t.type === 'expense' && t.category !== 'Credit Card Payment' && t.date && t.date.startsWith(currentMonthStr))
    .reduce((s, t) => s + t.amount, 0);
  
  const carryOver = typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : 0;
  
  // Cash Balance = Cash inflows minus Cash outflows (cash expenses and cc bill payments)
  const balance   = carryOver + netIncome + otherIncome - cashExpense - ccPayments;
  const remaining = balance;

  // ─── Credit Card Calculations ───
  const cards = getCCCards();
  if (!activeCCCardId || !cards.some(c => c.id === activeCCCardId)) {
    activeCCCardId = cards[0] ? cards[0].id : 'legacy-default';
  }
  const activeCard = cards.find(c => c.id === activeCCCardId) || cards[0];

  const ccOutstanding = getCCCardOutstanding(activeCCCardId);
  const ccLimit       = activeCard ? activeCard.limit : 10000;
  const ccDueDay      = activeCard ? activeCard.dueDay : 25;
  const ccAvailable   = Math.max(0, ccLimit - ccOutstanding);
  const ccUtilization = ccLimit > 0 ? Math.min((ccOutstanding / ccLimit) * 100, 100) : 0;

  const ccCardTitleEl = document.querySelector('.cc-dashboard-title');
  if (ccCardTitleEl && activeCard) {
    ccCardTitleEl.textContent = `Credit Card (${activeCard.name})`;
  }

  // Desktop summary cards
  document.getElementById('total-income').textContent  = formatCurrency(netIncome);
  document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
  document.getElementById('total-balance').textContent = formatCurrency(balance);
  document.getElementById('tx-count').textContent      = allTransactions.length;

  // Mobile hero card
  const mobBal       = document.getElementById('mob-hero-balance');
  const mobRemaining = document.getElementById('mob-remaining');
  if (mobBal)       mobBal.dataset.value       = formatCurrency(netIncome);
  if (mobRemaining) mobRemaining.dataset.value = formatCurrency(remaining);

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
    if (ccOutstanding > 0) {
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
    if (ccOutstanding > 0) {
      headerStatusEl.textContent = `Outstanding: ${formatCurrency(ccOutstanding)} · Available: ${formatCurrency(ccAvailable)}`;
    } else {
      headerStatusEl.textContent = `Fully Paid · Available: ${formatCurrency(ccAvailable)}`;
    }
  }

  const headerPctEl = document.getElementById('dashboard-cc-percentage');
  if (headerPctEl) {
    headerPctEl.textContent = `${ccUtilization.toFixed(0)}%`;
    headerPctEl.style.color = ccOutstanding > 0 && ccAvailable <= 0 ? 'var(--neon-coral)' : 'var(--neon-violet)';
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
    <div class="transaction-item" ontouchstart="handleSwipeStart(event)" ontouchmove="handleSwipeMove(event)" ontouchend="handleSwipeEnd(event)">
      <div class="tx-icon ${tx.type}">${getCategoryIcon(tx.category)}</div>
      <div class="tx-info">
        <div class="tx-desc">${tx.description}</div>
        <div class="tx-meta">
          <span class="tx-cat">${tx.category}</span>
          <span class="tx-date">${formatDate(tx.date)}</span>
          ${tx.paymentMethod === 'credit' ? `
            <span class="tx-method-badge" style="background: rgba(138, 75, 243, 0.12); color: var(--neon-violet); border: 1px solid rgba(138, 75, 243, 0.25); border-radius: 4px; padding: 1px 5px; font-size: 0.68rem; font-weight: 600; margin-left: 4px; display: inline-flex; align-items: center; gap: 2px;">
              💳 ${getCardNameById(tx.cardId)}
            </span>
          ` : ''}
          ${tx.notes ? `<span class="tx-cat">${tx.notes}</span>` : ''}
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</span>
      </div>
    </div>
    <div class="swipe-actions">
      <button class="tx-btn edit" onclick="haptic(); openModal('${tx.id}')">Edit</button>
      <button class="tx-btn del" onclick="haptic(); promptDelete('${tx.id}')">Delete</button>
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
  if (activeFilter !== 'all') list = list.filter(t => t.type === activeFilter);
  const selCombined = document.getElementById('filter-month-combined');
  const monthVal = selCombined ? selCombined.value : '';
  if (monthVal) list = list.filter(t => t.date && t.date.startsWith(monthVal));
  
  const searchInput = document.getElementById('search-tx');
  if (searchInput) {
    const search = searchInput.value.toLowerCase().trim();
    if (search) {
      list = list.filter(t => 
        (t.description || '').toLowerCase().includes(search) || 
        (t.category || '').toLowerCase().includes(search) ||
        (t.notes || '').toLowerCase().includes(search)
      );
    }
  }
  return list;
}

function renderAllTransactions() {
  const container = document.getElementById('all-transactions-list');
  const list = getFilteredTransactions();
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><span>🗂️</span><p>No transactions found.</p></div>';
    return;
  }
  list.forEach(tx => container.appendChild(buildTransactionItem(tx)));
}

window.filterTransactions = function (type, el) {
  activeFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAllTransactions();
};

window.searchTransactions = function () {
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

let currentEditWeek = null;

const WEEKLY_BUDGET_DEFAULTS = { week1: 0, week2: 0, week3: 0, week4: 0 };
const WEEKLY_BUDGET_META = [
  { num: 1, label: 'Week 1', key: 'week1' },
  { num: 2, label: 'Week 2', key: 'week2' },
  { num: 3, label: 'Week 3', key: 'week3' },
  { num: 4, label: 'Week 4', key: 'week4' }
];

function getWeeklyBudgets() {
  return { ...WEEKLY_BUDGET_DEFAULTS, ...(userSettings.weeklyBudgets || {}) };
}

function getCurrentBudgetWeek() {
  const day = new Date().getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function getWeeklySpentByWeek() {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
  const weeklySpent = { week1: 0, week2: 0, week3: 0, week4: 0 };

  allTransactions.forEach(t => {
    if (t.type === 'expense' && t.date && t.date.startsWith(currentMonthStr)) {
      const parts = t.date.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[2], 10);
        if (day >= 1 && day <= 7) weeklySpent.week1 += t.amount;
        else if (day >= 8 && day <= 14) weeklySpent.week2 += t.amount;
        else if (day >= 15 && day <= 21) weeklySpent.week3 += t.amount;
        else if (day >= 22) weeklySpent.week4 += t.amount;
      }
    }
  });

  return weeklySpent;
}

function getWeeklyBudgetSummary(weekNum = getCurrentBudgetWeek()) {
  const week = WEEKLY_BUDGET_META.find(w => w.num === weekNum) || WEEKLY_BUDGET_META[0];
  const weeklyBudgets = getWeeklyBudgets();
  const weeklySpent = getWeeklySpentByWeek();
  const limit = weeklyBudgets[week.key] || 0;
  const spent = weeklySpent[week.key] || 0;
  const remaining = Math.max(0, limit - spent);
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

  let statusClass = 'safe';
  let statusText = limit > 0 ? 'Looking good!' : 'No budget set';
  if (limit > 0) {
    if (pct >= 100) { statusClass = 'danger'; statusText = 'Over budget!'; }
    else if (pct >= 80) { statusClass = 'warn'; statusText = 'Nearing limit'; }
  }

  return { ...week, limit, spent, remaining, pct, statusClass, statusText };
}

function syncWeeklyBudgetModal() {
  const weekNum = currentEditWeek || getCurrentBudgetWeek();
  currentEditWeek = weekNum;

  const weeklyBudgets = getWeeklyBudgets();
  const currentLimit = weeklyBudgets[`week${weekNum}`] || 0;
  const titleEl = document.getElementById('weekly-budget-title');
  const inputEl = document.getElementById('weekly-budget-limit');
  const selectEl = document.getElementById('weekly-budget-week');
  const helperEl = document.getElementById('weekly-budget-helper');

  if (selectEl) selectEl.value = String(weekNum);
  if (titleEl) titleEl.textContent = currentLimit > 0 ? `Edit Week ${weekNum} Budget` : `Set Week ${weekNum} Budget`;
  if (helperEl) helperEl.textContent = 'Set a spending limit for this week of the current month.';
  if (inputEl) {
    inputEl.value = currentLimit > 0 ? currentLimit : '';
    setTimeout(() => inputEl.focus(), 0);
  }
}

function renderWeeklyBudgets() {
  const weeklyContainer = document.getElementById('weekly-budgets-list');
  if (!weeklyContainer) return;
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
  
  // Get weekly budget settings from userSettings
  const weeklyBudgets = getWeeklyBudgets();
  
  // Calculate spent for each week
  const weeklySpent = { week1: 0, week2: 0, week3: 0, week4: 0 };
  allTransactions.forEach(t => {
    if (t.type === 'expense' && t.date && t.date.startsWith(currentMonthStr)) {
      const parts = t.date.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[2], 10);
        if (day >= 1 && day <= 7) weeklySpent.week1 += t.amount;
        else if (day >= 8 && day <= 14) weeklySpent.week2 += t.amount;
        else if (day >= 15 && day <= 21) weeklySpent.week3 += t.amount;
        else if (day >= 22) weeklySpent.week4 += t.amount;
      }
    }
  });

  const weeks = WEEKLY_BUDGET_META;

  weeklyContainer.innerHTML = '';
  weeks.forEach(w => {
    const limit = weeklyBudgets[w.key] || 0;
    const spent = weeklySpent[w.key];
    const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    
    let statusClass = 'safe';
    let statusText = limit > 0 ? 'Looking good!' : 'No budget set';
    if (limit > 0) {
      if (pct >= 100) { statusClass = 'danger'; statusText = 'Over budget!'; }
      else if (pct >= 80) { statusClass = 'warn'; statusText = 'Nearing limit'; }
    }
    
    const div = document.createElement('div');
    div.className = 'budget-card';
    div.innerHTML = `
      <div class="budget-header" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span class="budget-cat">📅 ${w.label}</span>
        <button class="btn-edit-weekly" onclick="event.stopPropagation(); openWeeklyBudgetModal(${w.num})">✏️</button>
      </div>
      <div class="budget-amounts" style="margin-top:0.5rem;">
        <strong>${formatCurrency(spent)}</strong> spent of ${formatCurrency(limit)}
      </div>
      <div class="budget-progress-wrap" style="margin-top:0.8rem">
        <div class="budget-progress ${statusClass}" style="width:${limit > 0 ? pct : 0}%"></div>
      </div>
      <div class="budget-status ${statusClass}">${statusText} ${limit > 0 ? `(${pct.toFixed(0)}%)` : ''}</div>
    `;
    div.addEventListener('click', () => openWeeklyBudgetModal(w.num));
    weeklyContainer.appendChild(div);
  });
}

function renderDashboardWeeklyBudget() {
  const card = document.getElementById('dashboard-weekly-budget-card');
  if (!card) return;

  const currentWeek = getCurrentBudgetWeek();
  const currentSummary = getWeeklyBudgetSummary(currentWeek);
  const summary = currentSummary;

  // Update subtitle
  const statusHeaderEl = document.getElementById('dashboard-weekly-current-status');
  if (statusHeaderEl) {
    if (summary.limit > 0) {
      statusHeaderEl.textContent = `Week ${currentWeek} · ${formatCurrency(summary.spent)} of ${formatCurrency(summary.limit)}`;
    } else {
      statusHeaderEl.textContent = `Week ${currentWeek} · No budget set`;
    }
  }

  // Update percentage badge (like checklist)
  const pctEl = document.getElementById('dashboard-weekly-percentage');
  if (pctEl) {
    pctEl.textContent = summary.limit > 0 ? `${Math.min(summary.pct, 100).toFixed(0)}%` : '';
    pctEl.style.color = summary.limit > 0 && summary.remaining <= 0 ? 'var(--neon-coral)' : 'var(--neon-violet)';
  }

  // Update header progress bar (like checklist)
  const progressBar = document.getElementById('dashboard-weekly-progress-bar');
  if (progressBar) {
    progressBar.style.width = summary.limit > 0 ? `${Math.min(summary.pct, 100)}%` : '0%';
  }

  // Update body content
  const weeklyContainer = document.getElementById('dashboard-weekly-list');
  if (!weeklyContainer) return;

  const weekLabels = ['', 'Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const remainingColor = summary.limit > 0 && summary.remaining <= 0 ? 'var(--neon-coral)' : 'var(--ink-primary)';

  const pct = summary.limit > 0 ? Math.min(summary.pct, 100) : 0;
  const barColor = summary.statusClass === 'danger' ? 'var(--neon-coral)' : summary.statusClass === 'warn' ? 'var(--neon-gold)' : 'linear-gradient(90deg, var(--neon-violet), var(--neon-teal))';

  weeklyContainer.innerHTML = `
    <div class="weekly-dashboard-item" style="display: flex; flex-direction: column; gap: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; font-size: 0.8rem; color: var(--ink-secondary); text-transform: uppercase; letter-spacing: 0.04em;">Week ${currentWeek} Budget</span>
        <button class="btn-edit-weekly" onclick="event.stopPropagation(); openWeeklyBudgetModal(${currentWeek})" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--ink-secondary); cursor: pointer; transition: all 0.2s;" aria-label="Edit budget" title="Edit budget">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5z"/></svg>
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 0 0.1rem;">
        <strong style="font-size: 1.35rem; font-family: 'Sora', sans-serif; font-weight: 800; color: var(--ink-primary);">${formatCurrency(summary.spent)}</strong>
        <span style="font-size: 0.8rem; color: var(--ink-muted);">of ${summary.limit > 0 ? formatCurrency(summary.limit) : 'no limit'}</span>
      </div>

      <div style="height: 8px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; border: 1px solid var(--border-subtle);">
        <div style="height: 100%; width: ${pct}%; border-radius: 99px; background: ${barColor}; transition: width 0.5s cubic-bezier(0.34,1.56,0.64,1);"></div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; padding: 0 0.1rem;">
        <span style="color: var(--ink-muted);">Remaining</span>
        <span style="font-weight: 700; color: ${remainingColor};">${summary.limit > 0 ? formatCurrency(summary.remaining) : '--'}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; padding: 0 0.1rem; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
        <span style="color: var(--ink-muted);">Status</span>
        <span style="font-weight: 600; color: ${summary.statusClass === 'danger' ? 'var(--neon-coral)' : summary.statusClass === 'warn' ? 'var(--neon-gold)' : 'var(--neon-teal)'};">${summary.limit > 0 ? `${summary.statusText} · ${pct.toFixed(0)}%` : 'No budget set'}</span>
      </div>
    </div>
  `;
}

window.toggleDashboardWeeklyDropdown = function(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('dashboard-weekly-budget-card');
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  localStorage.setItem('dashboardWeeklyOpen', isOpen);
};

window.toggleDashboardCCDropdown = function(e) {
  if (e) e.stopPropagation();
  const card = document.querySelector('.cc-dashboard-card');
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  localStorage.setItem('dashboardCCOpen', isOpen);
};

window.openWeeklyBudgetModal = function(weekNum = null) {
  currentEditWeek = weekNum || getCurrentBudgetWeek();
  syncWeeklyBudgetModal();
  document.getElementById('weekly-budget-modal-overlay').classList.remove('hidden');
};

window.updateWeeklyBudgetModalFromSelect = function() {
  const selectEl = document.getElementById('weekly-budget-week');
  currentEditWeek = selectEl ? parseInt(selectEl.value, 10) : getCurrentBudgetWeek();
  syncWeeklyBudgetModal();
};

window.closeWeeklyBudgetModal = function() {
  document.getElementById('weekly-budget-modal-overlay').classList.add('hidden');
  currentEditWeek = null;
};

window.closeWeeklyBudgetModalOnOverlay = function(e) {
  if (e.target.id === 'weekly-budget-modal-overlay') {
    closeWeeklyBudgetModal();
  }
};

window.saveWeeklyBudget = async function() {
  const selectEl = document.getElementById('weekly-budget-week');
  if (selectEl) currentEditWeek = parseInt(selectEl.value, 10);
  if (!currentEditWeek) return;
  
  const limitInput = document.getElementById('weekly-budget-limit');
  const val = parseFloat(limitInput.value) || 0;
  if (val < 0) return showToast('Please enter a valid weekly limit.', 'error');
  
  const weeklyBudgets = getWeeklyBudgets();
  weeklyBudgets[`week${currentEditWeek}`] = val;
  
  try {
    const btn = document.getElementById('btn-save-weekly-budget');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    
    await setDoc(doc(db, 'settings', currentUser.uid), { 
      weeklyBudgets 
    }, { merge: true });
    
    userSettings.weeklyBudgets = weeklyBudgets;
    showToast(`Week ${currentEditWeek} budget saved!`, 'success');
    closeWeeklyBudgetModal();
    renderBudgets();
    renderDashboardWeeklyBudget();
  } catch(e) {
    console.error(e);
    showToast('Failed to save budget', 'error');
  } finally {
    const btn = document.getElementById('btn-save-weekly-budget');
    btn.disabled = false;
    btn.textContent = 'Save Budget';
  }
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

  const titleEl = overlay.querySelector('.modal-header h2');
  const nameInput = document.getElementById('cc-name-input');
  const limitInput = document.getElementById('cc-limit-input');
  const dueDayInput = document.getElementById('cc-due-day-input');
  const errEl = document.getElementById('cc-limit-modal-error');
  const deleteBtn = document.getElementById('btn-delete-cc');

  if (errEl) errEl.style.display = 'none';

  if (cardId) {
    if (titleEl) titleEl.textContent = 'Edit Credit Card';
    const card = getCCCards().find(c => c.id === cardId);
    if (card) {
      if (nameInput) nameInput.value = card.name;
      if (limitInput) limitInput.value = card.limit;
      if (dueDayInput) dueDayInput.value = card.dueDay;
    }
    if (deleteBtn) {
      deleteBtn.style.display = getCCCards().length > 1 ? 'block' : 'none';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Add Credit Card';
    if (nameInput) nameInput.value = '';
    if (limitInput) limitInput.value = 10000;
    if (dueDayInput) dueDayInput.value = 25;
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
  const nameInput = document.getElementById('cc-name-input');
  const limitInput = document.getElementById('cc-limit-input');
  const dueDayInput = document.getElementById('cc-due-day-input');
  const errEl = document.getElementById('cc-limit-modal-error');

  const name = nameInput ? nameInput.value.trim() : '';
  const limit = limitInput ? parseFloat(limitInput.value) : NaN;
  const dueDay = dueDayInput ? parseInt(dueDayInput.value, 10) : NaN;

  if (!name) {
    errEl.textContent = 'Please enter a card name.';
    errEl.style.display = 'block';
    return;
  }
  if (isNaN(limit) || limit < 0) {
    errEl.textContent = 'Please enter a valid credit limit.';
    errEl.style.display = 'block';
    return;
  }
  if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
    errEl.textContent = 'Please enter a valid due day between 1 and 31.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btn-save-cc-limit');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const cards = [...getCCCards()];
    if (editingCCCardId) {
      const idx = cards.findIndex(c => c.id === editingCCCardId);
      if (idx !== -1) {
        cards[idx] = { ...cards[idx], name, limit, dueDay };
      }
    } else {
      const newId = 'card_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      cards.push({ id: newId, name, limit, dueDay });
      activeCCCardId = newId;
    }

    await setDoc(doc(db, 'settings', currentUser.uid), {
      creditCards: cards
    }, { merge: true });

    userSettings.creditCards = cards;
    showToast(editingCCCardId ? 'Credit card updated!' : 'Credit card added!', 'success');
    closeCCLimitModal();
    updateSummaryCards();
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Failed to save card. Try again.';
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

  if (amountInput) amountInput.value = ccOutstanding > 0 ? ccOutstanding.toFixed(2) : '';
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

function renderBudgets() {
  renderWeeklyBudgets();

  const container = document.getElementById('budgets-list');
  if (!container) return;
  
  if (!allBudgets.length) {
    container.innerHTML = '<div class="empty-state"><span>🎯</span><p>No budgets set. Create one to start tracking!</p></div>';
    return;
  }
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
  
  container.innerHTML = '';
  allBudgets.forEach(b => {
    const spent = allTransactions
      .filter(t => t.type === 'expense' && t.category === b.category && t.date.startsWith(currentMonthStr))
      .reduce((sum, t) => sum + t.amount, 0);
      
    const pct = Math.min((spent / b.limit) * 100, 100);
    let statusClass = 'safe';
    let statusText = 'Looking good!';
    if (pct >= 100) { statusClass = 'danger'; statusText = 'Over budget!'; }
    else if (pct >= 80) { statusClass = 'warn'; statusText = 'Nearing limit'; }
    
    const div = document.createElement('div');
    div.className = 'budget-card';
    div.innerHTML = `
      <div class="budget-header">
        <span class="budget-cat">${getCategoryIcon(b.category)} ${b.category}</span>
        <button class="btn-edit-budget" onclick="event.stopPropagation();openBudgetModal('${b.id}')" aria-label="Edit budget" title="Edit budget">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5z"/></svg>
        </button>
        <button class="btn-del-budget" onclick="event.stopPropagation();deleteBudget('${b.id}')">✕</button>
      </div>
      <div class="budget-amounts">
        <strong>${formatCurrency(spent)}</strong> spent of ${formatCurrency(b.limit)}
      </div>
      <div class="budget-progress-wrap" style="margin-top:0.8rem">
        <div class="budget-progress ${statusClass}" style="width:${pct}%"></div>
      </div>
      <div class="budget-status ${statusClass}">${statusText} (${pct.toFixed(0)}%)</div>
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

let touchStartX = 0;
let touchCurrentX = 0;
let swipingElement = null;

window.handleSwipeStart = function(e) {
  if (e.touches.length > 1) return;
  touchStartX = e.touches[0].clientX;
  swipingElement = e.currentTarget;
  swipingElement.style.transition = 'none';
};

window.handleSwipeMove = function(e) {
  if (!swipingElement) return;
  touchCurrentX = e.touches[0].clientX;
  const diffX = touchStartX - touchCurrentX;
  
  if (diffX > 5) { // Swiping left
    const move = Math.min(diffX, 140);
    swipingElement.style.transform = `translateX(-${move}px)`;
  } else if (diffX < -5) {
    swipingElement.style.transform = `translateX(0px)`;
  }
};

window.handleSwipeEnd = function(e) {
  if (!swipingElement) return;
  const diffX = touchStartX - touchCurrentX;
  swipingElement.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
  
  if (diffX > 60) {
    swipingElement.style.transform = `translateX(-140px)`;
    haptic();
  } else {
    swipingElement.style.transform = `translateX(0px)`;
  }
  swipingElement = null;
};

// ─── Keyboard shortcuts ────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
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
      <div class="mth-tx-item">
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
      document.getElementById('tabung-target').value = t.target;
      document.getElementById('tabung-saved').value = t.saved;
      document.getElementById('tabung-emoji').value = t.emoji || '🎯';
      document.getElementById('tabung-deadline').value = t.deadline || '';
    }
  } else {
    document.getElementById('tabung-name').value = '';
    document.getElementById('tabung-target').value = '';
    document.getElementById('tabung-saved').value = '0';
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
      document.getElementById('loan-total').value = l.total;
      document.getElementById('loan-paid').value = l.paid;
      document.getElementById('loan-due').value = l.due || '';
    }
  } else {
    setLoanType('owe');
    document.getElementById('loan-person').value = '';
    document.getElementById('loan-desc').value = '';
    document.getElementById('loan-total').value = '';
    document.getElementById('loan-paid').value = '0';
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
    return 'Food & Dining';
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
  if (grossInput) grossInput.value = grossIncome || '';
  
  const carryInput = document.getElementById('modal-setting-carry-over');
  if (carryInput) carryInput.value = typeof userSettings.carryOverBalance === 'number' ? userSettings.carryOverBalance : '';
  
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
