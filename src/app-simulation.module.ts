import { Module } from '@nestjs/common';
import { AppProductionModule } from './app-production.module';
import { PlaidSimulationModule } from './plaid/simulation/plaid-simulation.module';
import { StripeSimulationModule } from './stripe/stripe-simulation.module';

@Module({
  imports: [AppProductionModule, PlaidSimulationModule, StripeSimulationModule],
})
export class AppSimulationModule {}
