import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertWorkspaceMutable, getPortalUserContext, isWorkspaceReadOnly } from '@/lib/portal';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export default async function SupportPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div>No workspace found.</div>;

  const { workspace, user } = context;
  const readOnly = isWorkspaceReadOnly(workspace);

  const tickets = await prisma.workItem.findMany({
    where: { workspaceId: workspace.id, type: 'support_ticket' },
    include: { _count: { select: { comments: true, attachments: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  async function createSupportTicket(formData: FormData) {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const actionContext = await getPortalUserContext(session.userId);
    if (!actionContext) throw new Error('Workspace not found');
    assertWorkspaceMutable(actionContext.workspace);

    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const priority = String(formData.get('priority') || 'NORMAL').toUpperCase();
    if (!title || !description) return;

    const normalizedPriority = PRIORITIES.includes(priority) ? priority : 'NORMAL';

    const ticket = await prisma.workItem.create({
      data: {
        workspaceId: actionContext.workspace.id,
        type: 'support_ticket',
        status: 'Intake',
        title,
        description,
        priority: normalizedPriority,
      },
    });

    await prisma.activityLog.create({
      data: {
        workspaceId: actionContext.workspace.id,
        workItemId: ticket.id,
        actorId: actionContext.user.id,
        action: 'SUPPORT_TICKET_CREATED',
        metadataJson: JSON.stringify({
          priority: normalizedPriority,
          createdByRole: actionContext.user.role,
        }),
      },
    });

    await prisma.notification.create({
      data: {
        workspaceId: actionContext.workspace.id,
        type: 'SUPPORT',
        title: 'New support ticket submitted',
        message: `"${title}" is now in Intake.`,
        link: `/app/services/support_ticket/${ticket.id}`,
      },
    });

    revalidatePath('/app/support');
    revalidatePath('/app');
    revalidatePath('/app/services/support_ticket');
  }

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Client Collaboration"
        title="Support"
        description="Submit technical requests, track status, and keep scope aligned with execution timelines."
        rightSlot={readOnly ? <StatusPill label="Read-only" tone="danger" /> : undefined}
      />

      {!readOnly ? (
        <Card className="p-5 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ia-text-strong)]">Create Support Ticket</h2>
          <form action={createSupportTicket} className="space-y-3">
            <input
              name="title"
              required
              placeholder="Ticket title"
              className="w-full rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
            />
            <textarea
              name="description"
              required
              rows={4}
              placeholder="Describe the issue, expected behavior, and timeline."
              className="w-full rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select name="priority" defaultValue="NORMAL" className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)]">
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
              <button type="submit" className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ia-brand-gold-highlight)]">
                Submit Ticket
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--ia-border)]">
          <h2 className="text-lg font-semibold text-[var(--ia-text-strong)]">Open and Recent Tickets</h2>
        </div>

        {tickets.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No support tickets yet" description="New requests will appear here once submitted." />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <a href={`/app/services/support_ticket/${ticket.id}`} className="text-lg font-semibold text-[var(--ia-text-strong)] hover:text-[var(--ia-brand-gold-highlight)] underline underline-offset-2">
                      {ticket.title || ticket.id}
                    </a>
                    <p className="text-sm text-[var(--ia-text)] mt-1">{ticket.description || 'No description provided.'}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <StatusPill label={ticket.priority || 'NORMAL'} tone={ticket.priority === 'URGENT' ? 'danger' : ticket.priority === 'HIGH' ? 'warning' : 'neutral'} compact />
                    <p className="text-sm font-semibold text-[var(--ia-text-strong)]">{ticket.status}</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-[var(--ia-text-muted)] flex flex-wrap gap-4">
                  <span>Comments: {ticket._count.comments}</span>
                  <span>Attachments: {ticket._count.attachments}</span>
                  <span>Updated: {new Date(ticket.updatedAt).toLocaleString()}</span>
                  <span>Requested by: {user.displayName || user.email}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
