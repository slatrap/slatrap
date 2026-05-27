import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeSimulatorService } from './stripe-simulator.service';
import { SimulationInternalTokenGuard } from '../shared/guards/simulation-internal-token.guard';
import { SimulationInternalNetworkGuard } from '../shared/guards/simulation-internal-network.guard';
import { StripeSimulatorApiClient } from './stripe-simulator-api.client';
import { StripeSimulatorErrorMapper } from './stripe-simulator-error.mapper';
import { StripeSimulatorEventPublisher } from './stripe-simulator-event.publisher';

@Module({
  controllers: [StripeController],
  providers: [
    StripeSimulatorService,
    StripeSimulatorApiClient,
    StripeSimulatorErrorMapper,
    StripeSimulatorEventPublisher,
    SimulationInternalTokenGuard,
    SimulationInternalNetworkGuard,
  ],
})
export class StripeSimulationModule {}
