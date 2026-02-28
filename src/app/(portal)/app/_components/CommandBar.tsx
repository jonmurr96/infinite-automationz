'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command, LifeBuoy, CalendarPlus, MessageSquarePlus } from 'lucide-react';
import type { CommandResultDTO } from '@/types/portal-command';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';

type CommandBarProps = {
  role: 'ADMIN' | 'CLIENT';
  readOnly: boolean;
};

export default function CommandBar({ role, readOnly }: CommandBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'workspace' | 'admin'>('workspace');
  const [results, setResults] = useState<CommandResultDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setBusy(true);
        const response = await fetch(`/api/app/command?query=${encodeURIComponent(query)}&scope=${scope}`, { signal: controller.signal });
        const json = (await response.json()) as { results?: CommandResultDTO[] };
        setResults(json.results || []);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 120);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query, scope]);

  const quickActions = useMemo(
    () => [
      {
        id: 'qa-ticket',
        label: 'Create Ticket',
        icon: LifeBuoy,
        body: { action: 'create_support_ticket', payload: { title: 'Quick support request' } },
      },
      {
        id: 'qa-calendar',
        label: 'Add Event',
        icon: CalendarPlus,
        body: { action: 'create_calendar_event', payload: { title: 'Quick event' } },
      },
      {
        id: 'qa-thread',
        label: 'Start Thread',
        icon: MessageSquarePlus,
        body: { action: 'create_thread', payload: { title: 'Quick thread' } },
      },
    ],
    [],
  );

  async function runQuickAction(body: Record<string, unknown>) {
    try {
      setQuickBusy(true);
      const response = await fetch('/api/app/quick-actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { ok?: boolean; href?: string };
      if (json.ok && json.href) {
        setOpen(false);
        router.push(json.href);
        router.refresh();
      }
    } finally {
      setQuickBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-[var(--ia-radius-sm)] border border-[var(--ia-border)] bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[var(--ia-text)] hover:bg-white/[0.08]"
        onClick={() => setOpen(true)}
      >
        <span className="inline-flex items-center gap-1.5">
          <Command className="h-3.5 w-3.5" />
          Command
          <span className="hidden sm:inline text-[var(--ia-text-muted)]">Ctrl/Cmd+K</span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Command Center</DialogTitle>
            <DialogDescription>Jump to routes, open records, and trigger quick operations.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search routes, work items, threads, files..." />
              {role === 'ADMIN' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScope((value) => (value === 'workspace' ? 'admin' : 'workspace'))}
                >
                  Scope: {scope}
                </Button>
              ) : null}
              {readOnly ? <StatusPill label="Read-only" tone="danger" compact /> : null}
            </div>

            {!readOnly ? (
              <div className="flex flex-wrap items-center gap-2">
                {quickActions.map((action) => (
                  <Button key={action.id} type="button" variant="outline" size="sm" disabled={quickBusy} onClick={() => runQuickAction(action.body)}>
                    <action.icon className="mr-1.5 h-3.5 w-3.5" />
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="portal-surface max-h-[48vh] overflow-y-auto divide-y divide-white/[0.06]">
              {busy ? <div className="p-4 text-sm text-[var(--ia-text-muted)]">Searching…</div> : null}
              {!busy && results.length === 0 ? <div className="p-4 text-sm text-[var(--ia-text-muted)]">No results found.</div> : null}
              {!busy &&
                results.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    className="w-full p-4 text-left hover:bg-white/[0.05] transition-colors"
                    onClick={() => {
                      if (!result.href) return;
                      setOpen(false);
                      router.push(result.href);
                    }}
                  >
                    <p className="font-semibold text-[var(--ia-text-strong)]">{result.label}</p>
                    {result.subtitle ? <p className="mt-1 text-xs text-[var(--ia-text-muted)]">{result.subtitle}</p> : null}
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
