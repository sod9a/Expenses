import React, { useEffect, useRef, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';

interface MyKasihModalProps {
  open: boolean;
  onClose: () => void;
}

function parseMoneyInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned);
}

export function MyKasihModal({ open, onClose }: MyKasihModalProps) {
  const { settings, mykasihBalance, saveMyKasihSettings } = useFinance();
  const [allowance, setAllowance] = useState('50.00');
  const [balance, setBalance] = useState('50.00');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setError('');
      setAllowance(Number(settings.mykasihAllowance ?? 50).toFixed(2));
      setBalance(mykasihBalance.toFixed(2));
    }
    wasOpenRef.current = open;
  }, [open, settings.mykasihAllowance, mykasihBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAllowance = parseMoneyInput(allowance);
    const numBalance = parseMoneyInput(balance);

    if (Number.isNaN(numAllowance) || numAllowance < 0) {
      setError('Please enter a valid monthly allowance (0 or more).');
      return;
    }
    if (Number.isNaN(numBalance) || numBalance < 0) {
      setError('Please enter a valid current balance (0 or more).');
      return;
    }

    setSaving(true);
    try {
      await saveMyKasihSettings(numBalance, numAllowance);
      onClose();
    } catch (err) {
      console.error('Failed to save MyKasih settings:', err);
      setError('Failed to save MyKasih settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={open} title="MyKasih Settings" onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <p style={{ color: 'var(--ink-secondary)', fontSize: '0.82rem', lineHeight: 1.45, margin: 0 }}>
          Set your current remaining MyKasih balance and monthly aid amount. Your allowance tops up automatically each new month.
        </p>

        {error && (
          <div className="auth-error" style={{ display: 'block', marginTop: 0 }}>
            {error}
          </div>
        )}

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="mk-allow">Monthly Allowance</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input
              id="mk-allow"
              type="text"
              inputMode="decimal"
              placeholder="50.00"
              value={allowance}
              onChange={(e) => setAllowance(e.target.value)}
            />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="mk-bal">Current Available Balance</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input
              id="mk-bal"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save MyKasih Settings'}
        </button>
      </form>
    </ModalSheet>
  );
}
