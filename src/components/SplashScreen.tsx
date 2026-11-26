interface SplashScreenProps {
  message?: string;
}

export function SplashScreen({ message = 'Loading ExpenseFlow…' }: SplashScreenProps) {
  return (
    <div className="splash-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="splash-content">
        <img
          src={`${import.meta.env.BASE_URL}favicon.png`}
          alt="ExpenseFlow"
          className="splash-logo"
          width={72}
          height={72}
        />
        <h1 className="splash-title">ExpenseFlow</h1>
        <div className="splash-bar" aria-hidden="true">
          <div className="splash-bar-fill" />
        </div>
        <p className="splash-status">{message}</p>
      </div>
    </div>
  );
}
