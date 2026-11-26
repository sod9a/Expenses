import React, { useEffect, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';
import type { BudgetItem } from '@/types/finance';
import { BUDGET_CATEGORIES } from '@/utils/categories';
import { formatCurrency } from '@/utils/format';

interface BudgetModalProps {
  open: boolean;
  editingBudget: BudgetItem | null;
  onClose: () => void;
}

export function BudgetModal({ open, editingBudget, onClose }: BudgetModalProps) {
  const { settings, saveBudget } = useFinance();
  const [category, setCategory] = useState<string>(BUDGET_CATEGORIES[0]);
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingBudget) {
      setCategory(editingBudget.category);
      setLimit(String(Number(editingBudget.limit || 0).toFixed(2)));
    } else {
      setCategory(BUDGET_CATEGORIES[0]);
      setLimit('');
    }
  }, [open, editingBudget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(limit);
    if (!num || num <= 0) return setError('Please enter a valid monthly limit.');
    setSaving(true);
    try {
      await saveBudget(category, num, editingBudget?.id);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={open} title={editingBudget ? 'Edit Budget' : 'Set Budget'} onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="budget-cat">Category</label>
          <select id="budget-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="budget-lim">Monthly Limit</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="budget-lim" type="text" placeholder="0.00" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Budget'}
        </button>
      </form>
    </ModalSheet>
  );
}

interface BudgetChartModalProps {
  data: { budget: BudgetItem; spent: number } | null;
  onClose: () => void;
}

export function BudgetChartModal({ data, onClose }: BudgetChartModalProps) {
  const { settings } = useFinance();
  if (!data) return null;

  const { budget, spent } = data;
  const limit = Number(budget.limit) || 1;
  const remaining = Math.max(0, limit - spent);
  const pct = Math.min((spent / limit) * 100, 100);
  const circumference = 2 * Math.PI * 80;
  const dash = (pct / 100) * circumference;
  const isOver = spent > limit;

  return (
    <ModalSheet open={Boolean(data)} title={`${budget.category} Budget`} onClose={onClose} small>
      <div style={{ textAlign: 'center' }}>
        <div className="budget-donut-wrap">
          <svg viewBox="0 0 200 200" width="180" height="180">
            <circle cx="100" cy="100" r="80" fill="none" stroke="var(--bg-elevated)" strokeWidth="20" />
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={isOver ? 'var(--expense)' : 'var(--primary-ink)'}
              strokeWidth="20"
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <div className="budget-donut-center">
            <span className="budget-donut-pct">{Math.round((spent / limit) * 100)}%</span>
            <span className="budget-donut-sub">used</span>
          </div>
        </div>

        <div className="budget-chart-legend">
          <div className="budget-legend-row">
            <span className="budget-legend-label">Spent</span>
            <span className="budget-legend-val">{formatCurrency(spent, settings.currency)}</span>
          </div>
          <div className="budget-legend-row">
            <span className="budget-legend-label">Remaining</span>
            <span className="budget-legend-val">{formatCurrency(remaining, settings.currency)}</span>
          </div>
          <div className="budget-legend-row total-row">
            <span className="budget-legend-label">Monthly Limit</span>
            <span className="budget-legend-val">{formatCurrency(limit, settings.currency)}</span>
          </div>
        </div>
      </div>
    </ModalSheet>
  );
}
