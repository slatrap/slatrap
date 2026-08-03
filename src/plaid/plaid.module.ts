import { Module } from '@nestjs/common';
import { PlaidSimulationErrorService } from './simulation/simulation-error.service';
import { PlaidSimulatorService } from './simulation/plaid-simulator.service';
import {
  loadPlaidSimulationTestCases,
  PLAID_SIMULATION_TEST_CASES,
} from './simulation/plaid-simulation-test-cases';

@Module({
  providers: [
    {
      provide: PLAID_SIMULATION_TEST_CASES,
      useFactory: () => loadPlaidSimulationTestCases(),
    },
    PlaidSimulationErrorService,
    PlaidSimulatorService,
  ],
  exports: [PlaidSimulationErrorService, PlaidSimulatorService],
})
export class PlaidModule {}
