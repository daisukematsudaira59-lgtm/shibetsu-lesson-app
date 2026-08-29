import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { Judgement } from '../../analysis/types';
import { GLOSSARY } from '../../explain/glossary';

export function Card({
  children,
  tight,
  className = '',
  style,
}: {
  children: ReactNode;
  tight?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`card ${tight ? 'tight' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="between">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-sub" style={{ margin: 0 }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stars({ value, size = 19 }: { value: number; size?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`5段階中 ${value}`} role="img">
      {[0, 1, 2, 3, 4].map((i) => {
        if (i < full) return <span key={i} className="on">★</span>;
        if (i === full && half)
          return (
            <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
              <span className="off">★</span>
              <span
                className="on"
                style={{ position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden' }}
              >
                ★
              </span>
            </span>
          );
        return <span key={i} className="off">★</span>;
      })}
    </span>
  );
}

export function Pill({ tone = 'na', children }: { tone?: Judgement | 'brand'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Bar({ ratio, color }: { ratio: number; color?: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, background: color }} />
    </div>
  );
}

/** 用語解説モーダル（初心者モードの「？」ボタン） */
export function TermButton({ termKey }: { termKey?: string }) {
  const [open, setOpen] = useState(false);
  const t = termKey ? GLOSSARY[termKey] : undefined;
  if (!t) return null;
  return (
    <>
      <button className="term-btn" onClick={() => setOpen(true)} aria-label={`${t.label}とは`}>
        ?
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title={t.label}>
          <p style={{ fontSize: 15, fontWeight: 700, marginTop: 0 }}>{t.short}</p>
          <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink-2)' }}>{t.detail}</p>
          {t.guide && <div className="note">目安：{t.guide}</div>}
        </Modal>
      )}
    </>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 8 }}>
          <h3>{title}</h3>
          <button className="btn" onClick={onClose} style={{ padding: '6px 14px' }}>
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fmtPrice = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));
