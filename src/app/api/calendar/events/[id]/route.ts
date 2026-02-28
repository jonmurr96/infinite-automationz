import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertWorkspaceMutable, getPortalUserContext } from '@/lib/portal';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getPortalUserContext(session.userId);
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  assertWorkspaceMutable(context.workspace);

  const { id } = await params;
  const existing = await prisma.calendarEvent.findFirst({ where: { id, workspaceId: context.workspace.id } });
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await request.json();

  await prisma.calendarEvent.update({
    where: { id },
    data: {
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      startsAt: typeof body.startTime === 'string' ? new Date(body.startTime) : undefined,
      endsAt: typeof body.endTime === 'string' ? new Date(body.endTime) : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getPortalUserContext(session.userId);
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  assertWorkspaceMutable(context.workspace);

  const { id } = await params;
  const existing = await prisma.calendarEvent.findFirst({ where: { id, workspaceId: context.workspace.id } });
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  await prisma.calendarEvent.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
