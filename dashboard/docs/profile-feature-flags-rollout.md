# Trader Profile Feature Flag Rollout

## Purpose
Control risky UI changes in production and support fast rollback without redeploy.

## Flags
- `NEXT_PUBLIC_FF_INSIGHTS_TAB`
- `NEXT_PUBLIC_FF_COMPARE_MODE`
- `NEXT_PUBLIC_FF_VIRTUALIZED_TABLES`
- `NEXT_PUBLIC_FF_MOBILE_DETAIL_DRAWERS`
- `NEXT_PUBLIC_FF_INSPECTOR_DETAIL_DRAWER`

## Suggested rollout sequence
1. Start with all flags `false` in production.
2. Enable `NEXT_PUBLIC_FF_INSIGHTS_TAB=true` and monitor page errors.
3. Enable `NEXT_PUBLIC_FF_VIRTUALIZED_TABLES=true` and validate large order histories on low-end devices.
4. Enable `NEXT_PUBLIC_FF_MOBILE_DETAIL_DRAWERS=true` and validate mobile interaction flows.
5. Enable `NEXT_PUBLIC_FF_INSPECTOR_DETAIL_DRAWER=true` and validate long value rendering.
6. Enable `NEXT_PUBLIC_FF_COMPARE_MODE=true` last (extra data load path).

## Rollback plan
- If any issue appears, set only the problematic flag back to `false`.
- If issue scope is unclear, set all feature flags to `false` and re-check baseline profile behavior.

## Validation checklist
- `npm run test`
- `npm run build`
- Open `/traders/[leadId]` with and without compare query.
- Verify tabs and mobile drawers under flag on/off states.
