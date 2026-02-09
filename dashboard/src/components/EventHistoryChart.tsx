'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface EventHistoryChartProps {
  className?: string;
  timeRange?: '1h' | '6h' | '24h' | '7d';
}

interface HourlyData {
  hour: string;
  opens: number;
  closes: number;
  netPnl: number;
}

export function EventHistoryChart({ className, timeRange = '24h' }: EventHistoryChartProps) {
  const [data, setData] = useState<HourlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEventHistory();
  }, [timeRange]);

  const fetchEventHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/signals/events/feed?limit=1000&timeRange=${timeRange}`);
      const result = await response.json();

      if (result.success) {
        // Group events by hour
        const hourlyMap = new Map<string, { opens: number; closes: number; pnl: number }>();

        result.data.forEach((event: any) => {
          const date = new Date(event.eventTime);
          const hourKey = `${date.getHours().toString().padStart(2, '0')}:00`;

          if (!hourlyMap.has(hourKey)) {
            hourlyMap.set(hourKey, { opens: 0, closes: 0, pnl: 0 });
          }

          const hourData = hourlyMap.get(hourKey)!;

          if (event.eventType.startsWith('OPEN')) {
            hourData.opens++;
          } else if (event.eventType.startsWith('CLOSE')) {
            hourData.closes++;
            if (event.realizedPnl) {
              hourData.pnl += event.realizedPnl;
            }
          }
        });

        // Convert to array and sort
        const chartData: HourlyData[] = Array.from(hourlyMap.entries())
          .map(([hour, data]) => ({
            hour,
            opens: data.opens,
            closes: data.closes,
            netPnl: data.pnl,
          }))
          .sort((a, b) => a.hour.localeCompare(b.hour));

        setData(chartData);
      }
    } catch (error) {
      console.error('Failed to fetch event history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-[#1e2329] rounded-xl border border-[#2b3139] p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-32 mb-4" />
          <div className="h-40 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  const totalOpens = data.reduce((sum, d) => sum + d.opens, 0);
  const totalCloses = data.reduce((sum, d) => sum + d.closes, 0);
  const totalPnl = data.reduce((sum, d) => sum + d.netPnl, 0);

  return (
    <div className={`bg-[#1e2329] rounded-xl border border-[#2b3139] p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Event Activity ({timeRange})</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-slate-400">Opens: {totalOpens}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span className="text-slate-400">Closes: {totalCloses}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data}>
              <XAxis
                dataKey="hour"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e2329',
                  border: '1px solid #2b3139',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="opens" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="closes" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Net PnL */}
          <div className="mt-4 text-center">
            <div className="text-xs text-slate-400">Net PnL</div>
            <div className={`text-lg font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-500">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-xs">No events in this timeframe</p>
        </div>
      )}
    </div>
  );
}
