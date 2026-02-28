import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { initializeOnboarding } from './actions';
import WelcomeForm from './WelcomeForm';
import { provisionStripeEntitlements } from '@/app/api/webhooks/stripe/route';
import { isAuthUiV2Enabled } from '@/lib/flags';

export default async function WelcomePage({
    searchParams,
}: {
    searchParams: Promise<{ session_id?: string }> | { session_id?: string };
}) {
    const resolvedSearchParams = await Promise.resolve(searchParams);
    const sessionId = resolvedSearchParams.session_id;

    if (!sessionId) {
        redirect('/');
    }

    // 1. Fetch Session from Stripe
    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
        console.error('Failed to retrieve session:', err);
        redirect('/');
    }

    if (session.payment_status !== 'paid') {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">Payment Pending</h1>
                    <p>Your payment is still processing. Please check back later.</p>
                </div>
            </div>
        );
    }

    const customerEmail = session.customer_details?.email;
    const planKey = session.metadata?.plan_key;
    const authV2 = isAuthUiV2Enabled();

    if (!customerEmail || !planKey) {
        console.warn('Welcome flow: missing email or plan_key', { customerEmail, planKey });
        redirect('/');
    }

    // Idempotently provision resources if webhook was delayed
    await provisionStripeEntitlements(session, planKey);

    // Get user to see if they already set a password
    let user: { passwordHash: string | null } | null = null;
    try {
        user = await prisma.user.findUnique({
            where: { email: customerEmail },
            select: { passwordHash: true },
        });
    } catch (err) {
        console.error('Failed to load user during welcome flow:', err);
    }

    if (user && user.passwordHash) {
        // Already onboarded
        redirect('/app');
    }

    return (
        <div className="portal-shell min-h-screen text-[var(--ia-text-strong)] flex items-center justify-center p-6">
            <div className={authV2 ? 'w-full max-w-xl portal-surface-command p-8' : 'max-w-md w-full border border-gray-800 rounded-xl p-8 bg-black/50 backdrop-blur-md'}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--ia-brand-gold)]">Checkout Complete</p>
                <h1 className="text-3xl md:text-4xl font-bold mt-2">Welcome to Your Portal</h1>
                <p className="mt-3 mb-7 text-sm text-[var(--ia-text-muted)]">
                    Your workspace is provisioned. Complete account setup to unlock command access.
                </p>

                <WelcomeForm email={customerEmail} action={initializeOnboarding} />
            </div>
        </div>
    );
}
