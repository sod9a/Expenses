import React, { useEffect, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';
import type { CardColor, CreditCard } from '@/types/finance';
import { WALLET_CARD_COLORS } from '@/utils/categories';
import { haptic } from '@/utils/format';

interface CreditCardModalProps {
  open: boolean;
  editingCard: CreditCard | null;
  onClose: () => void;
}

export function CreditCardModal({ open, editingCard, onClose }: CreditCardModalProps) {
  const { settings, creditCards, getCardLimit, getCardDueDay, getCardColor, saveCreditCard, deleteCreditCard } = useFinance();

  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [limit, setLimit] = useState('');
  const [dueDay, setDueDay] = useState('20');
  const [color, setColor] = useState<CardColor>('blue');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingCard) {
      const idx = creditCards.findIndex((c) => c.id === editingCard.id);
      setName(editingCard.name || '');
      setLast4(editingCard.last4 || '0000');
      setLimit(String(getCardLimit(editingCard).toFixed(2)));
      setDueDay(String(getCardDueDay(editingCard)));
      setColor(getCardColor(editingCard, idx >= 0 ? idx : 0));
    } else {
      setName('');
      setLast4('');
      setLimit('');
      setDueDay(String(settings.creditPoolDueDay || 20));
      setColor(WALLET_CARD_COLORS[creditCards.length % WALLET_CARD_COLORS.length].key);
    }
  }, [open, editingCard, creditCards, getCardLimit, getCardDueDay, getCardColor, settings.creditPoolDueDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    const numLimit = parseFloat(limit);
    const numDue = parseInt(dueDay, 10);
    const digits = last4.replace(/\D/g, '').slice(-4);
    const normalizedLast4 = digits ? digits.padStart(4, '0') : '0000';

    if (!trimmed) return setError('Please enter a card name.');
    if (Number.isNaN(numLimit) || numLimit < 0) return setError('Please enter a valid credit limit.');
    if (Number.isNaN(numDue) || numDue < 1 || numDue > 31) return setError('Please enter a valid due day (1 to 31).');

    setSaving(true);
    try {
      await saveCreditCard(
        { name: trimmed, last4: normalizedLast4, limit: numLimit, dueDay: numDue, color },
        editingCard?.id
      );
      onClose();
    } catch {
      setError('Failed to save card. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCard) return;
    if (!window.confirm(`Delete "${editingCard.name}"? Past transactions stay in your history.`)) return;
    await deleteCreditCard(editingCard.id);
    onClose();
  };

  return (
    <ModalSheet open={open} title={editingCard ? 'Edit Credit Card' : 'Add Credit Card'} onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cc-name">Card Name</label>
          <input id="cc-name" type="text" placeholder="e.g. RHB, Maybank, CIMB" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cc-last4">Last 4 Digits</label>
          <input id="cc-last4" type="text" placeholder="e.g. 0000" maxLength={4} inputMode="numeric" value={last4} onChange={(e) => setLast4(e.target.value)} />
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cc-limit">Credit Limit</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="cc-limit" type="text" placeholder="0.00" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cc-due-day">Statement Due Day (1 to 31)</label>
          <input id="cc-due-day" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label id="cc-color-lbl">Card Color</label>
          <div className="cc-color-picker" role="radiogroup" aria-labelledby="cc-color-lbl">
            {WALLET_CARD_COLORS.map((swatch) => (
              <button
                key={swatch.key}
                type="button"
                role="radio"
                aria-checked={color === swatch.key}
                aria-label={swatch.label}
                className={`cc-color-swatch${color === swatch.key ? ' active' : ''}`}
                style={{ background: swatch.gradient }}
                onClick={() => {
                  haptic();
                  setColor(swatch.key);
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button type="submit" className="btn-primary" style={{ flex: 2, marginTop: 0 }} disabled={saving}>
            {saving ? 'Saving…' : 'Save Card'}
          </button>
          {editingCard && (
            <button type="button" className="btn-danger" style={{ flex: 1 }} onClick={() => void handleDelete()}>
              Delete
            </button>
          )}
        </div>
      </form>
    </ModalSheet>
  );
}
