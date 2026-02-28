import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertWorkspaceMutable, getPortalUserContext, isWorkspaceReadOnly } from '@/lib/portal';
import KanbanBoard from './KanbanBoard';
import { getWorkflow } from '@/lib/work-item';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';

const TITLE_MAP: Record<string, string> = {
  social_post: 'Social Media Automation',
  website_change: 'AI Website Requests',
  receptionist_kb: 'Receptionist Knowledge Base',
  receptionist_change: 'Receptionist Change Requests',
  avatar_request: 'Avatar / Clone Requests',
  video_ad: 'AI Video Ads',
  automation_request: 'Automation Requests',
  support_ticket: 'Support Tickets',
  paid_change_request: 'Paid Change Requests',
};

export default async function ServiceModulePage({ params }: { params: { type: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div>No workspace found</div>;

  const { user, workspace } = context;
  const { type } = params;
  const isAdmin = user.role === 'ADMIN';
  const readOnly = isWorkspaceReadOnly(workspace);

  const items = await prisma.workItem.findMany({
    where: {
      workspaceId: workspace.id,
      type,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const title = TITLE_MAP[type] || type.replace('_', ' ').toUpperCase();
  const workflow = getWorkflow(type);

  async function createItem() {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const actionContext = await getPortalUserContext(session.userId);
    if (!actionContext || actionContext.user.role !== 'ADMIN') throw new Error('Forbidden');
    assertWorkspaceMutable(actionContext.workspace);

    await prisma.workItem.create({
      data: {
        workspaceId: actionContext.workspace.id,
        type,
        status: workflow[0] || 'Draft',
        title: `New ${title}`,
      },
    });
  }

  return (
    <div className="flex flex-col h-full bg-transparent space-y-4">
      <SectionHeader
        eyebrow="Service Workflow"
        title={title}
        description={`Manage all ${title.toLowerCase()} deliverables with status-safe transitions and client approvals.`}
        rightSlot={
          <div className="flex items-center gap-2">
            <StatusPill label={`${items.length} items`} compact tone="neutral" />
            {readOnly ? <StatusPill label="Read-only" compact tone="danger" /> : null}
            {isAdmin ? (
              <form action={createItem}>
                <button
                  type="submit"
                  disabled={readOnly}
                  className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ia-brand-gold-highlight)] disabled:opacity-50"
                >
                  New Item
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="text-xs text-[var(--ia-text-muted)] uppercase tracking-[0.12em]">
        Workflow: {workflow.join(' -> ')}
      </div>

      <div className="flex-1 min-h-0">
        <KanbanBoard items={items} isAdmin={isAdmin} moduleType={type} />
      </div>
    </div>
  );
}
