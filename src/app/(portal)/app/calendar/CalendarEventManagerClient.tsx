'use client';

import { useMemo } from 'react';
import { EventManager, type Event } from '@/components/ui/event-manager';

type RawEvent = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  color: string;
  category?: string | null;
  tags?: string[];
  isDerived?: boolean;
};

interface CalendarEventManagerClientProps {
  events: RawEvent[];
  readOnly: boolean;
}

export default function CalendarEventManagerClient({ events, readOnly }: CalendarEventManagerClientProps) {
  const parsedEvents = useMemo<Event[]>(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description || undefined,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        color: event.color,
        category: event.category || undefined,
        tags: event.tags || [],
      })),
    [events],
  );

  const handleCreate = async (event: Omit<Event, 'id'>) => {
    if (readOnly) return;
    await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: event.title,
        description: event.description,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        color: event.color,
        category: event.category,
        tags: event.tags || [],
      }),
    });
  };

  const handleUpdate = async (id: string, event: Partial<Event>) => {
    if (readOnly || id.startsWith('derived-')) return;

    await fetch(`/api/calendar/events/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: event.title,
        description: event.description,
        startTime: event.startTime?.toISOString(),
        endTime: event.endTime?.toISOString(),
        color: event.color,
        category: event.category,
        tags: event.tags,
      }),
    });
  };

  const handleDelete = async (id: string) => {
    if (readOnly || id.startsWith('derived-')) return;

    await fetch(`/api/calendar/events/${id}`, {
      method: 'DELETE',
    });
  };

  return (
    <EventManager
      events={parsedEvents}
      onEventCreate={handleCreate}
      onEventUpdate={handleUpdate}
      onEventDelete={handleDelete}
      categories={['Meeting', 'Task', 'Reminder', 'Personal', 'Client Review', 'Delivery']}
      colors={[
        { name: 'Gold', value: 'gold', bg: 'bg-amber-500', text: 'text-amber-700' },
        { name: 'Blue', value: 'blue', bg: 'bg-blue-500', text: 'text-blue-700' },
        { name: 'Green', value: 'green', bg: 'bg-green-500', text: 'text-green-700' },
        { name: 'Orange', value: 'orange', bg: 'bg-orange-500', text: 'text-orange-700' },
        { name: 'Red', value: 'red', bg: 'bg-red-500', text: 'text-red-700' },
      ]}
      availableTags={['Important', 'Urgent', 'Work', 'Personal', 'Team', 'Client', 'Approval']}
      defaultView="month"
      readOnly={readOnly}
      className="rounded-xl border border-[var(--ia-border)] p-4"
    />
  );
}
