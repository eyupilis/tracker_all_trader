'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadCommon, PortfolioDetail } from '@/lib/api';
import { evaluateTraderPayloadChecklist } from '@/lib/field-checklist';
import type { TraderPayload } from '@/lib/api';

interface ProfileOperationsOverviewProps {
    payload: TraderPayload;
    leadCommon: LeadCommon;
    portfolio: PortfolioDetail;
    fetchedAt: string;
    timeRange: string;
    assetUpdateTime?: number;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function formatTimestamp(value: unknown): string {
    const numeric = toNumber(value);
    if (!numeric || numeric <= 0) return '-';
    return new Date(numeric).toLocaleString('tr-TR');
}

function formatNumber(value: unknown, suffix = ''): string {
    const numeric = toNumber(value);
    if (numeric === null) return '-';
    return `${numeric.toLocaleString('en-US')}${suffix}`;
}

function boolBadge(value: unknown): { label: string; className: string } {
    if (value === true) return { label: 'Enabled', className: 'border-emerald-500/50 text-emerald-300' };
    if (value === false) return { label: 'Disabled', className: 'border-slate-600 text-slate-300' };
    return { label: 'Unknown', className: 'border-amber-500/50 text-amber-300' };
}

function statusBadge(status: unknown): { label: string; className: string } {
    if (typeof status !== 'string' || status.trim().length === 0) {
        return { label: 'Unknown', className: 'border-amber-500/50 text-amber-300' };
    }

    const normalized = status.toUpperCase();
    if (normalized.includes('ACTIVE') || normalized.includes('OPEN') || normalized.includes('PUBLIC')) {
        return { label: status, className: 'border-emerald-500/50 text-emerald-300' };
    }
    if (normalized.includes('CLOSE') || normalized.includes('INACTIVE') || normalized.includes('DISABLE')) {
        return { label: status, className: 'border-rose-500/50 text-rose-300' };
    }
    return { label: status, className: 'border-cyan-500/50 text-cyan-300' };
}

function stalenessBadge(ageMinutes: number | null): { label: string; className: string } {
    if (ageMinutes === null) return { label: 'Unknown', className: 'border-amber-500/50 text-amber-300' };
    if (ageMinutes <= 3) return { label: `Fresh (${ageMinutes.toFixed(1)}m)`, className: 'border-emerald-500/50 text-emerald-300' };
    if (ageMinutes <= 15) return { label: `Warm (${ageMinutes.toFixed(1)}m)`, className: 'border-yellow-500/50 text-yellow-300' };
    return { label: `Stale (${ageMinutes.toFixed(1)}m)`, className: 'border-rose-500/50 text-rose-300' };
}

function FieldRow({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-800/70 last:border-b-0">
            <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
            <span className={`text-sm text-slate-100 text-right break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    );
}

export function ProfileOperationsOverview({
    payload,
    leadCommon,
    portfolio,
    fetchedAt,
    timeRange,
    assetUpdateTime,
}: ProfileOperationsOverviewProps) {
    const portfolioRecord = portfolio as Record<string, unknown>;
    const now = Date.now();
    const fetchedAtMs = Number.isNaN(Date.parse(fetchedAt)) ? null : Date.parse(fetchedAt);
    const snapshotAgeMinutes = fetchedAtMs === null ? null : Math.max(0, (now - fetchedAtMs) / (1000 * 60));
    const assetAgeHours =
        typeof assetUpdateTime === 'number' && assetUpdateTime > 0
            ? Math.max(0, (now - assetUpdateTime) / (1000 * 60 * 60))
            : null;

    const checklist = evaluateTraderPayloadChecklist(payload);
    const missingFields = checklist.missingPaths;
    const missingPreview = missingFields.slice(0, 8);
    const remainingMissing = Math.max(0, missingFields.length - missingPreview.length);

    const futuresPublicStatus = statusBadge(leadCommon.futuresPublicLPStatus);
    const futuresPrivateStatus = statusBadge(leadCommon.futuresPrivateLPStatus);
    const spotPublicStatus = statusBadge(leadCommon.spotPublicLPStatus);
    const spotPrivateStatus = statusBadge(leadCommon.spotPrivateLPStatus);
    const freshness = stalenessBadge(snapshotAgeMinutes);

    const tagList = Array.isArray(portfolioRecord.tag) ? portfolioRecord.tag : [];
    const tagItemList = Array.isArray(portfolioRecord.tagItemVos) ? portfolioRecord.tagItemVos : [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-white text-base">Platform IDs & Status</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <FieldRow label="Futures Public LP ID" value={leadCommon.futuresPublicLPId || '-'} mono />
                        <FieldRow
                            label="Futures Public Status"
                            value={<Badge variant="outline" className={futuresPublicStatus.className}>{futuresPublicStatus.label}</Badge>}
                        />
                        <FieldRow label="Futures Private LP ID" value={leadCommon.futuresPrivateLPId || '-'} mono />
                        <FieldRow
                            label="Futures Private Status"
                            value={<Badge variant="outline" className={futuresPrivateStatus.className}>{futuresPrivateStatus.label}</Badge>}
                        />
                        <FieldRow label="Spot Public LP ID" value={leadCommon.spotPublicLPId || '-'} mono />
                        <FieldRow
                            label="Spot Public Status"
                            value={<Badge variant="outline" className={spotPublicStatus.className}>{spotPublicStatus.label}</Badge>}
                        />
                        <FieldRow label="Spot Private LP ID" value={leadCommon.spotPrivateLPId || '-'} mono />
                        <FieldRow
                            label="Spot Private Status"
                            value={<Badge variant="outline" className={spotPrivateStatus.className}>{spotPrivateStatus.label}</Badge>}
                        />
                        <FieldRow
                            label="Lead Owner"
                            value={
                                <Badge
                                    variant="outline"
                                    className={leadCommon.leadOwner ? 'border-yellow-500/50 text-yellow-300' : 'border-slate-600 text-slate-300'}
                                >
                                    {leadCommon.leadOwner ? 'Yes' : 'No'}
                                </Badge>
                            }
                        />
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-white text-base">Copy Limits & Guardrails</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <FieldRow label="Current / Max Copy" value={`${formatNumber(portfolioRecord.currentCopyCount)} / ${formatNumber(portfolioRecord.maxCopyCount)}`} />
                        <FieldRow label="Final Effective Max" value={formatNumber(portfolioRecord.finalEffectiveMaxCopyCount)} />
                        <FieldRow label="Risk Control Max" value={formatNumber(portfolioRecord.riskControlMaxCopyCount)} />
                        <FieldRow label="Lock Period (days)" value={formatNumber(portfolioRecord.lockPeriod)} />
                        <FieldRow label="Copier Lock Ends" value={formatTimestamp(portfolioRecord.copierLockPeriodTime)} />
                        <FieldRow label="Copier Unlock Expires" value={formatTimestamp(portfolioRecord.copierUnlockExpiredTime)} />
                        <FieldRow label="Min Fixed Copy (USD)" value={formatNumber(portfolioRecord.fixedAmountMinCopyUsd)} />
                        <FieldRow label="Min Ratio Copy (USD)" value={formatNumber(portfolioRecord.fixedRadioMinCopyUsd)} />
                        <FieldRow label="Init Invest Asset" value={(portfolioRecord.initInvestAsset as string) || '-'} />
                        <FieldRow label="Copier PnL Asset" value={(portfolioRecord.copierPnlAsset as string) || '-'} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-white text-base">Operational Switches</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <FieldRow label="Enable Trading Signal" value={<Badge variant="outline" className={boolBadge(portfolioRecord.enableTradingSignal).className}>{boolBadge(portfolioRecord.enableTradingSignal).label}</Badge>} />
                        <FieldRow label="Feed Share Switch" value={<Badge variant="outline" className={boolBadge(portfolioRecord.feedShareSwitch).className}>{boolBadge(portfolioRecord.feedShareSwitch).label}</Badge>} />
                        <FieldRow label="Feed Agreement" value={<Badge variant="outline" className={boolBadge(portfolioRecord.feedAgreement).className}>{boolBadge(portfolioRecord.feedAgreement).label}</Badge>} />
                        <FieldRow label="Enable Add Max Copier" value={<Badge variant="outline" className={boolBadge(portfolioRecord.enableAddMaxCopier).className}>{boolBadge(portfolioRecord.enableAddMaxCopier).label}</Badge>} />
                        <FieldRow label="Has Copy" value={<Badge variant="outline" className={boolBadge(portfolioRecord.hasCopy).className}>{boolBadge(portfolioRecord.hasCopy).label}</Badge>} />
                        <FieldRow label="Has Mock" value={<Badge variant="outline" className={boolBadge(portfolioRecord.hasMock).className}>{boolBadge(portfolioRecord.hasMock).label}</Badge>} />
                        <FieldRow label="Slot Reminder" value={<Badge variant="outline" className={boolBadge(portfolioRecord.hasSlotReminder).className}>{boolBadge(portfolioRecord.hasSlotReminder).label}</Badge>} />
                        <FieldRow label="Position Show" value={<Badge variant="outline" className={boolBadge(portfolioRecord.positionShow).className}>{boolBadge(portfolioRecord.positionShow).label}</Badge>} />
                        <FieldRow label="Sync Setting" value={(portfolioRecord.syncSetting as string) || '-'} />
                        <FieldRow label="Sync Setting Count" value={formatNumber(portfolioRecord.syncSettingCount)} />
                        <FieldRow label="Invite Code Count" value={formatNumber(portfolioRecord.inviteCodeCount)} />
                        <FieldRow label="Feed Share Limit" value={formatNumber(portfolioRecord.feedSharePushLimit)} />
                        <FieldRow label="Tag Count / TagItemVos" value={`${tagList.length} / ${tagItemList.length}`} />
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-white text-base">Lifecycle & Freshness</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <FieldRow label="Snapshot Fetched At" value={new Date(fetchedAt).toLocaleString('tr-TR')} />
                        <FieldRow
                            label="Snapshot Freshness"
                            value={<Badge variant="outline" className={freshness.className}>{freshness.label}</Badge>}
                        />
                        <FieldRow label="Time Range" value={timeRange || '-'} />
                        <FieldRow label="Trading Start Time" value={formatTimestamp(portfolioRecord.startTime)} />
                        <FieldRow label="Portfolio End Time" value={formatTimestamp(portfolioRecord.endTime)} />
                        <FieldRow label="Last Trade Time" value={formatTimestamp(portfolioRecord.lastTradeTime)} />
                        <FieldRow label="Badge Modify Time" value={formatTimestamp(portfolioRecord.badgeModifyTime)} />
                        <FieldRow label="Closed Time" value={formatTimestamp(portfolioRecord.closedTime)} />
                        <FieldRow
                            label="Asset Pref Update"
                            value={assetAgeHours === null ? '-' : `${assetAgeHours.toFixed(1)}h ago`}
                        />
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-white text-base">Critical Field Coverage</CardTitle>
                        <Badge
                            variant="outline"
                            className={
                                missingFields.length === 0
                                    ? 'border-emerald-500/50 text-emerald-300'
                                    : 'border-amber-500/50 text-amber-300'
                            }
                        >
                            {missingFields.length === 0
                                ? `Complete (${checklist.totalChecked} checks)`
                                : `${missingFields.length} missing / ${checklist.totalChecked} checks`}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-xs text-slate-400">
                        Checks critical operational fields required for profile rendering and behavioral controls.
                    </p>
                    {missingFields.length === 0 ? (
                        <p className="text-sm text-emerald-300">All critical fields are present in this snapshot.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {missingPreview.map((field) => (
                                <Badge key={field} variant="outline" className="border-amber-500/50 text-amber-200">
                                    {field}
                                </Badge>
                            ))}
                            {remainingMissing > 0 && (
                                <Badge variant="outline" className="border-slate-600 text-slate-300">
                                    +{remainingMissing} more
                                </Badge>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
