import { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { TransactionRow } from '@/components/TransactionRow';
import type { PageId, Transaction, WalletTabId } from '@/types/finance';
import { getCategoryMeta } from '@/utils/categories';
import { formatCurrency, formatMonthYear, haptic, shiftMonth, toMonthKey } from '@/utils/format';

interface DashboardPageProps {
  onNavigate: (page: PageId, walletTab?: WalletTabId) => void;
  onInspectTx: (tx: Transaction) => void;
  onDeleteTx: (tx: Transaction) => void;
}

export function DashboardPage({ onNavigate, onInspectTx, onDeleteTx }: DashboardPageProps) {
  const {
    transactions,
    settings,
    totalCardDebt,
    totalSavings,
    totalLoansRemaining,
    getCardNameById,
    toggleBalanceHidden
  } = useFinance();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [catOpen, setCatOpen] = useState(() => localStorage.getItem('swCategoryOpen') === 'true');

  const currency = settings.currency;
  const hidden = Boolean(settings.balanceHidden);
  const mask = (val: string) => (hidden ? '••••••' : val);

  const monthKey = toMonthKey(selectedYear, selectedMonth);
  const currentMonthKey = toMonthKey(now.getFullYear(), now.getMonth());
  const isCurrentMonth = monthKey === currentMonthKey;

  const { monthTxs, totalIncome, totalExpense, balance, categoryBreakdown } = useMemo(() => {
    const calcCashNet = (list: Transaction[]) => {
      const inc = list
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const cashExp = list
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.paymentMethod !== 'credit' &&
            !t.cardId &&
            t.paymentMethod !== 'mykasih' &&
            t.category !== 'Credit Card Payment'
        )
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const ccPay = list
        .filter((t) => t.type === 'expense' && t.category === 'Credit Card Payment')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      return { inc, cashExp, ccPay, net: inc - cashExp - ccPay };
    };

    const filtered = transactions.filter((t) => t.date && t.date.startsWith(monthKey));
    const selectedStats = calcCashNet(filtered);

    const totalExp = filtered
      .filter((t) => t.type === 'expense' && t.category !== 'Credit Card Payment')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const baseCarry = typeof settings.carryOverBalance === 'number' ? settings.carryOverBalance : 0;

    let carryForward = 0;
    if (isCurrentMonth) {
      carryForward = baseCarry;
    } else if (monthKey > currentMonthKey) {
      // Automatically carry forward current month (and any intervening months) into future months
      const interveningTxs = transactions.filter((t) => {
        if (!t.date) return false;
        const ym = t.date.slice(0, 7);
        return ym >= currentMonthKey && ym < monthKey;
      });
      carryForward = baseCarry + calcCashNet(interveningTxs).net;
    }

    const bal = carryForward + selectedStats.net;

    const catMap: Record<string, number> = {};
    filtered
      .filter((t) => t.type === 'expense' && t.category !== 'Credit Card Payment')
      .forEach((t) => {
        const c = t.category || 'Other';
        catMap[c] = (catMap[c] || 0) + (Number(t.amount) || 0);
      });

    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    return {
      monthTxs: filtered,
      totalIncome: selectedStats.inc,
      totalExpense: totalExp,
      balance: bal,
      categoryBreakdown: sortedCats
    };
  }, [transactions, monthKey, currentMonthKey, isCurrentMonth, settings.carryOverBalance]);

  const handleShiftMonth = (delta: number) => {
    haptic();
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
  };

  const handleToggleCat = () => {
    haptic();
    setCatOpen((prev) => {
      const next = !prev;
      localStorage.setItem('swCategoryOpen', next ? 'true' : 'false');
      return next;
    });
  };

  return (
    <section id="page-dashboard" className="page active">
      {/* Month Selector */}
      <div className="sw-month-bar" id="dash-month-bar">
        <button className="sw-month-arrow" type="button" onClick={() => handleShiftMonth(-1)} aria-label="Previous month">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="sw-month-label">{formatMonthYear(selectedYear, selectedMonth)}</span>
        <button className="sw-month-arrow" type="button" onClick={() => handleShiftMonth(1)} aria-label="Next month">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Emerald Hero Balance Card */}
      <div className="mob-hero-card sw-hero-card">
        <div className="sw-hero-top">
          <span className="sw-hero-title">Monthly Net Balance</span>
          <button
            type="button"
            className="mob-eye-btn sw-eye-btn"
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
            onClick={() => {
              haptic();
              void toggleBalanceHidden();
            }}
          >
            {hidden ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <div className="sw-hero-balance">{mask(formatCurrency(balance, currency))}</div>
        <div className="sw-hero-split">
          <div className="sw-hero-col">
            <span className="sw-hero-sub-label">Income</span>
            <span className="sw-hero-sub-val income">{mask(formatCurrency(totalIncome, currency))}</span>
          </div>
          <div className="sw-hero-col right">
            <span className="sw-hero-sub-label">Expenses</span>
            <span className="sw-hero-sub-val expense">{mask(formatCurrency(totalExpense, currency))}</span>
          </div>
        </div>
      </div>

      {/* 3-Column Mini Stats */}
      <div className="sw-mini-stats">
        <button type="button" className="sw-mini-card" onClick={() => { haptic(); onNavigate('wallet', 'cards'); }}>
          <span className="sw-mini-label">Credit Card</span>
          <span className="sw-mini-val debt">{mask(formatCurrency(totalCardDebt, currency))}</span>
        </button>
        <button type="button" className="sw-mini-card" onClick={() => { haptic(); onNavigate('wallet', 'savings'); }}>
          <span className="sw-mini-label">Savings</span>
          <span className="sw-mini-val savings">{mask(formatCurrency(totalSavings, currency))}</span>
        </button>
        <button type="button" className="sw-mini-card" onClick={() => { haptic(); onNavigate('wallet', 'loans'); }}>
          <span className="sw-mini-label">Loans</span>
          <span className="sw-mini-val loans">{mask(formatCurrency(totalLoansRemaining, currency))}</span>
        </button>
      </div>

      {/* Spending by Category Dropdown */}
      {categoryBreakdown.length > 0 && (
        <div className="sw-section">
          <div className={`sw-cat-dropdown-card${catOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="sw-cat-dropdown-header"
              aria-expanded={catOpen}
              onClick={handleToggleCat}
            >
              <div className="sw-cat-dropdown-left">
                <span className="sw-cat-dropdown-title">Spending by Category</span>
                <span className="sw-cat-dropdown-sub">
                  {categoryBreakdown.length} {categoryBreakdown.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
              <div className="sw-cat-dropdown-right">
                <span className="sw-cat-dropdown-total">{mask(formatCurrency(totalExpense, currency))}</span>
                <svg className="sw-cat-dropdown-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>
            <div className="sw-cat-dropdown-body">
              <div className="sw-cat-dropdown-inner">
                <div className="sw-cat-breakdown-list">
                  {categoryBreakdown.map(([cat, spent]) => {
                    const pct = totalExpense > 0 ? Math.round((spent / totalExpense) * 100) : 0;
                    const meta = getCategoryMeta(cat, 'expense');
                    return (
                      <div
                        key={cat}
                        className="sw-cat-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          haptic();
                          onNavigate('categories');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onNavigate('categories');
                          }
                        }}
                      >
                        <div className="sw-cat-row-top">
                          <span className="sw-cat-name">{cat}</span>
                          <span className="sw-cat-val">
                            {formatCurrency(spent, currency)} ({pct}%)
                          </span>
                        </div>
                        <div className="sw-cat-bar-track" style={{ background: meta.bg }}>
                          <div className="sw-cat-bar-fill" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions (Latest 3) */}
      <div className="sw-section">
        <div className="sw-section-row">
          <h2 className="sw-section-heading">Recent Transactions</h2>
          <button
            type="button"
            className="sw-see-all-btn"
            onClick={() => {
              haptic();
              onNavigate('transactions');
            }}
          >
            See all
          </button>
        </div>
        <div className="sw-recent-list">
          {monthTxs.length === 0 ? (
            <div className="sw-empty-card">
              <div className="sw-empty-title">No transactions yet</div>
              <div className="sw-empty-sub">Tap the + button below to add your salary, food, bills, or rent.</div>
            </div>
          ) : (
            monthTxs.slice(0, 3).map((tx) => (
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
      </div>
    </section>
  );
}
