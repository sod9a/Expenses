import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';
import type { Transaction } from '@/types/finance';
import { formatCurrency, formatDisplayDate, haptic } from '@/utils/format';

interface TransactionDetailsModalProps {
  tx: Transaction | null;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionDetailsModal({ tx, onClose, onEdit, onDelete }: TransactionDetailsModalProps) {
  const { settings, getCardNameById } = useFinance();
  if (!tx) return null;

  const isExpense = tx.type === 'expense';
  const payLabel =
    tx.paymentMethod === 'credit' || tx.cardId
      ? `Credit Card (${getCardNameById(tx.cardId)})`
      : tx.paymentMethod === 'mykasih'
        ? 'MyKasih'
        : 'Cash / Debit';

  return (
    <ModalSheet open={Boolean(tx)} title="Transaction Details" onClose={onClose} small>
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <div
          style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1.85rem',
            fontWeight: 800,
            color: isExpense ? 'var(--expense)' : 'var(--income)'
          }}
        >
          {isExpense ? '-' : '+'}
          {formatCurrency(tx.amount, settings.currency)}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>{tx.description}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', background: 'var(--bg-elevated)', padding: '0.9rem 1rem', borderRadius: 12, fontSize: '0.86rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--ink-secondary)' }}>Category</span>
          <strong>{tx.category}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--ink-secondary)' }}>Date</span>
          <strong>{formatDisplayDate(tx.date)}</strong>
        </div>
        {isExpense && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ink-secondary)' }}>Payment</span>
            <strong>{payLabel}</strong>
          </div>
        )}
        {tx.notes && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.55rem', marginTop: '0.2rem' }}>
            <div style={{ color: 'var(--ink-secondary)', fontSize: '0.78rem', marginBottom: '0.2rem' }}>Notes</div>
            <div>{tx.notes}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.35rem' }}>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 2, marginTop: 0 }}
          onClick={() => {
            haptic();
            onClose();
            onEdit(tx);
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn-danger"
          style={{ flex: 1 }}
          onClick={() => {
            haptic();
            onClose();
            onDelete(tx);
          }}
        >
          Delete
        </button>
      </div>
    </ModalSheet>
  );
}
