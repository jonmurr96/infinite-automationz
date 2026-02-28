'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

type WelcomeFormAction = (formData: FormData) => Promise<{ error?: string } | void>;

export default function WelcomeForm({ email, action }: { email: string; action: WelcomeFormAction }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await action(formData);
            if (res?.error) {
                alert(res.error);
            } else {
                router.push('/app'); // Login and redirect
            }
        });
    }

    return (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <input type="hidden" name="email" value={email} />

            <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)] mb-1">Email</label>
                <input
                    disabled
                    value={email}
                    className="w-full h-10 rounded-[var(--ia-radius-sm)] border border-[var(--ia-border)] bg-black/30 px-3 text-[var(--ia-text-muted)] cursor-not-allowed"
                />
            </div>

            <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)] mb-1">Display Name / Client Name</label>
                <input
                    required
                    name="displayName"
                    placeholder="e.g. John Doe"
                    className="w-full h-10 rounded-[var(--ia-radius-sm)] border border-[var(--ia-border)] bg-black/30 px-3 text-[var(--ia-text-strong)] focus:outline-none focus:border-[var(--ia-border-gold)]"
                />
            </div>

            <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)] mb-1">Create Password</label>
                <input
                    required
                    type="password"
                    name="password"
                    minLength={6}
                    placeholder="Min. 6 characters"
                    className="w-full h-10 rounded-[var(--ia-radius-sm)] border border-[var(--ia-border)] bg-black/30 px-3 text-[var(--ia-text-strong)] focus:outline-none focus:border-[var(--ia-border-gold)]"
                />
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="mt-3 h-11 w-full rounded-[var(--ia-radius-sm)] border border-[var(--ia-border-gold)] bg-[linear-gradient(135deg,#f4d77b,#d4af37)] text-black text-sm uppercase tracking-[0.1em] font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
                {isPending ? 'Setting up...' : 'Complete Setup & Login →'}
            </button>
        </form>
    );
}
