import { Module } from '@nestjs/common';
import { StripeRuntimeModule } from './stripe-runtime.module';
import { StripeSimulationModule } from './stripe-simulation.module';

@Module({
  imports: [StripeRuntimeModule, StripeSimulationModule],
})
export class StripeModule {}
