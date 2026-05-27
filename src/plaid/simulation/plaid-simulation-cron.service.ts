import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import {
  buildPlaidSimulationScenarios,
  type PlaidSimulationScenario,
} from './plaid-simulation-scenarios';
import { createSlatrapAxiosInterceptor } from './create-slatrap-axios-interceptor';

@Injectable()
export class PlaidSimulationCronService {
  private readonly logger = new Logger(PlaidSimulationCronService.name);

  constructor(private readonly configService: ConfigService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runAutoSimulation() {
    const enabled =
      this.configService.get<boolean>('SIMULATION_ENABLED') ?? false;
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';

    if (!enabled || nodeEnv === 'test') {
      return;
    }

    const scenarios = buildPlaidSimulationScenarios();

    if (scenarios.length === 0) {
      this.logger.warn(
        'Simulation enabled, but no Plaid scenarios are configured.',
      );
      return;
    }

    this.logger.log('Rolling the dice: a Plaid scenario may be triggered...');

    const randomValue = Math.random();
    let cursor = 0;
    let selectedScenario: PlaidSimulationScenario | null = null;

    for (const scenario of scenarios) {
      cursor += Math.max(0, scenario.frequency);
      if (randomValue < cursor) {
        selectedScenario = scenario;
        break;
      }
    }

    if (!selectedScenario) {
      this.logger.debug(
        'No Plaid scenario selected this tick (within no-op probability gap).',
      );
      return;
    }

    this.logger.warn(
      `Scenario selected: ${selectedScenario.name} (expected: ${selectedScenario.expectedError})`,
    );

    try {
      const requestBody = await selectedScenario.buildRequestBody();
      await this.postToLocalEndpoint(selectedScenario.requestPath, requestBody);

      this.logger.log(`Scenario finished: ${selectedScenario.name}`);
    } catch {
      this.logger.warn(
        {
          scenario: selectedScenario.name,
          expectedError: selectedScenario.expectedError,
          endpoint: selectedScenario.endpoint,
        },
        'Scenario request failed',
      );
    }
  }

  private async postToLocalEndpoint(path: string, body?: unknown) {
    const port = this.configService.get<number>('PORT') ?? 3000;
    const url = `http://127.0.0.1:${port}${path}`;
    const startedAt = Date.now();
    const simulationInternalToken = this.configService.get<string>(
      'SIMULATION_INTERNAL_TOKEN',
    );
    const plaidAxiosInstance = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'x-slatrap-origin': 'cron-auto',
        ...(simulationInternalToken
          ? { 'x-simulation-token': simulationInternalToken }
          : {}),
      },
    });

    plaidAxiosInstance.interceptors.response.use(
      (res) => res,
      createSlatrapAxiosInterceptor({
        configService: this.configService,
        endpoint: path,
        startedAt,
      }),
    );

    return plaidAxiosInstance.post(url, body);
  }
}
