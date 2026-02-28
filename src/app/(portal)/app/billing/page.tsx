import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPortalUserContext, getWorkspaceLockReason, isWorkspaceReadOnly } from '@/lib/portal';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';

function formatBillingStatus(status: string | null) {
  if (!status) return 'Not Connected';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div>No workspace found.</div>;

  const { workspace } = context;
  const readOnly = isWorkspaceReadOnly(workspace);

  const billingLogs = await prisma.activityLog.findMany({
    where: {
      workspaceId: workspace.id,
      OR: [{ action: { contains: 'BILL' } }, { action: { contains: 'SUBSCRIPTION' } }, { action: { contains: 'PAYMENT' } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  const status = formatBillingStatus(workspace.stripeSubscriptionStatus);
  const renewalDate = workspace.stripeCurrentPeriodEnd ? new Date(workspace.stripeCurrentPeriodEnd).toLocaleDateString() : 'Not available';
  const canceledAt = workspace.stripeCanceledAt ? new Date(workspace.stripeCanceledAt).toLocaleDateString() : null;

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Revenue Operations"
        title="Billing"
        description="Subscription state, renewal visibility, and direct Stripe remediation for locked workspaces."
        rightSlot={
          <a href="/api/billing" className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ia-brand-gold-highlight)] hover:bg-[#d4af3733]">
            {readOnly ? 'Fix Billing in Stripe' : 'Open Stripe Portal'}
          </a>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Subscription Status" value={status} tone={readOnly ? 'danger' : 'success'} />
        <KpiCard label="Next Renewal" value={renewalDate} tone="info" />
        <KpiCard label="Access Mode" value={readOnly ? 'Read-only' : 'Full access'} tone={readOnly ? 'danger' : 'gold'} />
      </section>

      {readOnly ? (
        <Card className="p-4 border-[#ef444480] bg-[#ef444422]">
          <h2 className="font-semibold text-[#fecaca]">Billing lock is active</h2>
          <p className="text-sm text-[#fecaca] mt-1">
            Reason: {getWorkspaceLockReason(workspace)}. Use the billing action above to restore full access.
          </p>
        </Card>
      ) : null}

      <Card className="p-5 space-y-2">
        <h2 className="text-lg font-semibold text-[var(--ia-text-strong)]">Subscription Details</h2>
        <div className="text-sm text-[var(--ia-text)] space-y-1">
          <p>Stripe Customer ID: {workspace.stripeCustomerId || 'Not linked'}</p>
          <p>Stripe Subscription ID: {workspace.stripeSubscriptionId || 'Not linked'}</p>
          <p>Plan Key / Price Mapping: {workspace.stripePriceId || 'Not set'}</p>
          {canceledAt ? <p>Canceled On: {canceledAt}</p> : null}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--ia-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ia-text-strong)]">Billing Activity</h2>
          <StatusPill label={`${billingLogs.length} events`} tone="neutral" compact />
        </div>
        {billingLogs.length === 0 ? (
          <div className="p-4 text-sm text-[var(--ia-text-muted)]">No billing activity logs yet.</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {billingLogs.map((log) => (
              <article key={log.id} className="p-4">
                <p className="font-semibold text-[var(--ia-text-strong)]">{log.action}</p>
                <p className="text-xs text-[var(--ia-text-muted)] mt-1">{new Date(log.createdAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
