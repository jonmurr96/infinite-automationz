'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { WorkItem } from '@prisma/client';
import { updateItemStatus } from './actions';
import { getWorkflow } from '@/lib/work-item';
import { StatusPill } from '@/components/ui/status-pill';

function urgencyLabel(item: WorkItem) {
  if (!item.dueDate) return { label: 'No due date', tone: 'neutral' as const };
  const now = Date.now();
  const diff = item.dueDate.getTime() - now;
  const day = 1000 * 60 * 60 * 24;

  if (diff < 0) return { label: 'Overdue', tone: 'danger' as const };
  if (diff <= day) return { label: 'Due < 24h', tone: 'warning' as const };
  if (diff <= day * 3) return { label: 'Due this week', tone: 'info' as const };
  return { label: 'On track', tone: 'success' as const };
}

export default function KanbanBoard({
  items,
  isAdmin,
  moduleType,
}: {
  items: WorkItem[];
  isAdmin: boolean;
  moduleType: string;
}) {
  const columns = getWorkflow(moduleType);
  const [localItems, setLocalItems] = useState(items);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const columnCounts = useMemo(() => {
    return columns.reduce<Record<string, number>>((acc, column) => {
      acc[column] = localItems.filter((item) => item.status === column).length;
      return acc;
    }, {});
  }, [columns, localItems]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setLoadingId(id);
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));

    const reason =
      newStatus === 'Changes Requested'
        ? window.prompt('Briefly explain what needs revision:', 'Please update and resubmit.') || undefined
        : undefined;

    try {
      await updateItemStatus(id, newStatus, reason);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto h-full pb-4">
      {columns.map((column) => {
        const columnItems = localItems.filter((item) => item.status === column);
        const isWipHeavy = columnItems.length >= 6;

        return (
          <section
            key={column}
            className="w-[360px] shrink-0 rounded-[var(--ia-radius-md)] border border-[var(--ia-border)] bg-[linear-gradient(180deg,#111114,#17171b)] p-3 flex flex-col"
          >
            <header className="px-2 mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ia-text)]">{column}</h3>
                <StatusPill
                  label={`${columnCounts[column]}`}
                  compact
                  tone={isWipHeavy ? 'warning' : 'neutral'}
                />
              </div>
              {isWipHeavy ? <StatusPill label="WIP High" compact tone="warning" /> : null}
            </header>

            <div className="flex-1 overflow-y-auto space-y-3 pb-1 px-1">
              {columnItems.map((item) => {
                const urgency = urgencyLabel(item);
                return (
                  <article
                    key={item.id}
                    className={`rounded-[10px] border border-[var(--ia-border)] bg-black/40 p-4 transition-all duration-150 ${
                      loadingId === item.id ? 'opacity-50' : 'opacity-100 hover:border-[var(--ia-border-strong)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/app/services/${moduleType}/${item.id}`}
                        className="font-semibold text-sm text-[var(--ia-text-strong)] hover:text-[var(--ia-brand-gold-highlight)] underline underline-offset-2 truncate"
                      >
                        {item.title || 'Untitled'}
                      </Link>
                      <StatusPill label={urgency.label} tone={urgency.tone} compact />
                    </div>

                    {item.description ? (
                      <p className="mt-2 text-xs leading-relaxed text-[var(--ia-text-muted)] line-clamp-3">{item.description}</p>
                    ) : null}

                    {item.dueDate ? (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-[var(--ia-text-muted)]">
                        Due {new Date(item.dueDate).toLocaleDateString()}
                      </p>
                    ) : null}

                    <div className="mt-3 pt-3 border-t border-white/[0.08]">
                      {isAdmin ? (
                        <div className="flex flex-wrap gap-1.5">
                          {columns
                            .filter((candidate) => candidate !== item.status)
                            .map((candidate) => (
                              <button
                                key={candidate}
                                onClick={() => handleStatusChange(item.id, candidate)}
                                className="rounded-md border border-[var(--ia-border)] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--ia-text)] hover:bg-white/[0.08]"
                              >
                                {candidate}
                              </button>
                            ))}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {item.status === 'Needs Review' ? (
                            <>
                              <button
                                onClick={() => handleStatusChange(item.id, 'Approved')}
                                className="rounded-md border border-[#22c55e66] bg-[#22c55e22] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#bbf7d0]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusChange(item.id, 'Changes Requested')}
                                className="rounded-md border border-[#ef444466] bg-[#ef444422] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#fecaca]"
                              >
                                Request Changes
                              </button>
                            </>
                          ) : (
                            <StatusPill label="Waiting for next step" compact tone="neutral" />
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {columnItems.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[var(--ia-border)] p-4 text-xs text-[var(--ia-text-muted)] text-center">
                  No items in this stage.
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
