'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from './actions';

export default function LoginForm() {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await loginAction(formData);
            if (res?.error) {
                setError(res.error);
            } else {
                router.push('/app'); // Login success
            }
        });
    }

    return (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {error && <div className="rounded-[var(--ia-radius-sm)] border border-[#ef444480] bg-[#ef444420] px-3 py-2 text-[#fecaca] text-sm">{error}</div>}
            <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)] mb-1">Email</label>
                <input
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                    className="w-full h-10 rounded-[var(--ia-radius-sm)] border border-[var(--ia-border)] bg-black/30 px-3 text-[var(--ia-text-strong)] focus:outline-none focus:border-[var(--ia-border-gold)]"
                />
            </div>

            <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-[var(--ia-text-muted)] mb-1">Password</label>
                <input
                    required
                    type="password"
                    name="password"
                    className="w-full h-10 rounded-[var(--ia-radius-sm)] border border-[var(--ia-border)] bg-black/30 px-3 text-[var(--ia-text-strong)] focus:outline-none focus:border-[var(--ia-border-gold)]"
                />
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="mt-4 h-11 w-full rounded-[var(--ia-radius-sm)] border border-[var(--ia-border-gold)] bg-[linear-gradient(135deg,#f4d77b,#d4af37)] text-black text-sm uppercase tracking-[0.1em] font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
                {isPending ? 'Logging in...' : 'Sign In'}
            </button>
        </form>
    );
}
