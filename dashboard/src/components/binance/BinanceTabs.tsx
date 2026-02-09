'use client';

import { useState } from 'react';
import type { TraderPayload, PerformanceData, MultiRangePerformance, LatestRecord, PositionHistoryRecord } from '@/lib/api';
import { BinancePositionsTable } from './BinancePositionsTable';
import { BinanceOrderHistory } from './BinanceOrderHistory';
import { BinanceRoiChart } from './BinanceRoiChart';
import { BinanceAssetChart } from './BinanceAssetChart';
import { PerformanceStats } from './PerformanceStats';
import { MultiRangePerformanceCard } from './MultiRangePerformanceCard';
import { TraderSettingsCard } from './TraderSettingsCard';
import { PlatformStatusCard } from './PlatformStatusCard';
import { BinanceLatestRecords } from './BinanceLatestRecords';
import { BinancePositionHistory } from './BinancePositionHistory';
import { RawPayloadViewer } from '@/components/RawPayloadViewer';

interface BinanceTabsProps {
  traderData: TraderPayload;
  performance: PerformanceData | null;
  allPerformance?: MultiRangePerformance;
  latestRecords?: { list: LatestRecord[]; total: number };
  positionHistory?: { list: PositionHistoryRecord[]; total: number };
}

const TABS = [
  { key: 'performance', label: 'Performance' },
  { key: 'positions', label: 'Positions' },
  { key: 'positionHistory', label: 'Position History' },
  { key: 'latestRecords', label: 'Latest Records' },
  { key: 'orders', label: 'Orders' },
  { key: 'settings', label: 'Settings' },
  { key: 'platform', label: 'Platform' },
  { key: 'raw', label: 'Raw Data' },
] as const;

type TabKey = typeof TABS[number]['key'];

export function BinanceTabs({ traderData, performance, allPerformance, latestRecords, positionHistory }: BinanceTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('performance');

  const positionCount = traderData.activePositions?.length || 0;
  const orderCount = traderData.orderHistory?.allOrders?.length || 0;
  const latestRecordsCount = latestRecords?.total || 0;
  const positionHistoryCount = positionHistory?.total || 0;

  return (
    <div>
      {/* Tab bar */}
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] mb-6 overflow-hidden">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            let badge: string | null = null;
            if (tab.key === 'positions' && positionCount > 0) badge = String(positionCount);
            if (tab.key === 'orders' && orderCount > 0) badge = String(orderCount);
            if (tab.key === 'latestRecords' && latestRecordsCount > 0) badge = String(latestRecordsCount);
            if (tab.key === 'positionHistory' && positionHistoryCount > 0) badge = String(positionHistoryCount);

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[#f0b90b]'
                    : 'text-[#848e9c] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#f0b90b]/20 text-[#f0b90b]' : 'bg-[#2b3139] text-[#848e9c]'
                    }`}>
                      {badge}
                    </span>
                  )}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f0b90b]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'performance' && (
          <>
            <PerformanceStats payload={traderData} performance={performance} />
            {allPerformance && (
              <MultiRangePerformanceCard allPerformance={allPerformance} />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BinanceRoiChart roiSeries={traderData.roiSeries} leadId={traderData.leadId} />
              <BinanceAssetChart assetPreferences={traderData.assetPreferences as unknown as Record<string, unknown>} />
            </div>
          </>
        )}

        {activeTab === 'positions' && (
          <>
            {traderData.portfolioDetail?.positionShow === false && (
              <div className="bg-[#1e2329] rounded-xl border border-[#f6465d]/30 p-5 flex items-start gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <h4 className="text-[#f6465d] font-semibold text-sm mb-1">Positions Hidden</h4>
                  <p className="text-[#848e9c] text-xs leading-relaxed">
                    This trader has chosen to <span className="text-white font-medium">hide their active positions</span>.
                    You can check the <button onClick={() => setActiveTab('latestRecords')} className="text-[#f0b90b] hover:underline font-medium">Latest Records</button> tab to see their recent open/close trades.
                  </p>
                </div>
              </div>
            )}
            <BinancePositionsTable positions={traderData.activePositions || []} />
          </>
        )}

        {activeTab === 'orders' && (
          <BinanceOrderHistory
            orders={traderData.orderHistory?.allOrders || []}
            total={traderData.orderHistory?.total || 0}
          />
        )}

        {activeTab === 'latestRecords' && (
          <BinanceLatestRecords
            leadId={traderData.leadId}
            initialRecords={latestRecords?.list || []}
            initialTotal={latestRecords?.total || 0}
          />
        )}

        {activeTab === 'positionHistory' && (
          <BinancePositionHistory
            leadId={traderData.leadId}
            initialRecords={positionHistory?.list || []}
            initialTotal={positionHistory?.total || 0}
          />
        )}

        {activeTab === 'settings' && traderData.portfolioDetail && (
          <TraderSettingsCard portfolio={traderData.portfolioDetail} />
        )}

        {activeTab === 'platform' && traderData.leadCommon && (
          <PlatformStatusCard leadCommon={traderData.leadCommon} leadId={traderData.leadId} />
        )}

        {activeTab === 'raw' && (
          <RawPayloadViewer payload={traderData} />
        )}
      </div>
    </div>
  );
}
