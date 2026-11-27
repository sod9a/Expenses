export type TxType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'credit' | 'mykasih';
export type CardColor = 'blue' | 'teal' | 'indigo' | 'crimson' | 'slate' | 'amber';
export type SavingsColor = 'emerald' | 'blue' | 'indigo' | 'amber' | 'rose' | 'slate';
export type LoanColor = 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
export type PageId =
  | 'dashboard'
  | 'transactions'
  | 'budgets'
  | 'wallet'
  | 'categories'
  | 'monthly'
  | 'tools'
  | 'settings';
export type WalletTabId = 'cards' | 'savings' | 'loans';

export interface CreditCard {
  id: string;
  name: string;
  last4?: string;
  limit?: number;
  dueDay?: number;
  color?: CardColor;
}

export interface UserSettings {
  currency: string;
  theme: 'dark' | 'light';
  avatarUrl: string;
  grossIncome?: number;
  carryOverBalance?: number;
  balanceHidden?: boolean;
  lastProcessedMonth?: string;
  creditPoolLimit?: number;
  creditPoolDueDay?: number;
  creditLimit?: number;
  creditDueDay?: number;
  creditCards?: CreditCard[];
  mykasihAllowance?: number;
  mykasihBaseBalance?: number;
  mykasihLastTopupMonth?: string;
}

export interface Transaction {
  id: string;
  uid: string;
  type: TxType;
  description: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  paymentMethod?: PaymentMethod;
  cardId?: string | null;
  createdAt?: { toMillis?: () => number; toDate?: () => Date };
  updatedAt?: { toMillis?: () => number; toDate?: () => Date };
}

export interface BudgetItem {
  id: string;
  uid: string;
  category: string;
  limit: number;
  isChecklist?: false;
}

export interface ChecklistItem {
  id: string;
  uid: string;
  isChecklist: true;
  name: string;
  amount: number;
  paid: boolean;
  month?: string; // YYYY-MM
  createdAt?: { toMillis?: () => number };
}

export interface SavingsHistoryEntry {
  amount: number;
  type?: 'add' | 'withdraw';
  date: string;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  uid: string;
  name: string;
  target: number;
  saved: number;
  emoji?: string;
  color?: SavingsColor;
  deadline?: string;
  history?: SavingsHistoryEntry[];
  createdAt?: { toMillis?: () => number; toDate?: () => Date };
}

export interface LoanHistoryEntry {
  amount: number;
  date: string;
  note?: string;
}

export interface LoanItem {
  id: string;
  uid: string;
  loanType?: 'owe' | 'lent';
  person: string;
  desc?: string;
  total: number;
  paid: number;
  monthlyInstallment?: number;
  dueDay?: number | null;
  icon?: string;
  color?: LoanColor;
  due?: string;
  history?: LoanHistoryEntry[];
  createdAt?: { toMillis?: () => number; toDate?: () => Date };
}
