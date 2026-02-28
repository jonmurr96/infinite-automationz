import LoginForm from './LoginForm';
import { isAuthUiV2Enabled } from '@/lib/flags';

export default function LoginPage() {
    const authV2 = isAuthUiV2Enabled();
    if (!authV2) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
                <div className="max-w-md w-full border border-gray-800 rounded-xl p-8 bg-black/50 backdrop-blur-md">
                    <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
                    <p className="text-gray-400 mb-8">
                        Sign in to your client portal.
                    </p>
                    <LoginForm />
                </div>
            </div>
        );
    }

    return (
        <div className="portal-shell min-h-screen text-[var(--ia-text-strong)] flex items-center justify-center p-6">
            <div className="w-full max-w-md portal-surface-command p-8">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--ia-brand-gold)]">Infinite Automationz</p>
                <h1 className="mt-2 text-4xl font-bold">Portal Login</h1>
                <p className="mt-3 text-sm text-[var(--ia-text-muted)]">Sign in to continue managing approvals, delivery, and billing actions.</p>
                <LoginForm />
            </div>
        </div>
    );
}
