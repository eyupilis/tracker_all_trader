import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, TraderPayload } from '@/lib/api';
import { buildRiskAlerts, buildRiskScore, deriveTraderMetrics } from '@/lib/trader-insights';

interface TraderRiskSurfaceCardProps {
    payload: TraderPayload;
    title?: string;
}

function severityClass(severity: 'high' | 'medium' | 'low'): string {
    if (severity === 'high') return 'border-rose-500/50 text-rose-300';
    if (severity === 'medium') return 'border-amber-500/50 text-amber-300';
    return 'border-cyan-500/50 text-cyan-300';
}

function riskBandClass(band: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    if (band === 'HIGH') return 'border-rose-500/50 text-rose-300';
    if (band === 'MEDIUM') return 'border-amber-500/50 text-amber-300';
    return 'border-emerald-500/50 text-emerald-300';
}

function MetricBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
        </div>
    );
}

export function TraderRiskSurfaceCard({ payload, title = 'Risk Surface' }: TraderRiskSurfaceCardProps) {
    const metrics = deriveTraderMetrics(payload);
    const alerts = buildRiskAlerts(payload, metrics);
    const riskScore = buildRiskScore(alerts);

    const snapshotAgeText =
        metrics.snapshotAgeMinutes === null ? '-' : `${metrics.snapshotAgeMinutes.toFixed(1)}m`;
    const copyUtilizationText =
        metrics.copyUtilization === null ? '-' : `${(metrics.copyUtilization * 100).toFixed(1)}%`;
    const roiText = metrics.latestRoi === null ? '-' : `${metrics.latestRoi.toFixed(2)}%`;

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-white text-base">{title}</CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={riskBandClass(riskScore.band)}>
                            {riskScore.band} RISK
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-200">
                            Score {riskScore.score}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricBox label="Max / Avg Lev." value={`${metrics.maxLeverage.toFixed(0)}x / ${metrics.avgLeverage.toFixed(1)}x`} />
                    <MetricBox label="Gross Notional" value={`$${formatNumber(metrics.grossNotional)}`} />
                    <MetricBox label="Net Exposure" value={`$${formatNumber(metrics.netExposure)}`} />
                    <MetricBox label="Unrealized PnL" value={`$${formatNumber(metrics.unrealizedPnl)}`} />
                    <MetricBox label="Realized PnL" value={`$${formatNumber(metrics.realizedPnl)}`} />
                    <MetricBox label="Top Symbol Weight" value={metrics.topSymbol ? `${metrics.topSymbol} ${metrics.topSymbolShare.toFixed(1)}%` : '-'} />
                    <MetricBox label="Top Asset Weight" value={metrics.topAsset ? `${metrics.topAsset} ${metrics.topAssetShare.toFixed(1)}%` : '-'} />
                    <MetricBox label="Snapshot Age" value={snapshotAgeText} />
                    <MetricBox label="Copy Utilization" value={copyUtilizationText} />
                    <MetricBox label="Latest ROI" value={roiText} />
                    <MetricBox label="ADL High Count" value={metrics.adlHighCount.toString()} />
                    <MetricBox label="Active Positions" value={metrics.activePositions.toString()} />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-200">Alert Badges</p>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {alerts.length} alerts
                        </Badge>
                    </div>

                    {alerts.length === 0 ? (
                        <p className="text-sm text-emerald-300">No active risk alerts in this snapshot.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {alerts.map((alert) => (
                                <Badge key={alert.code} variant="outline" className={severityClass(alert.severity)}>
                                    {alert.title}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {alerts.length > 0 && (
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                            {alerts.slice(0, 4).map((alert) => (
                                <div key={`detail-${alert.code}`} className="flex items-start justify-between gap-3">
                                    <p className="text-xs text-slate-300">{alert.detail}</p>
                                    <Badge variant="outline" className={severityClass(alert.severity)}>
                                        {alert.severity.toUpperCase()}
                                    </Badge>
                                </div>
                            ))}
                            {alerts.length > 4 && (
                                <p className="text-xs text-slate-500">+{alerts.length - 4} more alerts</p>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
