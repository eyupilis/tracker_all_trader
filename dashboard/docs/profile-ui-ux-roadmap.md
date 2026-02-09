# Trader Profile UI/UX Roadmap

## Goal
Use all n8n payload fields in the trader profile experience while keeping the UI readable and fast.

## Phase 0 - Field Coverage Blueprint
- Status: `completed`
- Actions:
  - Mapped top-level payload fields used vs unused.
  - Mapped `portfolioDetail`, `leadCommon`, `roiSeries`, `assetPreferences`, `activePositions`, `orderHistory` field usage.
  - Added field-inspector UI sections to expose full payload fields per trader.

## Phase 1 - Information Architecture
- Status: `completed`
- Actions:
  - Reworked profile into tabs:
    - `Overview`
    - `Positions`
    - `Orders`
    - `Operations`
    - `Raw`
  - Added snapshot metadata card (`fetchedAt`, `timeRange`, `startTime`, `endTime`, counts).

## Phase 2 - Full Field Visibility
- Status: `completed (deep pass)`
- Actions:
  - Added full-field inspectors for:
    - `leadCommon`
    - `portfolioDetail`
    - top-level snapshot metadata
    - ROI row schema
    - order row schema
    - active position schema
    - full asset preference object
  - Added raw payload JSON inspector + copy action.
  - Added `orderTime` visibility in order history table.
  - Added structured operations cards for:
    - platform IDs and status states (public/private, spot/futures)
    - copy limits, lock windows, min copy constraints
    - operational switches and sync/feed controls
    - lifecycle and freshness monitoring
  - Added critical-field coverage card for quick completeness checks.

## Phase 3 - Advanced UX and Analytics
- Status: `completed (initial pass)`
- Actions:
  - Added trader compare mode (`?compare=`) on profile page.
  - Added snapshot diff card between latest and previous snapshots:
    - opened/closed positions
    - leverage changes
    - orders/positions/PnL/ROI deltas
  - Added risk surface cards:
    - max/avg leverage, concentration, ADL pressure, freshness, copy utilization
    - risk score and alert badges
  - Added side-by-side metrics compare table between primary and selected trader.

## Phase 4 - Performance and Mobile
- Status: `completed (initial pass)`
- Actions:
  - Added table virtualization (windowing) for large `Order History` datasets.
  - Added mobile-first card + details drawer flows for:
    - order history rows
    - active positions rows
    - long key/value inspector fields
  - Added route-level loading skeleton for trader profile (`/traders/[leadId]`).
  - Added fixed-height scroll containers for heavy desktop tables.

## Phase 5 - QA and Rollout
- Status: `completed (initial pass)`
- Scope:
  - Field-level checklist tests.
  - UI contract snapshot checks.
  - Feature flag rollout plan.
- Delivered:
  - Added payload checklist spec and evaluator (`src/lib/payload-checklist.spec.json`, `src/lib/field-checklist.ts`).
  - Added checklist test for real sample payload (`tests/field-checklist.test.mjs`).
  - Added profile UI contract tests (`tests/ui-contract.test.mjs`) using `tests/snapshots/trader-profile-contract.json`.
  - Added environment-driven feature flags (`src/lib/feature-flags.ts`) and wired profile page/components.
  - Added rollout guide (`docs/profile-feature-flags-rollout.md`).
