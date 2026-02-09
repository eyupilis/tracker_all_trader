# Binance Copy Trader Tracker - Veri Envanteri (Eksiksiz Alan Dokumani)

Bu dokuman, projede su ana kadar **cekilen tum verileri**, bu verilerin **hangi endpointlerden geldigini**, **hangi alanlara donusturuldugunu**, **DB'ye nasil yazildigini** ve **dashboard'da nasil kullanildigini** tek dosyada toplar.

Bu dokuman asagidaki kodlardan cikartilmistir:
- `src/services/binanceScraper.ts`
- `src/schemas/ingest.ts`
- `src/routes/*.ts`
- `src/services/*.ts`
- `prisma/schema.prisma`
- `n8n_real_workflow.json`
- `dashboard/src/lib/api.ts`
- `dashboard/src/components/**/*.tsx`
- `dashboard/src/lib/payload-checklist.spec.json`
- `dashboard/src/lib/trader-insights.ts`

---

## 1) Su an cekilen veri kaynaklari

### 1.1 Binance public endpointleri (dogrudan cekilen)

1. `GET /friendly/future/spot-copy-trade/common/spot-futures-last-lead?portfolioId={leadId}`
2. `GET /friendly/future/copy-trade/lead-portfolio/detail?portfolioId={leadId}`
3. `GET /friendly/future/copy-trade/lead-data/positions?portfolioId={leadId}`
4. `GET /public/future/copy-trade/lead-portfolio/chart-data?dataType=ROI&portfolioId={leadId}&timeRange={7D|30D|90D}`
5. `GET /public/future/copy-trade/lead-portfolio/performance/coin?portfolioId={leadId}&timeRange={7D|30D|90D}`
6. `POST /friendly/future/copy-trade/lead-portfolio/order-history`
7. `GET /public/future/copy-trade/lead-portfolio/performance?portfolioId={leadId}&timeRange={7D|30D|90D}`
8. `POST /public/future/copy-trade/lead-portfolio/position-history`

> Not: Hem backend scheduler hem n8n workflow hem de dashboard bu endpointlerin farkli alt-kumelerini kullanir.

### 1.2 Backend internal endpointleri (dashboard tarafindan cekilen)

1. `GET /health`
2. `GET /ingest/raw/latest`
3. `GET /ingest/raw/:leadId`
4. `GET /signals/heatmap`
5. `GET /signals/symbol/:symbol`

### 1.3 Ingest endpointleri (n8n/scheduler -> backend)

1. `POST /ingest/binance-copytrade` (raw veya normalized payload)
2. `POST /ingest/raw` (payloadi hic donusturmeden komple saklar)

---

## 2) Pipeline ozeti (ham veri -> analiz -> UI)

1. Binance endpointlerinden trader verileri cekilir.
2. Pozisyonlar aktif filtrelenir (0 olanlar elenir) ve `positionAudit` uretilir.
3. Son payload su shape ile birlestirilir:
   - `leadId, fetchedAt, timeRange, startTime, endTime, leadCommon, portfolioDetail, roiSeries, assetPreferences, activePositions, positionAudit, orderHistory`
4. Payload hem:
   - normalize edilip `PositionSnapshot` + `Event` tablolarina,
   - hem de ham haliyle `RawIngest.payload` alanina yazilir.
5. Sonra:
   - `SymbolAggregation` yeniden hesaplanir,
   - `TraderScore` guncellenir.
6. Dashboard hem backendden hem Binance'den canli veriyi gosterir.

---

## 3) n8n ve scheduler konfiginde cekim kapsamı

### 3.1 Takip edilen leadId listesi

- `4897589091850209025`
- `4708220152086930177`
- `4657853710421943296`
- `4778647677431223297`
- `4881493257880589312`
- `4681698170884314113`
- `4532994172262753536`
- `4734328346700544769`
- `4734249513132666368`

### 3.2 n8n Workflow Configuration alanlari

- `leadIds` (array)
- `timeRange` (varsayilan `30D`)
- `backendBaseUrl`
- `apiKey`
- `rateLimitMs`
- `orderHistory.pageSize`
- `ingestPath`
- `rawIngestPath`

---

## 4) Ham payload alanlari (tam liste)

Asagidaki alanlar `TraderPayload` / `RawIngest.payload` core alanlaridir.

### 4.1 Top-level alanlar

- `leadId`
- `fetchedAt`
- `timeRange`
- `startTime`
- `endTime`
- `leadCommon`
- `portfolioDetail`
- `roiSeries`
- `assetPreferences`
- `activePositions`
- `orderHistory`
- `positionAudit` (opsiyonel ama projede aktif uretiliyor)

### 4.2 `leadCommon` alanlari (9)

- `leadOwner`
- `futuresPublicLPId`
- `futuresPublicLPStatus`
- `futuresPrivateLPId`
- `futuresPrivateLPStatus`
- `spotPublicLPId`
- `spotPublicLPStatus`
- `spotPrivateLPId`
- `spotPrivateLPStatus`

### 4.3 `portfolioDetail` alanlari (58)

- `aumAmount`
- `avatarUrl`
- `badgeCopierCount`
- `badgeModifyTime`
- `badgeName`
- `closeLeadCount`
- `closedTime`
- `copierLockPeriodTime`
- `copierPnl`
- `copierPnlAsset`
- `copierUnlockExpiredTime`
- `currentCopyCount`
- `descTranslate`
- `description`
- `enableAddMaxCopier`
- `enableTradingSignal`
- `endTime`
- `favorite`
- `favoriteCount`
- `feedAgreement`
- `feedSharePushLimit`
- `feedShareSwitch`
- `finalEffectiveMaxCopyCount`
- `fixedAmountMinCopyUsd`
- `fixedRadioMinCopyUsd`
- `futuresType`
- `hasCopy`
- `hasMock`
- `hasSlotReminder`
- `initInvestAsset`
- `inviteCodeCount`
- `lastTradeTime`
- `leadOwner`
- `leadPortfolioId`
- `lockPeriod`
- `marginBalance`
- `maxCopyCount`
- `mockCopyCount`
- `nickname`
- `nicknameTranslate`
- `pgcUsername`
- `portfolioType`
- `positionShow`
- `privateLeadPortfolioId`
- `profitSharingRate`
- `publicLeadPortfolioId`
- `rebateFee`
- `riskControlMaxCopyCount`
- `sharpRatio`
- `startTime`
- `status`
- `syncSetting`
- `syncSettingCount`
- `tag`
- `tagItemVos`
- `totalCopyCount`
- `unrealizedProfitShareAmount`
- `userId`

### 4.4 `activePositions[]` alanlari

Sahada gorulen union listesi:

- `id`
- `symbol`
- `collateral`
- `positionAmount`
- `entryPrice`
- `markPrice`
- `leverage`
- `isolated`
- `positionSide`
- `unrealizedProfit`
- `cumRealized`
- `notionalValue`
- `breakEvenPrice`
- `adl`
- `askNotional` (varyasyonel)
- `bidNotional` (varyasyonel)
- `isolatedWallet` (varyasyonel)

### 4.5 `positionAudit` alanlari

- `sourceRawPositionsCount`
- `filteredActivePositionsCount`
- `droppedPositionsCount`
- `nonZeroByAmountCount`
- `nonZeroByNotionalCount`
- `nonZeroByUnrealizedCount`
- `droppedBecauseAllZeroCount`

### 4.6 `orderHistory` alanlari

Top-level:
- `total`
- `list` (Binance response)
- `allOrders` (n8n/scheduler final payload normalize)
- `indexValue` (pagination cursor)

Order satiri alanlari:
- `symbol`
- `baseAsset`
- `quoteAsset`
- `side`
- `type`
- `positionSide`
- `executedQty`
- `avgPrice`
- `totalPnl`
- `orderUpdateTime`
- `orderTime`
- `origQty` (bazı dashboard akışlarında opsiyonel)

### 4.7 `roiSeries[]` alanlari

- `value`
- `dataType`
- `dateTime`

### 4.8 `assetPreferences` alanlari

Top-level:
- `data`
- `timeRange`
- `updateTime`

`data[]` satiri:
- `asset`
- `volume`

Desteklenen varyasyon (component fallback):
- `coinPnlList[]` (opsiyonel)
- `coinPositionList[]` (opsiyonel)

`coinPnlList[]` icin kodda beklenen alanlar:
- `symbol`
- `pnl`
- `roi`

### 4.9 `performance` endpoint alanlari

- `timeRange`
- `roi`
- `pnl`
- `mdd`
- `copierPnl`
- `winRate`
- `winOrders`
- `totalOrder`
- `sharpRatio`

### 4.10 `position-history` endpoint alanlari

Top-level:
- `indexValue`
- `list`
- `total`

Row:
- `id`
- `symbol`
- `type`
- `opened`
- `closed`
- `avgCost`
- `avgClosePrice`
- `closingPnl`
- `maxOpenInterest`
- `closedVolume`
- `isolated`
- `side`
- `status`
- `updateTime`

---

## 5) Donusum kurallari (raw -> normalized)

Kaynak: `src/schemas/ingest.ts`.

### 5.1 Position donusumu (`activePositions -> positions`)

Hedef alanlar:
- `platform` (`binance`)
- `leadId`
- `symbol`
- `contractType` (`PERP`)
- `leverage`
- `size` (`positionAmount`)
- `sizeAsset` (`symbol` icinden `USDT` silinerek)
- `side`
- `entryPrice`
- `markPrice`
- `marginUSDT`
- `marginType`
- `pnlUSDT`
- `roePct` (`null`)
- `fetchedAt`

Kurallar:
- `positionSide === BOTH` ise side, `positionAmount` isaretinden turetilir:
  - `>= 0` => `LONG`
  - `< 0` => `SHORT`
- `marginUSDT = abs(notionalValue / leverage)`
- `marginType = isolated ? 'ISOLATED' : 'CROSS'`
- `pnlUSDT = unrealizedProfit`

### 5.2 Event donusumu (`orderHistory.allOrders -> events`)

Hedef alanlar:
- `platform`
- `leadId`
- `eventTimeText` (`MM-DD, HH:MM:SS`)
- `eventType`
- `symbol`
- `price` (`avgPrice`)
- `amount` (`executedQty`)
- `amountAsset` (`baseAsset` fallback: symbolden turet)
- `realizedPnl`
- `fetchedAt`
- `event_key`

`eventType` kurallari:
- `BUY + LONG` => `OPEN_LONG`
- `SELL + LONG` => `CLOSE_LONG`
- `BUY + SHORT` => `CLOSE_SHORT`
- `SELL + SHORT` => `OPEN_SHORT`
- diger => `UNKNOWN`

`realizedPnl` kurali:
- sadece `totalPnl > 0` ise yaziliyor, diger durumda `null`.

`event_key` formati:
- `binance|{leadId}|{eventType}|{symbol}|{eventTimeText}|{executedQty}|{avgPrice}`

### 5.3 Event time parse

`eventTimeText` regex ile parse edilir: `MM-DD, HH:MM:SS`.
- yil, `fetchedAt` yilindan alinir.
- parse edilen tarih `fetchedAt`'den buyukse bir onceki yila cekilir (year rollover).

---

## 6) Veritabani modelleri ve tum alanlari

Kaynak: `prisma/schema.prisma`.

### 6.1 `LeadTrader`

- `id`
- `platform`
- `createdAt`
- `updatedAt`

### 6.2 `PositionSnapshot`

- `id`
- `platform`
- `leadId`
- `fetchedAt`
- `symbol`
- `side`
- `contractType`
- `leverage`
- `size`
- `sizeAsset`
- `entryPrice`
- `markPrice`
- `marginUSDT`
- `marginType`
- `pnlUSDT`
- `roePct`
- `raw`
- `createdAt`

### 6.3 `Event`

- `id`
- `platform`
- `leadId`
- `eventKey`
- `eventType`
- `symbol`
- `eventTimeText`
- `eventTime`
- `price`
- `amount`
- `amountAsset`
- `realizedPnl`
- `fetchedAt`
- `createdAt`

### 6.4 `SymbolAggregation`

- `id`
- `platform`
- `symbol`
- `updatedAt`
- `openLongCount`
- `openShortCount`
- `totalOpen`
- `latestEventAt`
- `latestEventKey`

### 6.5 `TraderScore`

- `leadId`
- `platform`
- `score30d`
- `updatedAt`

### 6.6 `RawIngest`

- `id`
- `leadId`
- `platform`
- `fetchedAt`
- `payload` (tum ham JSON)
- `createdAt`
- `positionsCount`
- `ordersCount`
- `timeRange`

---

## 7) Backend endpoint ciktilari ve uretilen alanlar

### 7.1 `/ingest/raw` POST response `data`

- `id`
- `leadId`
- `fetchedAt`
- `positionsCount`
- `ordersCount`
- `payloadSize`
- `parity.sourceRawPositionsCount`
- `parity.filteredActivePositionsCount`
- `parity.backendStoredPositionsCount`
- `parity.filteredMatchesStored`
- `message`

### 7.2 `/ingest/raw/:leadId` ve `/ingest/raw/latest`

- `id`
- `leadId`
- `fetchedAt`
- `positionsCount`
- `ordersCount`
- `timeRange`
- `createdAt`
- `payload` (opsiyonel, query ile)

### 7.3 `/symbols`

Her satir:
- `symbol`
- `openLongCount`
- `openShortCount`
- `totalOpen`
- `latestEventAt`

### 7.4 `/symbols/:symbol/feed`

Her satir:
- `eventType`
- `eventTimeText`
- `eventTime`
- `leadId`
- `price`
- `amount`
- `realizedPnl`
- `eventKey`

### 7.5 `/traders/top`

- `leadId`
- `score30d`

### 7.6 `/traders/:leadId`

- `leadId`
- `platform`
- `score30d`
- `createdAt`
- `updatedAt`

### 7.7 `/traders/:leadId/positions`

Her satir:
- `id`
- `symbol`
- `side`
- `leverage`
- `size`
- `sizeAsset`
- `entryPrice`
- `markPrice`
- `marginUSDT`
- `pnlUSDT`
- `roePct`
- `fetchedAt`

### 7.8 `/signals/heatmap`

Her sembol satiri:
- `symbol`
- `longCount`
- `shortCount`
- `totalTraders`
- `avgLeverage`
- `totalVolume`
- `longVolume`
- `shortVolume`
- `imbalance`
- `sentiment`

### 7.9 `/signals/symbol/:symbol`

`summary`:
- `longCount`
- `shortCount`
- `totalTraders`
- `totalLongVolume`
- `totalShortVolume`
- `avgEntryLong`
- `avgEntryShort`
- `sentiment`

`traders[]`:
- `leadId`
- `nickname`
- `avatarUrl`
- `side`
- `leverage`
- `entryPrice`
- `markPrice`
- `size`
- `pnl`
- `pnlPercent`

### 7.10 `/signals/traders`

Her trader:
- `leadId`
- `nickname`
- `avatarUrl`
- `badgeName`
- `positionsCount`
- `totalPnl`
- `lastUpdate`

### 7.11 `/signals/feed`

Her feed satiri:
- `leadId`
- `nickname`
- `symbol`
- `action`
- `side`
- `notional`
- `leverage`
- `pnl`
- `timestamp`
- `source` (`POSITIONS` / `DERIVED`)

### 7.12 `/signals/metrics/:leadId`

- `leadId`
- `nickname`
- `tradeCounts.closedTrades7d`
- `tradeCounts.closedTrades30d`
- `tradeCounts.orders7d`
- `tradeCounts.orders30d`
- `tradeCounts.closesPerDay7d`
- `tradeCounts.ordersPerDay7d`
- `winLoss.wins`
- `winLoss.losses`
- `winLoss.breakevens`
- `winLoss.winRate`
- `winLoss.winRateNote`
- `streaks.maxConsecutiveLosses`
- `streaks.maxConsecutiveWins`
- `streaks.currentStreak`
- `pnl.totalRealizedPnl`
- `pnl.avgPnlPerTrade`
- `leverage.avgLeverage`
- `leverage.isEstimated`
- `leverage.note`
- `qualityScore.score`
- `qualityScore.confidence`
- `qualityScore.sampleSize`
- `qualityScore.breakdown`
- `dataAvailability.positionsVisible`
- `dataAvailability.ordersCount`
- `dataAvailability.roiDataPoints`

---

## 8) Dashboard tarafinda veri kullanim haritasi (ne yapiyoruz?)

### 8.1 Ana sayfa (`dashboard/src/app/page.tsx`)

Cekilenler:
- Backend: `getLatestIngests`
- Binance: `getTraderPortfolio`, `getTraderPerformance`, `getTraderPositions`

Yapilanlar:
- Trader card listesi
- Ozet metrikler: trader sayisi, snapshot sayisi, aktif pozisyon, takip edilen order sayisi

### 8.2 Trader detay (`dashboard/src/app/traders/[leadId]/page.tsx`)

Cekilenler:
- Backend raw payload: `getTraderData`
- Binance canli: `getTraderPerformanceMulti`, `getTraderLatestRecords`, `getTraderPositionHistory`

Yapilanlar:
- Profil header
- ROI chart
- Asset chart
- Pozisyon tablosu
- Order history
- Latest records timeline
- Position history
- Settings / Platform status
- Raw payload inspector

### 8.3 Signals sayfasi (`dashboard/src/app/signals/page.tsx`)

Cekilenler:
- `getHeatMapData`
- `getSymbolDetail`

Yapilanlar:
- Heatmap
- Symbol bazli detay modal
- Bullish/Bearish ozetleri

### 8.4 Kritik component bazli alan kullanimi

- `TraderProfileHeader`: `portfolioDetail`, `leadCommon`, `performance`
- `BinancePositionsTable`: `activePositions` satir alanlari (pnl, notional, leverage, adl, breakEven vb)
- `BinanceOrderHistory`: `orderHistory.allOrders`
- `BinanceLatestRecords`: order satirindan open/close aksiyon turetimi
- `BinancePositionHistory`: kapali pozisyon gecmisi
- `TraderSettingsCard`: `portfolioDetail` icindeki operasyonel/limit/timestamp alanlarinin tamina yakinini gosterir
- `PlatformStatusCard`: `leadCommon` tum LP id/status alanlari
- `RawPayloadViewer`: payloadin tum fieldlarini ham JSON olarak gosterir
- `DataParityCard`: `positionAudit` + `activePositions.length` + backend count tutarlilik kontrolu
- `ProfileOperationsOverview`: `payload-checklist.spec.json` ile kritik field coverage kontrolu
- `trader-insights.ts`: risk/skor metrikleri icin payloaddan turetim

---

## 9) Veri kalite ve parity kontrolleri

### 9.1 Active position filter

Aktif kabul kosulu (n8n + scraper):
- `positionAmount != 0` veya
- `notionalValue != 0` veya
- `unrealizedProfit != 0`

### 9.2 Position parity

Karsilastirilanlar:
- `positionAudit.filteredActivePositionsCount`
- `payload.activePositions.length`
- `RawIngest.positionsCount`

Uyumsuzluk oldugunda log ve UI uyarisi uretilir.

### 9.3 Event dedup

- `Event.eventKey` uniq oldugu icin duplicate event yazilmaz.

---

## 10) Bilinen field varyasyonlari ve notlar

1. `positions` bazen gizli olabilir (`portfolioDetail.positionShow=false`), bu durumda davranis order-history tabanli derive edilir.
2. `assetPreferences` iki farkli sekilde gelebilir:
   - standart: `data[]` (`asset`, `volume`)
   - alternatif: `coinPnlList[]` (component fallback destekli)
3. `orderHistory` responseunda Binance tarafinda `list` gelir; n8n/scheduler payloadinda UI tarafina `allOrders` olarak normalize edilir.
4. `positionSide=BOTH` durumunda side/action turetimi kurallarla yapilir (hem transform hem UI katmaninda).
5. `realizedPnl` transformda sadece `totalPnl > 0` oldugunda doluyor (negatif/0 -> `null`).

---

## 11) Tam checklist (projede takip edilen kritik alan seti)

Kaynak: `dashboard/src/lib/payload-checklist.spec.json`.

- `topLevel`: `leadId, fetchedAt, timeRange, startTime, endTime, leadCommon, portfolioDetail, roiSeries, assetPreferences, activePositions, orderHistory`
- `leadCommon`: tum 9 alan
- `portfolioDetail`: operasyonel kritik 22+ alan (ID, status, copy limit, lock, signal, feed, sync, lastTrade)
- `assetPreferences`: `data, timeRange, updateTime`
- `orderHistory`: `total, allOrders`
- `orderRow`: `symbol, baseAsset, quoteAsset, side, type, positionSide, executedQty, avgPrice, totalPnl, orderTime, orderUpdateTime`
- `positionRow`: `id, symbol, collateral, positionAmount, entryPrice, markPrice, leverage, isolated, positionSide, unrealizedProfit, cumRealized, notionalValue, breakEvenPrice, adl`
- `roiRow`: `value, dataType, dateTime`

---

## 12) Kisa sonuc

Bu projede su anda:
- Binance'den trader profil, performans, ROI, aktif pozisyon, order gecmisi, varlik dagilimi ve pozisyon gecmisi verileri cekiliyor.
- Bu veriler ham ve normalize iki formatta saklaniyor.
- DB'de snapshot/event/aggregation/score katmanlari olusturuluyor.
- Dashboard tarafinda hem ham denetim (raw inspector/parity/checklist) hem de analitik gorunum (signals/risk/compare/performance) saglaniyor.

Bu dosyadaki alan listeleri, kodda tanimli tum aktif veri akislari ve field setleri ile birebir uyumludur.
