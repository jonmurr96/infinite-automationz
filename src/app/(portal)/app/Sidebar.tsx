'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { INFINITE_BRAND_CONFIG } from '@/lib/portal-config';
import { cn } from '@/components/ui/cn';

type SidebarUser = {
  role: 'ADMIN' | 'CLIENT';
  displayName: string | null;
  email: string;
};

type SidebarWorkspace = {
  name: string;
};

const accentClassMap = {
  gold: 'text-[var(--ia-brand-gold-highlight)]',
  danger: 'text-[#fecaca]',
  info: 'text-[#bfdbfe]',
};

function isActivePath(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ user, workspace }: { user: SidebarUser; workspace: SidebarWorkspace }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = INFINITE_BRAND_CONFIG.primaryNav;

  const adminItems = useMemo(
    () => [
      { name: 'Customers', href: '/app/admin/customers', glyph: 'U' },
      { name: 'Analytics', href: '/app/admin/analytics', glyph: 'A' },
    ],
    [],
  );

  const mobilePrimary = navItems.filter((item) => ['inbox', 'services', 'messages', 'calendar', 'billing'].includes(item.key));

  return (
    <>
      <aside className="hidden lg:flex w-72 min-h-screen border-r border-[var(--ia-border)] bg-black/92 backdrop-blur-sm flex-col sticky top-0">
        <div className="px-6 pt-6 pb-5 border-b border-[var(--ia-border)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--ia-brand-gold)]">{INFINITE_BRAND_CONFIG.name}</p>
          <h2 className="text-3xl font-bold mt-2 text-[var(--ia-text-strong)]">{INFINITE_BRAND_CONFIG.portalTitle}</h2>
          <p className="text-xs text-[var(--ia-text-muted)] mt-2 truncate">{workspace.name}</p>
        </div>

        <nav className="px-3 py-4 flex-1 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] text-sm transition-all duration-[var(--ia-motion-220)] border',
                  active
                    ? 'bg-[var(--ia-brand-gold-soft)] text-[var(--ia-text-strong)] border-[var(--ia-border-gold)] shadow-[var(--ia-shadow-gold)]'
                    : 'text-[var(--ia-text)] hover:text-[var(--ia-text-strong)] hover:bg-white/[0.05] border-transparent',
                )}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'w-4 h-4 inline-flex items-center justify-center text-[10px] font-semibold text-[var(--ia-text-muted)]',
                      active && 'text-[var(--ia-brand-gold-highlight)]',
                    )}
                  >
                    {item.glyph}
                  </span>
                  <span className="truncate">{item.name}</span>
                </span>
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="rounded-full border border-[var(--ia-border)] bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--ia-text-muted)]">
                    {item.badgeCount}
                  </span>
                ) : item.accent ? (
                  <span className={cn('text-[9px] uppercase tracking-[0.18em] opacity-80', accentClassMap[item.accent])}>•</span>
                ) : (
                  <span />
                )}
              </Link>
            );
          })}

          {user.role === 'ADMIN' ? (
            <div className="mt-4 pt-4 border-t border-[var(--ia-border)] space-y-1">
              <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--ia-text-muted)]">Admin</p>
              {adminItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm transition-all duration-[var(--ia-motion-220)] border',
                      active
                        ? 'bg-[var(--ia-brand-gold-soft)] text-[var(--ia-text-strong)] border-[var(--ia-border-gold)]'
                        : 'text-[var(--ia-text)] hover:text-[var(--ia-text-strong)] hover:bg-white/[0.05] border-transparent',
                    )}
                  >
                    <span className="w-4 h-4 inline-flex items-center justify-center text-[10px] font-semibold text-[var(--ia-text-muted)]">{item.glyph}</span>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </nav>

        <div className="px-4 py-4 border-t border-[var(--ia-border)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[var(--ia-brand-gold)] text-black text-sm font-bold flex items-center justify-center">
              {user.displayName?.slice(0, 1).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-[var(--ia-text-strong)]">{user.displayName || 'User'}</p>
              <p className="text-xs text-[var(--ia-text-muted)] truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/" className="rounded-md border border-[var(--ia-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ia-text)] hover:bg-white/[0.08]">
              Marketing Site
            </Link>
            <Link href="/app/billing" className="rounded-md border border-[var(--ia-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ia-text)] hover:bg-white/[0.08]">
              Billing
            </Link>
          </div>
        </div>
      </aside>

      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ia-border)] bg-black/92 backdrop-blur-md">
        <nav className="grid grid-cols-6 gap-1 p-2">
          {mobilePrimary.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'rounded-[var(--ia-radius-xs)] px-2 py-2 text-center text-[10px] uppercase tracking-[0.1em] border',
                  active
                    ? 'border-[var(--ia-border-gold)] bg-[var(--ia-brand-gold-soft)] text-[var(--ia-brand-gold-highlight)]'
                    : 'border-transparent text-[var(--ia-text-muted)]',
                )}
              >
                {item.name}
              </Link>
            );
          })}
          <button
            type="button"
            className="rounded-[var(--ia-radius-xs)] border border-[var(--ia-border)] bg-white/[0.02] text-[var(--ia-text)] inline-flex items-center justify-center"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
        </nav>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/88 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-[84%] max-w-sm border-l border-[var(--ia-border)] bg-[var(--ia-bg-1)] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--ia-border)]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--ia-brand-gold)]">{INFINITE_BRAND_CONFIG.name}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ia-text-strong)]">{workspace.name}</p>
              </div>
              <button
                type="button"
                className="rounded-[var(--ia-radius-xs)] border border-[var(--ia-border)] p-1 text-[var(--ia-text)]"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {navItems.map((item) => (
                <Link key={item.key} href={item.href} className="block rounded-[var(--ia-radius-xs)] border border-[var(--ia-border)] px-3 py-2 text-sm text-[var(--ia-text)]">
                  {item.name}
                </Link>
              ))}
            </div>

            {user.role === 'ADMIN' ? (
              <div className="mt-5 pt-5 border-t border-[var(--ia-border)] space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--ia-text-muted)]">Admin</p>
                {adminItems.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-[var(--ia-radius-xs)] border border-[var(--ia-border)] px-3 py-2 text-sm text-[var(--ia-text)]">
                    {item.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
