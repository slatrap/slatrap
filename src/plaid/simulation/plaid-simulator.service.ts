import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Slatrap } from '@slatrap/slatrap';
import { PLAID_ITEM_CREATED } from '@slatrap/slatrap-engine';
import { PlaidSimulationErrorService } from './simulation-error.service';
import { type PlaidSimulationOptions } from './plaid-simulation-options';
import { getPlaidSimulationScenario } from './plaid-simulation-scenarios';

export type SimulatedPlaidItem = {
  itemId: string;
  institutionId: string;
  institutionName: string;
};

export type PlaidScenarioRunContext = {
  options?: PlaidSimulationOptions;
  body?: { delayMs?: number };
};

@Injectable()
export class PlaidSimulatorService {
  constructor(
    private readonly simulationErrorService: PlaidSimulationErrorService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Dispatches a registered Plaid simulation by route segment
   * (e.g. `institution-down`, `item-created`).
   */
  run(route: string, context: PlaidScenarioRunContext = {}) {
    const scenario = getPlaidSimulationScenario(route);
    if (!scenario) {
      throw new NotFoundException(`Unknown Plaid simulation scenario: ${route}`);
    }

    const options = context.options ?? {};

    switch (scenario.kind) {
      case 'item-created':
        return this.createItem();
      case 'slow-response': {
        const delayMs =
          context.body?.delayMs ??
          this.configService.get<number>('PLAID_SIMULATION_SLOW_MS') ??
          2_500;
        return this.simulationErrorService.triggerSlowResponse(delayMs, options);
      }
      case 'error': {
        if (!scenario.fixtureKey) {
          throw new Error(
            `Plaid scenario '${route}' is missing fixtureKey configuration`,
          );
        }
        return this.simulationErrorService.triggerError(
          scenario.fixtureKey,
          options,
        );
      }
      default: {
        const _exhaustive: never = scenario.kind;
        throw new Error(`Unhandled Plaid scenario kind: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Simulates a successful Plaid Link / item create and emits `plaid.item.created`
   * so the engine listener can persist item metadata.
   */
  createItem(): SimulatedPlaidItem {
    const item: SimulatedPlaidItem = {
      itemId:
        this.configService.get<string>('SIMULATION_ITEM_ID') ??
        `item_sim_${Date.now()}`,
      institutionId:
        this.configService.get<string>('SIMULATION_INSTITUTION_ID') ??
        'ins_109508',
      institutionName:
        this.configService.get<string>('SIMULATION_INSTITUTION_NAME') ??
        'First Platypus Bank',
    };

    void Slatrap.emit(
      Slatrap.sanitize({
        eventName: PLAID_ITEM_CREATED,
        payload: item,
      }),
    );

    return item;
  }
}
