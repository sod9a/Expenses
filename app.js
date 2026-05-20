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
let userSettings = { currency: '$', theme: 'dark', avatarUrl: '' };
let activeFilter = 'all';
let editingTxId = null;
let editingTabungId = null;
let editingLoanId = null;
let topupTabungId = null;
let loanPayId = null;
let pendingDeleteId = null;
let txType = 'income';
let loanType = 'owe';
let unsubscribeListener = null;
let unsubscribeBudgets = null;
let unsubscribeSettings = null;
let unsubscribeTabung = null;
let unsubscribeLoans = null;
let isRegistering = false;

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
    allTransactions = [];
    allBudgets = [];
    allTabung = [];
    allLoans = [];
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
const hasCreds = !!navigator.credentials;   // Available on iOS Safari too

function showFaceIdButton() {
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
    showAuthError('login-error', friendlyAuthError(e.code) || 'Login failed. Please try your password.');
    resetBtn();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  showFaceIdButton();
  tryAutoSignIn(); // Attempt silent auto-login on every page load
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

  // 4. Tabung (savings)
  const tq = query(collection(db, 'tabung'), where('uid', '==', currentUser.uid));
  unsubscribeTabung = onSnapshot(tq, snap => {
    allTabung = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-tabung').classList.contains('active')) renderTabung();
  });

  // 5. Loans
  const lq = query(collection(db, 'loans'), where('uid', '==', currentUser.uid));
  unsubscribeLoans = onSnapshot(lq, snap => {
    allLoans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-loans').classList.contains('active')) renderLoans();
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
  
  renderAll(); // Re-render to update currency formats
}

window.saveSettings = async function () {
  const currency = document.getElementById('setting-currency').value;
  const theme = document.getElementById('setting-theme').value;
  
  try {
    await setDoc(doc(db, 'settings', currentUser.uid), { currency, theme }, { merge: true });
    showToast('Settings saved!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Failed to save settings', 'error');
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
  if (page === 'categories') renderCategories();
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
  const balance = income - expense;
  // Desktop summary cards
  document.getElementById('total-income').textContent = formatCurrency(income);
  document.getElementById('total-expense').textContent = formatCurrency(expense);
  document.getElementById('total-balance').textContent = formatCurrency(balance);
  document.getElementById('tx-count').textContent = allTransactions.length;
  // Mobile hero card
  const mobBal = document.getElementById('mob-hero-balance');
  const mobInc = document.getElementById('mob-total-income');
  const mobExp = document.getElementById('mob-total-expense');
  if (mobBal) mobBal.textContent = formatCurrency(balance);
  if (mobInc) mobInc.textContent = formatCurrency(income);
  if (mobExp) mobExp.textContent = formatCurrency(expense);
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

// ─── Mobile Profile Dropdown (duplicate removed — see line 572) ───────────

// ─── MONTHLY REPORT ───────────────────────────────────────────────────────

function renderMonthly() {
  const now = new Date();
  const yearSel = document.getElementById('monthly-year-select');

  // Populate years from transactions
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
    <div class="summary-card income">
      <div class="card-icon">📈</div>
      <div class="card-info">
        <span class="card-label">Total Income ${selectedYear}</span>
        <span class="card-value">${formatCurrency(totalIncome)}</span>
      </div>
    </div>
    <div class="summary-card expense">
      <div class="card-icon">📉</div>
      <div class="card-info">
        <span class="card-label">Total Expenses ${selectedYear}</span>
        <span class="card-value">${formatCurrency(totalExpense)}</span>
      </div>
    </div>
    <div class="summary-card ${netSaving >= 0 ? 'balance' : 'expense'}">
      <div class="card-icon">${netSaving >= 0 ? '💰' : '⚠️'}</div>
      <div class="card-info">
        <span class="card-label">Net Savings ${selectedYear}</span>
        <span class="card-value">${formatCurrency(netSaving)}</span>
      </div>
    </div>
  `;

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const breakdown = document.getElementById('monthly-breakdown');
  breakdown.innerHTML = '';

  let hasData = false;
  months.forEach((mName, i) => {
    const mKey = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
    const mTx = txInYear.filter(t => t.date && t.date.startsWith(mKey));
    if (!mTx.length) return;
    hasData = true;
    const inc = mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = inc - exp;
    const maxBar = Math.max(inc, exp, 1);
    const div = document.createElement('div');
    div.className = 'monthly-row';
    div.innerHTML = `
      <div class="monthly-month-header">
        <span class="monthly-month-name">${mName}</span>
        <span class="monthly-net ${net >= 0 ? 'income' : 'expense'}">${net >= 0 ? '+' : ''}${formatCurrency(net)}</span>
      </div>
      <div class="monthly-bars">
        <div class="monthly-bar-row">
          <span class="monthly-bar-label">Income</span>
          <div class="monthly-bar-track">
            <div class="monthly-bar income" style="width:${(inc/maxBar*100).toFixed(1)}%"></div>
          </div>
          <span class="monthly-bar-val income">${formatCurrency(inc)}</span>
        </div>
        <div class="monthly-bar-row">
          <span class="monthly-bar-label">Expense</span>
          <div class="monthly-bar-track">
            <div class="monthly-bar expense" style="width:${(exp/maxBar*100).toFixed(1)}%"></div>
          </div>
          <span class="monthly-bar-val expense">${formatCurrency(exp)}</span>
        </div>
      </div>
      <div class="monthly-tx-count">${mTx.length} transaction${mTx.length !== 1 ? 's' : ''}</div>
    `;
    breakdown.appendChild(div);
  });

  if (!hasData) {
    breakdown.innerHTML = `<div class="empty-state"><span>📅</span><p>No transactions in ${selectedYear}.</p></div>`;
  }
}

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
  if (saved > target) { errEl.textContent = 'Amount saved cannot exceed target.'; errEl.style.display = 'block'; return; }

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
  const newSaved = Math.min(t.saved + amount, t.target);
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
    const pct = Math.min((t.saved / t.target) * 100, 100);
    let statusClass = 'safe', statusText = `${pct.toFixed(0)}% reached`;
    if (pct >= 100) { statusClass = 'income-text'; statusText = '🎉 Goal reached!'; }
    else if (pct >= 75) { statusClass = 'warn'; }

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
    card.innerHTML = `
      <div class="tabung-header">
        <span class="tabung-emoji">${t.emoji || '🎯'}</span>
        <div class="tabung-title-wrap">
          <span class="tabung-name">${t.name}</span>
          ${deadlineHtml}
        </div>
        <div class="tabung-actions">
          <button class="btn-tabung-edit" onclick="openTabungModal('${t.id}')">✏️</button>
          <button class="btn-del-budget" onclick="deleteTabung('${t.id}')">✕</button>
        </div>
      </div>
      <div class="tabung-amounts">
        <span class="tabung-saved">${formatCurrency(t.saved)}</span>
        <span class="tabung-sep"> / </span>
        <span class="tabung-target-val">${formatCurrency(t.target)}</span>
      </div>
      <div class="budget-progress-wrap" style="margin:0.75rem 0;">
        <div class="budget-progress ${pct >= 100 ? 'safe' : pct >= 75 ? 'warn' : 'safe'}" style="width:${pct}%;background:${pct >= 100 ? 'linear-gradient(90deg,var(--accent-green),#16b98d)' : pct >= 75 ? 'linear-gradient(90deg,var(--accent-gold),#fda642)' : 'linear-gradient(90deg,var(--accent-purple),var(--accent-purple-light))'}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="budget-status ${pct >= 100 ? 'safe' : ''}" style="color:${pct >= 100 ? 'var(--accent-green)' : pct >= 75 ? 'var(--accent-gold)' : 'var(--text-secondary)'}">${statusText}</span>
        <button class="btn-add-tx" style="padding:0.4rem 0.9rem;font-size:0.8rem;" onclick="openTopupModal('${t.id}')">+ Add</button>
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
  const newPaid = Math.min(l.paid + amount, l.total);
  try {
    await updateDoc(doc(db, 'loans', loanPayId), { paid: newPaid, updatedAt: serverTimestamp() });
    showToast(`Payment of ${formatCurrency(amount)} recorded!`, 'success');
    closeLoanPayModal();
  } catch(e) { showToast('Failed to update', 'error'); }
};

function renderLoans() {
  const container = document.getElementById('loan-list');
  const summaryEl = document.getElementById('loan-summary-cards');

  const totalOwe = allLoans.filter(l => l.loanType === 'owe').reduce((s, l) => s + (l.total - l.paid), 0);
  const totalLent = allLoans.filter(l => l.loanType === 'lent').reduce((s, l) => s + (l.total - l.paid), 0);

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
    const pct = Math.min((l.paid / l.total) * 100, 100);
    const isSettled = remaining <= 0;

    let dueHtml = '';
    if (l.due && !isSettled) {
      const d = new Date(l.due + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      const label = diff < 0 ? `⚠️ ${Math.abs(diff)} days overdue` : diff === 0 ? '🔔 Due today!' : `📆 ${diff} days left`;
      dueHtml = `<span class="tabung-deadline-label ${diff < 0 ? 'overdue' : ''}">${label}</span>`;
    }

    const card = document.createElement('div');
    card.className = `loan-card ${isSettled ? 'settled' : ''} ${l.loanType}`;
    card.innerHTML = `
      <div class="loan-type-badge ${l.loanType}">${l.loanType === 'owe' ? '💸 I Owe' : '💰 I Lent'}</div>
      <div class="loan-header">
        <div>
          <div class="loan-person">${l.person}</div>
          <div class="loan-desc-text">${l.desc || ''}</div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-shrink:0;">
          <button class="btn-tabung-edit" onclick="openLoanModal('${l.id}')">✏️</button>
          <button class="btn-del-budget" onclick="deleteLoan('${l.id}')">✕</button>
        </div>
      </div>
      ${dueHtml}
      <div class="loan-amounts">
        <span>Paid: <strong style="color:var(--accent-green)">${formatCurrency(l.paid)}</strong></span>
        <span>Remaining: <strong style="color:${isSettled ? 'var(--accent-green)' : 'var(--accent-red)'}">${formatCurrency(remaining)}</strong></span>
        <span>Total: <strong>${formatCurrency(l.total)}</strong></span>
      </div>
      <div class="budget-progress-wrap" style="margin:0.75rem 0;">
        <div class="budget-progress safe" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.8rem;color:${isSettled ? 'var(--accent-green)' : 'var(--text-secondary)'}">
          ${isSettled ? '✅ Settled!' : `${pct.toFixed(0)}% paid`}
        </span>
        ${!isSettled ? `<button class="btn-add-tx" style="padding:0.4rem 0.9rem;font-size:0.8rem;" onclick="openLoanPayModal('${l.id}')">+ Pay</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

