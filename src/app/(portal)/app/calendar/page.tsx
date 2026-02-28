import { redirect } from 'next/navigation';

import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPortalUserContext, isWorkspaceReadOnly } from '@/lib/portal';
import CalendarEventManagerClient from './CalendarEventManagerClient';

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div>No workspace found.</div>;

  const { workspace } = context;
  const readOnly = isWorkspaceReadOnly(workspace);

  const [manualEvents, derivedFromItems] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.workItem.findMany({
      where: {
        workspaceId: workspace.id,
        OR: [{ dueDate: { not: null } }, { scheduledAt: { not: null } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
  ]);

  const combinedEvents = [
    ...manualEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startsAt.toISOString(),
      endTime: (event.endsAt || event.startsAt).toISOString(),
      color: 'gold',
      category: 'Manual',
      tags: ['Workspace'],
      isDerived: false,
    })),
    ...derivedFromItems
      .map((item) => {
        const date = item.scheduledAt || item.dueDate;
        if (!date) return null;
        return {
          id: `derived-${item.id}`,
          title: item.title || item.id,
          description: `Derived from ${item.type}`,
          startTime: date.toISOString(),
          endTime: date.toISOString(),
          color: item.scheduledAt ? 'blue' : 'orange',
          category: item.scheduledAt ? 'Scheduled' : 'Due',
          tags: ['Derived'],
          isDerived: true,
        };
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event)),
  ];

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Scheduling"
        title="Calendar"
        description="Drag-free event ops for planning, filtering, and managing client delivery schedules."
        rightSlot={readOnly ? <StatusPill label="Read-only" tone="danger" /> : undefined}
      />

      <CalendarEventManagerClient events={combinedEvents} readOnly={readOnly} />
    </div>
  );
}
