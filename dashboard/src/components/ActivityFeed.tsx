'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatNumber } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { TraderDetailDrawer } from './TraderDetailDrawer';
import { MiniHeatMap } from './MiniHeatMap';

interface FeedEvent {
  eventId?: string;
  leadId: string;
  nickname: string;
  eventType?: string;
  side?: string;
  symbol: string;
  direction?: 'LONG' | 'SHORT';
  price: number;
  amount: number;
  total?: number;
  // Smart aggregation fields
  status?: 'OPEN_ONLY' | 'PARTIAL_CLOSE' | 'FULL_CLOSE' | 'OVER_CLOSE';
  totalOpened?: number;
  totalClosed?: number;
  closePercentage?: number;
  avgOpenPrice?: number;
  avgClosePrice?: number;
  openCount?: number;
  closeCount?: number;
  // Other fields
  leverage?: number | null;
  realizedPnl?: number | null;
  eventTime: number;
  eventTimeText?: string;
  segment?: 'VISIBLE' | 'HIDDEN' | 'UNKNOWN';
  positionShow?: boolean | null;
  traderWeight?: number | null;
  qualityScore?: number | null;
  confidence?: 'low' | 'medium' | 'high' | null;
  winRate?: number | null;
}

interface ActivityFeedProps {
  className?: string;
  onSymbolClick?: (symbol: string) => void;
  onTraderClick?: (leadId: string) => void;
}

function formatTimestamp(timestamp: number): string {
  // Convert to Istanbul timezone (Europe/Istanbul)
  const date = new Date(timestamp);
  const istanbulDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));

  const month = String(istanbulDate.getMonth() + 1).padStart(2, '0');
  const day = String(istanbulDate.getDate()).padStart(2, '0');
  const hours = String(istanbulDate.getHours()).padStart(2, '0');
  const minutes = String(istanbulDate.getMinutes()).padStart(2, '0');
  const seconds = String(istanbulDate.getSeconds()).padStart(2, '0');

  return `${month}-${day}, ${hours}:${minutes}:${seconds}`;
}

interface FeedEventCardProps {
  event: FeedEvent;
  onSymbolClick?: (symbol: string) => void;
  onTraderClick?: (leadId: string) => void;
}

function FeedEventCard({ event, onSymbolClick, onTraderClick }: FeedEventCardProps) {
  const router = useRouter();
  const direction = event.direction || (event.eventType?.includes('LONG') ? 'LONG' : 'SHORT');
  const isLong = direction === 'LONG';
  const isDerived = event.positionShow === false;

  // Smart aggregation display
  let actionText = '';
  let actionColor = '';

  if (event.status) {
    // New aggregated format
    switch (event.status) {
      case 'OPEN_ONLY':
        actionText = `opened ${direction}`;
        actionColor = isLong ? 'text-green-400' : 'text-red-400';
        break;
      case 'PARTIAL_CLOSE':
        actionText = `partially closed ${direction}`;
        actionColor = isLong ? 'text-green-300' : 'text-red-300';
        break;
      case 'FULL_CLOSE':
        actionText = `fully closed ${direction}`;
        actionColor = isLong ? 'text-green-200' : 'text-red-200';
        break;
      case 'OVER_CLOSE':
        actionText = `closed ${direction} (had prior)`;
        actionColor = isLong ? 'text-green-200' : 'text-red-200';
        break;
    }
  } else {
    // Fallback for old format
    const side = event.side || event.eventType || 'UNKNOWN';
    actionText = side.toLowerCase();
    actionColor = isLong ? 'text-green-400' : 'text-red-400';
  }

  const totalValue = event.total || (event.price * event.amount);

  return (
    <div className="border-b border-slate-700/50 pb-3 mb-3 hover:bg-slate-800/30 transition-colors px-3 py-2 rounded">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar
            className="h-6 w-6 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/traders/${event.leadId}`);
            }}
          >
            <AvatarFallback className="text-[10px] bg-slate-700">
              {event.nickname.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-slate-400">{formatTimestamp(event.eventTime)}</span>
        </div>
        {isDerived && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-600/40 text-orange-400">
            DERIVED
          </Badge>
        )}
      </div>

      {/* Action */}
      <div className="text-sm mb-1">
        <span
          className="text-slate-300 font-medium hover:text-white cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/traders/${event.leadId}`);
          }}
        >
          {event.nickname}
        </span>
        {' '}
        <span className={actionColor}>{actionText}</span>
        {' on '}
        <span
          className="font-mono font-semibold text-white hover:text-yellow-400 cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onSymbolClick?.(event.symbol);
          }}
        >
          {event.symbol}
        </span>
      </div>

      {/* Details */}
      <div className="text-xs text-slate-400 space-y-0.5">
        {event.status ? (
          // Smart aggregation format
          <>
            {event.status === 'OPEN_ONLY' && (
              <>
                <div>
                  Opened: <span className="text-slate-300">{formatNumber(event.totalOpened || 0)}</span>
                  {' @ '}
                  <span className="text-slate-300">${formatNumber(event.avgOpenPrice || 0)}</span>
                  {' · '}
                  <span className="text-blue-400">{event.openCount}× trades</span>
                </div>
              </>
            )}
            {(event.status === 'PARTIAL_CLOSE' || event.status === 'FULL_CLOSE' || event.status === 'OVER_CLOSE') && (
              <>
                <div>
                  Opened: <span className="text-slate-300">{formatNumber(event.totalOpened || 0)}</span>
                  {' @ '}
                  <span className="text-slate-300">${formatNumber(event.avgOpenPrice || 0)}</span>
                </div>
                <div>
                  Closed: <span className="text-slate-300">{formatNumber(event.totalClosed || 0)}</span>
                  {' @ '}
                  <span className="text-slate-300">${formatNumber(event.avgClosePrice || 0)}</span>
                  {' · '}
                  <span className={
                    event.status === 'OVER_CLOSE' ? 'text-orange-400' :
                    (event.closePercentage || 0) >= 100 ? 'text-green-400' : 'text-yellow-400'
                  }>
                    {event.closePercentage?.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px]">
                  <span className="text-blue-400">{event.openCount}× open</span>
                  {' · '}
                  <span className="text-purple-400">{event.closeCount}× close</span>
                </div>
              </>
            )}
          </>
        ) : (
          // Original format
          <>
            <div>
              Price: <span className="text-slate-300">${formatNumber(event.price)}</span>
              {' · '}
              Size: <span className="text-slate-300">{formatNumber(event.amount)}</span>
            </div>
            <div>
              Total: <span className="text-yellow-400">${formatNumber(totalValue)}</span>
              {event.leverage && event.leverage > 0 && (
                <>
                  {' · '}
                  Lev: <span className="text-orange-400">{event.leverage}x</span>
                </>
              )}
            </div>
            {event.realizedPnl !== undefined && event.realizedPnl !== null && (
              <div>
                PnL:{' '}
                <span className={event.realizedPnl >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                  {event.realizedPnl >= 0 ? '+' : ''}${formatNumber(event.realizedPnl)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ActivityFeed({ className, onSymbolClick, onTraderClick }: ActivityFeedProps) {
  const router = useRouter();
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Trader Detail Drawer
  const [selectedTraderId, setSelectedTraderId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Real-time notifications
  const [newEventsCount, setNewEventsCount] = useState(0);
  const prevFeedLengthRef = useRef(0);

  // Filters
  const [eventFilter, setEventFilter] = useState<'all' | 'OPEN' | 'CLOSE' | 'LONG' | 'SHORT'>('all');
  const [segmentFilter, setSegmentFilter] = useState<'BOTH' | 'VISIBLE' | 'HIDDEN'>('BOTH');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  const fetchFeed = async () => {
    try {
      const response = await fetch(`/api/signals/latest-records/feed?limit=200&timeRange=${timeRange}`);
      const data = await response.json();

      if (data.success) {
        const newData = data.data;

        // Detect new events for notification
        if (prevFeedLengthRef.current > 0 && newData.length > prevFeedLengthRef.current) {
          const newCount = newData.length - prevFeedLengthRef.current;
          setNewEventsCount(newCount);
        }

        prevFeedLengthRef.current = newData.length;
        setFeed(newData);
      }
    } catch (error) {
      console.error('Failed to fetch activity feed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();

    // Auto-refresh every 30 seconds (only if not paused)
    const interval = setInterval(() => {
      if (!isPaused) {
        fetchFeed();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isPaused, timeRange, segmentFilter]);

  // Client-side filtering
  const filteredFeed = useMemo(() => {
    let result = feed;

    // Event type filter
    if (eventFilter === 'OPEN') {
      result = result.filter(e => e.eventType?.startsWith('OPEN'));
    } else if (eventFilter === 'CLOSE') {
      result = result.filter(e => e.eventType?.startsWith('CLOSE'));
    } else if (eventFilter === 'LONG') {
      result = result.filter(e => e.eventType?.includes('LONG'));
    } else if (eventFilter === 'SHORT') {
      result = result.filter(e => e.eventType?.includes('SHORT'));
    }

    return result;
  }, [feed, eventFilter]);

  // Handle scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSymbolClick = (symbol: string) => {
    if (onSymbolClick) {
      onSymbolClick(symbol);
    } else {
      router.push(`/signals?symbol=${symbol}`);
    }
  };

  const handleTraderClick = (leadId: string) => {
    if (onTraderClick) {
      onTraderClick(leadId);
    } else {
      setSelectedTraderId(leadId);
      setIsDrawerOpen(true);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedTraderId(null), 300); // Clear after animation
  };

  const exportToCSV = () => {
    // Prepare CSV data
    const headers = ['Event Time', 'Trader', 'Event Type', 'Symbol', 'Price', 'Amount', 'Total Value', 'Leverage', 'PnL', 'Segment'];
    const rows = filteredFeed.map(event => [
      new Date(event.eventTime).toISOString(),
      event.nickname,
      event.eventType,
      event.symbol,
      event.price,
      event.amount,
      (event.price * event.amount).toFixed(2),
      event.leverage || 'N/A',
      event.realizedPnl?.toFixed(2) || 'N/A',
      event.segment,
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activity-feed-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`flex flex-col h-full bg-[#1e2329] rounded-xl border border-[#2b3139] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2b3139]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Live Feed</h3>
          <span className="text-xs text-slate-500">107 traders</span>
          {/* New events notification badge */}
          {newEventsCount > 0 && !isPaused && (
            <Badge
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer animate-pulse"
              onClick={() => {
                setNewEventsCount(0);
                scrollToTop();
              }}
            >
              {newEventsCount} new
            </Badge>
          )}
        </div>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 hover:bg-slate-700 rounded"
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-[#2b3139] bg-[#181b1f]">
        {/* Event type filter */}
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value as any)}
          className="text-xs bg-[#2b3139] text-slate-300 border border-[#3b4149] rounded px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Events</option>
          <option value="OPEN">Opens Only</option>
          <option value="CLOSE">Closes Only</option>
          <option value="LONG">Longs Only</option>
          <option value="SHORT">Shorts Only</option>
        </select>

        {/* Segment filter */}
        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value as any)}
          className="text-xs bg-[#2b3139] text-slate-300 border border-[#3b4149] rounded px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          <option value="BOTH">All Traders</option>
          <option value="VISIBLE">Visible Only</option>
          <option value="HIDDEN">Hidden Only</option>
        </select>

        {/* Time range */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="text-xs bg-[#2b3139] text-slate-300 border border-[#3b4149] rounded px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          <option value="1h">Last Hour</option>
          <option value="6h">Last 6 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>

        {/* Export CSV button */}
        <button
          onClick={exportToCSV}
          className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 hover:bg-slate-700 rounded"
          disabled={filteredFeed.length === 0}
          title="Export to CSV"
        >
          📥 CSV
        </button>

        {/* Refresh button */}
        <button
          onClick={() => fetchFeed()}
          className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 hover:bg-slate-700 rounded ml-auto"
          disabled={isLoading}
        >
          {isLoading ? '⟳ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Mini HeatMap */}
      <div className="p-3 border-b border-[#2b3139]">
        <MiniHeatMap onSymbolClick={handleSymbolClick} />
      </div>

      {/* Feed items count */}
      <div className="px-3 py-2 text-xs text-slate-500 border-b border-[#2b3139]">
        {filteredFeed.length} event{filteredFeed.length !== 1 ? 's' : ''}
      </div>

      {/* Feed */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative">
        {isLoading ? (
          <div className="space-y-3 p-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-3xl mb-2">📭</div>
            <p className="font-medium">No activity found</p>
            <p className="text-xs mt-1">Try adjusting filters or time range</p>
          </div>
        ) : (
          <div className="p-2">
            {filteredFeed.map((event, index) => (
              <FeedEventCard
                key={event.eventId || `${event.leadId}-${event.symbol}-${event.direction}-${index}`}
                event={event}
                onSymbolClick={handleSymbolClick}
                onTraderClick={handleTraderClick}
              />
            ))}
          </div>
        )}

        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="absolute bottom-4 right-4 bg-slate-700 hover:bg-slate-600 text-white rounded-full p-2 shadow-lg transition-all"
            title="Scroll to top"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>

      {/* Trader Detail Drawer */}
      <TraderDetailDrawer
        leadId={selectedTraderId}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
