import { useMemo, useState } from 'react';
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useFinance } from '@/context/FinanceContext';
import { getCategoryMeta } from '@/utils/categories';
import { formatCurrency, formatMonthYear, haptic, shiftMonth, toMonthKey } from '@/utils/format';

ChartJS.register(ArcElement, Tooltip);

export function CategoriesPage() {
  const { transactions, settings } = useFinance();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const currency = settings.currency;
  const monthKey = toMonthKey(selectedYear, selectedMonth);

  const { sorted, totalExpense } = useMemo(() => {
    const map: Record<string, { income: number; expense: number; count: number }> = {};
    transactions
      .filter((t) => t.date?.startsWith(monthKey) && t.category !== 'Credit Card Payment')
      .forEach((t) => {
        const cat = t.category || 'General';
        if (!map[cat]) map[cat] = { income: 0, expense: 0, count: 0 };
        map[cat][t.type] += Number(t.amount) || 0;
        map[cat].count += 1;
      });
    const list = Object.entries(map).sort((a, b) => b[1].expense - a[1].expense);
    const totalExp = list.reduce((s, [, v]) => s + v.expense, 0);
    return { sorted: list, totalExpense: totalExp };
  }, [transactions, monthKey]);

  const expenseItems = sorted.filter(([, v]) => v.expense > 0);
  const chartData = {
    labels: expenseItems.map(([cat]) => cat),
    datasets: [
      {
        data: expenseItems.map(([, v]) => v.expense),
        backgroundColor: expenseItems.map(([cat]) => getCategoryMeta(cat, 'expense').color),
        borderWidth: 0
      }
    ]
  };

  const handleShift = (delta: number) => {
    haptic();
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
  };

  return (
    <section id="page-categories" className="page active">
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

      {expenseItems.length > 0 && (
        <div className="section-card" style={{ padding: '1.1rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', width: 190, height: 190, margin: '0 auto 1rem' }}>
            <Doughnut
              data={chartData}
              options={{
                cutout: '68%',
                plugins: { legend: { display: false } }
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)' }}>Total Spent</span>
              <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem' }}>
                {formatCurrency(totalExpense, currency)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="sw-empty-card">
          <div className="sw-empty-title">No category data</div>
          <div className="sw-empty-sub">No transactions logged for {formatMonthYear(selectedYear, selectedMonth)}.</div>
        </div>
      ) : (
        <div className="categories-grid">
          {sorted.map(([cat, vals]) => {
            const meta = getCategoryMeta(cat, vals.expense > 0 ? 'expense' : 'income');
            const pct = totalExpense > 0 ? Math.round((vals.expense / totalExpense) * 100) : 0;
            return (
              <div key={cat} className="cat-card">
                <div className="cat-header">
                  <span className="cat-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span className="sw-tx-icon" style={{ width: 28, height: 28, background: meta.bg, color: meta.color }}>
                      {meta.icon}
                    </span>
                    {cat}
                  </span>
                  <span className="cat-count">
                    {vals.count} tx{vals.expense > 0 ? ` · ${pct}%` : ''}
                  </span>
                </div>
                <div className="cat-totals">
                  <span className="cat-income-val">+{formatCurrency(vals.income, currency)}</span>
                  <span className="cat-expense-val">-{formatCurrency(vals.expense, currency)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
