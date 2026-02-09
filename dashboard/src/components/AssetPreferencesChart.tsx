'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssetPreferences } from '@/lib/api';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Cell, Pie, PieChart, ResponsiveContainer, Legend } from 'recharts';

interface AssetPreferencesChartProps {
    assetPreferences: AssetPreferences;
}

// Color palette for pie chart segments
const COLORS = [
    '#f59e0b', // amber
    '#3b82f6', // blue
    '#10b981', // emerald
    '#8b5cf6', // violet
    '#ef4444', // red
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
];

export function AssetPreferencesChart({ assetPreferences }: AssetPreferencesChartProps) {
    if (!assetPreferences?.data || assetPreferences.data.length === 0) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Asset Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-center py-8">No asset preference data</p>
                </CardContent>
            </Card>
        );
    }

    // Sort by volume and take top 10
    const sortedData = [...assetPreferences.data]
        .sort((a, b) => {
            const volA = typeof a.volume === 'string' ? parseFloat(a.volume) : a.volume;
            const volB = typeof b.volume === 'string' ? parseFloat(b.volume) : b.volume;
            return volB - volA;
        })
        .slice(0, 10);

    // Calculate total for percentage
    const total = sortedData.reduce((sum, item) => {
        const vol = typeof item.volume === 'string' ? parseFloat(item.volume) : item.volume;
        return sum + vol;
    }, 0);

    // Transform for chart
    const chartData = sortedData.map((item, index) => {
        const vol = typeof item.volume === 'string' ? parseFloat(item.volume) : item.volume;
        return {
            name: item.asset,
            value: vol,
            percentage: ((vol / total) * 100).toFixed(1),
            fill: COLORS[index % COLORS.length],
        };
    });

    const chartConfig = chartData.reduce((acc, item) => {
        acc[item.name] = { label: item.name, color: item.fill };
        return acc;
    }, {} as Record<string, { label: string; color: string }>);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Asset Preferences</CardTitle>
                    <span className="text-xs text-slate-400">
                        {assetPreferences.timeRange} • Top {sortedData.length} assets
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <ChartContainer config={chartConfig} className="h-[250px] w-full md:w-1/2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    innerRadius={40}
                                    paddingAngle={2}
                                    label={({ name, percentage }) => `${name} ${percentage}%`}
                                    labelLine={false}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <ChartTooltip content={<ChartTooltipContent />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>

                    {/* Legend List */}
                    <div className="flex-1 grid grid-cols-2 gap-2">
                        {chartData.map((item) => (
                            <div key={item.name} className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.fill }}
                                />
                                <span className="text-sm text-slate-300">{item.name}</span>
                                <span className="text-xs text-slate-500">{item.percentage}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
