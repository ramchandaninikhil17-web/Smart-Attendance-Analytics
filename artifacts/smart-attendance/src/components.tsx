import { type ReactNode, useEffect, useId } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled = false,
  testId,
  form
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  testId?: string;
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={`button button-${variant} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = '',
  id,
  style,
  ...props
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}) {
  return (
    <section id={id} style={style} className={`card ${className}`} data-testid={props['data-testid']}>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = ''
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'teal' | 'muted' | 'purple';
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 520
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-panel"
        style={{ maxWidth: `${maxWidth}px` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="button-close-dialog"
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </section>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        {icon || <span />}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search records',
  testId = 'input-search'
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <label className="search-field">
      <span className="sr-only">{placeholder}</span>
      <span className="search-icon">⌕</span>
      <input
        data-testid={testId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </label>
  );
}

export function SelectField({
  value,
  onChange,
  children,
  label,
  testId
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label: string;
  testId?: string;
}) {
  return (
    <label className="select-wrap">
      <span className="sr-only">{label}</span>
      <select data-testid={testId} value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  helperText,
  testId
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  helperText?: string;
  testId?: string;
}) {
  return (
    <label className="form-field">
      <span>{label} {required && <strong className="required-star">*</strong>}</span>
      <input
        required={required}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        data-testid={testId}
      />
      {helperText && <small className="field-helper">{helperText}</small>}
    </label>
  );
}

/**
 * Procedural Dynamic SVG QR Code
 * Renders standard 25x25 QR matrix structure with position finders, timing belts,
 * and pseudo-random deterministic data pattern keyed to the code string.
 */
export function DynamicQrCode({
  code,
  size = 180,
  logoText = 'NS'
}: {
  code: string;
  size?: number;
  logoText?: string;
}) {
  const N = 25;
  const grid: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  // Helper: place a 7x7 Finder Pattern at (r, c)
  const placeFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6) grid[r + i][c + j] = true;
        else if (i >= 2 && i <= 4 && j >= 2 && j <= 4) grid[r + i][c + j] = true;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, N - 7);
  placeFinder(N - 7, 0);

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    if (i % 2 === 0) {
      grid[6][i] = true;
      grid[i][6] = true;
    }
  }

  // Alignment pattern at (16, 16)
  for (let i = 16; i <= 20; i++) {
    for (let j = 16; j <= 20; j++) {
      if (i === 16 || i === 20 || j === 16 || j === 20 || (i === 18 && j === 18)) {
        grid[i][j] = true;
      }
    }
  }

  // Seeded hash for pseudo-random data bits
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      // Skip finders & separators
      const inTopLeft = r <= 7 && c <= 7;
      const inTopRight = r <= 7 && c >= N - 8;
      const inBottomLeft = r >= N - 8 && c <= 7;
      const inCenterLogo = r >= 10 && r <= 14 && c >= 10 && c <= 14;
      const inTiming = r === 6 || c === 6;
      const inAlignment = r >= 16 && r <= 20 && c >= 16 && c <= 20;

      if (!inTopLeft && !inTopRight && !inBottomLeft && !inCenterLogo && !inTiming && !inAlignment) {
        hash = (hash * 1103515245 + 12345) >>> 0;
        grid[r][c] = (hash % 100) < 52;
      }
    }
  }

  const cellSize = size / N;

  return (
    <div className="qr-container" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="qr-svg"
        role="img"
        aria-label={`QR Code for session ${code}`}
      >
        <rect width={size} height={size} fill="#ffffff" rx={8} />
        {grid.flatMap((row, r) =>
          row.map((active, c) => {
            if (!active) return null;
            // Clear center for logo
            if (r >= 10 && r <= 14 && c >= 10 && c <= 14) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize - 0.2}
                height={cellSize - 0.2}
                fill="#1c2826"
                rx={cellSize * 0.2}
              />
            );
          })
        )}
        {/* Center Emblem */}
        <rect
          x={10 * cellSize}
          y={10 * cellSize}
          width={5 * cellSize}
          height={5 * cellSize}
          fill="#187667"
          rx={4}
        />
        <text
          x={12.5 * cellSize}
          y={13.2 * cellSize}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={cellSize * 2.2}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {logoText}
        </text>
      </svg>
    </div>
  );
}

export function RiskScoreBadge({ score }: { score: number }) {
  const level = score >= 70 ? 'High' : score >= 35 ? 'Medium' : 'Low';
  const tone = score >= 70 ? 'red' : score >= 35 ? 'amber' : 'green';
  const Icon = score >= 70 ? ShieldAlert : score >= 35 ? AlertTriangle : ShieldCheck;

  return (
    <span className={`risk-badge risk-${tone}`}>
      <Icon size={12} />
      <span>{score}/100</span>
      <small>({level})</small>
    </span>
  );
}