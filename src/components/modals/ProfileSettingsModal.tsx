import React, { useEffect, useRef, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { haptic } from '@/utils/format';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileSettingsModal({ open, onClose }: ProfileSettingsModalProps) {
  const { user, updateDisplayName, changePassword, logout } = useAuth();
  const { settings, updateSettings } = useFinance();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState('');

  // Change Password inline panel
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user?.displayName || user?.email?.split('@')[0] || '');
    setPwOpen(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
  }, [open, user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('Please fill in all password fields.');
      return;
    }
    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPw === currentPw) {
      setPwError('New password must be different from your current password.');
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwOpen(false);
    } catch (err) {
      setPwError((err as Error).message || 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  const initial = (displayName || user?.email || 'U')[0].toUpperCase();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        void updateSettings({ avatarUrl: dataUrl }, 'Profile photo updated!');
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  return (
    <ModalSheet open={open} title="Profile & Settings" onClose={onClose} small>
      {/* Avatar & Name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <div
          style={{
            width: 82,
            height: 82,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-ink))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 700,
            color: '#fff',
            overflow: 'hidden'
          }}
        >
          {settings.avatarUrl ? (
            <img src={settings.avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.45rem' }}>
          <button type="button" className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }} onClick={() => fileRef.current?.click()}>
            Change Photo
          </button>
          {settings.avatarUrl && (
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
              onClick={() => void updateSettings({ avatarUrl: '' }, 'Photo removed.')}
            >
              Remove
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        <div style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>{user?.email}</div>
      </div>

      <div className="input-group" style={{ marginBottom: 0 }}>
        <label htmlFor="prof-name">Display Name</label>
        <input
          id="prof-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => {
            if (displayName.trim() && displayName.trim() !== user?.displayName) {
              void updateDisplayName(displayName.trim());
            }
          }}
        />
      </div>

      <div className="input-group" style={{ marginBottom: 0 }}>
        <label htmlFor="prof-currency">Currency Symbol</label>
        <select
          id="prof-currency"
          value={settings.currency}
          onChange={(e) => void updateSettings({ currency: e.target.value }, 'Currency updated!')}
        >
          <option value="$">USD ($)</option>
          <option value="RM">MYR (RM)</option>
          <option value="€">EUR (€)</option>
          <option value="£">GBP (£)</option>
          <option value="Rp">IDR (Rp)</option>
        </select>
      </div>

      <div className="input-group" style={{ marginBottom: 0 }}>
        <label htmlFor="prof-theme">Theme</label>
        <select
          id="prof-theme"
          value={settings.theme}
          onChange={(e) => void updateSettings({ theme: e.target.value === 'light' ? 'light' : 'dark' }, 'Theme updated!')}
        >
          <option value="dark">Dark Mode</option>
          <option value="light">Light Mode</option>
        </select>
      </div>

      {/* Change Password */}
      <div style={{ marginTop: '0.25rem' }}>
        <button
          type="button"
          className="btn-secondary"
          aria-expanded={pwOpen}
          style={{ width: '100%', minHeight: 44, justifyContent: 'space-between', display: 'flex', alignItems: 'center', padding: '0 1rem' }}
          onClick={() => {
            haptic();
            setPwOpen((prev) => !prev);
            setPwError('');
          }}
        >
          <span>Change Password</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: pwOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {pwOpen && (
          <form
            onSubmit={handleChangePassword}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.7rem',
              marginTop: '0.65rem',
              padding: '0.9rem',
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="pw-current">Current Password</label>
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="pw-new">New Password</label>
              <input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="pw-confirm">Confirm New Password</label>
              <input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            </div>
            {pwError && (
              <div className="auth-error" style={{ display: 'block', marginTop: 0 }}>
                {pwError}
              </div>
            )}
            <button type="submit" className="btn-primary" style={{ marginTop: '0.15rem' }} disabled={pwSaving}>
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      <button
        type="button"
        className="btn-logout"
        style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
        onClick={() => {
          onClose();
          void logout();
        }}
      >
        Sign Out
      </button>
    </ModalSheet>
  );
}
