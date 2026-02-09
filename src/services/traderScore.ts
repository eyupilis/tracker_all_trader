import { prisma } from '../db/prisma.js';
import { getRealizedPnlSum } from './event.js';

/**
 * Normalize score to 0-100 range
 * MVP: Simple normalization based on absolute PnL values
 */
function normalizeScore(pnlSum: number): number {
    // Handle edge cases
    if (pnlSum <= 0) {
        return 0;
    }

    // MVP normalization: logarithmic scale
    // $100 PnL ≈ 50 score, $10000 PnL ≈ 100 score
    const logScore = Math.log10(pnlSum + 1) * 25;
    return Math.min(100, Math.max(0, logScore));
}

/**
 * Update trader score based on realized PnL
 */
export async function updateTraderScore(
    leadId: string,
    platform: string = 'binance'
): Promise<number> {
    // Get realized PnL sum for last 30 days
    const pnlSum = await getRealizedPnlSum(leadId, platform, 30);
    const score30d = normalizeScore(pnlSum);

    // Upsert trader score
    await prisma.traderScore.upsert({
        where: { leadId },
        update: {
            platform,
            score30d,
        },
        create: {
            leadId,
            platform,
            score30d,
        },
    });

    return score30d;
}

/**
 * Get top traders by score
 */
export async function getTopTraders(
    platform: string = 'binance',
    limit: number = 50
) {
    return prisma.traderScore.findMany({
        where: {
            platform,
            score30d: { gt: 0 },
        },
        orderBy: { score30d: 'desc' },
        take: limit,
        select: {
            leadId: true,
            score30d: true,
        },
    });
}

/**
 * Batch update scores for multiple traders
 */
export async function batchUpdateTraderScores(
    leadIds: string[],
    platform: string = 'binance'
): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    for (const leadId of leadIds) {
        const score = await updateTraderScore(leadId, platform);
        results.set(leadId, score);
    }

    return results;
}
