export interface FeatureFlags {
    insightsTab: boolean;
    compareMode: boolean;
    virtualizedTables: boolean;
    mobileDetailDrawers: boolean;
    inspectorDetailDrawer: boolean;
}

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
}

export function getFeatureFlags(): FeatureFlags {
    return {
        insightsTab: parseFlag(process.env.NEXT_PUBLIC_FF_INSIGHTS_TAB, true),
        compareMode: parseFlag(process.env.NEXT_PUBLIC_FF_COMPARE_MODE, true),
        virtualizedTables: parseFlag(process.env.NEXT_PUBLIC_FF_VIRTUALIZED_TABLES, true),
        mobileDetailDrawers: parseFlag(process.env.NEXT_PUBLIC_FF_MOBILE_DETAIL_DRAWERS, true),
        inspectorDetailDrawer: parseFlag(process.env.NEXT_PUBLIC_FF_INSPECTOR_DETAIL_DRAWER, true),
    };
}
