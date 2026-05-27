import { Module } from '@nestjs/common';
import { PlaidSimulationErrorService } from './simulation/simulation-error.service';
import { PlaidSimulatorService } from './simulation/plaid-simulator.service';

@Module({
  providers: [PlaidSimulationErrorService, PlaidSimulatorService],
  exports: [PlaidSimulationErrorService, PlaidSimulatorService],
})
export class PlaidModule {}
