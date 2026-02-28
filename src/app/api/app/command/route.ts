import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPortalUserContext } from '@/lib/portal';
import type { CommandResultDTO } from '@/types/portal-command';

const ROUTE_RESULTS: Array<Pick<CommandResultDTO, 'id' | 'label' | 'subtitle' | 'href' | 'kind'>> = [
  { id: 'route-inbox', label: 'Inbox', subtitle: 'Workspace command inbox', href: '/app', kind: 'route' },
  { id: 'route-services', label: 'Services', subtitle: 'Module service lanes', href: '/app/services', kind: 'route' },
  { id: 'route-messages', label: 'Messages', subtitle: 'Threads and collaboration', href: '/app/messages', kind: 'route' },
  { id: 'route-files', label: 'Files', subtitle: 'Asset library', href: '/app/files', kind: 'route' },
  { id: 'route-calendar', label: 'Calendar', subtitle: 'Scheduling and due dates', href: '/app/calendar', kind: 'route' },
  { id: 'route-deliverables', label: 'Deliverables', subtitle: 'Posted and approved outputs', href: '/app/deliverables', kind: 'route' },
  { id: 'route-billing', label: 'Billing', subtitle: 'Subscription and billing state', href: '/app/billing', kind: 'route' },
  { id: 'route-support', label: 'Support', subtitle: 'Submit and track tickets', href: '/app/support', kind: 'route' },
  { id: 'route-admin-customers', label: 'Admin Customers', subtitle: 'Client health and preview', href: '/app/admin/customers', kind: 'route' },
  { id: 'route-admin-analytics', label: 'Admin Analytics', subtitle: 'Operations intelligence', href: '/app/admin/analytics', kind: 'route' },
];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getPortalUserContext(session.userId);
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { workspace, user } = context;
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('query') || '').trim().toLowerCase();
  const requestedScope = (searchParams.get('scope') || 'workspace').toLowerCase();
  const scope = user.role === 'ADMIN' && requestedScope === 'admin' ? 'admin' : 'workspace';

  const routeResults = ROUTE_RESULTS.filter((item) => {
    if (scope !== 'admin' && item.href?.startsWith('/app/admin')) return false;
    if (!query) return true;
    return item.label.toLowerCase().includes(query) || (item.subtitle || '').toLowerCase().includes(query);
  });

  let workItems: Array<{ id: string; title: string | null; type: string }> = [];
  let threads: Array<{ id: string; title: string }> = [];
  let files: Array<{ id: string; fileName: string }> = [];
  let adminWorkspaces: Array<{ id: string; name: string }> = [];

  try {
    [workItems, threads, files, adminWorkspaces] = await Promise.all([
      prisma.workItem.findMany({
        where: {
          workspaceId: workspace.id,
          ...(query ? { OR: [{ title: { contains: query, mode: 'insensitive' } }, { type: { contains: query, mode: 'insensitive' } }] } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, type: true },
      }),
      prisma.messageThread.findMany({
        where: {
          workspaceId: workspace.id,
          ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, title: true },
      }),
      prisma.fileAsset.findMany({
        where: {
          workspaceId: workspace.id,
          ...(query ? { fileName: { contains: query, mode: 'insensitive' } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, fileName: true },
      }),
      scope === 'admin'
        ? prisma.workspace.findMany({
            where: query ? { name: { contains: query, mode: 'insensitive' } } : {},
            orderBy: { updatedAt: 'desc' },
            take: 6,
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
  } catch {
    return NextResponse.json({ results: routeResults }, { status: 200 });
  }

  const results: CommandResultDTO[] = [
    ...routeResults,
    ...workItems.map((item) => ({
      id: `item-${item.id}`,
      label: item.title || item.id,
      subtitle: item.type.replaceAll('_', ' '),
      href: `/app/services/${item.type}/${item.id}`,
      kind: 'work_item' as const,
    })),
    ...threads.map((thread) => ({
      id: `thread-${thread.id}`,
      label: thread.title,
      subtitle: 'Message thread',
      href: `/app/messages?thread=${thread.id}`,
      kind: 'message_thread' as const,
    })),
    ...files.map((file) => ({
      id: `file-${file.id}`,
      label: file.fileName,
      subtitle: 'File asset',
      href: '/app/files',
      kind: 'file' as const,
    })),
    ...adminWorkspaces.map((entry) => ({
      id: `workspace-${entry.id}`,
      label: entry.name,
      subtitle: 'Workspace (admin)',
      href: '/app/admin/customers',
      kind: 'workspace' as const,
    })),
  ].slice(0, 24);

  return NextResponse.json({ results });
}
