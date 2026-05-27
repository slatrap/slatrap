import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Slatrap, sanitizeErrorData } from '../../../packages/slatrap/src';
import { withPlaidSimulationMetadata } from './plaid-simulation-metadata.util';

@Injectable()
export class PlaidSimulationErrorService {
  constructor(private readonly configService: ConfigService) {}

  triggerError(
    scenarioKey: string,
    options: { skipProviderErrorEmit?: boolean } = {},
  ): never {
    const start = Date.now();
    const { data, status } = this.readScenarioError(scenarioKey);
    const httpStatus = status ?? 400;

    const latency = Date.now() - start;

    if (!options.skipProviderErrorEmit) {
      const enrichedPayload = sanitizeErrorData(
        withPlaidSimulationMetadata(data, this.configService),
      );

      void Slatrap.emit({
        provider: 'plaid',
        endpoint: `/plaid/${scenarioKey}`,
        statusCode: httpStatus,
        providerPayload: enrichedPayload,
        latency,
      });
    }

    throw new HttpException({ plaid: data }, httpStatus);
  }

  private readScenarioError(key: string): {
    data: Record<string, unknown>;
    status: number;
  } {
    const payload = this.readTestCase(key);
    const status = this.inferHttpStatus(payload);

    return {
      data: payload as Record<string, unknown>,
      status,
    };
  }

  private readTestCase(key: string): unknown {
    const file = this.locateTestCasesFile();
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const payload = parsed[key];
    if (!payload) {
      throw new Error(`Missing test case '${key}' in ${file}`);
    }

    return payload;
  }

  private locateTestCasesFile(): string {
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
      `test-cases.json not found. Searched: ${candidates.join(', ')}`,
    );
  }

  private inferHttpStatus(payload: unknown): number {
    const data = payload as {
      status_code?: number;
      error_type?: string;
      error_code?: string;
      message?: string;
    };

    if (typeof data.status_code === 'number') {
      return data.status_code;
    }

    if (
      data.error_type === 'RATE_LIMIT_EXCEEDED' ||
      data.error_code?.includes('LIMIT')
    ) {
      return 429;
    }

    if (
      typeof data.message === 'string' &&
      data.message.includes('status code 429')
    ) {
      return 429;
    }

    return 400;
  }
}
