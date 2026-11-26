import React, { useEffect, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { ModalSheet } from '@/components/modals/ModalSheet';
import type { PaymentMethod, Transaction, TxType } from '@/types/finance';
import { TX_CATEGORIES_BY_TYPE, getCategoryMeta } from '@/utils/categories';
import { haptic, todayISO } from '@/utils/format';

interface TransactionModalProps {
  open: boolean;
  editingTx: Transaction | null;
  initialType?: TxType;
  initialPayMethod?: PaymentMethod;
  onClose: () => void;
}

export function TransactionModal({
  open,
  editingTx,
  initialType = 'expense',
  initialPayMethod = 'cash',
  onClose
}: TransactionModalProps) {
  const { settings, creditCards, saveTransaction } = useFinance();

  const [txType, setTxType] = useState<TxType>(initialType);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialPayMethod);
  const [cardId, setCardId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingTx) {
      setTxType(editingTx.type);
      setDescription(editingTx.description || '');
      setAmount(String(Number(editingTx.amount || 0).toFixed(2)));
      setCategory(editingTx.category || 'General');
      setDate(editingTx.date || todayISO());
      setPaymentMethod(editingTx.paymentMethod || 'cash');
      setCardId(editingTx.cardId || creditCards[0]?.id || '');
      setNotes(editingTx.notes || '');
    } else {
      setTxType(initialType);
      setDescription('');
      setAmount('');
      setCategory('General');
      setDate(todayISO());
      setPaymentMethod(initialPayMethod);
      setCardId(creditCards[0]?.id || '');
      setNotes('');
    }
  }, [open, editingTx, initialType, initialPayMethod, creditCards]);

  const baseCategories = TX_CATEGORIES_BY_TYPE[txType];
  const categories = baseCategories.includes(category) ? [...baseCategories] : [...baseCategories, category];

  const handleSwitchType = (next: TxType) => {
    haptic();
    setTxType(next);
    if (!TX_CATEGORIES_BY_TYPE[next].includes(category)) {
      setCategory('General');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const desc = description.trim();
    const numAmt = parseFloat(amount);
    if (!desc) return setError('Please enter a description.');
    if (!numAmt || numAmt <= 0) return setError('Please enter a valid amount.');
    if (!date) return setError('Please select a date.');

    setSaving(true);
    try {
      await saveTransaction(
        {
          type: txType,
          description: desc,
          amount: numAmt,
          category,
          date,
          notes: notes.trim(),
          paymentMethod: txType === 'expense' ? paymentMethod : 'cash',
          cardId: txType === 'expense' && paymentMethod === 'credit' ? cardId || creditCards[0]?.id || null : null
        },
        editingTx?.id
      );
      onClose();
    } catch {
      setError('Failed to save transaction. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % categories.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + categories.length) % categories.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = categories.length - 1;
    else return;
    e.preventDefault();
    setCategory(categories[next]);
  };

  return (
    <ModalSheet open={open} title={editingTx ? 'Edit Transaction' : 'Add Transaction'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div className="type-toggle">
          <button
            type="button"
            className={`type-btn income${txType === 'income' ? ' active' : ''}`}
            onClick={() => handleSwitchType('income')}
          >
            Income
          </button>
          <button
            type="button"
            className={`type-btn expense${txType === 'expense' ? ' active' : ''}`}
            onClick={() => handleSwitchType('expense')}
          >
            Expense
          </button>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="tx-description">Description</label>
          <input
            type="text"
            id="tx-description"
            placeholder="e.g. Salary, Rent, Groceries..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="tx-amount">Amount</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input
              type="text"
              id="tx-amount"
              placeholder="0.00"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label id="tx-category-label">Category</label>
          <div className="tx-cat-grid" role="radiogroup" aria-labelledby="tx-category-label">
            {categories.map((cat, idx) => {
              const meta = getCategoryMeta(cat, txType);
              const isActive = cat === category;
              return (
                <button
                  key={cat}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  className={`tx-cat-tile${isActive ? ' active' : ''}`}
                  style={{ '--cat-color': meta.color, '--cat-bg': meta.bg } as React.CSSProperties}
                  onClick={() => {
                    haptic();
                    setCategory(cat);
                  }}
                  onKeyDown={(e) => handleCategoryKeyDown(e, idx)}
                >
                  <span className="tx-cat-tile-icon" aria-hidden="true">
                    {meta.icon}
                  </span>
                  <span className="tx-cat-tile-label">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="tx-date">Date</label>
          <input type="date" id="tx-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {txType === 'expense' && (
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label id="tx-pm-label">Payment Method</label>
            <div className="pm-toggle" role="radiogroup" aria-labelledby="tx-pm-label">
              {(
                [
                  {
                    id: 'cash',
                    label: 'Cash / Debit',
                    icon: 'M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z'
                  },
                  {
                    id: 'credit',
                    label: 'Credit Card',
                    icon: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z'
                  },
                  {
                    id: 'mykasih',
                    label: 'MyKasih',
                    icon: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z'
                  }
                ] as const
              ).map((pm) => {
                const isActive = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`pm-btn${isActive ? ' active' : ''}`}
                    onClick={() => {
                      haptic();
                      setPaymentMethod(pm.id);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d={pm.icon} />
                    </svg>
                    <span>{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {txType === 'expense' && paymentMethod === 'credit' && (
          <div className="input-group" id="tx-cc-select-group" style={{ marginBottom: 0 }}>
            <label id="tx-cc-label">Select Credit Card</label>
            {creditCards.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', padding: '0.4rem 0' }}>
                No cards registered yet. Add one in Wallet.
              </div>
            ) : (
              <div className="tx-cc-grid" role="radiogroup" aria-labelledby="tx-cc-label">
                {creditCards.map((card) => {
                  const isActive = (cardId || creditCards[0]?.id) === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`tx-cc-tile${isActive ? ' active' : ''}`}
                      onClick={() => {
                        haptic();
                        setCardId(card.id);
                      }}
                    >
                      <span className="tx-cc-tile-icon" aria-hidden="true">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                        </svg>
                      </span>
                      <span className="tx-cc-tile-name">{card.name}</span>
                      <svg className="tx-cc-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="tx-notes">Notes (optional)</label>
          <textarea
            id="tx-notes"
            placeholder="Any extra details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : editingTx ? 'Update Transaction' : 'Save Transaction'}
        </button>
      </form>
    </ModalSheet>
  );
}
