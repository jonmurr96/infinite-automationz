import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertWorkspaceMutable, getPortalUserContext } from '@/lib/portal';
import type { QuickActionDTO } from '@/types/portal-command';

type QuickActionResponse = {
  ok: boolean;
  href?: string;
  message?: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getPortalUserContext(session.userId);
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  assertWorkspaceMutable(context.workspace);

  let body: QuickActionDTO;
  try {
    body = (await request.json()) as QuickActionDTO;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  const action = body.action;
  const payload = body.payload || {};

  let response: QuickActionResponse = { ok: false, message: 'Unsupported action' };

  try {
    if (action === 'create_support_ticket') {
      const title = (payload.title || 'Quick support request').trim();
      const description = (payload.description || 'Submitted from command quick action.').trim();
      const ticket = await prisma.workItem.create({
        data: {
          workspaceId: context.workspace.id,
          type: 'support_ticket',
          status: 'Intake',
          title,
          description,
          priority: 'NORMAL',
        },
        select: { id: true },
      });
      response = { ok: true, href: `/app/services/support_ticket/${ticket.id}`, message: 'Support ticket created.' };
    }

    if (action === 'create_thread') {
      const title = (payload.title || 'Quick thread').trim();
      const thread = await prisma.messageThread.create({
        data: {
          workspaceId: context.workspace.id,
          title,
          createdById: context.user.id,
        },
        select: { id: true },
      });
      response = { ok: true, href: `/app/messages?thread=${thread.id}`, message: 'Message thread created.' };
    }

    if (action === 'create_calendar_event') {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 30 * 60 * 1000);
      const endsAt = new Date(now.getTime() + 60 * 60 * 1000);
      await prisma.calendarEvent.create({
        data: {
          workspaceId: context.workspace.id,
          title: (payload.title || 'Quick calendar event').trim(),
          description: payload.description || 'Created from quick action.',
          startsAt,
          endsAt,
          sourceType: 'quick_action',
          createdById: context.user.id,
        },
      });
      response = { ok: true, href: '/app/calendar', message: 'Calendar event created.' };
    }
  } catch {
    return NextResponse.json({ ok: false, message: 'Action failed. Check database/service connectivity.' }, { status: 503 });
  }

  return NextResponse.json(response, { status: response.ok ? 200 : 400 });
}
