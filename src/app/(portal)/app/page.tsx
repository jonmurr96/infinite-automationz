import { redirect } from 'next/navigation';
import { differenceInCalendarDays } from 'date-fns';
import { getSession } from '@/lib/auth';
import { getPortalUserContext, isWorkspaceReadOnly } from '@/lib/portal';
import { prisma } from '@/lib/db';
import { SectionHeader } from '@/components/ui/section-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { EmptyState } from '@/components/ui/empty-state';
import WorkflowHints from './_components/WorkflowHints';
import type { WorkflowHintDTO } from '@/types/portal-command';

const ACTION_REQUIRED_STATUSES = ['Needs Review', 'Needs Client Review', 'Awaiting Approval', 'Changes Requested'];
const IN_PROGRESS_STATUSES = ['In Progress', 'Scheduled', 'Build', 'Test'];
const COMPLETED_STATUSES = ['Approved', 'Posted', 'Completed', 'Final Delivered'];

function scoreUrgency(item: {
  status: string;
  dueDate: Date | null;
  updatedAt: Date;
}) {
  let score = 0;
  const now = new Date();
  if (ACTION_REQUIRED_STATUSES.includes(item.status)) score += 40;
  if (item.dueDate) {
    const delta = differenceInCalendarDays(item.dueDate, now);
    if (delta < 0) score += 35;
    else if (delta <= 1) score += 25;
    else if (delta <= 3) score += 12;
  }

  const ageDays = differenceInCalendarDays(now, item.updatedAt);
  if (ageDays > 5) score += 15;
  else if (ageDays > 2) score += 8;

  return score;
}

function LegacyInbox({
  items,
  actionRequired,
  inProgress,
  completed,
  upcomingEvents,
}: {
  items: Awaited<ReturnType<typeof prisma.workItem.findMany>>;
  actionRequired: Awaited<ReturnType<typeof prisma.workItem.findMany>>;
  inProgress: Awaited<ReturnType<typeof prisma.workItem.findMany>>;
  completed: Awaited<ReturnType<typeof prisma.workItem.findMany>>;
  upcomingEvents: Awaited<ReturnType<typeof prisma.calendarEvent.findMany>>;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--ia-brand-gold)]">Workspace Overview</p>
        <h1 className="text-4xl font-bold mt-2">Workspace Inbox</h1>
      </header>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Action Required" value={String(actionRequired.length)} tone="danger" />
        <KpiCard label="In Progress" value={String(inProgress.length)} tone="info" />
        <KpiCard label="Completed" value={String(completed.length)} tone="success" />
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Awaiting Your Approval</h2>
          <div className="mt-4 space-y-3">
            {actionRequired.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 p-3">
                <a href={`/app/services/${item.type}/${item.id}`} className="font-semibold text-[var(--ia-text-strong)] underline">{item.title || item.id}</a>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Upcoming Schedule</h2>
          <div className="mt-4 space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 p-3">
                <p className="font-semibold text-[var(--ia-text-strong)]">{event.title}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <Card className="p-5">
        <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Recent Activity</h2>
        <div className="mt-4 space-y-2">
          {items.slice(0, 6).map((item) => (
            <a key={item.id} href={`/app/services/${item.type}/${item.id}`} className="block text-sm text-[var(--ia-text)] underline">
              {item.title || item.id}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div className="text-[var(--ia-text-strong)]">No workspace found.</div>;

  const { workspace } = context;
  const readOnly = isWorkspaceReadOnly(workspace);

  const [items, upcomingEvents] = await Promise.all([
    prisma.workItem.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.calendarEvent.findMany({
      where: { workspaceId: workspace.id, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 6,
    }),
  ]);

  const actionRequired = items.filter((item) => ACTION_REQUIRED_STATUSES.includes(item.status));
  const inProgress = items.filter((item) => IN_PROGRESS_STATUSES.includes(item.status));
  const completed = items.filter((item) => COMPLETED_STATUSES.includes(item.status));

  if (process.env.NEXT_PUBLIC_FORCE_LEGACY_INBOX === '1') {
    return (
      <LegacyInbox
        items={items}
        actionRequired={actionRequired}
        inProgress={inProgress}
        completed={completed}
        upcomingEvents={upcomingEvents}
      />
    );
  }

  const prioritized = [...items]
    .map((item) => ({ item, urgency: scoreUrgency(item) }))
    .sort((a, b) => b.urgency - a.urgency);

  const needsDecision = prioritized.filter((entry) => ACTION_REQUIRED_STATUSES.includes(entry.item.status)).slice(0, 6);
  const executionQueue = prioritized.filter((entry) => IN_PROGRESS_STATUSES.includes(entry.item.status)).slice(0, 6);
  const deliveredQueue = prioritized.filter((entry) => COMPLETED_STATUSES.includes(entry.item.status)).slice(0, 6);
  const hints: WorkflowHintDTO[] = [
    ...(needsDecision.length > 0
      ? [
          {
            id: 'hint-support',
            title: 'Queue triage support thread',
            description: `${needsDecision.length} items need a client decision. Open a support thread to resolve blockers quickly.`,
            tone: 'warning',
            action: { action: 'create_thread', payload: { title: 'Triage: approval blockers' } },
          } satisfies WorkflowHintDTO,
        ]
      : []),
    ...(upcomingEvents.length === 0
      ? [
          {
            id: 'hint-calendar',
            title: 'Add execution checkpoint',
            description: 'No upcoming calendar events detected. Add a checkpoint to keep delivery timing visible.',
            tone: 'info',
            action: { action: 'create_calendar_event', payload: { title: 'Execution checkpoint' } },
          } satisfies WorkflowHintDTO,
        ]
      : []),
    {
      id: 'hint-ticket',
      title: 'Capture new request',
      description: 'Create a structured support ticket to prevent scope drift and keep approvals auditable.',
      tone: 'gold',
      action: { action: 'create_support_ticket', payload: { title: 'New scoped request' } },
    },
  ].slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SectionHeader
        eyebrow="Workspace Overview"
        title="Command Inbox V2"
        description={`Fast triage view for approvals, execution bottlenecks, and delivery velocity.${readOnly ? ' Workspace is currently read-only.' : ''}`}
      />

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Needs Decision" value={String(needsDecision.length)} tone="danger" hint="Client review or blockers" />
        <KpiCard label="Execution" value={String(executionQueue.length)} tone="info" hint="Currently being worked" />
        <KpiCard label="Delivered" value={String(deliveredQueue.length)} tone="success" hint="Approved / posted / complete" />
        <KpiCard label="Upcoming Events" value={String(upcomingEvents.length)} tone="gold" hint="Calendar commitments" />
      </section>

      <WorkflowHints hints={hints} readOnly={readOnly} />

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Needs Decision</h2>
            <StatusPill label="Priority" tone="danger" compact />
          </div>
          <div className="mt-4 space-y-3">
            {needsDecision.map(({ item, urgency }) => (
              <article key={item.id} className="rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-4">
                <div className="flex items-start justify-between gap-2">
                  <a href={`/app/services/${item.type}/${item.id}`} className="font-semibold text-[var(--ia-text-strong)] hover:text-[var(--ia-brand-gold-highlight)] underline underline-offset-2">
                    {item.title || item.id}
                  </a>
                  <span className="portal-kpi-number text-xs text-[#fecaca]">{urgency}</span>
                </div>
                <p className="text-xs text-[var(--ia-text-muted)] mt-2">{item.type.replaceAll('_', ' ')} • {item.status}</p>
              </article>
            ))}
            {needsDecision.length === 0 && <p className="text-sm text-[var(--ia-text-muted)]">No items currently waiting for a decision.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Execution Queue</h2>
            <StatusPill label="In Flight" tone="info" compact />
          </div>
          <div className="mt-4 space-y-3">
            {executionQueue.map(({ item, urgency }) => (
              <article key={item.id} className="rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-4">
                <div className="flex items-start justify-between gap-2">
                  <a href={`/app/services/${item.type}/${item.id}`} className="font-semibold text-[var(--ia-text-strong)] hover:text-[var(--ia-brand-gold-highlight)] underline underline-offset-2">
                    {item.title || item.id}
                  </a>
                  <span className="portal-kpi-number text-xs text-[#bfdbfe]">{urgency}</span>
                </div>
                <p className="text-xs text-[var(--ia-text-muted)] mt-2">{item.type.replaceAll('_', ' ')} • {item.status}</p>
              </article>
            ))}
            {executionQueue.length === 0 && <p className="text-sm text-[var(--ia-text-muted)]">No active execution items.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Delivered</h2>
            <StatusPill label="Completed" tone="success" compact />
          </div>
          <div className="mt-4 space-y-3">
            {deliveredQueue.map(({ item }) => (
              <article key={item.id} className="rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-4">
                <a href={`/app/services/${item.type}/${item.id}`} className="font-semibold text-[var(--ia-text-strong)] hover:text-[var(--ia-brand-gold-highlight)] underline underline-offset-2">
                  {item.title || item.id}
                </a>
                <p className="text-xs text-[var(--ia-text-muted)] mt-2">{item.type.replaceAll('_', ' ')} • {item.status}</p>
              </article>
            ))}
            {deliveredQueue.length === 0 && <p className="text-sm text-[var(--ia-text-muted)]">No delivered items yet.</p>}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Upcoming Schedule</h2>
          <div className="mt-4 space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-4">
                <p className="font-semibold text-[var(--ia-text-strong)]">{event.title}</p>
                <p className="text-xs text-[var(--ia-text-muted)] mt-1">{new Date(event.startsAt).toLocaleString()}</p>
              </div>
            ))}
            {upcomingEvents.length === 0 ? (
              <EmptyState title="No scheduled events" description="Calendar items from work schedules will appear here." />
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xl font-semibold text-[var(--ia-text-strong)]">Recent Activity Feed</h2>
          <div className="mt-4 space-y-3">
            {items.slice(0, 8).map((item) => (
              <a
                key={item.id}
                href={`/app/services/${item.type}/${item.id}`}
                className="block rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-4 hover:bg-white/[0.05] transition-colors duration-150"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-[var(--ia-text-strong)]">{item.title || item.id}</p>
                  <StatusPill label={item.status} tone="neutral" compact />
                </div>
                <p className="text-xs text-[var(--ia-text-muted)] mt-2">{item.type.replaceAll('_', ' ')} • Updated {new Date(item.updatedAt).toLocaleDateString()}</p>
              </a>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
