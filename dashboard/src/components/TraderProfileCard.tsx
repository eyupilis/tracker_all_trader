'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PortfolioDetail, formatNumber, formatDate } from '@/lib/api';

interface TraderProfileCardProps {
    portfolio: PortfolioDetail;
    leadId: string;
    leadCommon?: {
        futuresPublicLPStatus?: string;
        spotPublicLPStatus?: string;
        leadOwner?: boolean;
    };
}

export function TraderProfileCard({ portfolio, leadId, leadCommon }: TraderProfileCardProps) {
    const getBadgeColor = (badge: string) => {
        switch (badge?.toUpperCase()) {
            case 'MASTER':
                return 'bg-yellow-500 text-black';
            case 'STAR':
                return 'bg-purple-500 text-white';
            case 'ELITE':
                return 'bg-blue-500 text-white';
            default:
                return 'bg-gray-500 text-white';
        }
    };

    const getStatusColor = (status: string) => {
        return status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50';
    };

    // Safe number parsing for string values
    const parseNum = (val: unknown): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val) || 0;
        return 0;
    };

    const sharpRatio = parseNum(portfolio.sharpRatio);
    const profitRate = parseNum(portfolio.profitSharingRate);
    const profitShareDisplay = profitRate > 1 ? profitRate : profitRate * 100;

    return (
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 ring-2 ring-yellow-500">
                        <AvatarImage src={portfolio.avatarUrl} alt={portfolio.nickname} />
                        <AvatarFallback className="bg-slate-700 text-xl">
                            {portfolio.nickname?.slice(0, 2).toUpperCase() || '??'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-2xl text-white">
                                {portfolio.nickname || `Trader ${leadId.slice(-6)}`}
                            </CardTitle>
                            {portfolio.badgeName && (
                                <Badge className={getBadgeColor(portfolio.badgeName)}>
                                    {portfolio.badgeName}
                                </Badge>
                            )}
                            {portfolio.status && (
                                <Badge variant="outline" className={getStatusColor(portfolio.status)}>
                                    {portfolio.status}
                                </Badge>
                            )}
                            {portfolio.futuresType && (
                                <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                                    {portfolio.futuresType}
                                </Badge>
                            )}
                            {portfolio.portfolioType && (
                                <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                                    {portfolio.portfolioType}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                            {portfolio.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            {portfolio.startTime && (
                                <span>🗓️ Trading since {formatDate(portfolio.startTime)}</span>
                            )}
                            {portfolio.lockPeriod && (
                                <span>🔒 {portfolio.lockPeriod} days lock</span>
                            )}
                            {portfolio.positionShow && (
                                <span>👁️ Positions visible</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Primary Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatItem
                        label="AUM"
                        value={`$${formatNumber(portfolio.aumAmount)}`}
                        subtext="Assets Under Mgmt"
                    />
                    <StatItem
                        label="Margin Balance"
                        value={`$${formatNumber(portfolio.marginBalance)}`}
                        subtext="Available margin"
                    />
                    <StatItem
                        label="Sharpe Ratio"
                        value={sharpRatio.toFixed(2)}
                        valueColor={sharpRatio > 1.5 ? 'text-green-400' : sharpRatio > 1 ? 'text-yellow-400' : 'text-orange-400'}
                    />
                    <StatItem
                        label="Profit Share"
                        value={`${profitShareDisplay.toFixed(0)}%`}
                        subtext="Commission rate"
                    />
                </div>

                <Separator className="bg-slate-700" />

                {/* Copier Stats Row */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <MiniStat
                        label="Active Copiers"
                        value={portfolio.currentCopyCount?.toLocaleString() || '0'}
                    />
                    <MiniStat
                        label="Max Copiers"
                        value={portfolio.maxCopyCount?.toLocaleString() || '∞'}
                    />
                    <MiniStat
                        label="Total Copiers"
                        value={portfolio.totalCopyCount?.toLocaleString() || '0'}
                    />
                    <MiniStat
                        label="Mock Copiers"
                        value={portfolio.mockCopyCount?.toLocaleString() || '0'}
                    />
                    <MiniStat
                        label="Badge Req."
                        value={portfolio.badgeCopierCount?.toLocaleString() || '-'}
                        subtext="copiers"
                    />
                    <MiniStat
                        label="Favorites"
                        value={portfolio.favoriteCount?.toLocaleString() || '0'}
                    />
                </div>

                <Separator className="bg-slate-700" />

                {/* Performance Stats Row */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <MiniStat
                        label="Copier PnL"
                        value={`$${formatNumber(portfolio.copierPnl)}`}
                        valueColor={parseNum(portfolio.copierPnl) >= 0 ? 'text-green-400' : 'text-red-400'}
                    />
                    <MiniStat
                        label="Rebate Fee"
                        value={`$${formatNumber(portfolio.rebateFee)}`}
                        valueColor="text-cyan-400"
                    />
                    <MiniStat
                        label="Last Trade"
                        value={portfolio.lastTradeTime ? formatDate(portfolio.lastTradeTime) : '-'}
                    />
                    <MiniStat
                        label="Closed Leads"
                        value={portfolio.closeLeadCount?.toString() || '0'}
                    />
                    <MiniStat
                        label="Sync Settings"
                        value={portfolio.syncSettingCount?.toString() || '0'}
                    />
                    <MiniStat
                        label="Invite Codes"
                        value={portfolio.inviteCodeCount?.toString() || '0'}
                    />
                </div>

                {/* Lead Platform Status */}
                {leadCommon && (
                    <>
                        <Separator className="bg-slate-700" />
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-500">Platform Status:</span>
                            {leadCommon.futuresPublicLPStatus && (
                                <Badge variant="outline" className={getStatusColor(leadCommon.futuresPublicLPStatus)}>
                                    Futures: {leadCommon.futuresPublicLPStatus}
                                </Badge>
                            )}
                            {leadCommon.spotPublicLPStatus && (
                                <Badge variant="outline" className={getStatusColor(leadCommon.spotPublicLPStatus)}>
                                    Spot: {leadCommon.spotPublicLPStatus}
                                </Badge>
                            )}
                            {leadCommon.leadOwner && (
                                <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                                    Lead Owner
                                </Badge>
                            )}
                        </div>
                    </>
                )}

                {/* Tags */}
                {portfolio.tag && portfolio.tag.length > 0 && (
                    <div className="flex gap-2 flex-wrap pt-2">
                        {portfolio.tag.map((tag, i) => (
                            <Badge key={i} variant="outline" className="border-slate-600 text-slate-300">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface StatItemProps {
    label: string;
    value: string;
    subtext?: string;
    valueColor?: string;
}

function StatItem({ label, value, subtext, valueColor = 'text-white' }: StatItemProps) {
    return (
        <div className="text-center p-3 rounded-lg bg-slate-800/50">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
            {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        </div>
    );
}

interface MiniStatProps {
    label: string;
    value: string;
    subtext?: string;
    valueColor?: string;
}

function MiniStat({ label, value, subtext, valueColor = 'text-white' }: MiniStatProps) {
    return (
        <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
            {subtext && <p className="text-[10px] text-slate-600">{subtext}</p>}
        </div>
    );
}
