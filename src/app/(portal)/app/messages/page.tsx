import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertWorkspaceMutable, getPortalUserContext, isWorkspaceReadOnly } from '@/lib/portal';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: { thread?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) return <div>No workspace found.</div>;

  const { user, workspace } = context;
  const isAdmin = user.role === 'ADMIN';
  const readOnly = isWorkspaceReadOnly(workspace);

  const [threads, workItems] = await Promise.all([
    prisma.messageThread.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        workItem: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: true },
        },
      },
    }),
    prisma.workItem.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, type: true },
      take: 50,
    }),
  ]);

  const selectedThreadId = searchParams?.thread || threads[0]?.id || null;
  const selectedThread = selectedThreadId ? threads.find((thread) => thread.id === selectedThreadId) || null : null;

  async function createThread(formData: FormData) {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const ctx = await getPortalUserContext(session.userId);
    if (!ctx) throw new Error('Workspace not found');
    assertWorkspaceMutable(ctx.workspace);

    const title = String(formData.get('title') || '').trim();
    const workItemId = String(formData.get('workItemId') || '').trim() || null;
    if (!title) return;

    if (workItemId) {
      const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
      if (!item || item.workspaceId !== ctx.workspace.id) throw new Error('Invalid work item');
    }

    await prisma.messageThread.create({
      data: {
        workspaceId: ctx.workspace.id,
        title,
        workItemId,
        createdById: ctx.user.id,
      },
    });

    revalidatePath('/app/messages');
  }

  async function postMessage(formData: FormData) {
    'use server';
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const ctx = await getPortalUserContext(session.userId);
    if (!ctx) throw new Error('Workspace not found');
    assertWorkspaceMutable(ctx.workspace);

    const threadId = String(formData.get('threadId') || '').trim();
    const content = String(formData.get('content') || '').trim();
    const isInternalRequested = formData.get('isInternal') === 'true';
    if (!threadId || !content) return;

    const thread = await prisma.messageThread.findUnique({ where: { id: threadId } });
    if (!thread || thread.workspaceId !== ctx.workspace.id) throw new Error('Thread not found');

    await prisma.message.create({
      data: {
        threadId,
        content,
        authorId: ctx.user.id,
        isInternal: ctx.user.role === 'ADMIN' ? isInternalRequested : false,
      },
    });

    await prisma.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    revalidatePath('/app/messages');
  }

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      <SectionHeader
        eyebrow="Collaboration"
        title="Messages"
        description="Workspace-wide and item-linked communication with internal/admin visibility control."
        rightSlot={
          !readOnly ? (
            <form action={createThread} className="flex flex-wrap gap-2 items-center">
              <input
                name="title"
                required
                placeholder="New thread title"
                className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
              />
              <select name="workItemId" className="rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)]">
                <option value="">No linked work item</option>
                {workItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.title || item.id} ({item.type})</option>
                ))}
              </select>
              <button type="submit" className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-3 py-2 text-xs uppercase tracking-[0.12em] font-semibold text-[var(--ia-brand-gold-highlight)]">
                Create Thread
              </button>
            </form>
          ) : <StatusPill label="Read-only" tone="danger" />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[60vh]">
        <Card className="overflow-hidden">
          <div className="p-3 border-b border-[var(--ia-border)] text-sm font-semibold text-[var(--ia-text-strong)]">Threads</div>
          <div className="max-h-[70vh] overflow-y-auto">
            {threads.map((thread) => (
              <a
                key={thread.id}
                href={`/app/messages?thread=${thread.id}`}
                className={`block px-4 py-3 border-b border-white/[0.06] transition-colors duration-150 ${
                  selectedThreadId === thread.id ? 'bg-[var(--ia-brand-gold-soft)]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="font-semibold truncate text-[var(--ia-text-strong)]">{thread.title}</div>
                {thread.workItem ? <div className="text-xs text-[var(--ia-text-muted)] truncate mt-1">Linked: {thread.workItem.title || thread.workItem.id}</div> : null}
                <div className="text-xs text-[var(--ia-text-muted)] mt-1">{thread.messages.length} messages</div>
              </a>
            ))}
            {threads.length === 0 ? <div className="p-4 text-sm text-[var(--ia-text-muted)]">No threads yet.</div> : null}
          </div>
        </Card>

        <Card className="lg:col-span-2 flex flex-col">
          {!selectedThread ? (
            <div className="p-8 text-[var(--ia-text-muted)]">Select a thread to view messages.</div>
          ) : (
            <>
              <div className="p-4 border-b border-[var(--ia-border)]">
                <div className="font-semibold text-[var(--ia-text-strong)]">{selectedThread.title}</div>
                {selectedThread.workItem ? (
                  <a href={`/app/services/${selectedThread.workItem.type}/${selectedThread.workItem.id}`} className="text-sm text-[#bfdbfe] underline mt-1 inline-block">
                    Open linked work item
                  </a>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[55vh]">
                {selectedThread.messages
                  .filter((message) => isAdmin || !message.isInternal)
                  .map((message) => (
                    <article key={message.id} className={`rounded-[10px] p-3 border ${message.isInternal ? 'border-[#d4af3766] bg-[#d4af3712]' : 'border-[var(--ia-border)] bg-black/35'}`}>
                      <p className="text-xs text-[var(--ia-text-muted)]">
                        {message.author.displayName || message.author.email}
                        {message.isInternal ? ' • Internal' : ''}
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-[var(--ia-text)] mt-1">{message.content}</p>
                    </article>
                  ))}
              </div>

              {!readOnly ? (
                <form action={postMessage} className="p-4 border-t border-[var(--ia-border)] space-y-2">
                  <input type="hidden" name="threadId" value={selectedThread.id} />
                  <textarea
                    name="content"
                    required
                    rows={3}
                    placeholder="Write a message..."
                    className="w-full rounded-[10px] border border-[var(--ia-border)] bg-black/30 px-3 py-2 text-sm text-[var(--ia-text-strong)] placeholder:text-[var(--ia-text-muted)]"
                  />
                  <div className="flex items-center justify-between">
                    {isAdmin ? (
                      <label className="text-sm text-[var(--ia-text-muted)] flex items-center gap-2">
                        <input type="checkbox" name="isInternal" value="true" />
                        Internal admin message
                      </label>
                    ) : <span />}
                    <button type="submit" className="rounded-[10px] border border-[#d4af3766] bg-[var(--ia-brand-gold-soft)] px-3 py-2 text-xs uppercase tracking-[0.12em] font-semibold text-[var(--ia-brand-gold-highlight)]">
                      Send
                    </button>
                  </div>
                </form>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
