import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getPortalUserContext, assertWorkspaceMutable } from '@/lib/portal';
import { prisma } from '@/lib/db';

const schema = z.object({
    fileName: z.string().min(1),
    fileUrl: z.string().url(),
    fileType: z.string().optional(),
    fileSize: z.number().int().nonnegative().optional(),
    tags: z.array(z.string()).optional(),
    workItemId: z.string().optional(),
});

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const context = await getPortalUserContext(session.userId);
    if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    try {
        assertWorkspaceMutable(context.workspace);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }

    let payload: z.infer<typeof schema>;
    try {
        payload = schema.parse(await request.json());
    } catch {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (payload.workItemId) {
        const item = await prisma.workItem.findUnique({ where: { id: payload.workItemId } });
        if (!item || item.workspaceId !== context.workspace.id) {
            return NextResponse.json({ error: 'Work item not found' }, { status: 404 });
        }
    }

    const asset = await prisma.fileAsset.create({
        data: {
            workspaceId: context.workspace.id,
            uploadedById: context.user.id,
            workItemId: payload.workItemId,
            fileName: payload.fileName,
            fileUrl: payload.fileUrl,
            fileType: payload.fileType,
            fileSize: payload.fileSize,
            tagsJson: payload.tags ? JSON.stringify(payload.tags) : null,
        },
    });

    // Keep legacy attachment records in sync when file is tied to a work item.
    if (payload.workItemId) {
        await prisma.attachment.create({
            data: {
                workItemId: payload.workItemId,
                fileName: payload.fileName,
                fileUrl: payload.fileUrl,
                fileType: payload.fileType,
                fileSize: payload.fileSize,
            },
        });
    }

    return NextResponse.json({ file: asset }, { status: 201 });
}
