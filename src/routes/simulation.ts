/**
 * Simulation & Portfolio API Routes (Sprint 1)
 * New endpoints for risk-aware position management
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import {
  createPortfolioSchema,
  openPositionWithRiskSchema,
  updatePositionRiskSchema,
  positionSizingRequestSchema,
  type CreatePortfolioRequest,
  type OpenPositionWithRiskRequest,
  type UpdatePositionRiskRequest,
  type PositionSizingRequest,
} from '../schemas/simulation.js';
import {
  computeKellySize,
  computeRiskBasedSize,
  computeStopLoss,
  computeTakeProfit,
  checkPortfolioRisk,
} from '../services/riskCalculator.js';
import { applySlippage, computeCommission } from '../services/executionModel.js';
import { monitorOpenPositions } from '../services/positionMonitor.js';
import {
  // getOrCreateDefaultPortfolio, // Unused
  createPortfolio,
  getPortfolio,
  getPortfolioPerformance,
  // updatePortfolioMetrics, // Unused
} from '../services/portfolioManager.js';

// Utility functions
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function getReferenceEntryPrice(symbol: string): Promise<number | null> {
  const s = symbol.toUpperCase();
  const latestPositions = await prisma.positionSnapshot.findMany({
    where: { symbol: s, platform: 'binance' },
    orderBy: { fetchedAt: 'desc' },
    take: 60,
    select: { markPrice: true, entryPrice: true },
  });

  const prices = latestPositions
    .map((p) => (p.markPrice && p.markPrice > 0 ? p.markPrice : p.entryPrice))
    .filter((v) => Number.isFinite(v) && v > 0);

  if (prices.length > 0) {
    const avg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
    return round4(avg);
  }

  const latestEvent = await prisma.event.findFirst({
    where: { symbol: s, platform: 'binance', price: { not: null } },
    orderBy: [{ eventTime: 'desc' }, { fetchedAt: 'desc' }],
    select: { price: true },
  });

  if (latestEvent?.price && latestEvent.price > 0) {
    return round4(latestEvent.price);
  }

  return null;
}

export async function simulationRoutes(fastify: FastifyInstance) {
  // ========================================================================
  // Portfolio Management
  // ========================================================================

  // POST /simulation/portfolios - Create new portfolio
  fastify.post(
    '/simulation/portfolios',
    async (request: FastifyRequest<{ Body: CreatePortfolioRequest }>, reply: FastifyReply) => {
      try {
        const validatedData = createPortfolioSchema.parse(request.body);
        const portfolio = await createPortfolio(validatedData);

        return reply.send({
          success: true,
          data: portfolio,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Failed to create portfolio');
        return reply.status(400).send({ success: false, error: msg });
      }
    }
  );

  // GET /simulation/portfolios - List all portfolios
  fastify.get('/simulation/portfolios', async (_request, reply: FastifyReply) => {
    try {
      const portfolios = await prisma.portfolio.findMany({
        where: { platform: 'binance' },
        orderBy: { createdAt: 'desc' },
        include: {
          metrics: true,
          _count: {
            select: {
              positions: { where: { status: 'OPEN' } },
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: portfolios,
        meta: { total: portfolios.length },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg }, 'Failed to list portfolios');
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  // GET /simulation/portfolios/:id - Get portfolio details
  fastify.get(
    '/simulation/portfolios/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const portfolio = await getPortfolio(request.params.id);

        if (!portfolio) {
          return reply.status(404).send({
            success: false,
            error: `Portfolio ${request.params.id} not found`,
          });
        }

        return reply.send({
          success: true,
          data: portfolio,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg, portfolioId: request.params.id }, 'Failed to get portfolio');
        return reply.status(500).send({ success: false, error: msg });
      }
    }
  );

  // GET /simulation/portfolios/:id/performance - Get performance analytics
  fastify.get(
    '/simulation/portfolios/:id/performance',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const performance = await getPortfolioPerformance(request.params.id);

        return reply.send({
          success: true,
          data: performance,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg, portfolioId: request.params.id }, 'Failed to get performance');
        return reply.status(500).send({ success: false, error: msg });
      }
    }
  );

  // ========================================================================
  // Position Sizing
  // ========================================================================

  // POST /simulation/positions/calculate-size - Calculate optimal position size
  fastify.post(
    '/simulation/positions/calculate-size',
    async (
      request: FastifyRequest<{ Body: PositionSizingRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const params = positionSizingRequestSchema.parse(request.body);

        // Get portfolio
        const portfolioId = params.portfolioId || 'default';
        const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });

        if (!portfolio) {
          return reply.status(404).send({
            success: false,
            error: `Portfolio ${portfolioId} not found`,
          });
        }

        // Get current price if not provided
        const entryPrice = params.entryPrice || await getReferenceEntryPrice(params.symbol);
        if (!entryPrice) {
          return reply.status(400).send({
            success: false,
            error: 'Entry price not provided and no market price available',
          });
        }

        let result: any = {};

        if (params.model === 'KELLY') {
          // Get trader metrics for Kelly calculation
          const traderScore = await prisma.traderScore.findFirst({
            orderBy: { traderWeight: 'desc' },
            select: { winRate: true },
          });

          const kellyResult = computeKellySize({
            traderWinRate: traderScore?.winRate || 0.5,
            avgRiskReward: 2.0,
            portfolioBalance: portfolio.currentBalance,
            kellyFraction: portfolio.kellyFraction,
            minSampleSize: portfolio.minSampleSize,
          });

          result = {
            marginNotional: kellyResult.marginNotional,
            positionNotional: kellyResult.marginNotional * (params.leverage || 10),
            leverage: params.leverage || 10,
            riskAmount: kellyResult.marginNotional,
            kelly: kellyResult.kelly,
            reason: kellyResult.reason,
          };
        } else if (params.model === 'RISK_BASED' && params.stopLossPct) {
          const stopLossPrice = params.direction === 'LONG'
            ? entryPrice * (1 - params.stopLossPct / 100)
            : entryPrice * (1 + params.stopLossPct / 100);

          const riskBasedResult = computeRiskBasedSize({
            portfolioBalance: portfolio.currentBalance,
            riskPercentage: params.riskPercentage || portfolio.maxRiskPerTrade,
            entryPrice,
            stopLossPrice,
            leverage: params.leverage || 10,
          });

          result = {
            ...riskBasedResult,
            leverage: params.leverage || 10,
            stopLossPrice,
          };
        } else {
          // FIXED sizing
          const marginNotional = params.riskPercentage
            ? (portfolio.currentBalance * params.riskPercentage) / 100
            : 100;

          result = {
            marginNotional: round4(marginNotional),
            positionNotional: round4(marginNotional * (params.leverage || 10)),
            leverage: params.leverage || 10,
            riskAmount: round4(marginNotional),
          };
        }

        // Calculate SL/TP if percentages provided
        if (params.stopLossPct && !result.stopLossPrice) {
          const slResult = computeStopLoss({
            entryPrice,
            direction: params.direction,
            fixedPct: params.stopLossPct,
            positionNotional: result.positionNotional,
          });
          result.stopLossPrice = slResult.stopLossPrice;
        }

        if (params.takeProfitPct && result.stopLossPrice) {
          const tpResult = computeTakeProfit({
            entryPrice,
            direction: params.direction,
            riskRewardRatio: params.takeProfitPct / params.stopLossPct!,
            stopLossPrice: result.stopLossPrice,
            positionNotional: result.positionNotional,
          });
          result.takeProfitPrice = tpResult.takeProfitPrice;
          result.riskRewardRatio = round4(params.takeProfitPct / params.stopLossPct!);
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Failed to calculate position size');
        return reply.status(400).send({ success: false, error: msg });
      }
    }
  );

  // ========================================================================
  // Position Management
  // ========================================================================

  // POST /simulation/positions/open - Open position with risk management
  fastify.post(
    '/simulation/positions/open',
    async (
      request: FastifyRequest<{ Body: OpenPositionWithRiskRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const params = openPositionWithRiskSchema.parse(request.body);

        // Get portfolio
        const portfolioId = params.portfolioId || 'default';
        const portfolio = await prisma.portfolio.findUnique({
          where: { id: portfolioId },
          include: {
            positions: { where: { status: 'OPEN' } },
          },
        });

        if (!portfolio) {
          return reply.status(404).send({
            success: false,
            error: `Portfolio ${portfolioId} not found`,
          });
        }

        // Get entry price
        let entryPrice = params.entryPrice || await getReferenceEntryPrice(params.symbol);
        if (!entryPrice) {
          return reply.status(400).send({
            success: false,
            error: 'Entry price not provided and no market price available',
          });
        }

        // Calculate position size if model provided
        let marginNotional = params.marginNotional;
        let stopLossPrice = params.stopLossPrice;
        let takeProfitPrice = params.takeProfitPrice;

        if (params.riskModel && !marginNotional) {
          // Calculate size based on risk model
          if (params.riskModel === 'RISK_BASED' && params.stopLossPct) {
            stopLossPrice = params.direction === 'LONG'
              ? entryPrice * (1 - params.stopLossPct / 100)
              : entryPrice * (1 + params.stopLossPct / 100);

            const sizeResult = computeRiskBasedSize({
              portfolioBalance: portfolio.currentBalance,
              riskPercentage: params.riskPercentage || portfolio.maxRiskPerTrade,
              entryPrice,
              stopLossPrice,
              leverage: params.leverage,
            });

            marginNotional = sizeResult.marginNotional;
          } else if (params.riskModel === 'KELLY') {
            const traderScore = await prisma.traderScore.findFirst({
              orderBy: { traderWeight: 'desc' },
              select: { winRate: true },
            });

            const kellyResult = computeKellySize({
              traderWinRate: traderScore?.winRate || 0.5,
              avgRiskReward: 2.0,
              portfolioBalance: portfolio.currentBalance,
              kellyFraction: portfolio.kellyFraction,
              minSampleSize: portfolio.minSampleSize,
            });

            if (kellyResult.reason) {
              return reply.status(400).send({
                success: false,
                error: kellyResult.reason,
              });
            }

            marginNotional = kellyResult.marginNotional;
          } else {
            marginNotional = 100; // Default fixed size
          }
        }

        if (!marginNotional) {
          return reply.status(400).send({
            success: false,
            error: 'marginNotional or riskModel required',
          });
        }

        // Calculate SL/TP if percentages provided
        if (params.stopLossPct && !stopLossPrice) {
          const slResult = computeStopLoss({
            entryPrice,
            direction: params.direction,
            fixedPct: params.stopLossPct,
          });
          stopLossPrice = slResult.stopLossPrice;
        }

        if (params.takeProfitPct && stopLossPrice) {
          const tpResult = computeTakeProfit({
            entryPrice,
            direction: params.direction,
            riskRewardRatio: params.takeProfitPct / (params.stopLossPct || 2),
            stopLossPrice,
          });
          takeProfitPrice = tpResult.takeProfitPrice;
        }

        const positionNotional = marginNotional * Math.max(params.leverage, 1);

        // Check portfolio risk limits
        const riskCheck = checkPortfolioRisk({
          currentBalance: portfolio.currentBalance,
          openPositions: portfolio.positions.map((p) => ({
            marginNotional: p.marginNotional,
            leverage: p.leverage,
          })),
          newPosition: { marginNotional, leverage: params.leverage },
          maxRiskPct: portfolio.maxPortfolioRisk,
          maxOpenPositions: portfolio.maxOpenPositions,
        });

        if (!riskCheck.allowed) {
          return reply.status(400).send({
            success: false,
            error: riskCheck.reason,
            meta: riskCheck,
          });
        }

        // Apply slippage to entry
        const slippageBps = params.slippageBps || portfolio.defaultSlippageBps;
        const commissionBps = params.commissionBps || portfolio.defaultCommissionBps;

        const entrySlippage = applySlippage({
          basePrice: entryPrice,
          direction: params.direction,
          slippageBps,
          isEntry: true,
        });

        const effectiveEntryPrice = entrySlippage.effectivePrice;

        // Calculate entry commission
        // const entryCommission = computeCommission({ positionNotional, commissionBps }); // Unused for now

        // Create position
        const position = await prisma.simulatedPosition.create({
          data: {
            platform: 'binance',
            symbol: params.symbol,
            direction: params.direction,
            status: 'OPEN',
            leverage: params.leverage,
            marginNotional: round4(marginNotional),
            positionNotional: round4(positionNotional),
            entryPrice: round4(entryPrice),
            effectiveEntryPrice,
            stopLossPrice: stopLossPrice ? round4(stopLossPrice) : null,
            takeProfitPrice: takeProfitPrice ? round4(takeProfitPrice) : null,
            trailingStopPct: params.trailingStopPct,
            slippageBps,
            commissionBps,
            riskModel: params.riskModel,
            riskPercentage: params.riskPercentage,
            portfolioId,
            source: 'MANUAL',
            notes: params.notes,
          },
        });

        // Update portfolio balance (subtract margin)
        await prisma.portfolio.update({
          where: { id: portfolioId },
          data: {
            currentBalance: round4(portfolio.currentBalance - marginNotional),
          },
        });

        logger.info(
          {
            positionId: position.id,
            symbol: params.symbol,
            direction: params.direction,
            marginNotional,
            stopLoss: stopLossPrice,
            takeProfit: takeProfitPrice,
          },
          'Position opened with risk management'
        );

        return reply.send({
          success: true,
          data: position,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Failed to open position');
        return reply.status(400).send({ success: false, error: msg });
      }
    }
  );

  // PATCH /simulation/positions/:id/risk - Update position risk parameters
  fastify.patch(
    '/simulation/positions/:id/risk',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdatePositionRiskRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const params = updatePositionRiskSchema.parse(request.body);

        const position = await prisma.simulatedPosition.findUnique({ where: { id } });

        if (!position || position.status !== 'OPEN') {
          return reply.status(404).send({
            success: false,
            error: 'Open position not found',
          });
        }

        const updated = await prisma.simulatedPosition.update({
          where: { id },
          data: {
            stopLossPrice: params.stopLossPrice,
            takeProfitPrice: params.takeProfitPrice,
            trailingStopPct: params.trailingStopPct,
            updatedAt: new Date(),
          },
        });

        logger.info({ positionId: id }, 'Position risk parameters updated');

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Failed to update position risk');
        return reply.status(400).send({ success: false, error: msg });
      }
    }
  );

  // POST /simulation/positions/monitor - Manually trigger position monitoring
  fastify.post('/simulation/positions/monitor', async (_request, reply: FastifyReply) => {
    try {
      const result = await monitorOpenPositions();

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg }, 'Manual position monitoring failed');
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  // ============================================================================
  // Backtest Management Endpoints (Sprint 2)
  // ============================================================================

  // GET /simulation/backtests - List saved backtest results
  fastify.get('/simulation/backtests', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const results = await prisma.backtestResult.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send({
        success: true,
        data: results,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg }, 'Failed to list backtest results');
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  // GET /simulation/backtests/:id - Get single backtest result
  fastify.get(
    '/simulation/backtests/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const result = await prisma.backtestResult.findUnique({
          where: { id },
        });

        if (!result) {
          return reply.status(404).send({
            success: false,
            error: 'Backtest result not found',
          });
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Failed to get backtest result');
        return reply.status(500).send({ success: false, error: msg });
      }
    }
  );

  // DELETE /simulation/backtests/:id - Delete backtest result
  fastify.delete(
    '/simulation/backtests/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        await prisma.backtestResult.delete({
          where: { id },
        });

        logger.info({ backtestId: id }, 'Backtest result deleted');

        return reply.send({
          success: true,
          data: { deleted: true },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Failed to delete backtest result');
        return reply.status(500).send({ success: false, error: msg });
      }
    }
  );
}
