'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Position, formatNumber, formatPnl } from '@/lib/api';

interface PositionsTableProps {
    positions: Position[];
    enableMobileDetailDrawer?: boolean;
}

export function PositionsTable({
    positions,
    enableMobileDetailDrawer = true,
}: PositionsTableProps) {
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

    if (!positions || positions.length === 0) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Active Positions</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-center py-8">No active positions</p>
                </CardContent>
            </Card>
        );
    }

    // Calculate totals
    const totalNotional = positions.reduce((sum, pos) => {
        const val = typeof pos.notionalValue === 'string' ? parseFloat(pos.notionalValue) : pos.notionalValue;
        return sum + (val || 0);
    }, 0);

    const totalUnrealizedPnl = positions.reduce((sum, pos) => {
        const val = typeof pos.unrealizedProfit === 'string' ? parseFloat(pos.unrealizedProfit) : pos.unrealizedProfit;
        return sum + (val || 0);
    }, 0);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-white">Active Positions</CardTitle>
                    <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                        <Badge variant="outline" className="border-slate-600">
                            {positions.length} positions
                        </Badge>
                        <div className="text-sm">
                            <span className="text-slate-400">Total Value: </span>
                            <span className="text-white font-semibold">${formatNumber(totalNotional)}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-slate-400">Total PnL: </span>
                            <span className={totalUnrealizedPnl >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {totalUnrealizedPnl >= 0 ? '+' : ''}${formatNumber(totalUnrealizedPnl)}
                            </span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="md:hidden space-y-3">
                    {positions.map((pos, index) => {
                        const unrealizedPnl = formatPnl(pos.unrealizedProfit);
                        return (
                            <div key={pos.id || index} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-white">{pos.symbol}</p>
                                    <Badge
                                        variant="outline"
                                        className={
                                            pos.positionSide === 'LONG'
                                                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                                : pos.positionSide === 'SHORT'
                                                    ? 'bg-red-500/20 text-red-400 border-red-500/50'
                                                    : 'bg-slate-500/20 text-slate-300 border-slate-500/50'
                                        }
                                    >
                                        {pos.positionSide}
                                    </Badge>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <p className="text-slate-400">Lev: <span className="text-slate-200">{pos.leverage}x</span></p>
                                    <p className="text-slate-400">Mode: <span className="text-slate-200">{pos.isolated ? 'Isolated' : 'Cross'}</span></p>
                                    <p className="text-slate-400">Notional: <span className="text-slate-200">${formatNumber(pos.notionalValue)}</span></p>
                                    <p className="text-slate-400">PnL: <span className={unrealizedPnl.color}>${unrealizedPnl.text}</span></p>
                                </div>
                                {enableMobileDetailDrawer ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3 w-full border-slate-700 text-slate-200"
                                        onClick={() => setSelectedPosition(pos)}
                                    >
                                        Details
                                    </Button>
                                ) : null}
                            </div>
                        );
                    })}
                </div>

                <div className="hidden md:block max-h-[680px] overflow-auto">
                    <Table className="min-w-[1180px]">
                        <TableHeader>
                            <TableRow className="border-slate-700 hover:bg-transparent">
                                <TableHead className="text-slate-400">Symbol</TableHead>
                                <TableHead className="text-slate-400">Side</TableHead>
                                <TableHead className="text-slate-400">Mode</TableHead>
                                <TableHead className="text-slate-400">Leverage</TableHead>
                                <TableHead className="text-slate-400 text-right">Size</TableHead>
                                <TableHead className="text-slate-400 text-right">Entry</TableHead>
                                <TableHead className="text-slate-400 text-right">Mark</TableHead>
                                <TableHead className="text-slate-400 text-right">Break-Even</TableHead>
                                <TableHead className="text-slate-400 text-right">Value</TableHead>
                                <TableHead className="text-slate-400 text-right">Unreal. PnL</TableHead>
                                <TableHead className="text-slate-400 text-right">Realized</TableHead>
                                <TableHead className="text-slate-400 text-center">ADL</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.map((pos, index) => {
                                const unrealizedPnl = formatPnl(pos.unrealizedProfit);
                                const realizedPnl = formatPnl(pos.cumRealized);
                                const size = parseFloat(String(pos.positionAmount));
                                const adlLevel = pos.adl || 0;

                                return (
                                    <TableRow key={pos.id || index} className="border-slate-700 hover:bg-slate-800">
                                        <TableCell className="font-medium text-white">
                                            <div className="flex items-center gap-2">
                                                {pos.symbol}
                                                <span className="text-xs text-slate-500">{pos.collateral}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={
                                                    pos.positionSide === 'LONG'
                                                        ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                                        : pos.positionSide === 'SHORT'
                                                            ? 'bg-red-500/20 text-red-400 border-red-500/50'
                                                            : 'bg-slate-500/20 text-slate-300 border-slate-500/50'
                                                }
                                                variant="outline"
                                            >
                                                {pos.positionSide}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={pos.isolated
                                                    ? 'border-orange-500/50 text-orange-400'
                                                    : 'border-blue-500/50 text-blue-400'
                                                }
                                            >
                                                {pos.isolated ? 'Isolated' : 'Cross'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-yellow-400 font-mono">
                                            {pos.leverage}x
                                        </TableCell>
                                        <TableCell className="text-right text-white font-mono">
                                            {formatNumber(Math.abs(size))}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-300 font-mono">
                                            ${formatNumber(pos.entryPrice)}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-300 font-mono">
                                            ${formatNumber(pos.markPrice)}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-400 font-mono text-sm">
                                            ${formatNumber(pos.breakEvenPrice)}
                                        </TableCell>
                                        <TableCell className="text-right text-cyan-400 font-mono">
                                            ${formatNumber(pos.notionalValue)}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-bold ${unrealizedPnl.color}`}>
                                            ${unrealizedPnl.text}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono text-sm ${realizedPnl.color}`}>
                                            ${realizedPnl.text}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <AdlIndicator level={adlLevel} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <Dialog
                    open={enableMobileDetailDrawer && Boolean(selectedPosition)}
                    onOpenChange={(open) => !open && setSelectedPosition(null)}
                >
                    <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100">
                        <DialogHeader>
                            <DialogTitle>Position Details</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Full position fields for mobile inspection.
                            </DialogDescription>
                        </DialogHeader>
                        {selectedPosition && (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <Field label="Symbol" value={selectedPosition.symbol} />
                                <Field label="Side" value={selectedPosition.positionSide} />
                                <Field label="Mode" value={selectedPosition.isolated ? 'Isolated' : 'Cross'} />
                                <Field label="Leverage" value={`${selectedPosition.leverage}x`} />
                                <Field label="Amount" value={formatNumber(selectedPosition.positionAmount)} />
                                <Field label="Notional" value={`$${formatNumber(selectedPosition.notionalValue)}`} />
                                <Field label="Entry Price" value={`$${formatNumber(selectedPosition.entryPrice)}`} />
                                <Field label="Mark Price" value={`$${formatNumber(selectedPosition.markPrice)}`} />
                                <Field label="Break-Even" value={`$${formatNumber(selectedPosition.breakEvenPrice)}`} />
                                <Field label="Unrealized PnL" value={`$${formatNumber(selectedPosition.unrealizedProfit)}`} />
                                <Field label="Cum Realized" value={`$${formatNumber(selectedPosition.cumRealized)}`} />
                                <Field label="ADL" value={String(selectedPosition.adl)} />
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

// ADL (Auto-Deleveraging) indicator component
function AdlIndicator({ level }: { level: number }) {
    const bars = [1, 2, 3, 4, 5];
    return (
        <div className="flex items-center justify-center gap-0.5">
            {bars.map((bar) => (
                <div
                    key={bar}
                    className={`w-1 h-3 rounded-sm ${bar <= level
                            ? level <= 2
                                ? 'bg-green-500'
                                : level <= 3
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                            : 'bg-slate-700'
                        }`}
                />
            ))}
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm text-slate-200 break-all">{value}</p>
        </div>
    );
}
