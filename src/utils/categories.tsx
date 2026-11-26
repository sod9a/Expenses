import React from 'react';
import type { CardColor, LoanColor, SavingsColor, TxType } from '@/types/finance';

export const TX_CATEGORIES_BY_TYPE: Record<TxType, readonly string[]> = {
  expense: [
    'Food', 'Groceries', 'Transport', 'Bills', 'Rent',
    'Entertainment', 'Health', 'Clothing', 'Loan', 'General', 'Other'
  ],
  income: ['Salary', 'Freelance', 'Investment', 'Loan', 'General', 'Other']
};

export const BUDGET_CATEGORIES = [
  'Food', 'Rent', 'Transport', 'Groceries', 'Bills',
  'Entertainment', 'Health', 'Clothing', 'Other'
] as const;

export const WALLET_CARD_COLORS: readonly { key: CardColor; label: string; gradient: string }[] = [
  { key: 'blue', label: 'Royal Blue', gradient: 'linear-gradient(135deg,#273d86,#1d3270)' },
  { key: 'teal', label: 'Emerald Teal', gradient: 'linear-gradient(135deg,#1b7e72,#136158)' },
  { key: 'indigo', label: 'Deep Indigo', gradient: 'linear-gradient(135deg,#3730a3,#312e81)' },
  { key: 'crimson', label: 'Burgundy', gradient: 'linear-gradient(135deg,#9f1239,#881337)' },
  { key: 'slate', label: 'Charcoal Slate', gradient: 'linear-gradient(135deg,#334155,#1e293b)' },
  { key: 'amber', label: 'Warm Amber', gradient: 'linear-gradient(135deg,#b45309,#92400e)' }
];

export const SAVINGS_COLORS: readonly { key: SavingsColor; label: string; color: string; bg: string }[] = [
  { key: 'emerald', label: 'Emerald', color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)' },
  { key: 'blue', label: 'Blue', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.16)' },
  { key: 'indigo', label: 'Indigo', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.16)' },
  { key: 'amber', label: 'Amber', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' },
  { key: 'rose', label: 'Rose', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.16)' },
  { key: 'slate', label: 'Slate', color: '#64748b', bg: 'rgba(100, 116, 139, 0.16)' }
];

export const LOAN_COLORS: readonly { key: LoanColor; label: string; color: string; bg: string }[] = [
  { key: 'blue', label: 'Blue', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.18)' },
  { key: 'indigo', label: 'Indigo', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.18)' },
  { key: 'emerald', label: 'Emerald', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)' },
  { key: 'amber', label: 'Amber', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)' },
  { key: 'rose', label: 'Rose', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)' },
  { key: 'slate', label: 'Slate', color: '#64748b', bg: 'rgba(100, 116, 139, 0.18)' }
];

export interface CategoryMeta {
  color: string;
  bg: string;
  icon: React.ReactNode;
}

function solidIcon(d: string): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function getCategoryMeta(cat: string, type: TxType = 'expense'): CategoryMeta {
  const key = (cat || '').toLowerCase();
  if (key.includes('food') || key.includes('dining') || key.includes('eat') || key.includes('drink') || key.includes('coffee')) {
    return {
      color: '#F97316',
      bg: 'rgba(249, 115, 22, 0.14)',
      icon: solidIcon('M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z')
    };
  }
  if (key.includes('grocer')) {
    return {
      color: '#22C55E',
      bg: 'rgba(34, 197, 94, 0.14)',
      icon: solidIcon('M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z')
    };
  }
  if (key.includes('rent') || key.includes('hous') || key.includes('home')) {
    return {
      color: '#0284C7',
      bg: 'rgba(2, 132, 199, 0.14)',
      icon: solidIcon('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z')
    };
  }
  if (key.includes('bill') || key.includes('util')) {
    return {
      color: '#EAB308',
      bg: 'rgba(234, 179, 8, 0.14)',
      icon: solidIcon('M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2 10.5 3.5 9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z')
    };
  }
  if (key.includes('transport') || key.includes('car') || key.includes('fuel') || key.includes('petrol') || key.includes('grab')) {
    return {
      color: '#6366F1',
      bg: 'rgba(99, 102, 241, 0.14)',
      icon: solidIcon('M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z')
    };
  }
  if (key.includes('shop') || key.includes('cloth')) {
    return {
      color: '#EC4899',
      bg: 'rgba(236, 72, 153, 0.14)',
      icon: solidIcon('M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2z')
    };
  }
  if (key.includes('entertain') || key.includes('movie') || key.includes('game')) {
    return {
      color: '#A855F7',
      bg: 'rgba(168, 85, 247, 0.14)',
      icon: solidIcon('M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z')
    };
  }
  if (key.includes('health') || key.includes('med') || key.includes('clinic')) {
    return {
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.14)',
      icon: solidIcon('M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z')
    };
  }
  if (key.includes('credit')) {
    return {
      color: '#0F766E',
      bg: 'rgba(15, 118, 110, 0.14)',
      icon: solidIcon('M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z')
    };
  }
  if (key.includes('freelance')) {
    return {
      color: '#38BDF8',
      bg: 'rgba(56, 189, 248, 0.14)',
      icon: solidIcon('M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z')
    };
  }
  if (key.includes('invest')) {
    return {
      color: '#14B8A6',
      bg: 'rgba(20, 184, 166, 0.14)',
      icon: solidIcon('M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z')
    };
  }
  if (key.includes('loan')) {
    return {
      color: '#0284C7',
      bg: 'rgba(2, 132, 199, 0.14)',
      icon: solidIcon('M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z')
    };
  }
  if (key.includes('general')) {
    return {
      color: '#64748B',
      bg: 'rgba(100, 116, 139, 0.16)',
      icon: solidIcon('M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z')
    };
  }
  if (key.includes('other')) {
    return {
      color: '#94A3B8',
      bg: 'rgba(148, 163, 184, 0.16)',
      icon: solidIcon('M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z')
    };
  }
  if (key.includes('salary') || key.includes('income') || type === 'income') {
    return {
      color: '#16A34A',
      bg: 'rgba(22, 163, 74, 0.14)',
      icon: solidIcon('M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z')
    };
  }
  return {
    color: '#64748B',
    bg: 'rgba(100, 116, 139, 0.14)',
    icon: solidIcon('M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z')
  };
}

export const SAVINGS_ICON_KEYS = ['goal', 'emergency', 'travel', 'tech', 'car', 'home', 'invest', 'gift'] as const;
export type SavingsIconKey = (typeof SAVINGS_ICON_KEYS)[number];

export function normalizeSavingsIconKey(raw?: string): SavingsIconKey {
  const key = String(raw || '').trim().toLowerCase();
  if ((SAVINGS_ICON_KEYS as readonly string[]).includes(key)) return key as SavingsIconKey;
  if (key.includes('✈') || key.includes('🏖') || key.includes('🌍')) return 'travel';
  if (key.includes('📱') || key.includes('💻') || key.includes('🖥')) return 'tech';
  if (key.includes('🚗') || key.includes('🚙') || key.includes('🏍')) return 'car';
  if (key.includes('🏠') || key.includes('🏡')) return 'home';
  if (key.includes('📈') || key.includes('💰') || key.includes('🪙')) return 'invest';
  if (key.includes('🎁') || key.includes('🎉') || key.includes('💍')) return 'gift';
  if (key.includes('🛡') || key.includes('🏥') || key.includes('🚨')) return 'emergency';
  return 'goal';
}

export function renderSavingsIcon(raw?: string): React.ReactNode {
  const key = normalizeSavingsIconKey(raw);
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };
  switch (key) {
    case 'emergency':
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case 'travel':
      return <svg {...props}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>;
    case 'tech':
      return <svg {...props}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="2" y1="20" x2="22" y2="20" /></svg>;
    case 'car':
      return <svg {...props}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>;
    case 'home':
      return <svg {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
    case 'invest':
      return <svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    case 'gift':
      return <svg {...props}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
  }
}

export const LOAN_ICON_KEYS = ['bank', 'car', 'home', 'education', 'tech', 'bnpl', 'personal', 'business'] as const;
export type LoanIconKey = (typeof LOAN_ICON_KEYS)[number];

export function normalizeLoanIconKey(raw?: string, nameFallback = ''): LoanIconKey {
  const key = String(raw || '').trim().toLowerCase();
  if ((LOAN_ICON_KEYS as readonly string[]).includes(key)) return key as LoanIconKey;
  const text = `${key} ${nameFallback}`.toLowerCase();
  if (text.includes('car') || text.includes('kereta') || text.includes('honda') || text.includes('perodua') || text.includes('proton') || text.includes('vehicle')) return 'car';
  if (text.includes('home') || text.includes('house') || text.includes('mortgage') || text.includes('rumah') || text.includes('lppsa')) return 'home';
  if (text.includes('ptptn') || text.includes('study') || text.includes('edu') || text.includes('mara')) return 'education';
  if (text.includes('phone') || text.includes('laptop') || text.includes('iphone') || text.includes('macbook') || text.includes('tech')) return 'tech';
  if (text.includes('spaylater') || text.includes('atome') || text.includes('bnpl') || text.includes('grabpaylater')) return 'bnpl';
  if (text.includes('business') || text.includes('biz')) return 'business';
  if (text.includes('personal')) return 'personal';
  return 'bank';
}

export function renderLoanIcon(raw?: string, nameFallback = ''): React.ReactNode {
  const key = normalizeLoanIconKey(raw, nameFallback);
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };
  switch (key) {
    case 'car':
      return <svg {...props}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>;
    case 'home':
      return <svg {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
    case 'education':
      return <svg {...props}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>;
    case 'tech':
      return <svg {...props}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="2" y1="20" x2="22" y2="20" /></svg>;
    case 'bnpl':
      return <svg {...props}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
    case 'personal':
      return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'business':
      return <svg {...props}><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
    default:
      return <svg {...props}><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" /></svg>;
  }
}
