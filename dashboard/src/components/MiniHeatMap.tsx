'use client';

import { useEffect, useState } from 'react';
import { HeatMapData } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface MiniHeatMapProps {
  className?: string;
  onSymbolClick?: (symbol: string) => void;
}

export function MiniHeatMap({ className, onSymbolClick }: MiniHeatMapProps) {
  const [data, setData] = useState<HeatMapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/signals/heatmap?segment=BOTH&timeRange=24h`);
      const result = await response.json();
      if (result.success) {
        // Show top 8 symbols by confidence score
        const top = result.data
          .sort((a: HeatMapData, b: HeatMapData) => b.confidenceScore - a.confidenceScore)
          .slice(0, 8);
        setData(top);
      }
    } catch (error) {
      console.error('Failed to fetch mini heatmap:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className={`bg-[#1e2329] rounded-xl border border-[#2b3139] p-3 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-32 mb-2" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <div className={`bg-[#1e2329] rounded-xl border border-[#2b3139] p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white">Active Positions (24h)</h3>
        <span className="text-xs text-slate-500">{data.length} symbols</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.map((item) => {
          const isLong = item.consensusDirection === 'LONG';
          const isShort = item.consensusDirection === 'SHORT';
          const bgColor = isLong
            ? 'bg-green-500/10 border-green-500/30'
            : isShort
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-slate-700/10 border-slate-700/30';

          return (
            <button
              key={item.symbol}
              onClick={() => onSymbolClick?.(item.symbol)}
              className={`${bgColor} border rounded-lg p-2 hover:opacity-80 transition-opacity text-left`}
            >
              {/* Symbol */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white font-mono">
                  {item.symbol.replace('USDT', '')}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[8px] px-1 py-0 ${
                    isLong
                      ? 'border-green-500/50 text-green-400'
                      : isShort
                      ? 'border-red-500/50 text-red-400'
                      : 'border-slate-500/50 text-slate-400'
                  }`}
                >
                  {item.consensusDirection}
                </Badge>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">
                  {item.totalTraders} trader{item.totalTraders !== 1 ? 's' : ''}
                </span>
                <span className="text-yellow-400 font-semibold">
                  {Math.round(item.confidenceScore)}%
                </span>
              </div>

              {/* Long/Short counts */}
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                {item.longCount > 0 && (
                  <span className="text-green-400">↑{item.longCount}</span>
                )}
                {item.shortCount > 0 && (
                  <span className="text-red-400">↓{item.shortCount}</span>
                )}
                {item.weightedAvgLeverage > 0 && (
                  <span className="text-orange-400">{item.weightedAvgLeverage.toFixed(1)}x</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
