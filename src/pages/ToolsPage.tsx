import React, { useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, haptic } from '@/utils/format';

interface ToolsPageProps {
  onAddMyKasihTx: () => void;
  onEditMyKasih: () => void;
}

export function ToolsPage({ onAddMyKasihTx, onEditMyKasih }: ToolsPageProps) {
  const {
    settings,
    checklist,
    mykasihBalance,
    mykasihSpentThisMonth,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem
  } = useFinance();

  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const currency = settings.currency;

  const paidCount = checklist.filter((c) => c.paid).length;
  const pct = checklist.length > 0 ? Math.round((paidCount / checklist.length) * 100) : 0;

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = itemName.trim();
    const amt = parseFloat(itemAmount) || 0;
    if (!name) return;
    await addChecklistItem(name, amt);
    setItemName('');
    setItemAmount('');
  };

  return (
    <section id="page-tools" className="page active" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* MyKasih Card */}
      <div className="section-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem' }}>MyKasih</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
              {formatCurrency(settings.mykasihAllowance ?? 50, currency)} monthly allowance
            </span>
          </div>
          <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', color: 'var(--income)' }}>
            {formatCurrency(mykasihBalance, currency)}
          </strong>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', marginBottom: '0.85rem' }}>
          Spent this month: <strong style={{ color: 'var(--expense)' }}>{formatCurrency(mykasihSpentThisMonth, currency)}</strong>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={() => { haptic(); onAddMyKasihTx(); }}>
            + Add MyKasih Expense
          </button>
          <button type="button" className="btn-secondary" onClick={() => { haptic(); onEditMyKasih(); }}>
            Edit
          </button>
        </div>
      </div>

      {/* Monthly Payment Checklist */}
      <div className="section-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem' }}>Monthly Checklist</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
              {paidCount} of {checklist.length} paid
            </span>
          </div>
          <span style={{ fontWeight: 700, color: 'var(--primary-ink)' }}>{pct}%</span>
        </div>

        <div className="sw-budget-track" style={{ marginBottom: '0.85rem' }}>
          <div className="sw-budget-fill" style={{ width: `${pct}%`, background: 'var(--primary-ink)' }} />
        </div>

        <div className="checklist-list" style={{ marginBottom: '0.85rem' }}>
          {checklist.length === 0 ? (
            <div className="checklist-empty">No items yet. Add your first monthly bill below.</div>
          ) : (
            checklist.map((item) => (
              <div key={item.id} className={`checklist-item${item.paid ? ' paid' : ''}`}>
                <input
                  type="checkbox"
                  checked={item.paid}
                  onChange={() => {
                    haptic();
                    void toggleChecklistItem(item);
                  }}
                />
                <span className="checklist-item-name" style={{ flex: 1 }}>
                  {item.name}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>
                  {formatCurrency(item.amount, currency)}
                </span>
                <button
                  type="button"
                  className="sw-budget-icon-btn danger"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => void deleteChecklistItem(item.id)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <form className="checklist-add-form" onSubmit={handleAddChecklist}>
          <input
            type="text"
            className="checklist-input"
            placeholder="e.g. Netflix, Rent..."
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
          <input
            type="text"
            className="checklist-input"
            style={{ maxWidth: 96 }}
            placeholder="0.00"
            inputMode="decimal"
            value={itemAmount}
            onChange={(e) => setItemAmount(e.target.value)}
          />
          <button type="submit" className="checklist-add-btn">
            + Add
          </button>
        </form>
      </div>
    </section>
  );
}
