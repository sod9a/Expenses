import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type {
  BudgetItem,
  CardColor,
  ChecklistItem,
  CreditCard,
  LoanColor,
  LoanHistoryEntry,
  LoanItem,
  PaymentMethod,
  SavingsColor,
  SavingsGoal,
  SavingsHistoryEntry,
  Transaction,
  TxType,
  UserSettings
} from '@/types/finance';
import { todayISO, toMonthKey } from '@/utils/format';

const DEFAULT_SETTINGS: UserSettings = {
  currency: '$',
  theme: 'dark',
  avatarUrl: '',
  grossIncome: 0,
  carryOverBalance: 0,
  balanceHidden: false,
  creditPoolLimit: 2000,
  creditPoolDueDay: 25,
  creditCards: [{ id: 'legacy-default', name: 'Primary Card', last4: '0000', limit: 2000, dueDay: 25, color: 'blue' }],
  mykasihAllowance: 50,
  mykasihBaseBalance: 50,
  mykasihLastTopupMonth: ''
};

const CARD_COLOR_CYCLE: readonly CardColor[] = ['blue', 'teal', 'indigo', 'crimson', 'slate', 'amber'];

export interface FinanceContextValue {
  transactions: Transaction[];
  budgets: BudgetItem[];
  checklist: ChecklistItem[];
  tabung: SavingsGoal[];
  loans: LoanItem[];
  settings: UserSettings;
  loading: boolean;
  syncError: string | null;
  creditCards: CreditCard[];
  getCardLimit: (card: CreditCard) => number;
  getCardDueDay: (card: CreditCard) => number;
  getCardColor: (card: CreditCard, index: number) => CardColor;
  getCardNameById: (cardId?: string | null) => string;
  getCardOutstanding: (cardId: string) => number;
  totalCardDebt: number;
  totalCardLimit: number;
  totalSavings: number;
  totalLoansRemaining: number;
  mykasihBalance: number;
  mykasihSpentThisMonth: number;
  // CRUD
  saveTransaction: (
    payload: {
      type: TxType;
      description: string;
      amount: number;
      category: string;
      date: string;
      notes: string;
      paymentMethod: PaymentMethod;
      cardId: string | null;
    },
    editingId?: string | null
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveBudget: (category: string, limit: number, editingId?: string | null) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addChecklistItem: (name: string, amount: number, month?: string) => Promise<void>;
  toggleChecklistItem: (item: ChecklistItem) => Promise<void>;
  deleteChecklistItem: (id: string) => Promise<void>;
  saveCreditCard: (
    payload: { name: string; last4: string; limit: number; dueDay: number; color: CardColor },
    editingId?: string | null
  ) => Promise<void>;
  deleteCreditCard: (cardId: string) => Promise<void>;
  recordCardPayment: (cardId: string, amount: number, date: string) => Promise<void>;
  saveSavingsGoal: (
    payload: { name: string; target: number; saved: number; emoji: string; color: SavingsColor; deadline: string },
    editingId?: string | null
  ) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  adjustSavingsGoal: (
    goalId: string,
    type: 'add' | 'withdraw',
    amount: number,
    date: string,
    note: string
  ) => Promise<void>;
  deleteSavingsHistoryItem: (goalId: string, historyIndex: number) => Promise<void>;
  saveLoan: (
    payload: {
      person: string;
      desc: string;
      total: number;
      paid: number;
      monthlyInstallment: number;
      dueDay: number | null;
      icon: string;
      color: LoanColor;
      due: string;
    },
    editingId?: string | null
  ) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  recordLoanPayment: (loanId: string, amount: number, date: string, note: string) => Promise<void>;
  deleteLoanHistoryItem: (loanId: string, historyIndex: number) => Promise<void>;
  saveMyKasihSettings: (currentBalance: number, monthlyAllowance: number) => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>, toastMsg?: string) => Promise<void>;
  toggleBalanceHidden: () => Promise<void>;
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function calcMonthsDiff(fromYM: string, toYM: string): number {
  if (!/^\d{4}-\d{2}$/.test(fromYM) || !/^\d{4}-\d{2}$/.test(toYM)) return 0;
  const [fy, fm] = fromYM.split('-').map(Number);
  const [ty, tm] = toYM.split('-').map(Number);
  const diff = (ty - fy) * 12 + (tm - fm);
  return diff > 0 ? diff : 0;
}

function isSafeAvatarUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 150000) return false;
  return url === '' || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [tabung, setTabung] = useState<SavingsGoal[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef<UserSettings>(DEFAULT_SETTINGS);
  const [loadedFlags, setLoadedFlags] = useState({ tx: false, budgets: false, settings: false });
  const [syncError, setSyncError] = useState<string | null>(null);
  const isResettingRef = useRef(false);
  const lastRolloverKeyRef = useRef('');

  const persistSettings = useCallback(
    async (partial: Partial<UserSettings>, toastMsg?: string) => {
      if (!user) return;
      const merged: UserSettings = { ...DEFAULT_SETTINGS, ...settingsRef.current, ...partial };
      const cleanCurrency =
        typeof merged.currency === 'string' && merged.currency.trim().length > 0
          ? merged.currency.slice(0, 10)
          : '$';
      const cleanTheme: 'dark' | 'light' = merged.theme === 'light' ? 'light' : 'dark';
      const cleanAvatar = isSafeAvatarUrl(merged.avatarUrl) ? merged.avatarUrl : '';
      const cleanCards = Array.isArray(merged.creditCards)
        ? merged.creditCards.slice(0, 50)
        : DEFAULT_SETTINGS.creditCards || [];
      const cleanLastProcessed =
        typeof merged.lastProcessedMonth === 'string' ? merged.lastProcessedMonth.slice(0, 10) : '';
      const cleanLastTopup =
        typeof merged.mykasihLastTopupMonth === 'string' ? merged.mykasihLastTopupMonth.slice(0, 10) : '';

      const nextLocal: UserSettings = {
        currency: cleanCurrency,
        theme: cleanTheme,
        avatarUrl: cleanAvatar,
        grossIncome: clampNum(merged.grossIncome, 0, 1_000_000_000, 0),
        carryOverBalance: clampNum(merged.carryOverBalance, -1_000_000_000, 1_000_000_000, 0),
        balanceHidden: Boolean(merged.balanceHidden),
        lastProcessedMonth: cleanLastProcessed,
        creditPoolLimit: clampNum(merged.creditPoolLimit, 0, 1_000_000_000, 2000),
        creditPoolDueDay: Math.round(clampNum(merged.creditPoolDueDay, 1, 31, 25)),
        creditCards: cleanCards,
        mykasihAllowance: clampNum(merged.mykasihAllowance, 0, 1_000_000, 50),
        mykasihBaseBalance: clampNum(merged.mykasihBaseBalance, 0, 1_000_000, 50),
        mykasihLastTopupMonth: cleanLastTopup
      };

      const prevLocal = settingsRef.current;
      settingsRef.current = nextLocal;
      setSettings(nextLocal);

      try {
        await setDoc(doc(db, 'settings', user.uid), {
          uid: user.uid,
          ...nextLocal,
          updatedAt: serverTimestamp()
        });
        if (toastMsg) showToast(toastMsg, 'success');
      } catch (err) {
        settingsRef.current = prevLocal;
        setSettings(prevLocal);
        throw err;
      }
    },
    [user, showToast]
  );

  // Apply theme to :root + meta theme-color
  useEffect(() => {
    const isLight = settings.theme === 'light';
    document.documentElement.classList.toggle('light-theme', isLight);
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', isLight ? '#ffffff' : '#0b1120');
  }, [settings.theme]);

  // Real-time Firestore subscriptions
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setBudgets([]);
      setChecklist([]);
      setTabung([]);
      setLoans([]);
      settingsRef.current = DEFAULT_SETTINGS;
      setSettings(DEFAULT_SETTINGS);
      setLoadedFlags({ tx: false, budgets: false, settings: false });
      setSyncError(null);
      lastRolloverKeyRef.current = '';
      return;
    }

    const uid = user.uid;
    setSyncError(null);
    let unsubFallbackTx: (() => void) | null = null;

    const handleSnapError = (source: string, err: { code?: string; message?: string }) => {
      console.error(`Firestore ${source} error:`, err);
      if (err?.code === 'permission-denied') {
        setSyncError('Access denied by Firestore rules. Check that your signed-in account UID is allowed in Firestore Rules.');
      } else {
        setSyncError(`Failed to sync ${source}: ${err?.message || 'Network error'}`);
      }
      setLoadedFlags({ tx: true, budgets: true, settings: true });
    };

    const sortTransactions = (list: Transaction[]) =>
      list.sort((a, b) => {
        const dateCmp = (b.date || '').localeCompare(a.date || '');
        if (dateCmp !== 0) return dateCmp;
        const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
        const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
        return bMs - aMs;
      });

    const txQ = query(collection(db, 'transactions'), where('uid', '==', uid), orderBy('date', 'desc'));
    const unsubTx = onSnapshot(
      txQ,
      (snap) => {
        const list = sortTransactions(
          snap.docs.map((d) => {
            const data = d.data() as Omit<Transaction, 'id'>;
            if (data.category === 'Food & Dining') data.category = 'Food';
            return { id: d.id, ...data };
          })
        );
        setTransactions(list);
        setLoadedFlags((f) => ({ ...f, tx: true }));
      },
      (err) => {
        if (err?.code === 'permission-denied') {
          handleSnapError('transactions', err);
          return;
        }
        // Fallback without composite index
        const fallbackQ = query(collection(db, 'transactions'), where('uid', '==', uid));
        unsubFallbackTx = onSnapshot(
          fallbackQ,
          (snap) => {
            const list = sortTransactions(
              snap.docs.map((d) => {
                const data = d.data() as Omit<Transaction, 'id'>;
                if (data.category === 'Food & Dining') data.category = 'Food';
                return { id: d.id, ...data };
              })
            );
            setTransactions(list);
            setLoadedFlags((f) => ({ ...f, tx: true }));
          },
          (fbErr) => handleSnapError('transactions', fbErr)
        );
      }
    );

    const bQ = query(collection(db, 'budgets'), where('uid', '==', uid));
    const unsubBudgets = onSnapshot(
      bQ,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<BudgetItem | ChecklistItem>;
        setBudgets(docs.filter((d): d is BudgetItem => !('isChecklist' in d && d.isChecklist)));
        setChecklist(docs.filter((d): d is ChecklistItem => Boolean('isChecklist' in d && d.isChecklist)));
        setLoadedFlags((f) => ({ ...f, budgets: true }));
      },
      (err) => handleSnapError('budgets', err)
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<UserSettings>;
          const nextSettings: UserSettings = {
            ...DEFAULT_SETTINGS,
            ...data,
            currency: data.currency || '$',
            theme: data.theme === 'light' ? 'light' : 'dark',
            avatarUrl: isSafeAvatarUrl(data.avatarUrl) ? data.avatarUrl : '',
            creditCards: Array.isArray(data.creditCards) ? data.creditCards : DEFAULT_SETTINGS.creditCards
          };
          settingsRef.current = nextSettings;
          setSettings(nextSettings);
        } else {
          settingsRef.current = DEFAULT_SETTINGS;
          setSettings(DEFAULT_SETTINGS);
        }
        setLoadedFlags((f) => ({ ...f, settings: true }));
      },
      (err) => handleSnapError('settings', err)
    );

    const tQ = query(collection(db, 'tabung'), where('uid', '==', uid));
    const unsubTabung = onSnapshot(
      tQ,
      (snap) => {
        setTabung(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavingsGoal, 'id'>) })));
      },
      (err) => console.error('Firestore tabung error:', err)
    );

    const lQ = query(collection(db, 'loans'), where('uid', '==', uid));
    const unsubLoans = onSnapshot(
      lQ,
      (snap) => {
        setLoans(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LoanItem, 'id'>) })));
      },
      (err) => console.error('Firestore loans error:', err)
    );

    return () => {
      unsubTx();
      if (unsubFallbackTx) unsubFallbackTx();
      unsubBudgets();
      unsubSettings();
      unsubTabung();
      unsubLoans();
    };
  }, [user]);

  // Monthly carry-over, checklist reset & MyKasih monthly top-up
  useEffect(() => {
    if (!user || isResettingRef.current) return;
    if (!loadedFlags.tx || !loadedFlags.budgets || !loadedFlags.settings) return;

    const now = new Date();
    const currentMonthStr = toMonthKey(now.getFullYear(), now.getMonth());
    const lastProcessed = settings.lastProcessedMonth;
    const lastTopup = settings.mykasihLastTopupMonth;

    const needsInitProcessed = !lastProcessed;
    const needsMonthRollover = Boolean(lastProcessed && lastProcessed < currentMonthStr);
    const needsInitTopup = !lastTopup;
    const needsMyKasihTopup = Boolean(lastTopup && lastTopup < currentMonthStr);

    if (!needsInitProcessed && !needsMonthRollover && !needsInitTopup && !needsMyKasihTopup) {
      return;
    }

    const attemptKey = `${user.uid}:${currentMonthStr}:${lastProcessed || ''}:${lastTopup || ''}`;
    if (lastRolloverKeyRef.current === attemptKey) return;
    lastRolloverKeyRef.current = attemptKey;

    isResettingRef.current = true;
    (async () => {
      try {
        const patch: Partial<UserSettings> = {};

        if (needsInitProcessed) {
          patch.lastProcessedMonth = currentMonthStr;
        } else if (needsMonthRollover && lastProcessed) {
          const prevTxs = transactions.filter((t) => t.date && t.date.startsWith(lastProcessed));
          const prevSalary = prevTxs
            .filter((t) => t.type === 'income' && t.category?.toLowerCase() === 'salary')
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const prevOther = prevTxs
            .filter((t) => t.type === 'income' && t.category?.toLowerCase() !== 'salary')
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const prevCashExp = prevTxs
            .filter(
              (t) =>
                t.type === 'expense' &&
                t.paymentMethod !== 'credit' &&
                !t.cardId &&
                t.paymentMethod !== 'mykasih' &&
                t.category !== 'Credit Card Payment'
            )
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const prevCCPay = prevTxs
            .filter((t) => t.type === 'expense' && t.category === 'Credit Card Payment')
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);

          const prevCarry = typeof settings.carryOverBalance === 'number' ? settings.carryOverBalance : 0;
          const prevGross = typeof settings.grossIncome === 'number' ? settings.grossIncome : 0;
          patch.carryOverBalance = prevCarry + prevGross + prevSalary + prevOther - prevCashExp - prevCCPay;
          patch.lastProcessedMonth = currentMonthStr;
        }

        if (needsInitTopup) {
          patch.mykasihLastTopupMonth = currentMonthStr;
        } else if (needsMyKasihTopup && lastTopup) {
          const monthsDiff = calcMonthsDiff(lastTopup, currentMonthStr);
          if (monthsDiff > 0) {
            const allowance = clampNum(settings.mykasihAllowance, 0, 1_000_000, 50);
            const rawBase = clampNum(settings.mykasihBaseBalance, 0, 1_000_000, 50);
            const spentBeforeCurMonth = transactions
              .filter(
                (t) =>
                  t.type === 'expense' &&
                  t.paymentMethod === 'mykasih' &&
                  t.date &&
                  t.date < `${currentMonthStr}-01`
              )
              .reduce((s, t) => s + (Number(t.amount) || 0), 0);
            patch.mykasihBaseBalance = Math.max(rawBase, spentBeforeCurMonth) + monthsDiff * allowance;
          }
          patch.mykasihLastTopupMonth = currentMonthStr;
        }

        await persistSettings(patch);
      } catch (err) {
        console.error('Monthly reset error:', err);
      } finally {
        isResettingRef.current = false;
      }
    })();
  }, [user, loadedFlags, settings, transactions, checklist, persistSettings]);

  const creditCards = useMemo<CreditCard[]>(() => {
    if (Array.isArray(settings.creditCards)) return settings.creditCards;
    return DEFAULT_SETTINGS.creditCards || [];
  }, [settings.creditCards]);

  const getCardLimit = useCallback(
    (card: CreditCard): number => {
      if (typeof card.limit === 'number' && !Number.isNaN(card.limit)) return card.limit;
      return settings.creditPoolLimit ?? settings.creditLimit ?? 2000;
    },
    [settings.creditPoolLimit, settings.creditLimit]
  );

  const getCardDueDay = useCallback(
    (card: CreditCard): number => {
      if (typeof card.dueDay === 'number' && !Number.isNaN(card.dueDay)) return card.dueDay;
      return settings.creditPoolDueDay ?? settings.creditDueDay ?? 25;
    },
    [settings.creditPoolDueDay, settings.creditDueDay]
  );

  const getCardColor = useCallback((card: CreditCard, index: number): CardColor => {
    if (card.color && CARD_COLOR_CYCLE.includes(card.color)) return card.color;
    return CARD_COLOR_CYCLE[index % CARD_COLOR_CYCLE.length];
  }, []);

  const getCardNameById = useCallback(
    (cardId?: string | null): string => {
      if (!cardId) return creditCards[0]?.name || 'Primary Card';
      const byId = creditCards.find((c) => c.id === cardId);
      if (byId) return byId.name;
      const byName = creditCards.find((c) => c.name === cardId);
      if (byName) return byName.name;
      return 'Primary Card';
    },
    [creditCards]
  );

  const getCardOutstanding = useCallback(
    (cardId: string): number => {
      const targetCard = creditCards.find((c) => c.id === cardId);
      const targetName = targetCard?.name || null;
      const isDefault = Boolean(creditCards[0] && creditCards[0].id === cardId);

      const matchesCard = (t: Transaction) => {
        if (t.cardId === cardId) return true;
        if (targetName && (t.cardId === targetName || getCardNameById(t.cardId) === targetName)) return true;
        if (!t.cardId && isDefault) return true;
        return false;
      };

      const expenses = transactions
        .filter((t) => t.type === 'expense' && t.category !== 'Credit Card Payment' && (t.paymentMethod === 'credit' || Boolean(t.cardId)) && matchesCard(t))
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const payments = transactions
        .filter((t) => t.type === 'expense' && t.category === 'Credit Card Payment' && matchesCard(t))
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

      return Math.max(0, expenses - payments);
    },
    [creditCards, transactions, getCardNameById]
  );

  const totalCardDebt = useMemo(() => {
    const perCardSum = creditCards.reduce((sum, c) => sum + getCardOutstanding(c.id), 0);
    const allCCExp = transactions
      .filter((t) => t.type === 'expense' && t.category !== 'Credit Card Payment' && (t.paymentMethod === 'credit' || Boolean(t.cardId)))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const allCCPay = transactions
      .filter((t) => t.type === 'expense' && t.category === 'Credit Card Payment')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return Math.max(perCardSum, Math.max(0, allCCExp - allCCPay));
  }, [creditCards, getCardOutstanding, transactions]);

  const totalCardLimit = useMemo(
    () => creditCards.reduce((sum, c) => sum + getCardLimit(c), 0),
    [creditCards, getCardLimit]
  );

  const totalSavings = useMemo(
    () => tabung.reduce((s, t) => s + (Number(t.saved) || 0), 0),
    [tabung]
  );

  const totalLoansRemaining = useMemo(
    () => loans.reduce((s, l) => s + Math.max(0, (Number(l.total) || 0) - (Number(l.paid) || 0)), 0),
    [loans]
  );

  const { mykasihBalance, mykasihSpentThisMonth } = useMemo(() => {
    const now = new Date();
    const curMonth = toMonthKey(now.getFullYear(), now.getMonth());
    const spentThisMonth = transactions
      .filter((t) => t.type === 'expense' && t.paymentMethod === 'mykasih' && t.date?.startsWith(curMonth))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalSpent = transactions
      .filter((t) => t.type === 'expense' && t.paymentMethod === 'mykasih')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const allowance = clampNum(settings.mykasihAllowance, 0, 1_000_000, 50);
    const rawBase = clampNum(settings.mykasihBaseBalance, 0, 1_000_000, 50);
    const monthsDiff = settings.mykasihLastTopupMonth
      ? calcMonthsDiff(settings.mykasihLastTopupMonth, curMonth)
      : 0;

    let effectiveBase = rawBase;
    if (monthsDiff > 0) {
      const spentBeforeCurMonth = transactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.paymentMethod === 'mykasih' &&
            t.date &&
            t.date < `${curMonth}-01`
        )
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      effectiveBase = Math.max(rawBase, spentBeforeCurMonth) + monthsDiff * allowance;
    }

    return {
      mykasihBalance: Math.max(0, effectiveBase - totalSpent),
      mykasihSpentThisMonth: spentThisMonth
    };
  }, [transactions, settings.mykasihAllowance, settings.mykasihBaseBalance, settings.mykasihLastTopupMonth]);

  // ── CRUD Actions ──────────────────────────────────────────────────────────

  const saveTransaction: FinanceContextValue['saveTransaction'] = useCallback(
    async (payload, editingId) => {
      if (!user) return;
      const data = {
        uid: user.uid,
        type: payload.type,
        description: payload.description,
        amount: payload.amount,
        category: payload.category,
        date: payload.date,
        notes: payload.notes,
        paymentMethod: payload.type === 'expense' ? payload.paymentMethod : 'cash',
        cardId: payload.type === 'expense' && payload.paymentMethod === 'credit' ? payload.cardId : null,
        updatedAt: serverTimestamp()
      };
      if (editingId) {
        await updateDoc(doc(db, 'transactions', editingId), data);
        showToast('Transaction updated!', 'success');
      } else {
        await addDoc(collection(db, 'transactions'), { ...data, createdAt: serverTimestamp() });
        showToast('Transaction added!', 'success');
      }
    },
    [user, showToast]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, 'transactions', id));
      showToast('Transaction deleted.', 'success');
    },
    [showToast]
  );

  const saveBudget = useCallback(
    async (category: string, limit: number, editingId?: string | null) => {
      if (!user) return;
      const duplicate = budgets.find((b) => b.category === category && b.id !== editingId);
      if (duplicate) throw new Error('A budget already exists for this category.');
      if (editingId) {
        await updateDoc(doc(db, 'budgets', editingId), { category, limit, updatedAt: serverTimestamp() });
        showToast('Budget updated!', 'success');
      } else {
        await addDoc(collection(db, 'budgets'), { uid: user.uid, category, limit, createdAt: serverTimestamp() });
        showToast('Budget added!', 'success');
      }
    },
    [user, budgets, showToast]
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, 'budgets', id));
      showToast('Budget deleted.', 'success');
    },
    [showToast]
  );

  const addChecklistItem = useCallback(
    async (name: string, amount: number, month?: string) => {
      if (!user) return;
      const now = new Date();
      const targetMonth = month || toMonthKey(now.getFullYear(), now.getMonth());
      await addDoc(collection(db, 'budgets'), {
        uid: user.uid,
        isChecklist: true,
        name,
        amount,
        paid: false,
        month: targetMonth,
        createdAt: serverTimestamp()
      });
      showToast('Checklist item added!', 'success');
    },
    [user, showToast]
  );

  const toggleChecklistItem = useCallback(async (item: ChecklistItem) => {
    await updateDoc(doc(db, 'budgets', item.id), { paid: !item.paid, updatedAt: serverTimestamp() });
  }, []);

  const deleteChecklistItem = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, 'budgets', id));
      showToast('Checklist item removed.', 'success');
    },
    [showToast]
  );

  const saveCreditCard: FinanceContextValue['saveCreditCard'] = useCallback(
    async (payload, editingId) => {
      if (!user) return;
      const normalized = creditCards.map((c, idx) => ({
        id: c.id,
        name: c.name,
        last4: c.last4 || '0000',
        limit: getCardLimit(c),
        dueDay: getCardDueDay(c),
        color: getCardColor(c, idx)
      }));

      if (editingId) {
        const idx = normalized.findIndex((c) => c.id === editingId);
        if (idx !== -1) normalized[idx] = { id: editingId, ...payload };
      } else {
        const newId = `card_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        normalized.push({ id: newId, ...payload });
      }

      const poolLimit = normalized.reduce((s, c) => s + c.limit, 0);
      await persistSettings(
        { creditCards: normalized, creditPoolLimit: poolLimit, creditPoolDueDay: payload.dueDay },
        editingId ? 'Credit card updated!' : 'Credit card added!'
      );
    },
    [user, creditCards, getCardLimit, getCardDueDay, getCardColor, persistSettings]
  );

  const deleteCreditCard = useCallback(
    async (cardId: string) => {
      if (!user) return;
      const updated = creditCards.filter((c) => c.id !== cardId);
      const poolLimit = updated.reduce((s, c) => s + getCardLimit(c), 0);
      await persistSettings({ creditCards: updated, creditPoolLimit: poolLimit }, 'Credit card deleted!');
    },
    [user, creditCards, getCardLimit, persistSettings]
  );

  const recordCardPayment = useCallback(
    async (cardId: string, amount: number, date: string) => {
      if (!user) return;
      const cardName = getCardNameById(cardId);
      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'expense',
        description: `Credit Card Payment (${cardName})`,
        category: 'Credit Card Payment',
        amount,
        date,
        notes: `Logged via card payment for ${cardName}.`,
        paymentMethod: 'cash',
        cardId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast('Payment recorded successfully!', 'success');
    },
    [user, getCardNameById, showToast]
  );

  const saveSavingsGoal: FinanceContextValue['saveSavingsGoal'] = useCallback(
    async (payload, editingId) => {
      if (!user) return;
      const base = {
        uid: user.uid,
        ...payload,
        updatedAt: serverTimestamp()
      };
      if (editingId) {
        await updateDoc(doc(db, 'tabung', editingId), base);
        showToast('Savings goal updated!', 'success');
      } else {
        const history: SavingsHistoryEntry[] =
          payload.saved > 0 ? [{ amount: payload.saved, type: 'add', date: todayISO(), note: 'Initial deposit' }] : [];
        await addDoc(collection(db, 'tabung'), { ...base, history, createdAt: serverTimestamp() });
        showToast('Savings goal created!', 'success');
      }
    },
    [user, showToast]
  );

  const deleteSavingsGoal = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, 'tabung', id));
      showToast('Savings goal deleted.', 'success');
    },
    [showToast]
  );

  const adjustSavingsGoal = useCallback(
    async (goalId: string, type: 'add' | 'withdraw', amount: number, date: string, note: string) => {
      const goal = tabung.find((t) => t.id === goalId);
      if (!goal) return;
      const nextSaved = type === 'withdraw' ? Math.max(0, (Number(goal.saved) || 0) - amount) : (Number(goal.saved) || 0) + amount;
      const nextHistory: SavingsHistoryEntry[] = [...(goal.history || []), { amount, type, date, note }];
      await updateDoc(doc(db, 'tabung', goalId), {
        saved: nextSaved,
        history: nextHistory,
        updatedAt: serverTimestamp()
      });
      showToast(type === 'withdraw' ? 'Withdrawal recorded!' : 'Deposit added!', 'success');
    },
    [tabung, showToast]
  );

  const deleteSavingsHistoryItem = useCallback(
    async (goalId: string, historyIndex: number) => {
      const goal = tabung.find((t) => t.id === goalId);
      if (!goal || !goal.history) return;
      const item = goal.history[historyIndex];
      if (!item) return;
      const delta = item.type === 'withdraw' ? item.amount : -item.amount;
      const nextSaved = Math.max(0, (Number(goal.saved) || 0) + delta);
      const nextHistory = goal.history.filter((_, idx) => idx !== historyIndex);
      await updateDoc(doc(db, 'tabung', goalId), {
        saved: nextSaved,
        history: nextHistory,
        updatedAt: serverTimestamp()
      });
      showToast('History entry removed.', 'success');
    },
    [tabung, showToast]
  );

  const saveLoan: FinanceContextValue['saveLoan'] = useCallback(
    async (payload, editingId) => {
      if (!user) return;
      const base = {
        uid: user.uid,
        loanType: 'owe' as const,
        ...payload,
        updatedAt: serverTimestamp()
      };
      if (editingId) {
        await updateDoc(doc(db, 'loans', editingId), base);
        showToast('Loan updated!', 'success');
      } else {
        const history: LoanHistoryEntry[] =
          payload.paid > 0 ? [{ amount: payload.paid, date: todayISO(), note: 'Initial paid balance' }] : [];
        await addDoc(collection(db, 'loans'), { ...base, history, createdAt: serverTimestamp() });
        showToast('Loan added!', 'success');
      }
    },
    [user, showToast]
  );

  const deleteLoan = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, 'loans', id));
      showToast('Loan deleted.', 'success');
    },
    [showToast]
  );

  const recordLoanPayment = useCallback(
    async (loanId: string, amount: number, date: string, note: string) => {
      const loan = loans.find((l) => l.id === loanId);
      if (!loan) return;
      const nextPaid = (Number(loan.paid) || 0) + amount;
      const nextHistory: LoanHistoryEntry[] = [...(loan.history || []), { amount, date, note }];
      await updateDoc(doc(db, 'loans', loanId), {
        paid: nextPaid,
        history: nextHistory,
        updatedAt: serverTimestamp()
      });
      showToast('Installment payment recorded!', 'success');
    },
    [loans, showToast]
  );

  const deleteLoanHistoryItem = useCallback(
    async (loanId: string, historyIndex: number) => {
      const loan = loans.find((l) => l.id === loanId);
      if (!loan || !loan.history) return;
      const item = loan.history[historyIndex];
      if (!item) return;
      const nextPaid = Math.max(0, (Number(loan.paid) || 0) - item.amount);
      const nextHistory = loan.history.filter((_, idx) => idx !== historyIndex);
      await updateDoc(doc(db, 'loans', loanId), {
        paid: nextPaid,
        history: nextHistory,
        updatedAt: serverTimestamp()
      });
      showToast('Payment entry removed.', 'success');
    },
    [loans, showToast]
  );

  const saveMyKasihSettings = useCallback(
    async (currentBalance: number, monthlyAllowance: number) => {
      if (!user) return;
      const now = new Date();
      const curMonth = toMonthKey(now.getFullYear(), now.getMonth());
      const totalSpent = transactions
        .filter((t) => t.type === 'expense' && t.paymentMethod === 'mykasih')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const safeBalance = clampNum(currentBalance, 0, 1_000_000, 0);
      const safeAllowance = clampNum(monthlyAllowance, 0, 1_000_000, 50);
      const newBaseBalance = clampNum(safeBalance + totalSpent, 0, 1_000_000, safeBalance);

      await persistSettings(
        {
          mykasihAllowance: safeAllowance,
          mykasihBaseBalance: newBaseBalance,
          mykasihLastTopupMonth: curMonth
        },
        'MyKasih settings saved!'
      );
    },
    [user, transactions, persistSettings]
  );

  const updateSettings = useCallback(
    async (partial: Partial<UserSettings>, toastMsg?: string) => {
      await persistSettings(partial, toastMsg);
    },
    [persistSettings]
  );

  const toggleBalanceHidden = useCallback(async () => {
    await persistSettings({ balanceHidden: !settingsRef.current.balanceHidden });
  }, [persistSettings]);

  const loading = Boolean(user && (!loadedFlags.tx || !loadedFlags.settings));

  const value: FinanceContextValue = {
    transactions,
    budgets,
    checklist,
    tabung,
    loans,
    settings,
    loading,
    syncError,
    creditCards,
    getCardLimit,
    getCardDueDay,
    getCardColor,
    getCardNameById,
    getCardOutstanding,
    totalCardDebt,
    totalCardLimit,
    totalSavings,
    totalLoansRemaining,
    mykasihBalance,
    mykasihSpentThisMonth,
    saveTransaction,
    deleteTransaction,
    saveBudget,
    deleteBudget,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    saveCreditCard,
    deleteCreditCard,
    recordCardPayment,
    saveSavingsGoal,
    deleteSavingsGoal,
    adjustSavingsGoal,
    deleteSavingsHistoryItem,
    saveLoan,
    deleteLoan,
    recordLoanPayment,
    deleteLoanHistoryItem,
    saveMyKasihSettings,
    updateSettings,
    toggleBalanceHidden
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
