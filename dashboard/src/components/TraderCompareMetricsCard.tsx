import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, TraderPayload } from '@/lib/api';
import { buildRiskAlerts, buildRiskScore, deriveTraderMetrics } from '@/lib/trader-insights';

interface TraderCompareMetricsCardProps {
    primaryLeadId: string;
    compareLeadId: string;
    primary: TraderPayload;
    compare: TraderPayload;
}

interface CompareRow {
    label: string;
    primaryLabel: string;
    compareLabel: string;
    deltaLabel: string;
    deltaRaw: number | null;
    higherIsBetter: boolean | null;
}

function deltaClass(deltaRaw: number | null, higherIsBetter: boolean | null): string {
    if (deltaRaw === null || higherIsBetter === null || deltaRaw === 0) return 'text-slate-300';
    const isBetter = higherIsBetter ? deltaRaw > 0 : deltaRaw < 0;
    return isBetter ? 'text-emerald-300' : 'text-rose-300';
}

function formatSigned(value: number, digits = 2): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(digits)}`;
}

export function TraderCompareMetricsCard({
    primaryLeadId,
    compareLeadId,
    primary,
    compare,
}: TraderCompareMetricsCardProps) {
    const primaryMetrics = deriveTraderMetrics(primary);
    const compareMetrics = deriveTraderMetrics(compare);

    const primaryRiskScore = buildRiskScore(buildRiskAlerts(primary, primaryMetrics));
    const compareRiskScore = buildRiskScore(buildRiskAlerts(compare, compareMetrics));

    const rows: CompareRow[] = [
        {
            label: 'AUM',
            primaryLabel: `$${formatNumber(primaryMetrics.aumAmount)}`,
            compareLabel: `$${formatNumber(compareMetrics.aumAmount)}`,
            deltaLabel:
                primaryMetrics.aumAmount !== null && compareMetrics.aumAmount !== null
                    ? `$${formatSigned(primaryMetrics.aumAmount - compareMetrics.aumAmount)}`
                    : '-',
            deltaRaw:
                primaryMetrics.aumAmount !== null && compareMetrics.aumAmount !== null
                    ? primaryMetrics.aumAmount - compareMetrics.aumAmount
                    : null,
            higherIsBetter: null,
        },
        {
            label: 'Sharpe Ratio',
            primaryLabel: primaryMetrics.sharpeRatio?.toFixed(2) || '-',
            compareLabel: compareMetrics.sharpeRatio?.toFixed(2) || '-',
            deltaLabel:
                primaryMetrics.sharpeRatio !== null && compareMetrics.sharpeRatio !== null
                    ? formatSigned(primaryMetrics.sharpeRatio - compareMetrics.sharpeRatio)
                    : '-',
            deltaRaw:
                primaryMetrics.sharpeRatio !== null && compareMetrics.sharpeRatio !== null
                    ? primaryMetrics.sharpeRatio - compareMetrics.sharpeRatio
                    : null,
            higherIsBetter: true,
        },
        {
            label: 'Copier PnL',
            primaryLabel: `$${formatNumber(primaryMetrics.copierPnl)}`,
            compareLabel: `$${formatNumber(compareMetrics.copierPnl)}`,
            deltaLabel:
                primaryMetrics.copierPnl !== null && compareMetrics.copierPnl !== null
                    ? `$${formatSigned(primaryMetrics.copierPnl - compareMetrics.copierPnl)}`
                    : '-',
            deltaRaw:
                primaryMetrics.copierPnl !== null && compareMetrics.copierPnl !== null
                    ? primaryMetrics.copierPnl - compareMetrics.copierPnl
                    : null,
            higherIsBetter: true,
        },
        {
            label: 'Latest ROI',
            primaryLabel: primaryMetrics.latestRoi !== null ? `${primaryMetrics.latestRoi.toFixed(2)}%` : '-',
            compareLabel: compareMetrics.latestRoi !== null ? `${compareMetrics.latestRoi.toFixed(2)}%` : '-',
            deltaLabel:
                primaryMetrics.latestRoi !== null && compareMetrics.latestRoi !== null
                    ? `${formatSigned(primaryMetrics.latestRoi - compareMetrics.latestRoi)}%`
                    : '-',
            deltaRaw:
                primaryMetrics.latestRoi !== null && compareMetrics.latestRoi !== null
                    ? primaryMetrics.latestRoi - compareMetrics.latestRoi
                    : null,
            higherIsBetter: true,
        },
        {
            label: 'Gross Notional',
            primaryLabel: `$${formatNumber(primaryMetrics.grossNotional)}`,
            compareLabel: `$${formatNumber(compareMetrics.grossNotional)}`,
            deltaLabel: `$${formatSigned(primaryMetrics.grossNotional - compareMetrics.grossNotional)}`,
            deltaRaw: primaryMetrics.grossNotional - compareMetrics.grossNotional,
            higherIsBetter: null,
        },
        {
            label: 'Max Leverage',
            primaryLabel: `${primaryMetrics.maxLeverage.toFixed(0)}x`,
            compareLabel: `${compareMetrics.maxLeverage.toFixed(0)}x`,
            deltaLabel: `${formatSigned(primaryMetrics.maxLeverage - compareMetrics.maxLeverage)}x`,
            deltaRaw: primaryMetrics.maxLeverage - compareMetrics.maxLeverage,
            higherIsBetter: false,
        },
        {
            label: 'Realized PnL (Loaded)',
            primaryLabel: `$${formatNumber(primaryMetrics.realizedPnl)}`,
            compareLabel: `$${formatNumber(compareMetrics.realizedPnl)}`,
            deltaLabel: `$${formatSigned(primaryMetrics.realizedPnl - compareMetrics.realizedPnl)}`,
            deltaRaw: primaryMetrics.realizedPnl - compareMetrics.realizedPnl,
            higherIsBetter: true,
        },
        {
            label: 'Active Positions',
            primaryLabel: primaryMetrics.activePositions.toString(),
            compareLabel: compareMetrics.activePositions.toString(),
            deltaLabel: formatSigned(primaryMetrics.activePositions - compareMetrics.activePositions, 0),
            deltaRaw: primaryMetrics.activePositions - compareMetrics.activePositions,
            higherIsBetter: null,
        },
        {
            label: 'Snapshot Freshness',
            primaryLabel:
                primaryMetrics.snapshotAgeMinutes === null ? '-' : `${primaryMetrics.snapshotAgeMinutes.toFixed(1)}m`,
            compareLabel:
                compareMetrics.snapshotAgeMinutes === null ? '-' : `${compareMetrics.snapshotAgeMinutes.toFixed(1)}m`,
            deltaLabel:
                primaryMetrics.snapshotAgeMinutes !== null && compareMetrics.snapshotAgeMinutes !== null
                    ? `${formatSigned(primaryMetrics.snapshotAgeMinutes - compareMetrics.snapshotAgeMinutes)}m`
                    : '-',
            deltaRaw:
                primaryMetrics.snapshotAgeMinutes !== null && compareMetrics.snapshotAgeMinutes !== null
                    ? primaryMetrics.snapshotAgeMinutes - compareMetrics.snapshotAgeMinutes
                    : null,
            higherIsBetter: false,
        },
        {
            label: 'Risk Score',
            primaryLabel: primaryRiskScore.score.toString(),
            compareLabel: compareRiskScore.score.toString(),
            deltaLabel: formatSigned(primaryRiskScore.score - compareRiskScore.score, 0),
            deltaRaw: primaryRiskScore.score - compareRiskScore.score,
            higherIsBetter: true,
        },
    ];

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-white text-base">Trader Compare</CardTitle>
                    <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="border-cyan-500/50 text-cyan-300">
                            Primary: {primaryLeadId}
                        </Badge>
                        <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                            Compare: {compareLeadId}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-950/70">
                            <tr className="border-b border-slate-800">
                                <th className="text-left p-3 text-slate-400">Metric</th>
                                <th className="text-right p-3 text-cyan-300">Primary</th>
                                <th className="text-right p-3 text-purple-300">Compare</th>
                                <th className="text-right p-3 text-slate-300">Delta</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.label} className="border-b border-slate-800 last:border-b-0">
                                    <td className="p-3 text-slate-200">{row.label}</td>
                                    <td className="p-3 text-right text-cyan-200 font-mono">{row.primaryLabel}</td>
                                    <td className="p-3 text-right text-purple-200 font-mono">{row.compareLabel}</td>
                                    <td className={`p-3 text-right font-mono ${deltaClass(row.deltaRaw, row.higherIsBetter)}`}>
                                        {row.deltaLabel}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
