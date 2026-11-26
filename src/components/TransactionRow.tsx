import type { Transaction } from '@/types/finance';
import { getCategoryMeta } from '@/utils/categories';
import { formatCurrency, formatDisplayDate, haptic } from '@/utils/format';

interface TransactionRowProps {
  tx: Transaction;
  currency: string;
  cardName?: string;
  onInspect: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionRow({ tx, currency, cardName, onInspect, onDelete }: TransactionRowProps) {
  const isExpense = tx.type === 'expense';
  const meta = getCategoryMeta(tx.category || 'Other', tx.type);
  const title = tx.description || tx.category || 'Transaction';
  const sign = isExpense ? '-' : '+';
  const isCC = (tx.paymentMethod === 'credit' || Boolean(tx.cardId)) && tx.category !== 'Credit Card Payment';
  const isMyKasih = tx.paymentMethod === 'mykasih';

  return (
    <div
      className="sw-tx-card"
      role="button"
      tabIndex={0}
      onClick={() => {
        haptic();
        onInspect(tx);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          haptic();
          onInspect(tx);
        }
      }}
    >
      <div className="sw-tx-icon" style={{ background: meta.bg, color: meta.color }}>
        {meta.icon}
      </div>
      <div className="sw-tx-body">
        <div className="sw-tx-title">{title}</div>
        <div className="sw-tx-sub">
          {tx.category || 'Other'} • {formatDisplayDate(tx.date)}
        </div>
        {isCC && cardName && <div className="sw-tx-badge">{cardName}</div>}
        {!isCC && isMyKasih && <div className="sw-tx-badge">MyKasih</div>}
      </div>
      <div className="sw-tx-right">
        <span className={`sw-tx-amount ${tx.type}`}>
          {sign}
          {formatCurrency(tx.amount, currency)}
        </span>
        <button
          type="button"
          className="sw-tx-del"
          aria-label={`Delete ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            haptic();
            onDelete(tx);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
