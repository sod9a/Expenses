import React, { useEffect, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';
import type { SavingsColor, SavingsGoal } from '@/types/finance';
import {
  SAVINGS_COLORS,
  SAVINGS_ICON_KEYS,
  normalizeSavingsIconKey,
  renderSavingsIcon
} from '@/utils/categories';
import { formatCurrency, formatDisplayDate, haptic, todayISO } from '@/utils/format';

interface SavingsGoalModalProps {
  open: boolean;
  editingGoal: SavingsGoal | null;
  onClose: () => void;
}

export function SavingsGoalModal({ open, editingGoal, onClose }: SavingsGoalModalProps) {
  const { settings, saveSavingsGoal } = useFinance();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('0');
  const [icon, setIcon] = useState('goal');
  const [color, setColor] = useState<SavingsColor>('emerald');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingGoal) {
      setName(editingGoal.name || '');
      setTarget(String(Number(editingGoal.target || 0).toFixed(2)));
      setSaved(String(Number(editingGoal.saved || 0).toFixed(2)));
      setIcon(normalizeSavingsIconKey(editingGoal.emoji));
      setColor(editingGoal.color || 'emerald');
      setDeadline(editingGoal.deadline || '');
    } else {
      setName('');
      setTarget('');
      setSaved('0');
      setIcon('goal');
      setColor('emerald');
      setDeadline('');
    }
  }, [open, editingGoal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    const numTarget = parseFloat(target);
    const numSaved = parseFloat(saved) || 0;
    if (!trimmed) return setError('Please enter a goal name.');
    if (!numTarget || numTarget <= 0) return setError('Please enter a valid target amount.');

    setSaving(true);
    try {
      await saveSavingsGoal(
        { name: trimmed, target: numTarget, saved: numSaved, emoji: icon, color, deadline },
        editingGoal?.id
      );
      onClose();
    } catch {
      setError('Failed to save savings goal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={open} title={editingGoal ? 'Edit Savings Goal' : 'New Savings Goal'} onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="sav-name">Goal Name</label>
          <input id="sav-name" type="text" placeholder="e.g. Emergency Fund, Japan Trip" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="sav-target">Target Amount</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="sav-target" type="text" placeholder="0.00" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="sav-saved">Current Saved</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="sav-saved" type="text" placeholder="0.00" inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {SAVINGS_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`tx-cat-tile${icon === k ? ' active' : ''}`}
                style={{ minHeight: 38, minWidth: 38, padding: '0.35rem' }}
                onClick={() => {
                  haptic();
                  setIcon(k);
                }}
              >
                {renderSavingsIcon(k)}
              </button>
            ))}
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Color</label>
          <div className="cc-color-picker">
            {SAVINGS_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={c.label}
                className={`cc-color-swatch${color === c.key ? ' active' : ''}`}
                style={{ background: c.color }}
                onClick={() => {
                  haptic();
                  setColor(c.key);
                }}
              />
            ))}
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="sav-deadline">Target Date (optional)</label>
          <input id="sav-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Goal'}
        </button>
      </form>
    </ModalSheet>
  );
}

interface SavingsTopupModalProps {
  goal: SavingsGoal | null;
  onClose: () => void;
}

export function SavingsTopupModal({ goal, onClose }: SavingsTopupModalProps) {
  const { settings, adjustSavingsGoal } = useFinance();
  const [action, setAction] = useState<'add' | 'withdraw'>('add');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!goal) return;
    setAction('add');
    setAmount('');
    setDate(todayISO());
    setNote('');
    setError('');
  }, [goal]);

  if (!goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (!num || num <= 0) return setError('Please enter a valid amount.');
    setSaving(true);
    try {
      await adjustSavingsGoal(goal.id, action, num, date, note.trim());
      onClose();
    } catch {
      setError('Failed to update savings goal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={Boolean(goal)} title={`Update ${goal.name}`} onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <div className="type-toggle">
          <button type="button" className={`type-btn income${action === 'add' ? ' active' : ''}`} onClick={() => setAction('add')}>
            Deposit
          </button>
          <button type="button" className={`type-btn expense${action === 'withdraw' ? ' active' : ''}`} onClick={() => setAction('withdraw')}>
            Withdraw
          </button>
        </div>
        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="sav-adj-amt">Amount</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="sav-adj-amt" type="text" placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="sav-adj-date">Date</label>
          <input id="sav-adj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="sav-adj-note">Note (optional)</label>
          <input id="sav-adj-note" type="text" placeholder="e.g. Monthly transfer" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : action === 'withdraw' ? 'Record Withdrawal' : 'Add Deposit'}
        </button>
      </form>
    </ModalSheet>
  );
}

interface SavingsDetailsModalProps {
  goalId: string | null;
  onClose: () => void;
}

export function SavingsDetailsModal({ goalId, onClose }: SavingsDetailsModalProps) {
  const { tabung, settings, deleteSavingsHistoryItem } = useFinance();
  const goal = goalId ? tabung.find((t) => t.id === goalId) || null : null;
  if (!goal) return null;

  const history = goal.history || [];

  return (
    <ModalSheet open={Boolean(goal)} title={goal.name} onClose={onClose} small>
      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-elevated)', padding: '0.85rem 1rem', borderRadius: 12 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>Saved</div>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', color: 'var(--income)' }}>
            {formatCurrency(goal.saved, settings.currency)}
          </strong>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>Target</div>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>
            {formatCurrency(goal.target, settings.currency)}
          </strong>
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink-secondary)', marginTop: '0.25rem' }}>
        History ({history.length})
      </div>
      {history.length === 0 ? (
        <div style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>No deposits or withdrawals recorded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {history.map((item, idx) => {
            const isWithdraw = item.type === 'withdraw';
            return (
              <div
                key={`${item.date}-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-elevated)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 10
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{item.note || (isWithdraw ? 'Withdrawal' : 'Deposit')}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-secondary)' }}>{formatDisplayDate(item.date)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ color: isWithdraw ? 'var(--expense)' : 'var(--income)' }}>
                    {isWithdraw ? '-' : '+'}
                    {formatCurrency(item.amount, settings.currency)}
                  </strong>
                  <button
                    type="button"
                    className="sw-budget-icon-btn danger"
                    aria-label="Delete history entry"
                    onClick={() => void deleteSavingsHistoryItem(goal.id, idx)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalSheet>
  );
}
