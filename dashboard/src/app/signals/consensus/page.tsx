'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/api';

interface ConsensusSignal {
  symbol: string;
  consensusDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidenceScore: number;
  totalTraders: number;
  sumWeights: number;
  sentimentScore: number;
  weightedAvgLeverage: number;
  consensusAge: number | null;
  consensusAgeFormatted: string | null;
  entryPriceSpread: number;
  recommendedPositionSize: number;
  avgHoldDurationFormatted: string | null;
  // NEW FIELDS (Round 2)
  consensusMomentum: 'FORMING' | 'STABLE' | 'WEAKENING';
  unrealizedPnL: number;
  historicalWinRate: number | null;
  averageHoldTime: string | null;
  topTraders: Array<{
    nickname: string;
    side: string;
    entryPrice: number;
    traderWeight: number;
  }>;
  traderComparison: {
    long: {
      traderCount: number;
      avgWeight: number | null;
    };
    short: {
      traderCount: number;
      avgWeight: number | null;
    };
  };
}

const PRIORITY_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
  'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT',
  'MATICUSDT', 'LINKUSDT', 'DOTUSDT', 'UNIUSDT',
  'ATOMUSDT', 'LTCUSDT', 'NEARUSDT', 'APTUSDT',
  'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT'
];

function getSignalStrength(confidenceScore: number): { stars: number; label: string; color: string } {
  if (confidenceScore >= 85) return { stars: 5, label: 'VERY STRONG', color: 'text-green-400' };
  if (confidenceScore >= 75) return { stars: 4, label: 'STRONG', color: 'text-green-300' };
  if (confidenceScore >= 65) return { stars: 3, label: 'MODERATE', color: 'text-yellow-400' };
  if (confidenceScore >= 55) return { stars: 2, label: 'WEAK', color: 'text-orange-400' };
  return { stars: 1, label: 'VERY WEAK', color: 'text-red-400' };
}

export default function ConsensusSignalsPage() {
  const [signals, setSignals] = useState<ConsensusSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchSignals = async () => {
    try {
      const response = await fetch('/api/signals/heatmap?segment=BOTH&timeRange=24h');
      const data = await response.json();

      if (data.success) {
        setSignals(data.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch consensus signals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Filter actionable signals
  const actionableSignals = useMemo(() => {
    return signals.filter(s => {
      // Must have clear direction
      if (s.consensusDirection === 'NEUTRAL') return false;

      // Min criteria
      const directionalCount = s.consensusDirection === 'LONG'
        ? s.traderComparison.long.traderCount
        : s.traderComparison.short.traderCount;

      if (directionalCount < 5) return false; // Min 5 traders same direction
      if (s.confidenceScore < 70) return false; // Min 70% confidence
      if (s.sumWeights < 3.0) return false; // Min 3.0 weight sum
      if (Math.abs(s.sentimentScore) < 0.6) return false; // Min 60% agreement

      // Focus on priority symbols
      if (!PRIORITY_SYMBOLS.includes(s.symbol)) return false;

      return true;
    }).sort((a, b) => b.confidenceScore - a.confidenceScore);
  }, [signals]);

  // Separate strong signals and exit alerts
  const strongSignals = actionableSignals.filter(s => s.confidenceScore >= 75);
  const moderateSignals = actionableSignals.filter(s => s.confidenceScore >= 65 && s.confidenceScore < 75);

  return (
    <main className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/signals" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
              &larr; Back to Signals
            </Link>
            <h1 className="text-3xl font-bold text-white">🎯 Consensus Trading Signals</h1>
            <p className="text-slate-400 mt-1">
              Actionable signals filtered for quality consensus (min 5 traders, 70% confidence)
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{actionableSignals.length}</div>
            <div className="text-xs text-slate-400">Active Signals</div>
            {lastUpdate && (
              <div className="text-xs text-slate-500 mt-1">
                Updated {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-slate-400 mt-4">Loading consensus signals...</p>
          </div>
        ) : (
          <>
            {/* Strong Signals */}
            {strongSignals.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  🔥 STRONG SIGNALS ({strongSignals.length})
                </h2>
                <div className="space-y-4">
                  {strongSignals.map(signal => (
                    <SignalCard key={signal.symbol} signal={signal} />
                  ))}
                </div>
              </div>
            )}

            {/* Moderate Signals */}
            {moderateSignals.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  ⚡ MODERATE SIGNALS ({moderateSignals.length})
                </h2>
                <div className="space-y-4">
                  {moderateSignals.map(signal => (
                    <SignalCard key={signal.symbol} signal={signal} />
                  ))}
                </div>
              </div>
            )}

            {/* No Signals */}
            {actionableSignals.length === 0 && (
              <div className="text-center py-20 bg-slate-900 border border-slate-700 rounded-xl">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-lg font-semibold text-white mb-2">No Actionable Signals</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  No strong consensus detected at the moment. Check back later or adjust your criteria.
                </p>
                <Link
                  href="/signals"
                  className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  View All Symbols
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SignalCard({ signal }: { signal: ConsensusSignal }) {
  const strength = getSignalStrength(signal.confidenceScore);
  const isLong = signal.consensusDirection === 'LONG';
  const directionColor = isLong ? 'text-green-400' : 'text-red-400';
  const bgColor = isLong ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30';

  const directionalTraders = isLong
    ? signal.traderComparison.long
    : signal.traderComparison.short;

  return (
    <div className={`${bgColor} border rounded-xl p-6 hover:opacity-90 transition-opacity`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold text-white font-mono">{signal.symbol.replace('USDT', '')}</h3>
            <Badge className={`${directionColor} border-current`}>
              {signal.consensusDirection}
            </Badge>
            <Badge className="text-yellow-400 border-yellow-400">
              {'⭐'.repeat(strength.stars)}
            </Badge>
          </div>
          <p className={`text-sm mt-1 ${strength.color} font-semibold`}>{strength.label} SIGNAL</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{signal.confidenceScore}%</div>
          <div className="text-xs text-slate-400">Confidence</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatBox label="Traders" value={directionalTraders.traderCount} />
        <StatBox label="Weight Sum" value={signal.sumWeights.toFixed(1)} />
        <StatBox label="Price Spread" value={`${signal.entryPriceSpread}%`} />
        <StatBox label="Age" value={signal.consensusAgeFormatted || 'N/A'} />
      </div>

      {/* Analytics Grid (NEW FIELDS) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className={`text-sm font-bold ${
            signal.consensusMomentum === 'FORMING' ? 'text-green-400' :
            signal.consensusMomentum === 'WEAKENING' ? 'text-red-400' :
            'text-yellow-400'
          }`}>
            {signal.consensusMomentum === 'FORMING' ? '📈 FORMING' :
             signal.consensusMomentum === 'WEAKENING' ? '📉 WEAKENING' :
             '➡️ STABLE'}
          </div>
          <div className="text-xs text-slate-400 mt-1">Momentum</div>
        </div>
        <StatBox
          label="Unrealized P/L"
          value={signal.unrealizedPnL >= 0 ? `+$${formatNumber(signal.unrealizedPnL)}` : `-$${formatNumber(Math.abs(signal.unrealizedPnL))}`}
        />
        <StatBox
          label="Historical Win Rate"
          value={signal.historicalWinRate ? `${(signal.historicalWinRate * 100).toFixed(1)}%` : 'N/A'}
        />
        <StatBox
          label="Avg Hold Time"
          value={signal.averageHoldTime || 'N/A'}
        />
      </div>

      {/* Recommendation */}
      <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-white mb-2">📋 Recommendation</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Position Size:</span>
            <span className="text-white font-semibold ml-2">
              {(signal.recommendedPositionSize * 100).toFixed(1)}% of portfolio
            </span>
          </div>
          <div>
            <span className="text-slate-400">Avg Leverage:</span>
            <span className="text-white font-semibold ml-2">{signal.weightedAvgLeverage}x</span>
          </div>
        </div>
      </div>

      {/* Top Traders */}
      <div>
        <h4 className="text-sm font-semibold text-slate-400 mb-2">Top Traders ({signal.topTraders.slice(0, 5).length})</h4>
        <div className="flex flex-wrap gap-2">
          {signal.topTraders.slice(0, 5).map((trader, idx) => (
            <div key={idx} className="bg-slate-900/50 rounded px-3 py-1 text-xs">
              <span className="text-white">{trader.nickname}</span>
              <span className="text-slate-400 ml-2">
                ${formatNumber(trader.entryPrice)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <button
          onClick={() => {
            // TODO: Implement copy trade action
            alert(`Copy ${signal.consensusDirection} on ${signal.symbol}`);
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          📋 COPY TRADE
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
