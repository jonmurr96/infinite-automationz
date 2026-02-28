'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts';
import type { AdminAnalyticsSeriesDTO } from '@/types/portal-analytics';

type AnalyticsChartsProps = {
  series: AdminAnalyticsSeriesDTO[];
};

export default function AnalyticsCharts({ series }: AnalyticsChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="portal-surface-command p-4">
        <p className="text-sm font-semibold text-[var(--ia-text-strong)]">Creation vs Completion Trend</p>
        <p className="text-xs text-[var(--ia-text-muted)] mt-1">Tracks operational throughput over the selected period.</p>
        <div className="h-72 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#8b8b84', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
              <YAxis tick={{ fill: '#8b8b84', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
              <Tooltip
                contentStyle={{
                  background: '#121218',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  color: '#f5f5f4',
                }}
              />
              <Legend wrapperStyle={{ color: '#c9c9c4', fontSize: 12 }} />
              <Line type="monotone" dataKey="created" stroke="#f59e0b" strokeWidth={2.6} dot={false} name="Created" />
              <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2.6} dot={false} name="Completed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="portal-surface-command p-4">
        <p className="text-sm font-semibold text-[var(--ia-text-strong)]">Approval Backlog Pressure</p>
        <p className="text-xs text-[var(--ia-text-muted)] mt-1">How much client approval load is active each day.</p>
        <div className="h-72 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#8b8b84', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
              <YAxis tick={{ fill: '#8b8b84', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
              <Tooltip
                contentStyle={{
                  background: '#121218',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  color: '#f5f5f4',
                }}
              />
              <Legend wrapperStyle={{ color: '#c9c9c4', fontSize: 12 }} />
              <Bar dataKey="approvals" fill="#3b82f6" name="Needs Approval" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
