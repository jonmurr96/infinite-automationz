import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { addPostedUrl, markOutOfScope } from '../actions';
import { assertWorkItemAccess, assertWorkspaceMutable, isWorkspaceReadOnly } from '@/lib/portal';
import { parseWorkItemData } from '@/lib/work-item';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';

export default async function WorkItemDetailPage({ params }: { params: { type: string; id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { type, id } = params;
  const context = await assertWorkItemAccess(session.userId, id).catch(() => null);
  if (!context) return <div>Work item not found.</div>;

  const { user, workspace } = context;
  const isAdmin = user.role === 'ADMIN';
  const readOnly = isWorkspaceReadOnly(workspace);

  const item = await prisma.workItem.findUnique({
    where: { id },
    include: {
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      internalNotes: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      attachments: true,
      snapshots: true,
    },
  });

  if (!item || item.workspaceId !== workspace.id) return <div>Work item not found.</div>;

  const data = parseWorkItemData(item.dataJson);
  const postedUrls = Array.isArray(data.postedUrls) ? data.postedUrls : [];

  const timeline = [
    { label: 'Created', at: item.createdAt, meta: 'Work item opened' },
    ...(item.revisionCount > 0 ? [{ label: 'Revisions', at: item.updatedAt, meta: `${item.revisionCount} revision request(s)` }] : []),
    ...item.snapshots.map((snapshot) => ({
      label: 'Approved',
      at: snapshot.timestamp,
      meta: 'Approval snapshot captured',
    })),
    ...(item.postedAt ? [{ label: 'Posted', at: item.postedAt, meta: 'Posted URL was added' }] : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  async function addComment(formData: FormData) {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const workContext = await assertWorkItemAccess(session.userId, id);
    assertWorkspaceMutable(workContext.workspace);

    const content = String(formData.get('content') || '').trim();
    if (!content) return;

    await prisma.comment.create({
      data: {
        content,
        isInternal: false,
        authorId: workContext.user.id,
        workItemId: id,
      },
    });

    await prisma.activityLog.create({
      data: {
        workspaceId: workContext.workspace.id,
        workItemId: id,
        actorId: workContext.user.id,
        action: 'WORK_ITEM_COMMENT_ADDED',
      },
    });

    revalidatePath(`/app/services/${type}/${id}`);
  }

  async function addInternalNote(formData: FormData) {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const workContext = await assertWorkItemAccess(session.userId, id);
    if (workContext.user.role !== 'ADMIN') throw new Error('Forbidden');
    assertWorkspaceMutable(workContext.workspace);

    const content = String(formData.get('internalNote') || '').trim();
    if (!content) return;

    await prisma.internalNote.create({
      data: {
        content,
        authorId: workContext.user.id,
        workItemId: id,
      },
    });

    await prisma.activityLog.create({
      data: {
        workspaceId: workContext.workspace.id,
        workItemId: id,
        actorId: workContext.user.id,
        action: 'WORK_ITEM_INTERNAL_NOTE_ADDED',
      },
    });

    revalidatePath(`/app/services/${type}/${id}`);
  }

  async function addPostedUrlAction(formData: FormData) {
    'use server';
    const postedUrl = String(formData.get('postedUrl') || '').trim();
    if (!postedUrl) return;
    await addPostedUrl(id, postedUrl);
    revalidatePath(`/app/services/${type}/${id}`);
  }

  async function markOutOfScopeAction(formData: FormData) {
    'use server';
    const reason = String(formData.get('outOfScopeReason') || '').trim();
    if (!reason) return;
    await markOutOfScope(id, reason);
    revalidatePath(`/app/services/${type}/${id}`);
  }

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <Link href={`/app/services/${type}`} className="text-[var(--ia-brand-gold-highlight)] hover:text-[var(--ia-brand-gold)] font-semibold inline-block">
        &larr; Back to {type.replace('_', ' ')}
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[var(--ia-border)]">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ia-text-strong)]">{item.title || 'Untitled'}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill label={item.status} tone="info" />
              {item.dueDate ? <StatusPill label={`Due ${new Date(item.dueDate).toLocaleDateString()}`} tone="warning" /> : null}
              {item.isOutOfScope ? <StatusPill label="Out of Scope" tone="danger" /> : null}
              {readOnly ? <StatusPill label="Read-only" tone="danger" /> : null}
            </div>
          </div>
          {readOnly ? (
            <div className="rounded-[10px] border border-[#ef444466] bg-[#ef444422] px-3 py-2 text-sm text-[#fecaca]">
              Billing lock active. Mutations are disabled.
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-[var(--ia-text)]">{item.description || 'No description provided.'}</p>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold text-[var(--ia-text-strong)]">Attachments</h3>
            <div className="mt-3 space-y-2">
              {item.attachments.length === 0 ? (
                <p className="text-sm text-[var(--ia-text-muted)]">No attachments.</p>
              ) : (
                item.attachments.map((attachment) => (
                  <a key={attachment.id} href={attachment.fileUrl} target="_blank" className="block rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-2.5 text-sm text-[var(--ia-text)] hover:bg-white/[0.06] transition-colors">
                    {attachment.fileName}
                  </a>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4 xl:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[var(--ia-text-strong)]">Posted URLs</h3>
              {item.postedAt ? <StatusPill label={`Posted ${new Date(item.postedAt).toLocaleDateString()}`} tone="success" compact /> : null}
            </div>
            <div className="mt-3 space-y-2">
              {postedUrls.length === 0 ? (
                <p className="text-sm text-[var(--ia-text-muted)]">No posted URLs logged yet.</p>
              ) : (
                postedUrls.map((url, index) => (
                  <a key={`${url}-${index}`} className="block text-sm text-[#bfdbfe] underline break-all" href={url} target="_blank">
                    {url}
                  </a>
                ))
              )}
            </div>
            {isAdmin && !readOnly ? (
              <form action={addPostedUrlAction} className="mt-4 flex flex-col sm:flex-row gap-2">
                <input
                  name="postedUrl"
                  type="url"
                  required
                  placeholder="https://..."
                  className="flex-1 rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
                />
                <button type="submit" className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-3 py-2 text-xs uppercase tracking-[0.12em] font-semibold text-[var(--ia-brand-gold-highlight)]">
                  Add URL
                </button>
              </form>
            ) : null}
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="p-4 xl:col-span-2">
            <h3 className="text-lg font-semibold text-[var(--ia-text-strong)]">Client-visible Comments</h3>
            <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
              {item.comments.length === 0 ? <p className="text-sm text-[var(--ia-text-muted)]">No comments yet.</p> : null}
              {item.comments.map((comment) => (
                <article key={comment.id} className="rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-3">
                  <p className="text-xs text-[var(--ia-text-muted)]">{comment.author.displayName || comment.author.email}</p>
                  <p className="mt-1 text-sm text-[var(--ia-text)] whitespace-pre-wrap">{comment.content}</p>
                </article>
              ))}
            </div>
            {!readOnly ? (
              <form action={addComment} className="mt-4 space-y-2">
                <textarea
                  name="content"
                  required
                  rows={3}
                  placeholder="Add a client-visible comment..."
                  className="w-full rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
                />
                <button type="submit" className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-3 py-2 text-xs uppercase tracking-[0.12em] font-semibold text-[var(--ia-brand-gold-highlight)]">
                  Post Comment
                </button>
              </form>
            ) : null}
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-semibold text-[var(--ia-text-strong)]">Revision & Approval Timeline</h3>
            <div className="mt-3 space-y-2">
              {timeline.map((event, index) => (
                <div key={`${event.label}-${index}`} className="rounded-[10px] border border-[var(--ia-border)] bg-black/35 p-3">
                  <p className="text-sm font-semibold text-[var(--ia-text-strong)]">{event.label}</p>
                  <p className="text-xs text-[var(--ia-text-muted)] mt-1">{event.meta}</p>
                  <p className="text-xs text-[var(--ia-text-muted)] mt-1">{new Date(event.at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold text-[var(--ia-text-strong)]">Internal Notes</h3>
            {isAdmin ? (
              <>
                <div className="mt-3 max-h-56 overflow-y-auto space-y-2">
                  {item.internalNotes.length === 0 ? <p className="text-sm text-[var(--ia-text-muted)]">No internal notes yet.</p> : null}
                  {item.internalNotes.map((note) => (
                    <article key={note.id} className="rounded-[10px] border border-[#d4af3766] bg-[#d4af3712] p-3">
                      <p className="text-xs text-[var(--ia-brand-gold-highlight)]">{note.author.displayName || note.author.email}</p>
                      <p className="mt-1 text-sm text-[var(--ia-text)] whitespace-pre-wrap">{note.content}</p>
                    </article>
                  ))}
                </div>
                {!readOnly ? (
                  <form action={addInternalNote} className="mt-4 space-y-2">
                    <textarea
                      name="internalNote"
                      required
                      rows={3}
                      placeholder="Add an internal note..."
                      className="w-full rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
                    />
                    <button type="submit" className="rounded-[10px] border border-[var(--ia-border)] bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.12em] font-semibold text-[var(--ia-text)] hover:bg-white/[0.1]">
                      Save Internal Note
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--ia-text-muted)]">Internal notes are admin-only.</p>
            )}
          </Card>

          {isAdmin && !readOnly ? (
            <Card className="p-4 border-[#ef444466] bg-[#ef444410]">
              <h3 className="text-lg font-semibold text-[#fecaca]">Out-of-scope Action</h3>
              <p className="mt-2 text-sm text-[#fecaca]">Generate a paid change request draft and notify the client.</p>
              <form action={markOutOfScopeAction} className="mt-4 space-y-2">
                <textarea
                  name="outOfScopeReason"
                  required
                  rows={3}
                  placeholder="Explain why this request is out of scope..."
                  className="w-full rounded-[10px] border border-[#ef444466] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
                />
                <button type="submit" className="rounded-[10px] border border-[#ef444466] bg-[#ef444422] px-3 py-2 text-xs uppercase tracking-[0.12em] font-semibold text-[#fecaca]">
                  Create Paid Change Request
                </button>
              </form>
            </Card>
          ) : (
            <Card className="p-4">
              <h3 className="text-lg font-semibold text-[var(--ia-text-strong)]">Approval Snapshots</h3>
              <p className="mt-2 text-sm text-[var(--ia-text-muted)]">Snapshots stored: {item.snapshots.length}</p>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
}
