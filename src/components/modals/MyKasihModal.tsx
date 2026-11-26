import React, { useEffect, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';
import { toMonthKey } from '@/utils/format';

interface MyKasihModalProps {
  open: boolean;
  onClose: () => void;
}

export function MyKasihModal({ open, onClose }: MyKasihModalProps) {
  const { settings, mykasihBalance, updateSettings } = useFinance();
  const [allowance, setAllowance] = useState('50.00');
  const [balance, setBalance] = useState('50.00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAllowance(Number(settings.mykasihAllowance ?? 50).toFixed(2));
    setBalance(mykasihBalance.toFixed(2));
  }, [open, settings.mykasihAllowance, mykasihBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const now = new Date();
      await updateSettings(
        {
          mykasihAllowance: parseFloat(allowance) || 50,
          mykasihBaseBalance: parseFloat(balance) || 0,
          mykasihLastTopupMonth: toMonthKey(now.getFullYear(), now.getMonth())
        },
        'MyKasih settings saved!'
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={open} title="MyKasih Settings" onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="mk-allow">Monthly Allowance</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="mk-allow" type="text" inputMode="decimal" value={allowance} onChange={(e) => setAllowance(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="mk-bal">Current Base Balance</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="mk-bal" type="text" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save MyKasih Settings'}
        </button>
      </form>
    </ModalSheet>
  );
}
