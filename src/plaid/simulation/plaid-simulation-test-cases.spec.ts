import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadPlaidSimulationTestCases,
  resolvePlaidSimulationTestCasesPath,
} from './plaid-simulation-test-cases';

describe('plaid-simulation-test-cases', () => {
  it('resolves the repo test-cases.json once via default candidates', () => {
    const resolved = resolvePlaidSimulationTestCasesPath();
    expect(fs.existsSync(resolved)).toBe(true);
    expect(path.basename(resolved)).toBe('test-cases.json');
  });

  it('loads and parses fixtures from an explicit path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaid-fixtures-'));
    const file = path.join(dir, 'cases.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        ITEM_LOGIN_REQUIRED: { error_code: 'ITEM_LOGIN_REQUIRED' },
      }),
      'utf8',
    );

    const cases = loadPlaidSimulationTestCases(file);

    expect(cases.ITEM_LOGIN_REQUIRED).toEqual({
      error_code: 'ITEM_LOGIN_REQUIRED',
    });
  });

  it('fails clearly when the configured fixture path is missing', () => {
    const missing = path.join(os.tmpdir(), `missing-plaid-cases-${Date.now()}.json`);

    expect(() => loadPlaidSimulationTestCases(missing)).toThrow(
      /not found at configured path/i,
    );
  });
});
