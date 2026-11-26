import { haptic } from '@/utils/format';

interface FloatingAddButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function FloatingAddButton({ visible, onClick }: FloatingAddButtonProps) {
  if (!visible) return null;
  return (
    <button
      id="sw-fab"
      className="sw-fab"
      type="button"
      onClick={() => {
        haptic();
        onClick();
      }}
      aria-label="Add Transaction"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}
