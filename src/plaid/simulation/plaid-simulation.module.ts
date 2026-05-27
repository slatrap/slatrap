import { Module } from '@nestjs/common';
import { PlaidModule } from '../plaid.module';
import { PlaidSimulationController } from './plaid-simulation.controller';
import { SimulationInternalTokenGuard } from '../../shared/guards/simulation-internal-token.guard';
import { SimulationInternalNetworkGuard } from '../../shared/guards/simulation-internal-network.guard';
import { PlaidSimulationCronService } from './plaid-simulation-cron.service';

@Module({
  imports: [PlaidModule],
  controllers: [PlaidSimulationController],
  providers: [
    SimulationInternalTokenGuard,
    SimulationInternalNetworkGuard,
    PlaidSimulationCronService,
  ],
})
export class PlaidSimulationModule {}
