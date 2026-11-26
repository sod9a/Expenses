import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  User,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/context/ToastContext';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  resendVerify: () => Promise<void>;
  reloadVerify: () => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function friendlyAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
    'auth/network-request-failed': 'Network error. Check your internet connection.'
  };
  return map[code] || 'Authentication error. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (emailRaw: string, password: string) => {
    const email = emailRaw.trim();
    if (!email || !password) throw new Error('Please fill in all fields.');
    if (!email.includes('@')) throw new Error('Please sign in using your email address.');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || '';
      throw new Error(friendlyAuthError(code));
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

  const updateDisplayName = useCallback(
    async (nameRaw: string) => {
      const name = nameRaw.trim();
      if (!auth.currentUser || !name) return;
      await updateProfile(auth.currentUser, { displayName: name });
      setUser({ ...auth.currentUser } as User);
      showToast('Display name updated!', 'success');
    },
    [showToast]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const fbUser = auth.currentUser;
      if (!fbUser || !fbUser.email) throw new Error('You must be signed in to change your password.');
      if (!currentPassword) throw new Error('Please enter your current password.');
      if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
      try {
        const cred = EmailAuthProvider.credential(fbUser.email, currentPassword);
        await reauthenticateWithCredential(fbUser, cred);
        await updatePassword(fbUser, newPassword);
        showToast('Password updated successfully!', 'success');
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code || '';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
          throw new Error('Current password is incorrect.');
        }
        throw new Error(friendlyAuthError(code));
      }
    },
    [showToast]
  );

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
        sendReset,
        resendVerify,
        reloadVerify,
        updateDisplayName,
        changePassword,
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
