import '@/app/globals.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getPortalUserContext, getWorkspaceLockReason, isWorkspaceReadOnly } from '@/lib/portal';
import { isCommandBarV1Enabled } from '@/lib/flags';
import CommandBar from './_components/CommandBar';
import Sidebar from './Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const context = await getPortalUserContext(session.userId);
  if (!context) redirect('/login');

  const { user, workspace } = context;
  const readOnly = isWorkspaceReadOnly(workspace);
  const commandEnabled = isCommandBarV1Enabled();

  return (
    <div className="portal-shell min-h-screen text-[var(--ia-text-strong)]">
      <div className="mx-auto flex max-w-[1740px]">
        <Sidebar
          user={{
            role: user.role,
            displayName: user.displayName,
            email: user.email,
          }}
          workspace={{ name: workspace.name }}
        />
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <div className="border-b border-[var(--ia-border)] px-4 md:px-8 py-4 text-xs uppercase tracking-[0.18em] text-[var(--ia-text-muted)]">
            Infinite Automationz Portal
          </div>

          <div className="mx-4 md:mx-8 mt-4 portal-surface-command px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.14em]">
            <div className="flex flex-wrap items-center gap-3 text-[var(--ia-text-muted)]">
              <span className="text-[var(--ia-brand-gold)]">Workspace</span>
              <span className="text-[var(--ia-text-strong)]">{workspace.name}</span>
              <span>•</span>
              <span>Role: {user.role}</span>
              <span>•</span>
              <span>Access: {readOnly ? 'Read-only' : 'Active'}</span>
            </div>
            <div className="flex items-center gap-2">
              {commandEnabled ? <CommandBar role={user.role} readOnly={readOnly} /> : null}
              <Link href="/app/services" className="rounded-md border border-[var(--ia-border)] px-2 py-1 hover:bg-white/[0.08] text-[var(--ia-text)]">
                Quick: Services
              </Link>
              <Link href="/app/billing" className="rounded-md border border-[var(--ia-border)] px-2 py-1 hover:bg-white/[0.08] text-[var(--ia-text)]">
                Quick: Billing
              </Link>
            </div>
          </div>

          {readOnly && (
            <div className="mx-4 md:mx-8 mt-4 rounded-[var(--ia-radius-md)] border border-[#ef444480] bg-[#ef444426] px-4 py-3 text-sm text-[#fecaca]">
              Workspace is in read-only mode: {getWorkspaceLockReason(workspace)}. Visit{' '}
              <Link href="/app/billing" className="underline font-semibold text-[#f4d77b]">
                Billing
              </Link>{' '}
              to resolve access.
            </div>
          )}

          <div className="px-4 md:px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
