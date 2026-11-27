import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { TransactionRow } from '@/components/TransactionRow';
import type { Transaction } from '@/types/finance';
import { formatCurrency, formatMonthYear, haptic, shiftMonth, toMonthKey } from '@/utils/format';

interface TransactionsPageProps {
  onInspectTx: (tx: Transaction) => void;
  onDeleteTx: (tx: Transaction) => void;
}

export function TransactionsPage({ onInspectTx, onDeleteTx }: TransactionsPageProps) {
  const {
    transactions,
    checklist,
    settings,
    getCardNameById,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem
  } = useFinance();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'list'>('all');

  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  const currency = settings.currency;
  const monthKey = toMonthKey(selectedYear, selectedMonth);
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const filtered = useMemo(() => {
    if (filter === 'list') return [];
    return transactions.filter((t) => {
      if (!t.date || !t.date.startsWith(monthKey)) return false;
      if (filter !== 'all' && t.type !== filter) return false;
      return true;
    });
  }, [transactions, monthKey, filter]);

  const sortedChecklist = useMemo(() => {
    return [...checklist].sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return aMs - bMs;
    });
  }, [checklist]);

  const paidCount = checklist.filter((c) => c.paid).length;
  const totalChecklistAmt = checklist.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const unpaidChecklistAmt = checklist
    .filter((c) => !c.paid)
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const checklistPct = checklist.length > 0 ? Math.round((paidCount / checklist.length) * 100) : 0;

  const handleShift = (delta: number) => {
    if (delta > 0 && isCurrentMonth) return;
    haptic();
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = itemName.trim();
    if (!name || addingItem) return;
    const amt = parseFloat(itemAmount) || 0;
    setAddingItem(true);
    try {
      await addChecklistItem(name, amt);
      setItemName('');
      setItemAmount('');
    } finally {
      setAddingItem(false);
    }
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

      <div className="sw-filter-chips" role="tablist" aria-label="Filter transactions">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'income', label: 'Income' },
            { id: 'expense', label: 'Expenses' },
            { id: 'list', label: 'List' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`sw-chip-btn${filter === tab.id ? ' active' : ''}`}
            onClick={() => {
              haptic();
              setFilter(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filter === 'list' ? (
        <div className="section-card checklist-card open" style={{ marginTop: '0.5rem' }}>
          <div className="checklist-header" style={{ cursor: 'default', padding: '1rem 1rem 0.85rem' }}>
            <div className="checklist-header-left">
              <div className="checklist-icon" style={{ background: 'rgba(15, 118, 110, 0.14)', color: 'var(--primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <div>
                <h2>Payment Checklist</h2>
                <span className="checklist-subtitle">
                  {paidCount} of {checklist.length} paid
                  {unpaidChecklistAmt > 0 ? ` · ${formatCurrency(unpaidChecklistAmt, currency)} left` : checklist.length > 0 ? ' · All paid' : ''}
                </span>
              </div>
            </div>
            <div className="checklist-header-right">
              <span className="checklist-percentage">{checklistPct}%</span>
            </div>
          </div>

          <div className="checklist-progress-wrap">
            <div className="checklist-progress-bar" style={{ width: `${checklistPct}%` }} />
          </div>

          <div className="checklist-body-inner">
            <div className="checklist-list">
              {sortedChecklist.length === 0 ? (
                <div className="checklist-empty">
                  No payments listed for this month yet. Add bills or commitments below to track them.
                </div>
              ) : (
                sortedChecklist.map((item) => (
                  <div key={item.id} className={`checklist-item${item.paid ? ' paid' : ''}`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.paid}
                      aria-label={`Mark ${item.name} as ${item.paid ? 'unpaid' : 'paid'}`}
                      className={`checklist-check${item.paid ? ' checked' : ''}`}
                      onClick={() => {
                        haptic();
                        void toggleChecklistItem(item);
                      }}
                    />
                    <div
                      className="checklist-item-info"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        haptic();
                        void toggleChecklistItem(item);
                      }}
                    >
                      <div className="checklist-item-name">{item.name}</div>
                    </div>
                    {Number(item.amount) > 0 && (
                      <span className="checklist-item-amount">{formatCurrency(item.amount, currency)}</span>
                    )}
                    <button
                      type="button"
                      className="checklist-delete-btn"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => {
                        haptic();
                        void deleteChecklistItem(item.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            {totalChecklistAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 1rem 0.25rem', fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                <span>Total listed</span>
                <strong style={{ color: 'var(--ink-primary)' }}>{formatCurrency(totalChecklistAmt, currency)}</strong>
              </div>
            )}

            <form className="checklist-add-form" onSubmit={handleAddChecklist} style={{ flexWrap: 'wrap' }}>
              <input
                type="text"
                className="checklist-input"
                placeholder="e.g. Rent, Unifi, Netflix..."
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
              <div className="checklist-amount-wrap">
                <span className="checklist-currency">{currency}</span>
                <input
                  type="text"
                  className="checklist-input checklist-amount-input"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={itemAmount}
                  onChange={(e) => setItemAmount(e.target.value)}
                />
              </div>
              <button type="submit" className="checklist-add-btn" disabled={addingItem}>
                {addingItem ? 'Adding…' : '+ Add'}
              </button>
            </form>
          </div>
        </div>
      ) : (
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
                currency={currency}
                cardName={tx.cardId ? getCardNameById(tx.cardId) : undefined}
                onInspect={onInspectTx}
                onDelete={onDeleteTx}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
