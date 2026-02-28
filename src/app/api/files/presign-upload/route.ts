import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getPortalUserContext, assertWorkspaceMutable } from '@/lib/portal';
import { createPresignedUpload } from '@/lib/s3';

const schema = z.object({
    fileName: z.string().min(1),
    contentType: z.string().min(1),
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

    const safeName = payload.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${context.workspace.id}/${Date.now()}_${safeName}`;

    try {
        const presigned = await createPresignedUpload({
            key,
            contentType: payload.contentType,
        });

        return NextResponse.json({
            key,
            uploadUrl: presigned.uploadUrl,
            fileUrl: presigned.fileUrl,
        });
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message || 'Failed to create upload URL' },
            { status: 500 },
        );
    }
}
