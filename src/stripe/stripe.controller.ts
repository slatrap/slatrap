import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { StripeSimulatorService } from './stripe-simulator.service';
import { SimulationInternalTokenGuard } from '../shared/guards/simulation-internal-token.guard';
import { SimulationInternalNetworkGuard } from '../shared/guards/simulation-internal-network.guard';

@Controller('stripe')
@UseGuards(SimulationInternalNetworkGuard, SimulationInternalTokenGuard)
export class StripeController {
  constructor(private readonly stripeSimulator: StripeSimulatorService) {}

  @Post(':scenario')
  simulate(@Param('scenario') scenario: string) {
    return this.stripeSimulator.run(scenario);
  }
}
