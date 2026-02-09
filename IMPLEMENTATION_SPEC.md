# Trader Dashboard Redesign - Implementation Spec

## Phase 1: Global Filter Bar + Enhanced List (3-4 days)

### Day 1: Backend Performance Metrics Enhancement

#### Task 1.1: Add ROI/PnL Calculation to Performance Service
**File**: `src/services/traderPerformance.ts`

**Current State**: Basic metrics (trades, leverage, hold time)
**Goal**: Add PnL-based metrics from Event.realizedPnl

```typescript
// Add to calculateTraderPerformance():
// 1. Query Event table for CLOSE events with realizedPnl
// 2. Calculate ROI = sum(realizedPnl) / initial capital estimate
// 3. Calculate max drawdown from equity curve
// 4. Calculate win rate = wins / total trades
```

**SQL Query**:
```sql
SELECT
  "eventType",
  "realizedPnl",
  "eventTime"
FROM "Event"
WHERE "leadId" = $1
  AND "eventType" IN ('CLOSE_LONG', 'CLOSE_SHORT')
  AND "eventTime" >= $2
  AND "realizedPnl" IS NOT NULL
ORDER BY "eventTime" ASC
```

**Acceptance Criteria**:
- ✅ roi30d calculated from realizedPnl sum
- ✅ pnl30d = sum of all realizedPnl
- ✅ maxDrawdown calculated from running equity
- ✅ winRate = (pnl > 0 count) / total

---

#### Task 1.2: Add Top Symbols to Trader Endpoint
**File**: `src/routes/signals.ts` - GET /signals/traders

**Current State**: Returns basic trader info
**Goal**: Include top 3 symbols per trader

**Logic**:
```typescript
// For each trader, aggregate from PositionState:
// 1. Group by symbol
// 2. Count positions per symbol
// 3. Determine predominant side (LONG/SHORT/MIXED)
// 4. Return top 3 by count
```

**Acceptance Criteria**:
- ✅ topSymbols array in response
- ✅ Shows symbol, count, side
- ✅ Limited to top 3
- ✅ Cached for performance

---

### Day 2: Frontend - Filter Components

#### Task 2.1: Create TraderFilterBar Component
**File**: `dashboard/src/components/TraderFilterBar.tsx` (NEW)

**Props**:
```typescript
interface TraderFilterBarProps {
  filters: TraderFilters;
  onFilterChange: (filters: Partial<TraderFilters>) => void;
  totalTraders: number;
  filteredCount: number;
}
```

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Search traders...     Sort: ROI 30D ▼   [Grid|Table] │
├─────────────────────────────────────────────────────────┤
│ Segment: [ALL] VISIBLE HIDDEN                            │
│ Quality: [━━━━━━○━━━] 0-100                              │
│ Leverage: [━━━━○━━━━] 0-50x                              │
│ Trades: [━○━━━━━━━━] 0-1000                              │
├─────────────────────────────────────────────────────────┤
│ Active: Quality>50, Leverage<20x, VISIBLE [Clear All]   │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:
1. `SearchInput.tsx` - Debounced search (300ms)
2. `SortDropdown.tsx` - Sort by selector
3. `SegmentToggle.tsx` - ALL/VISIBLE/HIDDEN toggle
4. `RangeSlider.tsx` - Generic range slider component
5. `FilterChips.tsx` - Active filter chips with remove

**State Sync**:
- Use Next.js `useSearchParams` + `useRouter`
- All filters in URL query params
- Shareable URLs

**Acceptance Criteria**:
- ✅ All filter controls functional
- ✅ Filters sync to URL
- ✅ Filter chips show active filters
- ✅ Clear all filters button
- ✅ Debounced search (no API spam)

---

#### Task 2.2: Implement Client-Side Filtering & Sorting
**File**: `dashboard/src/app/traders/page.tsx` (NEW)

**Logic**:
```typescript
const filteredTraders = useMemo(() => {
  let result = traders;

  // Search filter
  if (filters.search) {
    const search = filters.search.toLowerCase();
    result = result.filter(t =>
      t.nickname.toLowerCase().includes(search) ||
      t.leadId.includes(search) ||
      t.topSymbols?.some(s => s.symbol.includes(search.toUpperCase()))
    );
  }

  // Segment filter
  if (filters.segment !== 'ALL') {
    result = result.filter(t => t.segment === filters.segment);
  }

  // Range filters
  if (filters.qualityMin > 0 || filters.qualityMax < 100) {
    result = result.filter(t =>
      t.qualityScore !== null &&
      t.qualityScore >= filters.qualityMin &&
      t.qualityScore <= filters.qualityMax
    );
  }

  // Sort
  result.sort((a, b) => {
    const aVal = getSortValue(a, filters.sortBy);
    const bVal = getSortValue(b, filters.sortBy);
    return filters.sortOrder === 'asc'
      ? aVal - bVal
      : bVal - aVal;
  });

  return result;
}, [traders, filters]);
```

**Acceptance Criteria**:
- ✅ Search filters by name/leadId/symbol
- ✅ Segment filter works
- ✅ Range filters work
- ✅ Sorting works for all fields
- ✅ Performance: <100ms for 107 traders

---

### Day 3: Enhanced Card & Table View

#### Task 3.1: Enhanced TraderCard Component
**File**: `dashboard/src/components/TraderCard.tsx` (ENHANCE EXISTING)

**New Elements**:
```tsx
<div className="trader-card">
  {/* Existing: Avatar, Name, Badges */}

  {/* NEW: Mini Sparkline */}
  <div className="sparkline">
    <MiniSparkline data={trader.performance?.roi30dHistory} />
  </div>

  {/* NEW: Positions Summary */}
  <div className="positions-summary">
    {trader.topSymbols?.map(s => (
      <Chip key={s.symbol} color={s.side === 'LONG' ? 'green' : 'red'}>
        {s.symbol} {s.count}
      </Chip>
    ))}
  </div>

  {/* NEW: Risk Strip */}
  <div className="risk-strip">
    <MetricBadge label="Lev" value={`~${trader.performance?.avgLeverage}x`} />
    <MetricBadge label="MDD" value={`${trader.performance?.maxDrawdown}%`} />
    <MetricBadge label="Trades" value={trader.performance?.totalTrades} />
    <ConfidenceBadge level={trader.confidence} />
  </div>

  {/* Existing: Stats */}
</div>
```

**Dependencies**:
- Install `recharts` for sparklines: `npm install recharts`
- Or use lightweight `sparkline-svg` library

**Acceptance Criteria**:
- ✅ Sparkline shows 30D ROI trend
- ✅ Top 3 symbols displayed with side indicators
- ✅ Risk metrics visible
- ✅ Card layout remains clean (not cluttered)

---

#### Task 3.2: Create TraderTable Component
**File**: `dashboard/src/components/TraderTable.tsx` (NEW)

**Columns**:
| Trader | Segment | ROI 30D | PnL 30D | MDD | Sharpe | Leverage | Trades | Quality | Weight | Updated |
|--------|---------|---------|---------|-----|--------|----------|--------|---------|--------|---------|

**Features**:
- Column sorting (click header)
- Column show/hide (right-click menu)
- Row hover highlights
- Click row → opens detail drawer

**Libraries**:
- Use `@tanstack/react-table` for powerful table features
- Or build simple custom table

**Acceptance Criteria**:
- ✅ All columns sortable
- ✅ Column visibility toggle
- ✅ Performance: smooth scrolling for 107 rows
- ✅ Responsive (collapses on mobile)

---

### Day 4: Polish & Testing

#### Task 4.1: Loading & Empty States
**Files**: All components

**States**:
1. **Loading**: Skeleton loaders for cards/table
2. **Empty**: "No traders match your filters"
3. **Error**: "Failed to load traders. Retry?"

**Acceptance Criteria**:
- ✅ Skeleton loader while fetching
- ✅ Empty state with helpful message
- ✅ Error state with retry button

---

#### Task 4.2: URL State Persistence
**File**: `dashboard/src/hooks/useTraderFilters.ts` (NEW)

**Custom Hook**:
```typescript
export function useTraderFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() =>
    parseFiltersFromURL(searchParams),
    [searchParams]
  );

  const updateFilters = useCallback((updates: Partial<TraderFilters>) => {
    const newFilters = { ...filters, ...updates };
    const queryString = serializeFilters(newFilters);
    router.push(`?${queryString}`);
  }, [filters, router]);

  return { filters, updateFilters };
}
```

**Acceptance Criteria**:
- ✅ Filters persist in URL
- ✅ Shareable URLs work
- ✅ Back/forward buttons work
- ✅ Default filters applied on initial load

---

## Phase 2: Drawer & Interactions (2-3 days)

### Task 2.1: Trader Detail Drawer
**File**: `dashboard/src/components/TraderDetailDrawer.tsx` (NEW)

**Opens When**: Click on trader card/row

**Content Sections**:
1. **Header**: Name, avatar, badges, segment
2. **Performance Chart**: 30D equity curve
3. **Open Positions**: Live positions table
4. **Recent Activity**: Order history timeline
5. **Top Symbols**: Symbol breakdown with charts
6. **Actions**: Add to watchlist, Set alert

**Acceptance Criteria**:
- ✅ Slides in from right
- ✅ Fetches detail data on open
- ✅ Close on ESC or backdrop click
- ✅ Deep linkable (URL: /traders?detail=leadId)

---

### Task 2.2: Watchlist Feature
**File**: `dashboard/src/components/Watchlist.tsx` (NEW)

**Storage**: localStorage (later: backend)

**Features**:
- Star/unstar traders
- Filter to show only watchlist
- Persistent across sessions

**Acceptance Criteria**:
- ✅ Star icon on cards
- ✅ "Watchlist Only" filter toggle
- ✅ Persists in localStorage
- ✅ Sync across tabs (storage event)

---

### Task 2.3: Basic Alert Builder
**File**: `dashboard/src/components/AlertBuilder.tsx` (NEW)

**Alert Types** (MVP):
1. New position opened (symbol)
2. Position closed with profit/loss
3. Leverage exceeds threshold
4. Quality score drops

**Implementation**:
- Frontend: Alert rules stored in localStorage
- Backend: Polling check (every minute)
- Notification: Browser notification API

**Acceptance Criteria**:
- ✅ Create/edit/delete alerts
- ✅ Alert triggers show notification
- ✅ Alert history log

---

## Technical Decisions

### Frontend Libraries
- **Tables**: `@tanstack/react-table` (powerful, flexible)
- **Charts**: `recharts` (lightweight, React-friendly)
- **Sliders**: `rc-slider` (customizable range sliders)
- **Drawer**: `vaul` or `shadcn/ui` Sheet component

### Performance Optimizations
- **Virtualization**: Use `@tanstack/react-virtual` for table (if >200 rows)
- **Memoization**: Memo heavy computations (filtering, sorting)
- **Code Splitting**: Lazy load drawer component
- **Debouncing**: Search input, filter changes

### State Management
- **URL State**: Next.js router + searchParams
- **Client State**: React hooks + context (for drawer, modals)
- **Server State**: No external library needed (Next.js handles caching)

---

## Testing Plan

### Unit Tests
- Filter logic functions
- Sort utility functions
- URL serialization/deserialization

### Integration Tests
- Filter bar → filtered results
- Sort dropdown → reordered list
- Search → matching traders

### E2E Tests (Playwright)
- Complete filter flow
- Table sorting
- Drawer interaction
- Watchlist persistence

---

## Rollout Plan

### Step 1: Feature Flag
Add `/traders` route alongside existing dashboard
Users can opt-in to new experience

### Step 2: A/B Test
50% of users see new interface
Collect feedback + metrics

### Step 3: Full Rollout
Replace old dashboard with new
Keep old as `/traders/legacy` for 1 week

---

## Success Metrics

**Quantitative**:
- ⏱️ Time to find specific trader: <5s (vs ~30s current)
- 📊 Filter usage: >80% of sessions use at least 1 filter
- 🎯 Decision speed: Users select traders 3x faster

**Qualitative**:
- ✅ User feedback: "Much easier to navigate"
- ✅ Feature requests: Watchlist, alerts most requested
- ✅ Retention: Daily active users increase

---

## Open Questions / Decisions Needed

1. **Sparkline Data**: Store historical ROI in DB or calculate on-the-fly?
   - **Recommendation**: Store daily snapshots in new `TraderPerformanceSnapshot` table

2. **Alert Backend**: Polling vs WebSocket vs Server-Sent Events?
   - **Recommendation**: Start with polling (simple), upgrade to SSE later

3. **Mobile Experience**: Separate mobile UI or responsive?
   - **Recommendation**: Responsive first, native app later

4. **Export Feature**: CSV/PDF export of filtered traders?
   - **Recommendation**: Phase 3 feature

---

## Next Immediate Steps

**Ready to start coding. Choose one**:
1. 🔥 **Start Day 1**: Backend performance metrics (ROI, PnL, MDD calculation)
2. 🎨 **Start Day 2**: Frontend filter bar (skip backend enhancement for now, use mock data)
3. 📋 **Create Tasks**: Break down into GitHub issues/tickets

**Your call! What should I start with?**
