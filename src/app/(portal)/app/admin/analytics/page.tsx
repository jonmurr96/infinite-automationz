import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getPortalUserContext } from '@/lib/portal';
import { getAdminAnalyticsSeries, getAdminAnalyticsSummary } from '@/lib/queries/admin-analytics';
import type { DateRangePreset } from '@/types/portal-analytics';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import AnalyticsCharts from './AnalyticsCharts';

function normalizeRange(value: string | undefined): DateRangePreset {
  if (value === '7d' || value === '30d' || value === '90d') return value;
  return '30d';
}

function LegacyAdminAnalytics({
  stats,
}: {
  stats: Awaited<ReturnType<typeof getAdminAnalyticsSummary>>;
}) {
  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-[var(--ia-text-strong)]">Admin Analytics</h1>
        <p className="text-[var(--ia-text)] mt-2">Subscription health and operations summary.</p>
      </header>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Clients" value={String(stats.activeClients)} tone="gold" />
        <KpiCard label="Estimated MRR" value={`$${stats.estimatedMRR.toLocaleString()}`} tone="success" />
        <KpiCard label="Pending Approvals" value={String(stats.pendingApprovals)} tone="warning" />
        <KpiCard label="Avg Turnaround" value={`${stats.avgTurnaroundDays.toFixed(1)}d`} tone="info" />
      </section>
    </div>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context || context.user.role !== 'ADMIN') redirect('/app');

  const range = normalizeRange(searchParams?.range);
  const [summary, series] = await Promise.all([
    getAdminAnalyticsSummary(),
    getAdminAnalyticsSeries(range),
  ]);

  if (process.env.NEXT_PUBLIC_FORCE_LEGACY_ADMIN_ANALYTICS === '1') {
    return <LegacyAdminAnalytics stats={summary} />;
  }

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Operations Intelligence"
        title="Admin Analytics V2"
        description="Executive command-center metrics for workload pressure, client health, and delivery velocity."
        rightSlot={
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--ia-border)] bg-white/[0.02] p-1">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <Link
                key={r}
                href={`/app/admin/analytics?range=${r}`}
                className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors duration-150 ${
                  range === r
                    ? 'bg-[var(--ia-brand-gold-soft)] text-[var(--ia-brand-gold-highlight)] border border-[#d4af3760]'
                    : 'text-[var(--ia-text)] hover:bg-white/[0.06]'
                }`}
              >
                {r}
              </Link>
            ))}
          </div>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Active Clients" value={String(summary.activeClients)} tone="gold" hint="Subscribed and active" />
        <KpiCard label="Estimated MRR" value={`$${summary.estimatedMRR.toLocaleString()}`} tone="success" hint="Mapped from active plan keys" />
        <KpiCard label="Pending Approvals" value={String(summary.pendingApprovals)} tone="warning" hint={`${summary.avgApprovalAgingHours.toFixed(1)}h average aging`} />
        <KpiCard label="Avg Turnaround" value={`${summary.avgTurnaroundDays.toFixed(1)}d`} tone="info" hint="From created to completed" />
        <KpiCard label="Revision Load" value={String(summary.totalRevisions)} tone="danger" hint={`${summary.workload7} due in 7d`} />
      </section>

      {series.length === 0 ? (
        <EmptyState title="No analytics data yet" description="Once work items are created and updated, trend analytics will appear here." />
      ) : (
        <AnalyticsCharts series={series} />
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)]">Billing Risk</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--ia-text-strong)]">
            {summary.paymentFailedCount} failed / {summary.canceledCount} canceled
          </p>
          <p className="mt-2 text-sm text-[var(--ia-text-muted)]">Use this to prioritize collections and churn prevention.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)]">Workload Forecast</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--ia-text-strong)]">{summary.workload7} (7d) / {summary.workload30} (30d)</p>
          <p className="mt-2 text-sm text-[var(--ia-text-muted)]">Near-term due-date pressure across all client workspaces.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)]">Action Priority</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--ia-text-strong)]">
            {summary.pendingApprovals > summary.workload7 ? 'Approval bottleneck' : 'Execution bottleneck'}
          </p>
          <p className="mt-2 text-sm text-[var(--ia-text-muted)]">Derived from approval queue vs immediate workload.</p>
        </Card>
      </section>
    </div>
  );
}
