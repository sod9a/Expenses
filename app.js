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
let userSettings = { currency: '$', theme: 'dark', avatarUrl: '' };
let activeFilter = 'all';
let editingTxId = null;
let pendingDeleteId = null;
let txType = 'income';
let unsubscribeListener = null;
let unsubscribeBudgets = null;
let unsubscribeSettings = null;
let isRegistering = false; // Flag to pause onAuthStateChanged during registration

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
    allTransactions = [];
    allBudgets = [];
  }
});

function showApp(user) {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('user-name-display').textContent = name;
  document.getElementById('user-email-display').textContent = user.email;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  document.getElementById('mobile-user-avatar').textContent = name[0].toUpperCase();
  setGreeting();
  // Always start on Dashboard after login
  navigateTo('dashboard', document.querySelector('[data-page="dashboard"]'));
}

function hideApp() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('app').classList.add('hidden');
}

function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning! 👋' : h < 17 ? 'Good afternoon! ☀️' : 'Good evening! 🌙';
  document.getElementById('greeting').textContent = greet;
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
  el.textContent = msg; el.style.display = 'block';
}

// Resolve username to email via Firestore lookup
async function resolveLoginEmail(input) {
  if (input.includes('@')) return input; // it's already an email
  // Look up username in 'usernames' collection
  const snap = await getDocs(query(collection(db, 'usernames'), where('username', '==', input.toLowerCase())));
  if (snap.empty) return null;
  return snap.docs[0].data().email;
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const input = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  if (!input || !pw) return showAuthError('login-error', 'Please fill in all fields.');
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const email = await resolveLoginEmail(input);
    if (!email) {
      showAuthError('login-error', 'No account found with that username.');
      return;
    }
    await signInWithEmailAndPassword(auth, email, pw);
    // Save to device keychain so Face ID / Touch ID works next time
    await storeCredential(input, pw);
  } catch (e) {
    showAuthError('login-error', friendlyAuthError(e.code));
  } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
});

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
    showAuthError('register-error', friendlyAuthError(e.code));
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

function showFaceIdButton() {
  // Show on iOS Safari OR on Chrome/Android with Credential Management support
  if (isIOS || hasCMA) {
    document.getElementById('btn-face-id').classList.remove('hidden');
    document.getElementById('face-id-or').classList.remove('hidden');
  }
}

async function storeCredential(id, password) {
  if (!hasCMA) return;
  try {
    const cred = new PasswordCredential({ id, password });
    await navigator.credentials.store(cred);
  } catch (e) { /* Silent — user may dismiss */ }
}

window.faceIdLogin = async function () {
  if (isIOS) {
    // iOS Safari: focus the password field — this triggers the native
    // iCloud Keychain / Face ID autofill bar at the bottom of the screen
    const pw = document.getElementById('login-password');
    pw.focus();
    return;
  }
  // Chrome / Android: use the Credential Management API
  if (!hasCMA) return;
  try {
    const cred = await navigator.credentials.get({ password: true, mediation: 'optional' });
    if (!cred) return;
    const btn = document.getElementById('btn-face-id');
    btn.disabled = true; btn.textContent = 'Signing in\u2026';
    const email = await resolveLoginEmail(cred.id);
    if (!email) {
      showAuthError('login-error', 'No account found. Please sign in with password first.');
      btn.disabled = false; btn.innerHTML = '<span class="face-id-icon">\ud83d\udd12</span> Sign in with Face ID / Touch ID';
      return;
    }
    await signInWithEmailAndPassword(auth, email, cred.password);
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      showAuthError('login-error', 'Biometric login failed. Please use your password.');
    }
    const btn = document.getElementById('btn-face-id');
    btn.disabled = false; btn.innerHTML = '<span class="face-id-icon">\ud83d\udd12</span> Sign in with Face ID / Touch ID';
  }
};

// Show Face ID button on page load if supported
document.addEventListener('DOMContentLoaded', showFaceIdButton);

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
    showAuthError('forgot-error', friendlyAuthError(e.code));
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
    'auth/too-many-requests': 'Too many attempts. Try again later.'
  };
  return map[code] || 'An error occurred. Please try again.';
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
    renderAll();
  }, (err) => {
    console.error('Firestore error:', err);
    if (err.code === 'failed-precondition') {
      showToast('Please create a Firestore index. Check console for link.', 'error');
    }
  });

  // 2. Budgets
  const bq = query(collection(db, 'budgets'), where('uid', '==', currentUser.uid));
  unsubscribeBudgets = onSnapshot(bq, snap => {
    allBudgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
  });

  // 3. Settings
  unsubscribeSettings = onSnapshot(doc(db, 'settings', currentUser.uid), docSnap => {
    if (docSnap.exists()) {
      userSettings = { ...userSettings, ...docSnap.data() };
      applySettings();
    }
  });
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
  if (userSettings.avatarUrl) {
    avatarEl.innerHTML = `<img src="${userSettings.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    avatarEl.style.background = 'transparent';
  } else {
    avatarEl.innerHTML = '';
    avatarEl.textContent = (currentUser.displayName || currentUser.email)[0].toUpperCase();
    avatarEl.style.background = 'linear-gradient(135deg, var(--accent-purple), var(--accent-green))';
  }
  
  document.getElementById('setting-currency').value = userSettings.currency;
  document.getElementById('setting-theme').value = userSettings.theme;
  document.getElementById('setting-avatar-url').value = userSettings.avatarUrl || '';
  
  renderAll(); // Re-render to update currency formats
}

window.saveSettings = async function () {
  const currency = document.getElementById('setting-currency').value;
  const theme = document.getElementById('setting-theme').value;
  const avatarUrl = document.getElementById('setting-avatar-url').value.trim();
  
  try {
    await setDoc(doc(db, 'settings', currentUser.uid), { currency, theme, avatarUrl }, { merge: true });
    showToast('Settings saved!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Failed to save settings', 'error');
  }
};

// ─── Navigation ────────────────────────────────────────────────────────────
window.navigateTo = function (page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  }
  closeSidebar();
  if (page === 'categories') renderCategories();
  if (page === 'budgets') renderBudgets();
  if (page === 'transactions') renderAllTransactions();
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

// ─── Modal ─────────────────────────────────────────────────────────────────
window.openModal = function (txId = null) {
  editingTxId = txId;
  const modal = document.getElementById('modal-overlay');
  modal.classList.remove('hidden');
  document.getElementById('modal-title').textContent = txId ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('btn-save-tx').textContent = txId ? 'Update Transaction' : 'Save Transaction';
  document.getElementById('modal-error').style.display = 'none';

  if (txId) {
    const tx = allTransactions.find(t => t.id === txId);
    if (tx) {
      setType(tx.type);
      document.getElementById('tx-description').value = tx.description;
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-category').value = tx.category;
      document.getElementById('tx-date').value = tx.date;
      document.getElementById('tx-notes').value = tx.notes || '';
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
  document.getElementById('modal-error').style.display = 'none';
}

window.setType = function (t) {
  txType = t;
  document.getElementById('type-income').classList.toggle('active', t === 'income');
  document.getElementById('type-expense').classList.toggle('active', t === 'expense');
};

// ─── Save Transaction ──────────────────────────────────────────────────────
window.saveTransaction = async function () {
  const desc = document.getElementById('tx-description').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const date = document.getElementById('tx-date').value;
  const notes = document.getElementById('tx-notes').value.trim();
  const errEl = document.getElementById('modal-error');

  if (!desc) { errEl.textContent = 'Please enter a description.'; errEl.style.display = 'block'; return; }
  if (!amount || amount <= 0) { errEl.textContent = 'Please enter a valid amount.'; errEl.style.display = 'block'; return; }
  if (!date) { errEl.textContent = 'Please select a date.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-save-tx');
  btn.disabled = true; btn.textContent = 'Saving…';

  const data = { uid: currentUser.uid, type: txType, description: desc, amount, category, date, notes, updatedAt: serverTimestamp() };

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
window.openBudgetModal = function () {
  document.getElementById('budget-modal-overlay').classList.remove('hidden');
  document.getElementById('budget-limit').value = '';
};

window.closeBudgetModal = function () {
  document.getElementById('budget-modal-overlay').classList.add('hidden');
};

window.closeBudgetModalOnOverlay = function (e) {
  if (e.target.id === 'budget-modal-overlay') closeBudgetModal();
};

window.saveBudget = async function () {
  const category = document.getElementById('budget-category').value;
  const limit = parseFloat(document.getElementById('budget-limit').value);
  if (!limit || limit <= 0) return showToast('Please enter a valid limit', 'error');
  
  const existing = allBudgets.find(b => b.category === category);
  const btn = document.getElementById('btn-save-budget');
  btn.disabled = true; btn.textContent = 'Saving…';
  
  try {
    if (existing) {
      await updateDoc(doc(db, 'budgets', existing.id), { limit, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'budgets'), { uid: currentUser.uid, category, limit, createdAt: serverTimestamp() });
    }
    showToast('Budget saved!', 'success');
    closeBudgetModal();
  } catch (e) {
    console.error(e);
    showToast('Failed to save budget', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Budget';
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
  if (document.getElementById('page-transactions').classList.contains('active')) renderAllTransactions();
  if (document.getElementById('page-categories').classList.contains('active')) renderCategories();
  if (document.getElementById('page-budgets').classList.contains('active')) renderBudgets();
}

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
    'Entertainment': '🎬', 'Health': '💊', 'Education': '📚', 
    'Salary': '💼', 'Freelance': '💻', 'Investment': '📈', 
    'Loan': '🏦', 'Other': '✨', 'General': '💡'
  };
  return icons[cat] || '💡';
}

function updateSummaryCards() {
  const income = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  document.getElementById('total-income').textContent = formatCurrency(income);
  document.getElementById('total-expense').textContent = formatCurrency(expense);
  document.getElementById('total-balance').textContent = formatCurrency(income - expense);
  document.getElementById('tx-count').textContent = allTransactions.length;
}

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
  const recent = allTransactions.slice(0, 5);
  container.innerHTML = '';
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state"><span>🗂️</span><p>No transactions yet. Add your first one!</p></div>';
    return;
  }
  recent.forEach(tx => container.appendChild(buildTransactionItem(tx)));
}

function getFilteredTransactions() {
  let list = [...allTransactions];
  if (activeFilter !== 'all') list = list.filter(t => t.type === activeFilter);
  const monthVal = document.getElementById('filter-month').value;
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

function renderCategories() {
  const container = document.getElementById('categories-content');
  if (!allTransactions.length) {
    container.innerHTML = '<div class="empty-state"><span>🏷️</span><p>No data yet. Add some transactions!</p></div>';
    return;
  }
  const map = {};
  allTransactions.forEach(t => {
    if (!map[t.category]) map[t.category] = { income: 0, expense: 0, count: 0 };
    map[t.category][t.type] += t.amount;
    map[t.category].count++;
  });
  const maxTotal = Math.max(...Object.values(map).map(v => v.income + v.expense));
  container.innerHTML = '';
  Object.entries(map).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense)).forEach(([cat, vals]) => {
    const pct = maxTotal > 0 ? ((vals.income + vals.expense) / maxTotal * 100) : 0;
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

function renderBudgets() {
  const container = document.getElementById('budgets-list');
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
        <button class="btn-del-budget" onclick="deleteBudget('${b.id}')">✕</button>
      </div>
      <div class="budget-amounts">
        <strong>${formatCurrency(spent)}</strong> spent of ${formatCurrency(b.limit)}
      </div>
      <div class="budget-progress-wrap" style="margin-top:0.8rem">
        <div class="budget-progress ${statusClass}" style="width:${pct}%"></div>
      </div>
      <div class="budget-status ${statusClass}">${statusText} (${pct.toFixed(0)}%)</div>
    `;
    container.appendChild(div);
  });
}

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

// ─── Mobile Profile Dropdown ────────────────────────────────────────────────
window.toggleProfileDropdown = function() {
  document.getElementById('profile-dropdown').classList.toggle('hidden');
};

window.openMobileSettings = function() {
  document.getElementById('profile-dropdown').classList.add('hidden');
  navigateTo('settings', document.querySelector('[data-page="settings"]'));
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.mobile-profile-container')) {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
    }
  }
});
