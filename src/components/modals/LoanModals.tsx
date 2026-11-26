import React, { useEffect, useState } from 'react';
import { ModalSheet } from '@/components/modals/ModalSheet';
import { useFinance } from '@/context/FinanceContext';
import type { LoanColor, LoanItem } from '@/types/finance';
import { LOAN_COLORS, LOAN_ICON_KEYS, normalizeLoanIconKey, renderLoanIcon } from '@/utils/categories';
import { formatCurrency, formatDisplayDate, haptic, todayISO } from '@/utils/format';

interface LoanModalProps {
  open: boolean;
  editingLoan: LoanItem | null;
  onClose: () => void;
}

export function LoanModal({ open, editingLoan, onClose }: LoanModalProps) {
  const { settings, saveLoan } = useFinance();
  const [person, setPerson] = useState('');
  const [desc, setDesc] = useState('');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('0');
  const [monthly, setMonthly] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [icon, setIcon] = useState('bank');
  const [color, setColor] = useState<LoanColor>('blue');
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingLoan) {
      setPerson(editingLoan.person || '');
      setDesc(editingLoan.desc || '');
      setTotal(String(Number(editingLoan.total || 0).toFixed(2)));
      setPaid(String(Number(editingLoan.paid || 0).toFixed(2)));
      setMonthly(editingLoan.monthlyInstallment ? String(Number(editingLoan.monthlyInstallment).toFixed(2)) : '');
      setDueDay(editingLoan.dueDay ? String(editingLoan.dueDay) : '');
      setIcon(normalizeLoanIconKey(editingLoan.icon, editingLoan.person));
      setColor(editingLoan.color || 'blue');
      setDue(editingLoan.due || '');
    } else {
      setPerson('');
      setDesc('');
      setTotal('');
      setPaid('0');
      setMonthly('');
      setDueDay('');
      setIcon('bank');
      setColor('blue');
      setDue('');
    }
  }, [open, editingLoan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = person.trim();
    const numTotal = parseFloat(total);
    const numPaid = parseFloat(paid) || 0;
    const numMonthly = parseFloat(monthly) || 0;
    const rawDue = parseInt(dueDay, 10);
    const parsedDueDay = !Number.isNaN(rawDue) && rawDue >= 1 && rawDue <= 31 ? rawDue : null;

    if (!trimmed) return setError('Please enter a loan name or lender.');
    if (!numTotal || numTotal <= 0) return setError('Please enter a valid total loan amount.');
    if (numPaid > numTotal) return setError('Paid amount cannot exceed total loan amount.');

    setSaving(true);
    try {
      await saveLoan(
        {
          person: trimmed,
          desc: desc.trim(),
          total: numTotal,
          paid: numPaid,
          monthlyInstallment: numMonthly,
          dueDay: parsedDueDay,
          icon,
          color,
          due
        },
        editingLoan?.id
      );
      onClose();
    } catch {
      setError('Failed to save loan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={open} title={editingLoan ? 'Edit Loan / Installment' : 'New Loan / Installment'} onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-name">Loan / Lender Name</label>
          <input id="loan-name" type="text" placeholder="e.g. Maybank Financing, PTPTN" value={person} onChange={(e) => setPerson(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-desc">Description (optional)</label>
          <input id="loan-desc" type="text" placeholder="e.g. Study Loan, Car Loan" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-total">Total Loan Amount</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="loan-total" type="text" placeholder="0.00" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-paid">Already Paid</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="loan-paid" type="text" placeholder="0.00" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-monthly">Monthly Installment (optional)</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="loan-monthly" type="text" placeholder="0.00" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-due-day">Monthly Due Day (1 to 31, optional)</label>
          <input id="loan-due-day" type="number" min={1} max={31} placeholder="e.g. 25" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {LOAN_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`tx-cat-tile${icon === k ? ' active' : ''}`}
                style={{ minHeight: 38, minWidth: 38, padding: '0.35rem' }}
                onClick={() => {
                  haptic();
                  setIcon(k);
                }}
              >
                {renderLoanIcon(k)}
              </button>
            ))}
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Color</label>
          <div className="cc-color-picker">
            {LOAN_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={c.label}
                className={`cc-color-swatch${color === c.key ? ' active' : ''}`}
                style={{ background: c.color }}
                onClick={() => {
                  haptic();
                  setColor(c.key);
                }}
              />
            ))}
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-due-date">Final Due Date (optional)</label>
          <input id="loan-due-date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Loan'}
        </button>
      </form>
    </ModalSheet>
  );
}

interface LoanPayModalProps {
  loan: LoanItem | null;
  onClose: () => void;
}

export function LoanPayModal({ loan, onClose }: LoanPayModalProps) {
  const { settings, recordLoanPayment } = useFinance();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loan) return;
    const defaultAmt = loan.monthlyInstallment || Math.max(0, Number(loan.total) - Number(loan.paid));
    setAmount(defaultAmt > 0 ? Number(defaultAmt).toFixed(2) : '');
    setDate(todayISO());
    setNote('');
    setError('');
  }, [loan]);

  if (!loan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (!num || num <= 0) return setError('Please enter a valid payment amount.');
    setSaving(true);
    try {
      await recordLoanPayment(loan.id, num, date, note.trim());
      onClose();
    } catch {
      setError('Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet open={Boolean(loan)} title={`Pay ${loan.person}`} onClose={onClose} small>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {error && (
          <div className="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-pay-amt">Payment Amount</label>
          <div className="amount-input-wrap">
            <span className="currency-symbol">{settings.currency}</span>
            <input id="loan-pay-amt" type="text" placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-pay-date">Payment Date</label>
          <input id="loan-pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label htmlFor="loan-pay-note">Note (optional)</label>
          <input id="loan-pay-note" type="text" placeholder="e.g. Nov installment" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Record Payment'}
        </button>
      </form>
    </ModalSheet>
  );
}

interface LoanDetailsModalProps {
  loanId: string | null;
  onClose: () => void;
}

export function LoanDetailsModal({ loanId, onClose }: LoanDetailsModalProps) {
  const { loans, settings, deleteLoanHistoryItem } = useFinance();
  const loan = loanId ? loans.find((l) => l.id === loanId) || null : null;
  if (!loan) return null;

  const remaining = Math.max(0, (Number(loan.total) || 0) - (Number(loan.paid) || 0));
  const history = loan.history || [];

  return (
    <ModalSheet open={Boolean(loan)} title={loan.person} onClose={onClose} small>
      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-elevated)', padding: '0.85rem 1rem', borderRadius: 12 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>Remaining</div>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', color: remaining > 0 ? 'var(--expense)' : 'var(--income)' }}>
            {formatCurrency(remaining, settings.currency)}
          </strong>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>Paid of Total</div>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem' }}>
            {formatCurrency(loan.paid, settings.currency)} / {formatCurrency(loan.total, settings.currency)}
          </strong>
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink-secondary)', marginTop: '0.25rem' }}>
        Payment History ({history.length})
      </div>
      {history.length === 0 ? (
        <div style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>No payments recorded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {history.map((item, idx) => (
            <div
              key={`${item.date}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-elevated)',
                padding: '0.65rem 0.85rem',
                borderRadius: 10
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{item.note || 'Installment payment'}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--ink-secondary)' }}>{formatDisplayDate(item.date)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ color: 'var(--income)' }}>{formatCurrency(item.amount, settings.currency)}</strong>
                <button
                  type="button"
                  className="sw-budget-icon-btn danger"
                  aria-label="Delete payment entry"
                  onClick={() => void deleteLoanHistoryItem(loan.id, idx)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalSheet>
  );
}
