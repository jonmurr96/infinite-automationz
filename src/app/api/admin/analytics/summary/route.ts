import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAdminAnalyticsSeries, getAdminAnalyticsSummary } from '@/lib/queries/admin-analytics';
import type { DateRangePreset } from '@/types/portal-analytics';

function parseRange(value: string | null): DateRangePreset {
  if (value === '7d' || value === '30d' || value === '90d') return value;
  return '30d';
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (!user || user.role !== 'ADMIN') return new NextResponse('Forbidden', { status: 403 });

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get('range'));

  const [summary, series] = await Promise.all([
    getAdminAnalyticsSummary(),
    getAdminAnalyticsSeries(range),
  ]);

  return NextResponse.json({ summary, series, range });
}
