'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkflowHintDTO } from '@/types/portal-command';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';

type WorkflowHintsProps = {
  hints: WorkflowHintDTO[];
  readOnly: boolean;
};

export default function WorkflowHints({ hints, readOnly }: WorkflowHintsProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (hints.length === 0) return null;

  async function runHint(hint: WorkflowHintDTO) {
    if (readOnly) return;
    setBusyId(hint.id);
    try {
      const response = await fetch('/api/app/quick-actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(hint.action),
      });
      const json = (await response.json()) as { ok?: boolean; href?: string };
      if (json.ok && json.href) {
        router.push(json.href);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {hints.map((hint) => (
        <Card key={hint.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-[var(--ia-text-strong)]">{hint.title}</p>
            {hint.tone ? <StatusPill label="Next" tone={hint.tone} compact /> : null}
          </div>
          <p className="mt-2 text-sm text-[var(--ia-text-muted)]">{hint.description}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={readOnly || busyId === hint.id}
            onClick={() => runHint(hint)}
          >
            {busyId === hint.id ? 'Running…' : 'Run action'}
          </Button>
        </Card>
      ))}
    </section>
  );
}
