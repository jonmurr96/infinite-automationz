import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import entitlements from '@/config/stripe-entitlements.json';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const planKey = searchParams.get('plan');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;

    if (!planKey) {
        return NextResponse.json({ error: 'Missing plan key' }, { status: 400 });
    }

    const plan = entitlements.plans.find((p) => p.key === planKey);
    if (!plan) {
        return NextResponse.json({ error: 'Invalid plan key' }, { status: 400 });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    const { monthlyPriceId, setupFeePriceId } = plan.stripe;

    // We only add actual stripe price IDs if they are not placeholders.
    // Assuming the user configures them correctly. If they are "price_FILL_ME", checkout will fail.
    // We should add them to line_items.

    if (monthlyPriceId && monthlyPriceId !== 'price_FILL_ME') {
        lineItems.push({
            price: monthlyPriceId,
            quantity: 1,
        });
    }

    if (setupFeePriceId && setupFeePriceId !== 'price_FILL_ME') {
        lineItems.push({
            price: setupFeePriceId,
            quantity: 1,
        });
    }

    if (lineItems.length === 0) {
        return new NextResponse('Stripe Price IDs are not configured yet.', { status: 400 });
    }

    try {
        const sessionUrl = await createCheckoutSession(lineItems, planKey, baseUrl);
        return NextResponse.redirect(sessionUrl, 303);
    } catch (error: unknown) {
        console.error('[STRIPE_CHECKOUT_ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

async function createCheckoutSession(
    lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
    planKey: string,
    baseUrl: string,
) {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription', // Because there is a recurring component
        line_items: lineItems,
        success_url: `${baseUrl}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/`,
        metadata: {
            plan_key: planKey,
        },
        // Required to be able to look up the session to fulfill later
        expand: ['subscription'],
    });

    return session.url as string;
}
