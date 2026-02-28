import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPortalUserContext } from '@/lib/portal';
import { getAdminCustomerRows } from '@/lib/queries/admin-customers';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import type { AdminCustomerFilter, AdminCustomerRowDTO } from '@/types/portal-customers';

function formatStatus(status: string | null) {
  if (!status) return 'Unknown';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeFilter(searchParams?: {
  q?: string;
  status?: string;
  module?: string;
  risk?: string;
}): AdminCustomerFilter {
  return {
    q: searchParams?.q || '',
    status: (searchParams?.status as AdminCustomerFilter['status']) || 'all',
    module: (searchParams?.module as AdminCustomerFilter['module']) || 'all',
    risk: (searchParams?.risk as AdminCustomerFilter['risk']) || 'all',
  };
}

function LegacyAdminCustomers({ rows }: { rows: AdminCustomerRowDTO[] }) {
  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-[var(--ia-text-strong)]">Customers</h1>
        <p className="text-[var(--ia-text)] mt-2">Subscription state, module entitlements, and workspace activity.</p>
      </header>
      <Card className="p-4">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.workspaceId} className="rounded-[10px] border border-[var(--ia-border)] p-3">
              <p className="font-semibold text-[var(--ia-text-strong)]">{row.customerDisplayName || row.customerEmail}</p>
              <p className="text-xs text-[var(--ia-text-muted)]">{formatStatus(row.subscriptionStatus)} • {row.modules.join(', ') || 'No modules'}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; module?: string; risk?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context || context.user.role !== 'ADMIN') redirect('/app');

  const filter = normalizeFilter(searchParams);
  const rows = await getAdminCustomerRows(filter);

  const cookieStore = await cookies();
  const activePreviewWorkspaceId = cookieStore.get('admin_workspace_id')?.value || null;

  async function setPreviewWorkspace(formData: FormData) {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const context = await getPortalUserContext(session.userId);
    if (!context || context.user.role !== 'ADMIN') throw new Error('Forbidden');

    const workspaceId = String(formData.get('workspaceId') || '').trim();
    if (!workspaceId) return;

    const exists = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
    if (!exists) throw new Error('Workspace not found');

    const cookieStore = await cookies();
    cookieStore.set({
      name: 'admin_workspace_id',
      value: workspaceId,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
    });

    revalidatePath('/app');
    redirect('/app');
  }

  async function clearPreviewWorkspace() {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const context = await getPortalUserContext(session.userId);
    if (!context || context.user.role !== 'ADMIN') throw new Error('Forbidden');

    const cookieStore = await cookies();
    cookieStore.delete('admin_workspace_id');

    revalidatePath('/app');
    revalidatePath('/app/admin/customers');
  }

  if (process.env.NEXT_PUBLIC_FORCE_LEGACY_ADMIN_CUSTOMERS === '1') {
    return <LegacyAdminCustomers rows={rows} />;
  }

  const columns: DataTableColumn<AdminCustomerRowDTO>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--ia-text-strong)]">{row.customerDisplayName || row.customerEmail}</p>
          <p className="text-xs text-[var(--ia-text-muted)] mt-1">{row.customerEmail}</p>
          <p className="text-xs text-[var(--ia-text-muted)] mt-1">Workspace: {row.workspaceName}</p>
        </div>
      ),
    },
    {
      key: 'billing',
      header: 'Billing',
      render: (row) => (
        <div>
          <StatusPill
            label={formatStatus(row.subscriptionStatus)}
            tone={row.subscriptionStatus === 'active' ? 'success' : row.subscriptionStatus === 'payment_failed' ? 'danger' : row.subscriptionStatus === 'canceled' ? 'warning' : 'neutral'}
            compact
          />
          <p className="text-xs text-[var(--ia-text-muted)] mt-2">Renewal: {row.renewalDate ? new Date(row.renewalDate).toLocaleDateString() : 'n/a'}</p>
          <p className="text-xs text-[var(--ia-text-muted)] mt-1">Plan: {row.planKey || 'n/a'}</p>
        </div>
      ),
    },
    {
      key: 'modules',
      header: 'Modules',
      render: (row) => (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {row.modules.length ? row.modules.map((moduleType) => (
              <StatusPill key={`${row.workspaceId}-${moduleType}`} label={moduleType} tone="info" compact />
            )) : <span className="text-xs text-[var(--ia-text-muted)]">No modules</span>}
          </div>
          <p className="text-xs text-[var(--ia-text-muted)]">Items: {row.totalItems} • Threads: {row.totalThreads}</p>
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (row) => (
        <div>
          <StatusPill
            label={row.risk.toUpperCase()}
            tone={row.risk === 'high' ? 'danger' : row.risk === 'medium' ? 'warning' : 'success'}
            compact
          />
          <p className="text-xs text-[var(--ia-text-muted)] mt-2">Pending approvals: {row.pendingApprovals}</p>
        </div>
      ),
    },
    {
      key: 'recent',
      header: 'Recent Activity',
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--ia-text-strong)]">{row.lastActivityTitle || 'No work items yet'}</p>
          {row.lastActivityType ? <p className="text-xs text-[var(--ia-text-muted)] mt-1">{row.lastActivityType} • {row.lastActivityStatus}</p> : null}
          {row.lastActivityAt ? <p className="text-xs text-[var(--ia-text-muted)] mt-1">Updated {formatDistanceToNowStrict(new Date(row.lastActivityAt), { addSuffix: true })}</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2 justify-end">
          <form action={setPreviewWorkspace}>
            <input type="hidden" name="workspaceId" value={row.workspaceId} />
            <button
              type="submit"
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] border transition-colors ${
                activePreviewWorkspaceId === row.workspaceId
                  ? 'border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] text-[var(--ia-brand-gold-highlight)]'
                  : 'border-[var(--ia-border)] text-[var(--ia-text)] hover:bg-white/[0.08]'
              }`}
            >
              {activePreviewWorkspaceId === row.workspaceId ? 'Previewing' : 'View as Client'}
            </button>
          </form>
          <Link
            href="/app/billing"
            className="rounded-md border border-[var(--ia-border)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ia-text)] hover:bg-white/[0.08]"
          >
            Billing
          </Link>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Client Operations"
        title="Customers V2"
        description="Filter account health, risk, and delivery momentum. Use View as Client for safe read-only previews."
        rightSlot={
          activePreviewWorkspaceId ? (
            <form action={clearPreviewWorkspace}>
              <button className="rounded-md border border-[var(--ia-border)] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[var(--ia-text)] hover:bg-white/[0.08]">
                Exit Client Preview
              </button>
            </form>
          ) : undefined
        }
      />

      <Card className="p-4">
        <form action="/app/admin/customers" method="GET" className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            name="q"
            defaultValue={filter.q}
            placeholder="Search customer or workspace"
            className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ia-brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ia-bg-1)]"
          />
          <select name="status" defaultValue={filter.status} className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ia-brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ia-bg-1)]">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="payment_failed">Payment Failed</option>
            <option value="canceled">Canceled</option>
          </select>
          <select name="module" defaultValue={filter.module} className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ia-brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ia-bg-1)]">
            <option value="all">All modules</option>
            <option value="SOCIAL">Social</option>
            <option value="WEBSITE">Website</option>
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="AVATAR">Avatar</option>
            <option value="VIDEO_ADS">Video Ads</option>
            <option value="AUTOMATIONS">Automations</option>
          </select>
          <div className="flex gap-2">
            <select name="risk" defaultValue={filter.risk} className="flex-1 rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ia-brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ia-bg-1)]">
              <option value="all">All risk</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button type="submit" className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ia-brand-gold-highlight)] hover:bg-[#d4af3733]">
              Apply
            </button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No customers match this filter" description="Try widening your status/module/risk filters." />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.workspaceId} compact stickyLastColumn />
      )}
    </div>
  );
}
