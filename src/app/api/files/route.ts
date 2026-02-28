import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortalUserContext } from '@/lib/portal';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const context = await getPortalUserContext(session.userId);
    if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const files = await prisma.fileAsset.findMany({
        where: {
            workspaceId: context.workspace.id,
        },
        orderBy: { createdAt: 'desc' },
        include: {
            uploadedBy: {
                select: { id: true, email: true, displayName: true },
            },
            workItem: {
                select: { id: true, type: true, title: true, status: true },
            },
        },
    });

    const filtered = q
        ? files.filter((file) => {
              const tags = file.tagsJson ? JSON.parse(file.tagsJson) as string[] : [];
              return (
                  file.fileName.toLowerCase().includes(q) ||
                  tags.some((tag) => String(tag).toLowerCase().includes(q))
              );
          })
        : files;

    return NextResponse.json({ files: filtered });
}
