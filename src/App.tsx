import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingAddButton } from '@/components/layout/FloatingAddButton';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { BudgetsPage } from '@/pages/BudgetsPage';
import { WalletPage } from '@/pages/WalletPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { MonthlyReportPage } from '@/pages/MonthlyReportPage';
import { ToolsPage } from '@/pages/ToolsPage';
import { TransactionModal } from '@/components/modals/TransactionModal';
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal';
import { CreditCardModal } from '@/components/modals/CreditCardModal';
import { PayCreditCardModal } from '@/components/modals/PayCreditCardModal';
import { BudgetChartModal, BudgetModal } from '@/components/modals/BudgetModals';
import { SavingsDetailsModal, SavingsGoalModal, SavingsTopupModal } from '@/components/modals/SavingsModals';
import { LoanDetailsModal, LoanModal, LoanPayModal } from '@/components/modals/LoanModals';
import { ProfileSettingsModal } from '@/components/modals/ProfileSettingsModal';
import { MyKasihModal } from '@/components/modals/MyKasihModal';
import type {
  BudgetItem,
  CreditCard,
  LoanItem,
  PageId,
  PaymentMethod,
  SavingsGoal,
  Transaction,
  TxType,
  WalletTabId
} from '@/types/finance';

export function App() {
  const { user, authReady } = useAuth();
  const { deleteTransaction } = useFinance();

  const [page, setPage] = useState<PageId>('dashboard');
  const [walletTab, setWalletTab] = useState<WalletTabId>('cards');

  // Modal states
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txInitialType, setTxInitialType] = useState<TxType>('expense');
  const [txInitialPM, setTxInitialPM] = useState<PaymentMethod>('cash');
  const [inspectTx, setInspectTx] = useState<Transaction | null>(null);

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [payCardId, setPayCardId] = useState<string | null>(null);

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [budgetChartData, setBudgetChartData] = useState<{ budget: BudgetItem; spent: number } | null>(null);

  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [topupGoal, setTopupGoal] = useState<SavingsGoal | null>(null);
  const [detailsGoalId, setDetailsGoalId] = useState<string | null>(null);

  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanItem | null>(null);
  const [payLoan, setPayLoan] = useState<LoanItem | null>(null);
  const [detailsLoanId, setDetailsLoanId] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [mykasihOpen, setMykasihOpen] = useState(false);

  const handleNavigate = (nextPage: PageId, nextWalletTab?: WalletTabId) => {
    setPage(nextPage);
    if (nextWalletTab) setWalletTab(nextWalletTab);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleOpenAddTx = (type: TxType = 'expense', pm: PaymentMethod = 'cash') => {
    setEditingTx(null);
    setTxInitialType(type);
    setTxInitialPM(pm);
    setTxModalOpen(true);
  };

  const handleEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxModalOpen(true);
  };

  const handleDeleteTx = (tx: Transaction) => {
    if (window.confirm(`Delete "${tx.description || tx.category}"?`)) {
      void deleteTransaction(tx.id);
    }
  };

  if (!authReady) {
    return (
      <div className="auth-overlay">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem' }}>ExpenseFlow</h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '0.5rem', fontSize: '0.86rem' }}>Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div id="app" className="app">
      <AppHeader page={page} onOpenSettings={() => setProfileOpen(true)} />

      <main className="main-content">
        {page === 'dashboard' && (
          <DashboardPage
            onNavigate={handleNavigate}
            onInspectTx={setInspectTx}
            onDeleteTx={handleDeleteTx}
          />
        )}

        {page === 'transactions' && (
          <TransactionsPage onInspectTx={setInspectTx} onDeleteTx={handleDeleteTx} />
        )}

        {page === 'budgets' && (
          <BudgetsPage
            onOpenBudgetModal={(b) => {
              setEditingBudget(b || null);
              setBudgetModalOpen(true);
            }}
            onOpenBudgetChart={(budget, spent) => setBudgetChartData({ budget, spent })}
          />
        )}

        {page === 'wallet' && (
          <WalletPage
            activeTab={walletTab}
            onChangeTab={setWalletTab}
            onOpenCardModal={(c) => {
              setEditingCard(c || null);
              setCardModalOpen(true);
            }}
            onOpenPayCardModal={setPayCardId}
            onAddMyKasihTx={() => handleOpenAddTx('expense', 'mykasih')}
            onEditMyKasih={() => setMykasihOpen(true)}
            onOpenSavingsModal={(g) => {
              setEditingGoal(g || null);
              setSavingsModalOpen(true);
            }}
            onOpenSavingsTopup={setTopupGoal}
            onOpenSavingsDetails={(g) => setDetailsGoalId(g.id)}
            onOpenLoanModal={(l) => {
              setEditingLoan(l || null);
              setLoanModalOpen(true);
            }}
            onOpenLoanPay={setPayLoan}
            onOpenLoanDetails={(l) => setDetailsLoanId(l.id)}
          />
        )}

        {page === 'categories' && <CategoriesPage />}
        {page === 'monthly' && <MonthlyReportPage />}
        {page === 'tools' && (
          <ToolsPage
            onAddMyKasihTx={() => handleOpenAddTx('expense', 'mykasih')}
            onEditMyKasih={() => setMykasihOpen(true)}
          />
        )}
      </main>

      <FloatingAddButton
        visible={page === 'dashboard' || page === 'transactions'}
        onClick={() => handleOpenAddTx('expense', 'cash')}
      />

      <BottomNav page={page} onNavigate={handleNavigate} />

      {/* Modals */}
      <TransactionModal
        open={txModalOpen}
        editingTx={editingTx}
        initialType={txInitialType}
        initialPayMethod={txInitialPM}
        onClose={() => setTxModalOpen(false)}
      />
      <TransactionDetailsModal
        tx={inspectTx}
        onClose={() => setInspectTx(null)}
        onEdit={handleEditTx}
        onDelete={handleDeleteTx}
      />
      <CreditCardModal
        open={cardModalOpen}
        editingCard={editingCard}
        onClose={() => setCardModalOpen(false)}
      />
      <PayCreditCardModal cardId={payCardId} onClose={() => setPayCardId(null)} />
      <BudgetModal
        open={budgetModalOpen}
        editingBudget={editingBudget}
        onClose={() => setBudgetModalOpen(false)}
      />
      <BudgetChartModal data={budgetChartData} onClose={() => setBudgetChartData(null)} />
      <SavingsGoalModal
        open={savingsModalOpen}
        editingGoal={editingGoal}
        onClose={() => setSavingsModalOpen(false)}
      />
      <SavingsTopupModal goal={topupGoal} onClose={() => setTopupGoal(null)} />
      <SavingsDetailsModal goalId={detailsGoalId} onClose={() => setDetailsGoalId(null)} />
      <LoanModal
        open={loanModalOpen}
        editingLoan={editingLoan}
        onClose={() => setLoanModalOpen(false)}
      />
      <LoanPayModal loan={payLoan} onClose={() => setPayLoan(null)} />
      <LoanDetailsModal loanId={detailsLoanId} onClose={() => setDetailsLoanId(null)} />
      <ProfileSettingsModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <MyKasihModal open={mykasihOpen} onClose={() => setMykasihOpen(false)} />
    </div>
  );
}

export default App;
