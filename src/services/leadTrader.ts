import { prisma } from '../db/prisma.js';

/**
 * Upsert a lead trader record.
 * FAZ 0: Accepts optional meta to persist positionShow + nickname.
 */
export async function upsertLeadTrader(
    leadId: string,
    platform: string = 'binance',
    meta?: { positionShow?: boolean; nickname?: string },
) {
    return prisma.leadTrader.upsert({
        where: { id: leadId },
        update: {
            platform,
            updatedAt: new Date(),
            ...(meta?.positionShow !== undefined && {
                positionShow: meta.positionShow,
                posShowUpdatedAt: new Date(),
            }),
            ...(meta?.nickname !== undefined && { nickname: meta.nickname }),
        },
        create: {
            id: leadId,
            platform,
            positionShow: meta?.positionShow ?? null,
            posShowUpdatedAt: meta?.positionShow !== undefined ? new Date() : null,
            nickname: meta?.nickname ?? null,
        },
    });
}

/**
 * Get a lead trader by ID
 */
export async function getLeadTrader(leadId: string) {
    return prisma.leadTrader.findUnique({
        where: { id: leadId },
        include: {
            traderScore: true,
        },
    });
}

/**
 * Get all lead traders for a platform
 */
export async function getLeadTradersByPlatform(platform: string = 'binance') {
    return prisma.leadTrader.findMany({
        where: { platform },
    });
}
