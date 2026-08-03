import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { PlaidSimulatorService } from './plaid-simulator.service';
import { type PlaidSimulationOptions } from './plaid-simulation-options';
import { SimulationInternalTokenGuard } from '../../shared/guards/simulation-internal-token.guard';
import { SimulationInternalNetworkGuard } from '../../shared/guards/simulation-internal-network.guard';

@Controller('plaid')
@UseGuards(SimulationInternalNetworkGuard, SimulationInternalTokenGuard)
export class PlaidSimulationController {
  constructor(private readonly plaidSimulator: PlaidSimulatorService) {}

  @Post(':scenario')
  @HttpCode(200)
  simulate(
    @Param('scenario') scenario: string,
    @Req() req: Request,
    @Body() body: { delayMs?: number } = {},
  ) {
    return this.plaidSimulator.run(scenario, {
      options: this.getSimulationOptions(req),
      body,
    });
  }

  private getSimulationOptions(req: Request): PlaidSimulationOptions {
    const isCron = req.header('x-slatrap-origin') === 'cron-auto';

    return {
      skipProviderErrorEmit: isCron,
      skipProviderLatencyEmit: isCron,
    };
  }
}
