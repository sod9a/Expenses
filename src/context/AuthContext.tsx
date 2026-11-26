import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/context/ToastContext';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  resendVerify: () => Promise<void>;
  reloadVerify: () => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function friendlyAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Incorrect email/username or password.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
    'auth/network-request-failed': 'Network error. Check your internet connection.'
  };
  return map[code] || code || 'Authentication error. Please try again.';
}

async function resolveLoginEmail(input: string): Promise<string | null> {
  if (input.includes('@')) return input;
  try {
    const snap = await getDocs(
      query(collection(db, 'usernames'), where('username', '==', input.toLowerCase()))
    );
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return typeof data.email === 'string' ? data.email : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isRegisteringRef = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (isRegisteringRef.current) return;
      setUser(fbUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (inputRaw: string, password: string) => {
    const input = inputRaw.trim();
    if (!input || !password) throw new Error('Please fill in all fields.');
    let email = await resolveLoginEmail(input);
    if (!email) {
      if (input.includes('@')) {
        email = input;
      } else {
        throw new Error('Username not found. Please try signing in with your email address.');
      }
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const code = (e as { code?: string; message?: string })?.code || '';
      throw new Error(friendlyAuthError(code));
    }
  }, []);

  const register = useCallback(async (nameRaw: string, usernameRaw: string, emailRaw: string, password: string) => {
    const name = nameRaw.trim();
    const username = usernameRaw.trim().toLowerCase();
    const email = emailRaw.trim();
    if (!name || !username || !email || !password) throw new Error('Please fill in all fields.');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      throw new Error('Username must be 3 to 20 characters (letters, numbers, underscore only).');
    }
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    isRegisteringRef.current = true;
    try {
      const existing = await getDocs(
        query(collection(db, 'usernames'), where('username', '==', username))
      );
      if (!existing.empty) {
        throw new Error('That username is already taken. Please choose another.');
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      try {
        await setDoc(doc(db, 'usernames', cred.user.uid), {
          username,
          email,
          displayName: name,
          uid: cred.user.uid
        });
      } catch {
        // Account created even if username doc write fails
      }
      setUser(cred.user);
      setAuthReady(true);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code) throw new Error(friendlyAuthError(err.code));
      throw new Error(err?.message || 'Registration failed.');
    } finally {
      isRegisteringRef.current = false;
    }
  }, []);

  const sendReset = useCallback(async (emailRaw: string) => {
    const email = emailRaw.trim();
    if (!email) throw new Error('Please enter your email address.');
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || '';
      throw new Error(friendlyAuthError(code));
    }
  }, []);

  const resendVerify = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const reloadVerify = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    return Boolean(auth.currentUser.emailVerified);
  }, []);

  const updateDisplayName = useCallback(async (nameRaw: string) => {
    const name = nameRaw.trim();
    if (!auth.currentUser || !name) return;
    await updateProfile(auth.currentUser, { displayName: name });
    setUser({ ...auth.currentUser } as User);
    showToast('Display name updated!', 'success');
  }, [showToast]);

  const logout = useCallback(async () => {
    await signOut(auth);
    showToast('Signed out successfully.', 'success');
  }, [showToast]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        login,
        register,
        sendReset,
        resendVerify,
        reloadVerify,
        updateDisplayName,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
