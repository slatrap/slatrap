import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Request } from 'express';
import { PlaidSimulatorService } from './plaid-simulator.service';
import { type PlaidSimulationOptions } from './plaid-simulation-options';
import { SimulationInternalTokenGuard } from '../../shared/guards/simulation-internal-token.guard';
import { SimulationInternalNetworkGuard } from '../../shared/guards/simulation-internal-network.guard';

@Controller('plaid')
@UseGuards(SimulationInternalNetworkGuard, SimulationInternalTokenGuard)
export class PlaidSimulationController {
  constructor(
    private readonly plaidSimulator: PlaidSimulatorService,
    private readonly configService: ConfigService,
  ) {}

  @Post('no-accounts')
  @HttpCode(200)
  simulateNoAccounts(@Req() req: Request) {
    return this.plaidSimulator.triggerNoAccountsError(
      this.getSimulationOptions(req),
    );
  }

  @Post('institution-down')
  @HttpCode(200)
  simulateInstitutionDown(@Req() req: Request) {
    return this.plaidSimulator.triggerInstitutionDownError(
      this.getSimulationOptions(req),
    );
  }

  @Post('accounts-limit')
  @HttpCode(200)
  simulateAccountsLimit(@Req() req: Request) {
    return this.plaidSimulator.triggerAccountsLimitError(
      this.getSimulationOptions(req),
    );
  }

  @Post('institution-not-responding')
  @HttpCode(200)
  simulateInstitutionNotResponding(@Req() req: Request) {
    return this.plaidSimulator.triggerInstitutionNotRespondingError(
      this.getSimulationOptions(req),
    );
  }

  @Post('item-login-required')
  @HttpCode(200)
  simulateItemLoginRequired(@Req() req: Request) {
    return this.plaidSimulator.triggerItemLoginRequiredError(
      this.getSimulationOptions(req),
    );
  }

  @Post('invalid-access-token')
  @HttpCode(200)
  simulateInvalidAccessToken(@Req() req: Request) {
    return this.plaidSimulator.triggerInvalidAccessTokenError(
      this.getSimulationOptions(req),
    );
  }

  @Post('slow-response')
  @HttpCode(200)
  simulateSlowResponse(
    @Req() req: Request,
    @Body() body: { delayMs?: number } = {},
  ) {
    const delayMs =
      body.delayMs ??
      this.configService.get<number>('PLAID_SIMULATION_SLOW_MS') ??
      2_500;

    return this.plaidSimulator.triggerSlowResponse(
      delayMs,
      this.getSimulationOptions(req),
    );
  }

  private getSimulationOptions(req: Request): PlaidSimulationOptions {
    const isCron = this.isCronScenarioRequest(req);

    return {
      skipProviderErrorEmit: isCron,
      skipProviderLatencyEmit: isCron,
    };
  }

  private isCronScenarioRequest(req: Request): boolean {
    return req.header('x-slatrap-origin') === 'cron-auto';
  }
}
