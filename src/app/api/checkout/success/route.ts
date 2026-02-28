import { NextResponse } from 'next/server';
import { setSessionToken } from '@/lib/auth';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
        return NextResponse.redirect(new URL('/', request.url), 303);
    }

    try {
        const [{ stripe }, { provisionStripeEntitlements }] = await Promise.all([
            import('@/lib/stripe'),
            import('@/app/api/webhooks/stripe/route'),
        ]);

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const customerEmail = session.customer_details?.email;
        const planKey = session.metadata?.plan_key;

        // If payment is still processing, keep existing fallback flow.
        if (session.payment_status !== 'paid' || !customerEmail || !planKey) {
            return NextResponse.redirect(new URL(`/welcome?session_id=${encodeURIComponent(sessionId)}`, request.url), 303);
        }

        const provisioned = await provisionStripeEntitlements(session, planKey);
        const user = provisioned?.user;

        if (!user) {
            return NextResponse.redirect(new URL(`/welcome?session_id=${encodeURIComponent(sessionId)}`, request.url), 303);
        }

        await setSessionToken(user.id, user.role);
        return NextResponse.redirect(new URL('/app', request.url), 303);
    } catch (error) {
        console.error('[CHECKOUT_SUCCESS_REDIRECT_ERROR]', error);
        return NextResponse.redirect(new URL('/', request.url), 303);
    }
}
