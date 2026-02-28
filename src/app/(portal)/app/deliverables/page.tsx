import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPortalUserContext, isWorkspaceReadOnly } from '@/lib/portal';
import { parseWorkItemData } from '@/lib/work-item';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';

const DELIVERABLE_STATUSES = ['Approved', 'Scheduled', 'Posted', 'Completed', 'Final Delivered'];

export default async function DeliverablesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div>No workspace found.</div>;

  const { workspace } = context;
  const readOnly = isWorkspaceReadOnly(workspace);

  const items = await prisma.workItem.findMany({
    where: {
      workspaceId: workspace.id,
      status: { in: DELIVERABLE_STATUSES },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Delivery History"
        title="Deliverables"
        description="Final outputs, scheduled deployments, and posted links in one timeline surface."
        rightSlot={readOnly ? <StatusPill label="Read-only" tone="danger" /> : undefined}
      />

      {items.length === 0 ? (
        <EmptyState title="No deliverables yet" description="Approved, scheduled, or posted work will appear here." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => {
            const data = parseWorkItemData(item.dataJson);
            const postedUrls = Array.isArray(data.postedUrls) ? data.postedUrls : [];

            return (
              <Card key={item.id} className="p-5">
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--ia-text-strong)]">{item.title || item.id}</h3>
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--ia-text-muted)] mt-1">{item.type.replace('_', ' ')}</p>
                  </div>
                  <StatusPill label={item.status} tone={item.status === 'Posted' || item.status === 'Completed' ? 'success' : 'info'} compact />
                </div>

                <div className="mt-3 text-sm text-[var(--ia-text-muted)] space-y-1">
                  <div>Updated: {format(item.updatedAt, 'MMM d, yyyy')}</div>
                  {item.scheduledAt ? <div>Scheduled: {format(item.scheduledAt, 'MMM d, yyyy h:mm a')}</div> : null}
                  {item.postedAt ? <div>Posted: {format(item.postedAt, 'MMM d, yyyy h:mm a')}</div> : null}
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-[var(--ia-text-strong)]">Posted URLs</p>
                  {postedUrls.length > 0 ? (
                    <ul className="mt-2 list-disc ml-5 text-sm space-y-1 text-[var(--ia-text)]">
                      {postedUrls.map((url, index) => (
                        <li key={`${url}-${index}`}>
                          <a href={url} target="_blank" className="text-[#bfdbfe] underline break-all">{url}</a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--ia-text-muted)] mt-1">No posted URLs added.</p>
                  )}
                </div>

                <a href={`/app/services/${item.type}/${item.id}`} className="inline-block mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ia-brand-gold-highlight)] underline">
                  Open Work Item
                </a>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
