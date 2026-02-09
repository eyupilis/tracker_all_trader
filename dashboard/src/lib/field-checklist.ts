import type { TraderPayload } from '@/lib/api';
import spec from '@/lib/payload-checklist.spec.json';

export interface ChecklistSectionResult {
    section: string;
    checked: number;
    missing: string[];
}

export interface ChecklistResult {
    sections: ChecklistSectionResult[];
    totalChecked: number;
    totalMissing: number;
    missingPaths: string[];
}

interface ChecklistSpec {
    topLevel: string[];
    leadCommon: string[];
    portfolioDetail: string[];
    assetPreferences: string[];
    orderHistory: string[];
    orderRow: string[];
    positionRow: string[];
    roiRow: string[];
}

const checklistSpec = spec as ChecklistSpec;

function isMissing(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
}

function checkFields(section: string, source: Record<string, unknown>, fields: string[]): ChecklistSectionResult {
    const missing = fields
        .filter((field) => isMissing(source[field]))
        .map((field) => `${section}.${field}`);

    return {
        section,
        checked: fields.length,
        missing,
    };
}

function firstArrayItem(value: unknown): Record<string, unknown> {
    if (Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === 'object') {
        return value[0] as Record<string, unknown>;
    }
    return {};
}

export function evaluateTraderPayloadChecklist(payload: TraderPayload): ChecklistResult {
    const topLevelSource = payload as unknown as Record<string, unknown>;
    const leadCommon = (payload.leadCommon || {}) as unknown as Record<string, unknown>;
    const portfolioDetail = (payload.portfolioDetail || {}) as Record<string, unknown>;
    const assetPreferences = (payload.assetPreferences || {}) as unknown as Record<string, unknown>;
    const orderHistory = (payload.orderHistory || {}) as unknown as Record<string, unknown>;
    const orderRow = firstArrayItem(payload.orderHistory?.allOrders);
    const positionRow = firstArrayItem(payload.activePositions);
    const roiRow = firstArrayItem(payload.roiSeries);

    const sections: ChecklistSectionResult[] = [
        checkFields('topLevel', topLevelSource, checklistSpec.topLevel),
        checkFields('leadCommon', leadCommon, checklistSpec.leadCommon),
        checkFields('portfolioDetail', portfolioDetail, checklistSpec.portfolioDetail),
        checkFields('assetPreferences', assetPreferences, checklistSpec.assetPreferences),
        checkFields('orderHistory', orderHistory, checklistSpec.orderHistory),
        checkFields('orderRow', orderRow, checklistSpec.orderRow),
        checkFields('positionRow', positionRow, checklistSpec.positionRow),
        checkFields('roiRow', roiRow, checklistSpec.roiRow),
    ];

    const missingPaths = sections.flatMap((section) => section.missing);
    const totalChecked = sections.reduce((sum, section) => sum + section.checked, 0);

    return {
        sections,
        totalChecked,
        totalMissing: missingPaths.length,
        missingPaths,
    };
}
