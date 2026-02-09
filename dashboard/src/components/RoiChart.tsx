'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoiDataPoint } from '@/lib/api';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface RoiChartProps {
    roiSeries: RoiDataPoint[];
}

export function RoiChart({ roiSeries }: RoiChartProps) {
    if (!roiSeries || roiSeries.length === 0) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">30D ROI</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-center py-8">No ROI data available</p>
                </CardContent>
            </Card>
        );
    }

    // Transform data for chart
    const chartData = roiSeries.map((point) => ({
        date: new Date(point.dateTime).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
        roi: point.value * 100, // Convert to percentage
        timestamp: point.dateTime,
    }));

    // Calculate metrics
    const latestRoi = chartData[chartData.length - 1]?.roi || 0;
    const maxRoi = Math.max(...chartData.map(d => d.roi));
    const minRoi = Math.min(...chartData.map(d => d.roi));

    const chartConfig = {
        roi: {
            label: 'ROI',
            color: latestRoi >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)',
        },
    };

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white">30D ROI</CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Current</p>
                            <p className={`text-lg font-bold ${latestRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {latestRoi >= 0 ? '+' : ''}{latestRoi.toFixed(2)}%
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Max</p>
                            <p className="text-sm text-green-400">+{maxRoi.toFixed(2)}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Min</p>
                            <p className="text-sm text-red-400">{minRoi.toFixed(2)}%</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={latestRoi >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={latestRoi >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickFormatter={(v) => `${v}%`}
                                width={50}
                            />
                            <ChartTooltip
                                content={<ChartTooltipContent />}
                                cursor={{ stroke: '#475569', strokeDasharray: '4 4' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="roi"
                                stroke={latestRoi >= 0 ? '#22c55e' : '#ef4444'}
                                strokeWidth={2}
                                fill="url(#roiGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
