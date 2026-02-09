'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Order, formatNumber, formatPnl, formatDate } from '@/lib/api';

interface OrderHistoryTableProps {
    orders: Order[];
    total?: number;
    enableVirtualization?: boolean;
    enableMobileDetailDrawer?: boolean;
}

const ROW_HEIGHT = 50;
const OVERSCAN = 10;
const VIRTUALIZATION_THRESHOLD = 180;

function getEventType(side: string, positionSide: string) {
    if (side === 'BUY' && positionSide === 'LONG') return { type: 'OPEN LONG', color: 'bg-green-500/20 text-green-400' };
    if (side === 'SELL' && positionSide === 'LONG') return { type: 'CLOSE LONG', color: 'bg-green-500/20 text-green-300' };
    if (side === 'BUY' && positionSide === 'SHORT') return { type: 'CLOSE SHORT', color: 'bg-red-500/20 text-red-300' };
    if (side === 'SELL' && positionSide === 'SHORT') return { type: 'OPEN SHORT', color: 'bg-red-500/20 text-red-400' };
    if (positionSide === 'BOTH' && side === 'BUY') return { type: 'BUY (BOTH)', color: 'bg-blue-500/20 text-blue-300' };
    if (positionSide === 'BOTH' && side === 'SELL') return { type: 'SELL (BOTH)', color: 'bg-purple-500/20 text-purple-300' };
    return { type: 'UNKNOWN', color: 'bg-gray-500/20 text-gray-400' };
}

function getOrderTypeColor(type: string) {
    switch (type?.toUpperCase()) {
        case 'MARKET':
            return 'border-orange-500/50 text-orange-400';
        case 'LIMIT':
            return 'border-blue-500/50 text-blue-400';
        case 'STOP_MARKET':
            return 'border-red-500/50 text-red-400';
        case 'TAKE_PROFIT_MARKET':
            return 'border-green-500/50 text-green-400';
        default:
            return 'border-slate-500/50 text-slate-400';
    }
}

export function OrderHistoryTable({
    orders,
    total,
    enableVirtualization = true,
    enableMobileDetailDrawer = true,
}: OrderHistoryTableProps) {
    const [mobileVisible, setMobileVisible] = useState(20);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(560);
    const containerRef = useRef<HTMLDivElement | null>(null);

    if (!orders || orders.length === 0) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Order History</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-center py-8">No order history</p>
                </CardContent>
            </Card>
        );
    }

    const totalRealizedPnl = useMemo(
        () => orders.reduce((sum, order) => sum + (order.totalPnl || 0), 0),
        [orders]
    );
    const useVirtualization = enableVirtualization && orders.length >= VIRTUALIZATION_THRESHOLD;

    useEffect(() => {
        if (!useVirtualization) return;
        const container = containerRef.current;
        if (!container) return;

        const updateHeight = () => {
            setContainerHeight(container.clientHeight || 560);
        };

        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(container);
        return () => observer.disconnect();
    }, [useVirtualization, orders.length]);

    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + (OVERSCAN * 2);
    const startIndex = useVirtualization ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0;
    const endIndex = useVirtualization ? Math.min(orders.length, startIndex + visibleCount) : orders.length;
    const visibleOrders = useVirtualization ? orders.slice(startIndex, endIndex) : orders;
    const paddingTop = useVirtualization ? startIndex * ROW_HEIGHT : 0;
    const paddingBottom = useVirtualization ? (orders.length - endIndex) * ROW_HEIGHT : 0;

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-white">Order History</CardTitle>
                    <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                        <Badge variant="outline" className="border-slate-600">
                            {orders.length} loaded
                        </Badge>
                        <Badge variant="outline" className="border-slate-600">
                            {total ?? orders.length} total
                        </Badge>
                        {useVirtualization && (
                            <Badge variant="outline" className="border-cyan-500/50 text-cyan-300">
                                Virtualized
                            </Badge>
                        )}
                        <div className="text-sm">
                            <span className="text-slate-400">Total Realized: </span>
                            <span className={totalRealizedPnl >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {totalRealizedPnl >= 0 ? '+' : ''}${formatNumber(totalRealizedPnl)}
                            </span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="md:hidden space-y-3">
                    {orders.slice(0, mobileVisible).map((order, index) => {
                        const eventInfo = getEventType(order.side, order.positionSide);
                        const pnl = order.totalPnl ? formatPnl(order.totalPnl) : { text: '-', color: 'text-slate-500' };
                        return (
                            <div key={`${order.symbol}-${order.orderTime}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-white">{order.symbol}</p>
                                    <Badge variant="outline" className={eventInfo.color}>
                                        {eventInfo.type}
                                    </Badge>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <p className="text-slate-400">Time: <span className="text-slate-200">{formatDate(order.orderTime)}</span></p>
                                    <p className="text-slate-400">Type: <span className="text-slate-200">{order.type}</span></p>
                                    <p className="text-slate-400">Qty: <span className="text-slate-200">{formatNumber(order.executedQty)}</span></p>
                                    <p className="text-slate-400">PnL: <span className={pnl.color}>{order.totalPnl ? `$${pnl.text}` : '-'}</span></p>
                                </div>
                                {enableMobileDetailDrawer ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3 w-full border-slate-700 text-slate-200"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        Details
                                    </Button>
                                ) : null}
                            </div>
                        );
                    })}
                    {mobileVisible < orders.length && (
                        <Button
                            variant="outline"
                            className="w-full border-slate-700 text-slate-200"
                            onClick={() => setMobileVisible((prev) => Math.min(prev + 20, orders.length))}
                        >
                            Load more ({orders.length - mobileVisible} left)
                        </Button>
                    )}
                </div>

                <div
                    ref={containerRef}
                    className="hidden md:block max-h-[680px] overflow-auto"
                    onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                >
                    <Table className="min-w-[980px]">
                        <TableHeader>
                            <TableRow className="border-slate-700 hover:bg-transparent">
                                <TableHead className="text-slate-400">Open Time</TableHead>
                                <TableHead className="text-slate-400">Update Time</TableHead>
                                <TableHead className="text-slate-400">Symbol</TableHead>
                                <TableHead className="text-slate-400">Pair</TableHead>
                                <TableHead className="text-slate-400">Action</TableHead>
                                <TableHead className="text-slate-400">Order Type</TableHead>
                                <TableHead className="text-slate-400 text-right">Qty</TableHead>
                                <TableHead className="text-slate-400 text-right">Avg Price</TableHead>
                                <TableHead className="text-slate-400 text-right">Realized PnL</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {useVirtualization && paddingTop > 0 && (
                                <TableRow className="border-0 hover:bg-transparent">
                                    <TableCell colSpan={9} className="p-0" style={{ height: `${paddingTop}px` }} />
                                </TableRow>
                            )}

                            {visibleOrders.map((order, index) => {
                                const realIndex = useVirtualization ? startIndex + index : index;
                                const eventInfo = getEventType(order.side, order.positionSide);
                                const pnl = order.totalPnl ? formatPnl(order.totalPnl) : { text: '-', color: 'text-slate-500' };

                                return (
                                    <TableRow key={`${order.symbol}-${order.orderTime}-${realIndex}`} className="border-slate-700 hover:bg-slate-800">
                                        <TableCell className="text-slate-400 text-sm">
                                            {formatDate(order.orderTime)}
                                        </TableCell>
                                        <TableCell className="text-slate-400 text-sm">
                                            {formatDate(order.orderUpdateTime)}
                                        </TableCell>
                                        <TableCell className="font-medium text-white">
                                            {order.symbol}
                                        </TableCell>
                                        <TableCell className="text-slate-400 text-sm">
                                            {order.baseAsset}/{order.quoteAsset}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={eventInfo.color} variant="outline">
                                                {eventInfo.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={getOrderTypeColor(order.type)}>
                                                {order.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-white font-mono">
                                            {formatNumber(order.executedQty)}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-300 font-mono">
                                            ${formatNumber(order.avgPrice)}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-bold ${pnl.color}`}>
                                            {order.totalPnl ? `$${pnl.text}` : '-'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {useVirtualization && paddingBottom > 0 && (
                                <TableRow className="border-0 hover:bg-transparent">
                                    <TableCell colSpan={9} className="p-0" style={{ height: `${paddingBottom}px` }} />
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Dialog
                    open={enableMobileDetailDrawer && Boolean(selectedOrder)}
                    onOpenChange={(open) => !open && setSelectedOrder(null)}
                >
                    <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100">
                        <DialogHeader>
                            <DialogTitle>Order Details</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Full order fields for mobile inspection.
                            </DialogDescription>
                        </DialogHeader>
                        {selectedOrder && (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <Field label="Symbol" value={selectedOrder.symbol} />
                                <Field label="Action" value={`${selectedOrder.side} ${selectedOrder.positionSide}`} />
                                <Field label="Type" value={selectedOrder.type} />
                                <Field label="Pair" value={`${selectedOrder.baseAsset}/${selectedOrder.quoteAsset}`} />
                                <Field label="Executed Qty" value={formatNumber(selectedOrder.executedQty)} />
                                <Field label="Avg Price" value={`$${formatNumber(selectedOrder.avgPrice)}`} />
                                <Field label="Total PnL" value={`$${formatNumber(selectedOrder.totalPnl)}`} />
                                <Field label="Order Time" value={formatDate(selectedOrder.orderTime)} />
                                <Field label="Update Time" value={formatDate(selectedOrder.orderUpdateTime)} />
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
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
