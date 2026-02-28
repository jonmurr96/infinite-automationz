import type { MockTimelineEvent } from '@/lib/mock/crm-data';
import type { ReactNode } from 'react';

function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function SectionHeader({
  eyebrow,
  title,
  copy,
  right,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  right?: ReactNode;
}) {
  return (
    <header className="crm-section-header">
      <div>
        <p className="crm-eyebrow">{eyebrow}</p>
        <h1 className="crm-title">{title}</h1>
        {copy ? <p className="crm-copy">{copy}</p> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </header>
  );
}

export function KpiCard({
  label,
  value,
  change,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  change: string;
  tone?: 'neutral' | 'positive' | 'warning';
}) {
  return (
    <article className={clsx('crm-kpi-card', tone === 'positive' && 'is-positive', tone === 'warning' && 'is-warning')}>
      <p className="crm-kpi-label">{label}</p>
      <p className="crm-kpi-value">{value}</p>
      <p className="crm-kpi-change">{change}</p>
    </article>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="crm-panel">
      <div className="crm-panel-head">
        <div>
          <h2 className="crm-panel-title">{title}</h2>
          {subtitle ? <p className="crm-panel-subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatusChip({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = normalized.includes('active') || normalized.includes('paid') || normalized.includes('won') || normalized.includes('connected')
    ? 'success'
    : normalized.includes('new') || normalized.includes('open') || normalized.includes('prospect') || normalized.includes('trial')
      ? 'info'
      : normalized.includes('warning') || normalized.includes('qualified') || normalized.includes('attention') || normalized.includes('invited')
        ? 'warning'
        : normalized.includes('failed') || normalized.includes('lost') || normalized.includes('past') || normalized.includes('canceled')
          ? 'danger'
          : 'muted';

  return <span className={clsx('crm-chip', `tone-${tone}`)}>{status}</span>;
}

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={clsx('crm-filter-chip', active && 'active')}>
      {label}
    </button>
  );
}

export function Timeline({ events }: { events: MockTimelineEvent[] }) {
  return (
    <div className="crm-timeline">
      {events.map((event) => (
        <article key={event.id} className="crm-timeline-row">
          <span className={clsx('crm-timeline-dot', `type-${event.type}`)} />
          <div>
            <h4 className="crm-timeline-title">{event.title}</h4>
            <p className="crm-timeline-desc">{event.description}</p>
            <p className="crm-timeline-time">{event.timestamp}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function EmptyHint({ text }: { text: string }) {
  return <p className="crm-empty">{text}</p>;
}
