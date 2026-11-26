import type { PageId } from '@/types/finance';
import { haptic } from '@/utils/format';

interface BottomNavProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
}

export function BottomNav({ page, onNavigate }: BottomNavProps) {
  const walletActive = page === 'wallet' || page === 'tools' || page === 'categories' || page === 'monthly' || page === 'settings';

  const items: { id: PageId; label: string; active: boolean; icon: JSX.Element }[] = [
    {
      id: 'dashboard',
      label: 'Home',
      active: page === 'dashboard',
      icon: (
        <svg className="nav-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      )
    },
    {
      id: 'transactions',
      label: 'History',
      active: page === 'transactions',
      icon: (
        <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M16 8h-6" />
          <path d="M16 12H8" />
          <path d="M13 16H8" />
        </svg>
      )
    },
    {
      id: 'budgets',
      label: 'Budgets',
      active: page === 'budgets',
      icon: (
        <svg className="nav-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z" />
        </svg>
      )
    },
    {
      id: 'wallet',
      label: 'Wallet',
      active: walletActive,
      icon: (
        <svg className="nav-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 7H3V5h18v2zm0 2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2zm-5 7c-.83 0-1.5-.67-1.5-1.5S15.17 13 16 13s1.5.67 1.5 1.5S16.83 16 16 16z" />
        </svg>
      )
    }
  ];

  return (
    <nav className="bottom-nav" id="bottom-nav" aria-label="Main navigation">
      <div className="mob-nav-pill">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`nav-item${item.active ? ' active' : ''}`}
            data-page={item.id}
            aria-current={item.active ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              haptic();
              onNavigate(item.id);
            }}
          >
            <div className="nav-item-inner">
              <span className="nav-pill-bg">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </div>
          </a>
        ))}
      </div>
    </nav>
  );
}
