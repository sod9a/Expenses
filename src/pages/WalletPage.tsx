import { useFinance } from '@/context/FinanceContext';
import type { CreditCard, LoanItem, SavingsGoal, WalletTabId } from '@/types/finance';
import { LOAN_COLORS, SAVINGS_COLORS, renderLoanIcon, renderSavingsIcon } from '@/utils/categories';
import { formatCurrency, haptic } from '@/utils/format';

interface WalletPageProps {
  activeTab: WalletTabId;
  onChangeTab: (tab: WalletTabId) => void;
  onOpenCardModal: (card?: CreditCard | null) => void;
  onOpenPayCardModal: (cardId: string) => void;
  onAddMyKasihTx: () => void;
  onEditMyKasih: () => void;
  onOpenSavingsModal: (goal?: SavingsGoal | null) => void;
  onOpenSavingsTopup: (goal: SavingsGoal) => void;
  onOpenSavingsDetails: (goal: SavingsGoal) => void;
  onOpenLoanModal: (loan?: LoanItem | null) => void;
  onOpenLoanPay: (loan: LoanItem) => void;
  onOpenLoanDetails: (loan: LoanItem) => void;
}

export function WalletPage({
  activeTab,
  onChangeTab,
  onOpenCardModal,
  onOpenPayCardModal,
  onAddMyKasihTx,
  onEditMyKasih,
  onOpenSavingsModal,
  onOpenSavingsTopup,
  onOpenSavingsDetails,
  onOpenLoanModal,
  onOpenLoanPay,
  onOpenLoanDetails
}: WalletPageProps) {
  const {
    creditCards,
    tabung,
    loans,
    settings,
    getCardLimit,
    getCardDueDay,
    getCardColor,
    getCardOutstanding,
    totalCardDebt,
    totalCardLimit,
    totalSavings,
    totalLoansRemaining,
    mykasihBalance,
    mykasihSpentThisMonth,
    deleteCreditCard,
    deleteSavingsGoal,
    deleteLoan
  } = useFinance();

  const currency = settings.currency;
  const mykasihAllowance = Number(settings.mykasihAllowance ?? 50);
  const mykasihUsedPct = mykasihAllowance > 0 ? Math.min((mykasihSpentThisMonth / mykasihAllowance) * 100, 100) : 0;

  // Savings overview totals
  const totalSavingsTarget = tabung.reduce((s, t) => s + (Number(t.target) || 0), 0);
  const completedGoals = tabung.filter((t) => (Number(t.saved) || 0) >= (Number(t.target) || 1)).length;
  const activeGoals = Math.max(0, tabung.length - completedGoals);
  const savingsPct = totalSavingsTarget > 0 ? Math.min((totalSavings / totalSavingsTarget) * 100, 100) : 0;

  // Loans overview totals
  const totalLoanPrincipal = loans.reduce((s, l) => s + (Number(l.total) || 0), 0);
  const totalLoanPaid = loans.reduce((s, l) => s + Math.min(Number(l.total) || 0, Number(l.paid) || 0), 0);
  const activeLoans = loans.filter((l) => (Number(l.paid) || 0) < (Number(l.total) || 1));
  const monthlyCommitment = activeLoans.reduce((s, l) => s + (Number(l.monthlyInstallment) || 0), 0);
  const loanPaidPct = totalLoanPrincipal > 0 ? Math.min((totalLoanPaid / totalLoanPrincipal) * 100, 100) : 0;

  return (
    <section id="page-wallet" className="page active">
      {/* 3-Tab Sub-Navigation */}
      <div className="wallet-tabs" role="tablist" aria-label="Wallet sections">
        {(
          [
            { id: 'cards', label: 'Credit Cards' },
            { id: 'savings', label: 'Savings' },
            { id: 'loans', label: 'Loans' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`wallet-tab-${tab.id}`}
            className={`wallet-tab${activeTab === tab.id ? ' active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => {
              haptic();
              onChangeTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Credit Cards Panel ─────────────────────────────────────────── */}
      {activeTab === 'cards' && (
        <div className="wallet-panel active" role="tabpanel">
          <div className="wallet-summary-row">
            <div className="wallet-summary-left">
              <span className="wallet-summary-label">Total Card Debt</span>
              <strong className="wallet-summary-debt">{formatCurrency(totalCardDebt, currency)}</strong>
              <span className="wallet-summary-sub">Total Limit: {formatCurrency(totalCardLimit, currency)}</span>
            </div>
            <button
              type="button"
              className="wallet-add-pill"
              onClick={() => {
                haptic();
                onOpenCardModal(null);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Card</span>
            </button>
          </div>

          <div className="wallet-cc-list">
            {creditCards.length === 0 ? (
              <div className="sw-empty-card">
                <div className="sw-empty-title">No credit cards yet</div>
                <div className="sw-empty-sub">Tap + Add Card above to register your first credit card.</div>
              </div>
            ) : (
              creditCards.map((card, idx) => {
                const outstanding = getCardOutstanding(card.id);
                const limit = getCardLimit(card);
                const available = Math.max(0, limit - outstanding);
                const pct = limit > 0 ? Math.min((outstanding / limit) * 100, 100) : 0;
                const dueDay = getCardDueDay(card);
                const last4 = card.last4 && /^\d{1,4}$/.test(String(card.last4)) ? String(card.last4).padStart(4, '0') : '0000';
                const color = getCardColor(card, idx);

                return (
                  <article key={card.id} className="wallet-cc-card">
                    <div
                      className={`wallet-cc-face wallet-cc-theme-${color}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit ${card.name}`}
                      onClick={() => {
                        haptic();
                        onOpenCardModal(card);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          haptic();
                          onOpenCardModal(card);
                        }
                      }}
                    >
                      <div className="wallet-cc-top">
                        <div className="wallet-cc-brand">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="2" y="5" width="20" height="14" rx="2.5" />
                            <line x1="2" y1="10" x2="22" y2="10" />
                          </svg>
                          <span className="wallet-cc-name">{card.name || 'Card'}</span>
                        </div>
                        <span className="wallet-cc-last4">•••• {last4}</span>
                      </div>

                      <div className="wallet-cc-balances">
                        <div className="wallet-cc-bal-col">
                          <span className="wallet-cc-bal-label">Current Balance</span>
                          <strong className="wallet-cc-bal-val">{formatCurrency(outstanding, currency)}</strong>
                        </div>
                        <div className="wallet-cc-bal-col right">
                          <span className="wallet-cc-bal-label">Available</span>
                          <strong className="wallet-cc-avail-val">{formatCurrency(available, currency)}</strong>
                        </div>
                      </div>

                      <div className="wallet-cc-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                        <div className="wallet-cc-fill" style={{ width: `${pct.toFixed(1)}%` }} />
                        <span className="wallet-cc-dot" aria-hidden="true" />
                      </div>

                      <div className="wallet-cc-meta">
                        <span>
                          Limit: {formatCurrency(limit, currency)} ({pct.toFixed(0)}% used)
                        </span>
                        <span>Due: Day {dueDay}</span>
                      </div>
                    </div>

                    <div className="wallet-cc-footer">
                      <button
                        type="button"
                        className="wallet-pay-btn"
                        onClick={() => {
                          haptic();
                          onOpenPayCardModal(card.id);
                        }}
                      >
                        Pay Card Bill
                      </button>
                      <button
                        type="button"
                        className="wallet-del-btn"
                        aria-label={`Delete ${card.name}`}
                        title="Delete card"
                        onClick={() => {
                          haptic();
                          if (window.confirm(`Delete "${card.name}"? Past transactions linked to this card will stay in your history.`)) {
                            void deleteCreditCard(card.id);
                          }
                        }}
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Allowance / MyKasih Card */}
          <div className="wallet-section-subhead">Allowance</div>
          <article className="wallet-cc-card">
            <div
              className="wallet-cc-face wallet-cc-theme-mykasih"
              role="button"
              tabIndex={0}
              aria-label="Edit MyKasih settings"
              onClick={() => {
                haptic();
                onEditMyKasih();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  haptic();
                  onEditMyKasih();
                }
              }}
            >
              <div className="wallet-cc-top">
                <div className="wallet-cc-brand">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 12 20 22 4 22 4 12" />
                    <rect x="2" y="7" width="20" height="5" />
                    <line x1="12" y1="22" x2="12" y2="7" />
                    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                  </svg>
                  <span className="wallet-cc-name">MyKasih</span>
                </div>
                <span className="wallet-cc-last4">Monthly Aid</span>
              </div>

              <div className="wallet-cc-balances">
                <div className="wallet-cc-bal-col">
                  <span className="wallet-cc-bal-label">Available Balance</span>
                  <strong className="wallet-cc-bal-val">{formatCurrency(mykasihBalance, currency)}</strong>
                </div>
                <div className="wallet-cc-bal-col right">
                  <span className="wallet-cc-bal-label">Spent This Month</span>
                  <strong className="wallet-cc-avail-val">{formatCurrency(mykasihSpentThisMonth, currency)}</strong>
                </div>
              </div>

              <div className="wallet-cc-track" role="progressbar" aria-valuenow={Math.round(mykasihUsedPct)} aria-valuemin={0} aria-valuemax={100}>
                <div className="wallet-cc-fill" style={{ width: `${mykasihUsedPct.toFixed(1)}%` }} />
                <span className="wallet-cc-dot" aria-hidden="true" />
              </div>

              <div className="wallet-cc-meta">
                <span>Allowance: {formatCurrency(mykasihAllowance, currency)}/mo</span>
                <span>{mykasihUsedPct.toFixed(0)}% used</span>
              </div>
            </div>

            <div className="wallet-cc-footer">
              <button
                type="button"
                className="wallet-pay-btn"
                onClick={() => {
                  haptic();
                  onAddMyKasihTx();
                }}
              >
                + Add MyKasih Expense
              </button>
              <button
                type="button"
                className="wallet-del-btn"
                aria-label="Edit MyKasih settings"
                title="Edit MyKasih"
                onClick={() => {
                  haptic();
                  onEditMyKasih();
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          </article>
        </div>
      )}

      {/* ── Savings Panel ──────────────────────────────────────────────── */}
      {activeTab === 'savings' && (
        <div className="wallet-panel active" role="tabpanel">
          <div className="savings-overview-card">
            <div className="wallet-summary-row" style={{ marginBottom: '0.75rem' }}>
              <div className="wallet-summary-left">
                <span className="wallet-summary-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem' }}>
                  Total Saved
                </span>
                <strong className="wallet-summary-savings">{formatCurrency(totalSavings, currency)}</strong>
                <span className="wallet-summary-sub">
                  {totalSavingsTarget > 0 ? `of ${formatCurrency(totalSavingsTarget, currency)} target` : 'No target set yet'}
                </span>
              </div>
              <button
                type="button"
                className="wallet-add-pill"
                onClick={() => {
                  haptic();
                  onOpenSavingsModal(null);
                }}
              >
                + Add Goal
              </button>
            </div>
            <div className="sw-budget-track">
              <div className="sw-budget-fill" style={{ width: `${savingsPct.toFixed(1)}%`, background: 'var(--income)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.76rem', color: 'var(--ink-secondary)' }}>
              <span>
                {activeGoals} active{completedGoals > 0 ? ` · ${completedGoals} completed` : ''}
              </span>
              <span style={{ color: 'var(--primary-ink)', fontWeight: 700 }}>{savingsPct.toFixed(0)}% achieved</span>
            </div>
          </div>

          <div className="savings-goals-grid" style={{ marginTop: '0.9rem' }}>
            {tabung.length === 0 ? (
              <div className="sw-empty-card">
                <div className="sw-empty-title">No savings goals yet</div>
                <div className="sw-empty-sub">Tap + Add Goal above to start tracking your savings targets.</div>
              </div>
            ) : (
              tabung.map((goal) => {
                const saved = Number(goal.saved) || 0;
                const target = Number(goal.target) || 1;
                const pct = Math.min((saved / target) * 100, 100);
                const remaining = Math.max(0, target - saved);
                const themeKey = SAVINGS_COLORS.some((c) => c.key === goal.color) ? goal.color! : 'emerald';

                return (
                  <article
                    key={goal.id}
                    className={`tabung-card${remaining <= 0 ? ' is-completed' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      haptic();
                      onOpenSavingsDetails(goal);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenSavingsDetails(goal);
                      }
                    }}
                  >
                    <div className="tabung-card-top">
                      <div className={`tabung-icon-badge theme-${themeKey}`}>
                        {renderSavingsIcon(goal.emoji)}
                      </div>
                      <div className="tabung-title-wrap">
                        <div className="tabung-title-row">
                          <span className="tabung-name">{goal.name}</span>
                        </div>
                        <span className="tabung-sub-status">
                          {remaining > 0 ? `${formatCurrency(remaining, currency)} left to target` : 'Goal reached'}
                        </span>
                      </div>
                      <div className="tabung-actions">
                        <button
                          type="button"
                          className="btn-tabung-icon"
                          aria-label={`Edit ${goal.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic();
                            onOpenSavingsModal(goal);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-tabung-icon danger"
                          aria-label={`Delete ${goal.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic();
                            if (window.confirm(`Delete savings goal "${goal.name}"?`)) {
                              void deleteSavingsGoal(goal.id);
                            }
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="tabung-metrics-row">
                      <div className="tabung-amounts">
                        <strong className="tabung-saved">{formatCurrency(saved, currency)}</strong>
                        <span className="tabung-sep">of</span>
                        <span className="tabung-target-val">{formatCurrency(target, currency)}</span>
                      </div>
                      <span className={`tabung-pct-badge theme-${themeKey}`}>{pct.toFixed(0)}%</span>
                    </div>

                    <div className="tabung-track">
                      <div className={`tabung-fill theme-${themeKey}`} style={{ width: `${pct.toFixed(1)}%` }} />
                    </div>

                    <div className="tabung-card-footer">
                      <span className={`tabung-pace-text${remaining <= 0 ? ' completed' : ''}`}>
                        {remaining <= 0 ? 'Target achieved' : `${formatCurrency(remaining, currency)} remaining`}
                      </span>
                      <div className="tabung-footer-btns">
                        <button
                          type="button"
                          className="btn-tabung-deposit"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic();
                            onOpenSavingsTopup(goal);
                          }}
                        >
                          + Deposit / Withdraw
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Loans Panel ────────────────────────────────────────────────── */}
      {activeTab === 'loans' && (
        <div className="wallet-panel active" role="tabpanel">
          <div className="savings-overview-card">
            <div className="wallet-summary-row" style={{ marginBottom: '0.75rem' }}>
              <div className="wallet-summary-left">
                <span className="wallet-summary-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem' }}>
                  Total Remaining Balance
                </span>
                <strong className="wallet-summary-debt">{formatCurrency(totalLoansRemaining, currency)}</strong>
                <span className="wallet-summary-sub">
                  {totalLoanPrincipal > 0 ? `of ${formatCurrency(totalLoanPrincipal, currency)} principal` : 'No loans recorded'}
                </span>
              </div>
              <button
                type="button"
                className="wallet-add-pill"
                onClick={() => {
                  haptic();
                  onOpenLoanModal(null);
                }}
              >
                + Add Loan
              </button>
            </div>
            <div className="sw-budget-track">
              <div className="sw-budget-fill" style={{ width: `${loanPaidPct.toFixed(1)}%`, background: 'var(--primary-ink)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.76rem', color: 'var(--ink-secondary)' }}>
              <span>
                {activeLoans.length} active
                {monthlyCommitment > 0 ? ` · ${formatCurrency(monthlyCommitment, currency)}/mo commitment` : ''}
              </span>
              <span style={{ color: 'var(--primary-ink)', fontWeight: 700 }}>{loanPaidPct.toFixed(0)}% paid off</span>
            </div>
          </div>

          <div className="savings-goals-grid" style={{ marginTop: '0.9rem' }}>
            {loans.length === 0 ? (
              <div className="sw-empty-card">
                <div className="sw-empty-title">No loans recorded</div>
                <div className="sw-empty-sub">Tap + Add Loan above to track financing, study loans, or installments.</div>
              </div>
            ) : (
              loans.map((loan) => {
                const total = Number(loan.total) || 1;
                const paid = Number(loan.paid) || 0;
                const remaining = Math.max(0, total - paid);
                const pct = Math.min((paid / total) * 100, 100);
                const isSettled = remaining <= 0;
                const monthly = Number(loan.monthlyInstallment) || 0;
                const installmentsLeft = monthly > 0 && remaining > 0 ? Math.ceil(remaining / monthly) : 0;
                let estEnd = '';
                if (installmentsLeft > 0) {
                  const d = new Date();
                  d.setMonth(d.getMonth() + installmentsLeft);
                  estEnd = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }
                const themeKey = LOAN_COLORS.some((c) => c.key === loan.color) ? loan.color! : 'blue';

                return (
                  <article
                    key={loan.id}
                    className={`tabung-card${isSettled ? ' is-completed' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      haptic();
                      onOpenLoanDetails(loan);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenLoanDetails(loan);
                      }
                    }}
                  >
                    <div className="tabung-card-top">
                      <div className={`tabung-icon-badge theme-${themeKey}`}>
                        {renderLoanIcon(loan.icon, loan.person)}
                      </div>
                      <div className="tabung-title-wrap">
                        <div className="tabung-title-row">
                          <span className="tabung-name">{loan.person}</span>
                        </div>
                        <span className="tabung-sub-status">
                          {loan.desc ? `${loan.desc} · ` : ''}Paid {formatCurrency(paid, currency)}
                        </span>
                      </div>
                      <div className="tabung-actions">
                        <button
                          type="button"
                          className="btn-tabung-icon"
                          aria-label={`Edit ${loan.person}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic();
                            onOpenLoanModal(loan);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-tabung-icon danger"
                          aria-label={`Delete ${loan.person}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic();
                            if (window.confirm(`Delete loan "${loan.person}"?`)) {
                              void deleteLoan(loan.id);
                            }
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="tabung-metrics-row">
                      <div className="tabung-amounts">
                        <strong className="tabung-saved">{formatCurrency(remaining, currency)}</strong>
                        <span className="tabung-sep">left of</span>
                        <span className="tabung-target-val">{formatCurrency(total, currency)}</span>
                      </div>
                      <span className={`tabung-pct-badge theme-${themeKey}`}>{pct.toFixed(0)}% paid</span>
                    </div>

                    <div className="tabung-track">
                      <div className={`tabung-fill theme-${themeKey}`} style={{ width: `${pct.toFixed(1)}%` }} />
                    </div>

                    <div className="tabung-card-footer">
                      <span className={`tabung-pace-text${isSettled ? ' completed' : ''}`}>
                        {isSettled
                          ? 'Fully paid off'
                          : monthly > 0
                            ? `${formatCurrency(monthly, currency)}/mo · ${installmentsLeft} left${estEnd ? ` (Est. ${estEnd})` : ''}`
                            : `${formatCurrency(remaining, currency)} remaining`}
                      </span>
                      {!isSettled && (
                        <div className="tabung-footer-btns">
                          <button
                            type="button"
                            className="btn-tabung-deposit"
                            onClick={(e) => {
                              e.stopPropagation();
                              haptic();
                              onOpenLoanPay(loan);
                            }}
                          >
                            + Pay Installment
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
