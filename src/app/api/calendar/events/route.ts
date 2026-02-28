import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertWorkspaceMutable, getPortalUserContext } from '@/lib/portal';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getPortalUserContext(session.userId);
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  assertWorkspaceMutable(context.workspace);

  const body = await request.json();
  const title = String(body.title || '').trim();
  const startTime = String(body.startTime || '').trim();
  const endTime = String(body.endTime || '').trim();
  const description = String(body.description || '').trim();

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ error: 'Title, startTime and endTime are required.' }, { status: 400 });
  }

  const created = await prisma.calendarEvent.create({
    data: {
      workspaceId: context.workspace.id,
      title,
      description: description || null,
      startsAt: new Date(startTime),
      endsAt: new Date(endTime),
      sourceType: 'manual',
      createdById: context.user.id,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
