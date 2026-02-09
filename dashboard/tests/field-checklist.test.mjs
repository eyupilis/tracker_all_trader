import test from 'node:test';
import assert from 'node:assert/strict';
import payloadSpec from '../src/lib/payload-checklist.spec.json' with { type: 'json' };
import samplePayload from './fixtures/trader-payload.sample.json' with { type: 'json' };

function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

function firstRow(list) {
  if (!Array.isArray(list) || list.length === 0 || typeof list[0] !== 'object' || list[0] === null) {
    return {};
  }
  return list[0];
}

function collectMissing(payload, spec) {
  const sources = {
    topLevel: payload ?? {},
    leadCommon: payload?.leadCommon ?? {},
    portfolioDetail: payload?.portfolioDetail ?? {},
    assetPreferences: payload?.assetPreferences ?? {},
    orderHistory: payload?.orderHistory ?? {},
    orderRow: firstRow(payload?.orderHistory?.allOrders),
    positionRow: firstRow(payload?.activePositions),
    roiRow: firstRow(payload?.roiSeries),
  };

  const missing = [];
  for (const [section, fields] of Object.entries(spec)) {
    const source = sources[section] ?? {};
    for (const field of fields) {
      if (isMissing(source[field])) {
        missing.push(`${section}.${field}`);
      }
    }
  }
  return missing;
}

test('sample payload matches expected optional-missing baseline', () => {
  const missing = collectMissing(samplePayload, payloadSpec);
  const expectedOptionalMissing = [
    'leadCommon.futuresPrivateLPId',
    'leadCommon.futuresPrivateLPStatus',
    'portfolioDetail.privateLeadPortfolioId',
    'portfolioDetail.riskControlMaxCopyCount',
    'portfolioDetail.finalEffectiveMaxCopyCount',
    'portfolioDetail.copierLockPeriodTime',
    'portfolioDetail.copierUnlockExpiredTime',
  ];

  assert.deepEqual(
    [...missing].sort(),
    [...expectedOptionalMissing].sort(),
    `Unexpected checklist drift. Missing fields: ${missing.join(', ')}`
  );
});

test('field checklist detects missing critical fields', () => {
  const mutated = structuredClone(samplePayload);
  delete mutated.leadCommon.futuresPublicLPId;
  delete mutated.portfolioDetail.maxCopyCount;
  mutated.orderHistory.allOrders[0] = {};
  mutated.activePositions[0] = {};

  const missing = collectMissing(mutated, payloadSpec);

  assert.ok(missing.includes('leadCommon.futuresPublicLPId'));
  assert.ok(missing.includes('portfolioDetail.maxCopyCount'));
  assert.ok(missing.includes('orderRow.symbol'));
  assert.ok(missing.includes('positionRow.symbol'));
});
