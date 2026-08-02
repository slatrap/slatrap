import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Slatrap } from '@slatrap/slatrap';
import { PLAID_ITEM_CREATED } from '@slatrap/slatrap-engine';
import { PlaidSimulationErrorService } from './simulation-error.service';
import { type PlaidSimulationOptions } from './plaid-simulation-options';

export type SimulatedPlaidItem = {
  itemId: string;
  institutionId: string;
  institutionName: string;
};

@Injectable()
export class PlaidSimulatorService {
  constructor(
    private readonly simulationErrorService: PlaidSimulationErrorService,
    private readonly configService: ConfigService,
  ) {}

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

  triggerInstitutionDownError(
    options?: PlaidSimulationOptions,
  ): Promise<never> {
    return this.simulationErrorService.triggerError(
      'INSTITUTION_DOWN',
      options,
    );
  }

  triggerAccountsLimitError(options?: PlaidSimulationOptions): Promise<never> {
    return this.simulationErrorService.triggerError('ACCOUNTS_LIMIT', options);
  }

  triggerNoAccountsError(options?: PlaidSimulationOptions): Promise<never> {
    return this.simulationErrorService.triggerError('NO_ACCOUNTS', options);
  }

  triggerInstitutionNotRespondingError(
    options?: PlaidSimulationOptions,
  ): Promise<never> {
    return this.simulationErrorService.triggerError(
      'INSTITUTION_NOT_RESPONDING',
      options,
    );
  }

  triggerItemLoginRequiredError(
    options?: PlaidSimulationOptions,
  ): Promise<never> {
    return this.simulationErrorService.triggerError(
      'ITEM_LOGIN_REQUIRED',
      options,
    );
  }

  triggerInvalidAccessTokenError(
    options?: PlaidSimulationOptions,
  ): Promise<never> {
    return this.simulationErrorService.triggerError(
      'INVALID_ACCESS_TOKEN',
      options,
    );
  }

  triggerSlowResponse(
    delayMs: number,
    options?: PlaidSimulationOptions,
  ): Promise<{ ok: true; latencyMs: number }> {
    return this.simulationErrorService.triggerSlowResponse(delayMs, options);
  }
}
