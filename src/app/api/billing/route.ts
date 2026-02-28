import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { workspaces: true }
    });

    if (!user || user.workspaces.length === 0) {
        return new NextResponse('Workspace not found', { status: 404 });
    }

    const workspace = user.workspaces[0];

    if (!workspace.stripeCustomerId) {
        return new NextResponse('No billing information provided.', { status: 400 });
    }

    try {
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: workspace.stripeCustomerId,
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/app/billing`,
        });

        return NextResponse.redirect(portalSession.url, 303);
    } catch (err: unknown) {
        console.error('Billing portal error:', err);
        return new NextResponse('Internal error', { status: 500 });
    }
}
