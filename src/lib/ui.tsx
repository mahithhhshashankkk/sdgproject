import type { ReactNode } from 'react';

// Shared visual primitives. Color-coded, large touch targets, minimal text.

export const STATUS_COLORS: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
};

export function StatusDot({ color }: { color: 'green' | 'yellow' | 'red' | 'blue' }) {
  return <span className={`inline-block w-4 h-4 rounded-full ${STATUS_COLORS[color]}`} aria-hidden />;
}

export function IconTile({
  icon, label, onClick, color = 'bg-white', textColor = 'text-gray-800',
}: {
  icon: ReactNode; label: string; onClick?: () => void;
  color?: string; textColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`${color} ${textColor} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[112px] active:scale-95 transition-transform shadow-sm`}
    >
      <span className="w-10 h-10 flex items-center justify-center">{icon}</span>
      <span className="text-sm font-semibold text-center leading-tight">{label}</span>
    </button>
  );
}

export function BigButton({
  children, onClick, color = 'bg-blue-600', text = 'text-white', disabled = false,
}: { children: ReactNode; onClick?: () => void; color?: string; text?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${color} ${text} rounded-2xl px-6 py-4 text-lg font-bold min-h-[56px] w-full active:scale-95 transition-transform shadow-md disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-h-screen bg-amber-50 flex flex-col ${className}`}>{children}</div>;
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="bg-amber-500 text-white px-4 py-4 flex items-center gap-3 shadow-md sticky top-0 z-10">
      {onBack && (
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 active:scale-90" aria-label="Back">
          <span className="text-2xl">‹</span>
        </button>
      )}
      <h1 className="text-xl font-bold flex-1">{title}</h1>
      {right}
    </header>
  );
}
