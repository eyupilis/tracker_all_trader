import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import contract from './snapshots/trader-profile-contract.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pagePath = path.resolve(__dirname, '../src/app/traders/[leadId]/page.tsx');

async function readTraderProfilePage() {
  return readFile(pagePath, 'utf8');
}

test('trader profile tabs match UI contract snapshot', async () => {
  const source = await readTraderProfilePage();

  for (const tab of contract.tabs) {
    assert.match(
      source,
      new RegExp(`TabsTrigger\\s+value=\\"${tab}\\"`),
      `Missing tab trigger for "${tab}"`,
    );
  }
});

test('trader profile includes required insights and operations components', async () => {
  const source = await readTraderProfilePage();

  for (const componentName of contract.insightsComponents) {
    assert.match(
      source,
      new RegExp(`<${componentName}[\\s>]`),
      `Missing insights component "${componentName}"`,
    );
  }

  for (const componentName of contract.operationsComponents) {
    assert.match(
      source,
      new RegExp(`<${componentName}[\\s>]`),
      `Missing operations component "${componentName}"`,
    );
  }
});

test('trader profile reads all feature flags from contract', async () => {
  const source = await readTraderProfilePage();

  for (const flag of contract.featureFlags) {
    assert.match(
      source,
      new RegExp(`featureFlags\\.${flag}`),
      `Missing feature flag usage for "${flag}"`,
    );
  }
});
