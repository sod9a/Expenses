import { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { TransactionRow } from '@/components/TransactionRow';
import type { Transaction } from '@/types/finance';
import { formatMonthYear, haptic, shiftMonth, toMonthKey } from '@/utils/format';

interface TransactionsPageProps {
  onInspectTx: (tx: Transaction) => void;
  onDeleteTx: (tx: Transaction) => void;
}

export function TransactionsPage({ onInspectTx, onDeleteTx }: TransactionsPageProps) {
  const { transactions, settings, getCardNameById } = useFinance();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const monthKey = toMonthKey(selectedYear, selectedMonth);
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date || !t.date.startsWith(monthKey)) return false;
      if (filter !== 'all' && t.type !== filter) return false;
      return true;
    });
  }, [transactions, monthKey, filter]);

  const handleShift = (delta: number) => {
    if (delta > 0 && isCurrentMonth) return;
    haptic();
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
  };

  return (
    <section id="page-transactions" className="page active">
      <div className="sw-month-bar">
        <button type="button" className="sw-month-arrow" onClick={() => handleShift(-1)} aria-label="Previous month">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="sw-month-label">{formatMonthYear(selectedYear, selectedMonth)}</span>
        <button
          type="button"
          className="sw-month-arrow"
          disabled={isCurrentMonth}
          style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
          onClick={() => handleShift(1)}
          aria-label="Next month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="sw-filter-row" role="tablist" aria-label="Filter transactions">
        {(['all', 'income', 'expense'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`filter-btn${filter === tab ? ' active' : ''}`}
            onClick={() => {
              haptic();
              setFilter(tab);
            }}
          >
            {tab === 'all' ? 'All' : tab === 'income' ? 'Income' : 'Expenses'}
          </button>
        ))}
      </div>

      <div className="sw-recent-list" style={{ marginTop: '0.85rem' }}>
        {filtered.length === 0 ? (
          <div className="sw-empty-card">
            <div className="sw-empty-title">No transactions found</div>
            <div className="sw-empty-sub">
              Nothing recorded for {formatMonthYear(selectedYear, selectedMonth)}
              {filter !== 'all' ? ` under ${filter}` : ''}.
            </div>
          </div>
        ) : (
          filtered.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              currency={settings.currency}
              cardName={tx.cardId ? getCardNameById(tx.cardId) : undefined}
              onInspect={onInspectTx}
              onDelete={onDeleteTx}
            />
          ))
        )}
      </div>
    </section>
  );
}
