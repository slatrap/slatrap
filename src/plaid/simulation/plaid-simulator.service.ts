import { Injectable } from '@nestjs/common';
import { PlaidSimulationErrorService } from './simulation-error.service';

type PlaidSimulationOptions = { skipProviderErrorEmit?: boolean };

@Injectable()
export class PlaidSimulatorService {
  constructor(
    private readonly simulationErrorService: PlaidSimulationErrorService,
  ) {}

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
