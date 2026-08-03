import * as fs from 'node:fs';
import * as path from 'node:path';

export const PLAID_SIMULATION_TEST_CASES = Symbol(
  'PLAID_SIMULATION_TEST_CASES',
);

export type PlaidSimulationTestCases = Record<string, unknown>;

export function resolvePlaidSimulationTestCasesPath(
  explicitPath?: string,
): string {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `Plaid simulation test cases file not found at configured path: ${resolved}`,
      );
    }
    return resolved;
  }

  const candidates = [
    path.resolve(process.cwd(), '..', 'test-cases.json'),
    path.resolve(process.cwd(), 'test-cases.json'),
    path.resolve(__dirname, '..', '..', '..', 'test-cases.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `test-cases.json not found at startup. Searched: ${candidates.join(', ')}`,
  );
}

/** Reads and parses fixtures once (call from Nest provider factory / bootstrap). */
export function loadPlaidSimulationTestCases(
  explicitPath?: string,
): PlaidSimulationTestCases {
  const file = resolvePlaidSimulationTestCasesPath(explicitPath);
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Invalid Plaid simulation test cases file (expected object): ${file}`,
    );
  }

  return parsed as PlaidSimulationTestCases;
}
