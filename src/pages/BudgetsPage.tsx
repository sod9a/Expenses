import { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import type { BudgetItem } from '@/types/finance';
import { getCategoryMeta } from '@/utils/categories';
import { formatCurrency, formatMonthYear, haptic, shiftMonth, toMonthKey } from '@/utils/format';

interface BudgetsPageProps {
  onOpenBudgetModal: (budget?: BudgetItem | null) => void;
  onOpenBudgetChart: (budget: BudgetItem, spent: number) => void;
}

export function BudgetsPage({ onOpenBudgetModal, onOpenBudgetChart }: BudgetsPageProps) {
  const { budgets, transactions, settings, deleteBudget } = useFinance();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const currency = settings.currency;
  const monthKey = toMonthKey(selectedYear, selectedMonth);

  const { rows, totalLimit, totalSpent } = useMemo(() => {
    const monthExpenses = transactions.filter(
      (t) => t.type === 'expense' && t.category !== 'Credit Card Payment' && t.date?.startsWith(monthKey)
    );

    const spentMap: Record<string, number> = {};
    monthExpenses.forEach((t) => {
      const cat = t.category || 'Other';
      spentMap[cat] = (spentMap[cat] || 0) + (Number(t.amount) || 0);
    });

    const list = budgets.map((b) => {
      const spent = spentMap[b.category] || 0;
      const limit = Number(b.limit) || 0;
      const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
      return { budget: b, spent, limit, pct };
    });

    const tLimit = list.reduce((s, r) => s + r.limit, 0);
    const tSpent = list.reduce((s, r) => s + r.spent, 0);

    return { rows: list, totalLimit: tLimit, totalSpent: tSpent };
  }, [budgets, transactions, monthKey]);

  const remaining = totalLimit - totalSpent;
  const overallPct = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;

  const handleShift = (delta: number) => {
    haptic();
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
  };

  return (
    <section id="page-budgets" className="page active">
      <div className="sw-month-bar">
        <button type="button" className="sw-month-arrow" onClick={() => handleShift(-1)} aria-label="Previous month">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="sw-month-label">{formatMonthYear(selectedYear, selectedMonth)}</span>
        <button type="button" className="sw-month-arrow" onClick={() => handleShift(1)} aria-label="Next month">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Overall Monthly Budget Card */}
      <div className="sw-budget-summary-card">
        <div className="sw-budget-summary-top">
          <span className="sw-budget-summary-title">Monthly Budget</span>
          <button
            type="button"
            className="wallet-add-pill"
            style={{ minHeight: 38, padding: '0.4rem 0.95rem', fontSize: '0.82rem' }}
            onClick={() => {
              haptic();
              onOpenBudgetModal(null);
            }}
          >
            + Add Budget
          </button>
        </div>
        <div className={`sw-budget-summary-ratio ${totalSpent > totalLimit ? 'danger' : overallPct >= 80 ? 'warn' : 'safe'}`}>
          {formatCurrency(totalSpent, currency)} / {formatCurrency(totalLimit, currency)}
        </div>
        <div className="sw-budget-track large">
          <div
            className={`sw-budget-fill${totalSpent > totalLimit ? ' over' : overallPct >= 80 ? ' warn' : ''}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className={`sw-budget-summary-rem${remaining < 0 ? ' danger' : ''}`}>
          {totalLimit === 0
            ? 'No monthly budgets set yet'
            : remaining >= 0
              ? `${formatCurrency(remaining, currency)} remaining this month`
              : `Over budget by ${formatCurrency(-remaining, currency)}`}
        </div>
      </div>

      {/* Per-Category Budget Cards */}
      <div className="sw-budget-list" style={{ marginTop: '0.9rem' }}>
        {rows.length === 0 ? (
          <div className="sw-empty-card">
            <div className="sw-empty-title">No budgets configured</div>
            <div className="sw-empty-sub">Tap + Add Budget above to set spending limits by category.</div>
          </div>
        ) : (
          rows.map(({ budget, spent, limit, pct }) => {
            const meta = getCategoryMeta(budget.category, 'expense');
            const isOver = spent > limit;
            return (
              <div
                key={budget.id}
                className="sw-budget-card"
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptic();
                  onOpenBudgetChart(budget, spent);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenBudgetChart(budget, spent);
                  }
                }}
              >
                <div className="sw-budget-top">
                  <div className="sw-budget-icon" style={{ background: meta.bg, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="sw-budget-info">
                    <div className="sw-budget-name">{budget.category}</div>
                    <div className="sw-budget-sub">
                      {formatCurrency(spent, currency)} of {formatCurrency(limit, currency)}
                    </div>
                  </div>
                  <div className="sw-budget-actions">
                    <button
                      type="button"
                      className="sw-budget-icon-btn"
                      aria-label={`Edit ${budget.category} budget`}
                      onClick={(e) => {
                        e.stopPropagation();
                        haptic();
                        onOpenBudgetModal(budget);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="sw-budget-icon-btn danger"
                      aria-label={`Delete ${budget.category} budget`}
                      onClick={(e) => {
                        e.stopPropagation();
                        haptic();
                        if (window.confirm(`Delete budget for ${budget.category}?`)) {
                          void deleteBudget(budget.id);
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="sw-budget-track" style={{ marginTop: '0.65rem' }}>
                  <div
                    className={`sw-budget-fill${isOver ? ' over' : pct >= 80 ? ' warn' : ''}`}
                    style={{ width: `${pct}%`, background: isOver ? 'var(--expense)' : meta.color }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
