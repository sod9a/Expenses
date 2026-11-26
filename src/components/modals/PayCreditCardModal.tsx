import React, { useEffect, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';
import { todayISO } from '@/utils/format';

interface PayCreditCardModalProps {
  cardId: string | null;
  onClose: () => void;
}

export function PayCreditCardModal({ cardId, onClose }: PayCreditCardModalProps) {
  const { settings, getCardNameById, getCardOutstanding, recordCardPayment } = useFinance();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    const due = getCardOutstanding(cardId);
    setAmount(due > 0 ? due.toFixed(2) : '');
    setDate(todayISO());
    setError('');
  }, [cardId, getCardOutstanding]);

  if (!cardId) return null;
  const cardName = getCardNameById(cardId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) return setError('Please enter a valid payment amount.');
    if (!date) return setError('Please select a payment date.');

    setSaving(true);
    try {
      await recordCardPayment(cardId, num, date);
      onClose();
    } catch {
      setError('Failed to record payment. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={Boolean(cardId)} title={`Pay ${cardName} Bill`} onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        <p style={{ color: 'var(--ink-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>
          This records a payment from your Cash/Debit balance to reduce your {cardName} balance.
        </p>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cc-pay-amt">Payment Amount</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="cc-pay-amt" type="text" placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cc-pay-date">Payment Date</label>
          <input id="cc-pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Record Payment'}
        </button>
      </form>
    </ModalSheet>
  );
}
