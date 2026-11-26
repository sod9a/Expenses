import React, { useEffect, useRef, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import type { PageId } from '@/types/finance';
import { haptic } from '@/utils/format';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}

export function ProfileSettingsModal({ open, onClose, onNavigate }: ProfileSettingsModalProps) {
  const { user, updateDisplayName, logout } = useAuth();
  const { settings, updateSettings } = useFinance();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [grossIncome, setGrossIncome] = useState('');
  const [carryOver, setCarryOver] = useState('');

  useEffect(() => {
    if (!open) return;
    setDisplayName(user?.displayName || user?.email?.split('@')[0] || '');
    setGrossIncome(String(Number(settings.grossIncome || 0).toFixed(2)));
    setCarryOver(String(Number(settings.carryOverBalance || 0).toFixed(2)));
  }, [open, user, settings.grossIncome, settings.carryOverBalance]);

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

      <div className="input-group" style={{ marginBottom: 0 }}>
        <label htmlFor="prof-gross">Net Monthly Income</label>
        <div className="amount-input-wrap">
          <span className="currency-symbol">{settings.currency}</span>
          <input
            id="prof-gross"
            type="text"
            inputMode="decimal"
            value={grossIncome}
            onChange={(e) => setGrossIncome(e.target.value)}
            onBlur={() => void updateSettings({ grossIncome: parseFloat(grossIncome) || 0 }, 'Monthly income saved!')}
          />
        </div>
      </div>

      <div className="input-group" style={{ marginBottom: 0 }}>
        <label htmlFor="prof-carry">Carry-over Balance</label>
        <div className="amount-input-wrap">
          <span className="currency-symbol">{settings.currency}</span>
          <input
            id="prof-carry"
            type="text"
            inputMode="decimal"
            value={carryOver}
            onChange={(e) => setCarryOver(e.target.value)}
            onBlur={() => void updateSettings({ carryOverBalance: parseFloat(carryOver) || 0 }, 'Carry-over balance saved!')}
          />
        </div>
      </div>

      {/* Quick navigation to secondary views */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', marginTop: '0.25rem' }}>
        {(
          [
            { id: 'categories', label: 'Categories' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'tools', label: 'MyKasih & List' }
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.55rem 0.35rem' }}
            onClick={() => {
              haptic();
              onClose();
              onNavigate(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn-logout"
        style={{ width: '100%', justifyContent: 'center', marginTop: '0.35rem' }}
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
