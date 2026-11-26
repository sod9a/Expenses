import { useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/utils/format';

export function MonthlyReportPage() {
  const { transactions, settings } = useFinance();
  const currency = settings.currency;

  const months = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    transactions
      .filter((t) => t.date && t.category !== 'Credit Card Payment')
      .forEach((t) => {
        const key = t.date.slice(0, 7);
        if (!map[key]) map[key] = { income: 0, expense: 0 };
        map[key][t.type] += Number(t.amount) || 0;
      });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12);
  }, [transactions]);

  const maxVal = useMemo(
    () => Math.max(1, ...months.flatMap(([, v]) => [v.income, v.expense])),
    [months]
  );

  return (
    <section id="page-monthly" className="page active">
      {months.length === 0 ? (
        <div className="sw-empty-card">
          <div className="sw-empty-title">No monthly history yet</div>
          <div className="sw-empty-sub">Add transactions to see month-by-month income and expense trends.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {months.map(([ym, vals]) => {
            const [y, m] = ym.split('-').map(Number);
            const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const net = vals.income - vals.expense;
            return (
              <div key={ym} className="section-card" style={{ padding: '0.95rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <strong style={{ fontFamily: 'Outfit, sans-serif' }}>{label}</strong>
                  <span style={{ fontWeight: 700, color: net >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                    {net >= 0 ? '+' : ''}
                    {formatCurrency(net, currency)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <span style={{ width: 52, color: 'var(--ink-secondary)' }}>Income</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${(vals.income / maxVal) * 100}%`, height: '100%', background: 'var(--income)' }} />
                    </div>
                    <span style={{ width: 86, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(vals.income, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <span style={{ width: 52, color: 'var(--ink-secondary)' }}>Expense</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${(vals.expense / maxVal) * 100}%`, height: '100%', background: 'var(--expense)' }} />
                    </div>
                    <span style={{ width: 86, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(vals.expense, currency)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
