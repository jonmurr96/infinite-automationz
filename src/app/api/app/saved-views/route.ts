import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPortalUserContext } from '@/lib/portal';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getPortalUserContext(session.userId);
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const routeKey = (searchParams.get('routeKey') || '').trim();

  let views: Array<{
    id: string;
    routeKey: string;
    name: string;
    filterJson: string;
    isDefault: boolean;
    updatedAt: Date;
  }> = [];

  try {
    views = await prisma.savedView.findMany({
      where: {
        workspaceId: context.workspace.id,
        userId: context.user.id,
        ...(routeKey ? { routeKey } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        routeKey: true,
        name: true,
        filterJson: true,
        isDefault: true,
        updatedAt: true,
      },
    });
  } catch {
    return NextResponse.json({ views: [] });
  }

  return NextResponse.json({ views });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getPortalUserContext(session.userId);
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  let body: {
    routeKey?: string;
    name?: string;
    filterJson?: string;
    isDefault?: boolean;
  };
  try {
    body = (await request.json()) as {
      routeKey?: string;
      name?: string;
      filterJson?: string;
      isDefault?: boolean;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const routeKey = (body.routeKey || '').trim();
  const name = (body.name || '').trim();
  const filterJson = (body.filterJson || '').trim();

  if (!routeKey || !name || !filterJson) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    if (body.isDefault) {
      await prisma.savedView.updateMany({
        where: {
          workspaceId: context.workspace.id,
          userId: context.user.id,
          routeKey,
        },
        data: { isDefault: false },
      });
    }

    const view = await prisma.savedView.upsert({
      where: {
        workspaceId_userId_routeKey_name: {
          workspaceId: context.workspace.id,
          userId: context.user.id,
          routeKey,
          name,
        },
      },
      update: {
        filterJson,
        isDefault: Boolean(body.isDefault),
      },
      create: {
        workspaceId: context.workspace.id,
        userId: context.user.id,
        routeKey,
        name,
        filterJson,
        isDefault: Boolean(body.isDefault),
      },
      select: {
        id: true,
        routeKey: true,
        name: true,
        filterJson: true,
        isDefault: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, view });
  } catch {
    return NextResponse.json({ error: 'Saved views not available yet. Run Prisma sync first.' }, { status: 503 });
  }

}
