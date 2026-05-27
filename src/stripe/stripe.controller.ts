import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { StripeSimulatorService } from './stripe-simulator.service';
import { SimulationInternalTokenGuard } from '../shared/guards/simulation-internal-token.guard';
import { SimulationInternalNetworkGuard } from '../shared/guards/simulation-internal-network.guard';

@Controller('stripe')
@UseGuards(SimulationInternalNetworkGuard, SimulationInternalTokenGuard)
export class StripeController {
  constructor(private readonly stripeSimulator: StripeSimulatorService) {}

  @Post('insufficient-funds')
  @HttpCode(402)
  simulateInsufficientFunds() {
    return this.stripeSimulator.triggerInsufficientFundsError();
  }

  @Post('account-closed')
  @HttpCode(402)
  simulateAccountClosed() {
    return this.stripeSimulator.triggerAccountClosedError();
  }

  @Post('customer-not-authorized')
  @HttpCode(402)
  simulateCustomerNotAuthorized() {
    return this.stripeSimulator.triggerCustomerNotAuthorizedError();
  }

  @Post('invalid-account-routing-number')
  @HttpCode(402)
  simulateInvalidAccountRoutingNumber() {
    return this.stripeSimulator.triggerInvalidAccountRoutingNumberError();
  }

  @Post('stolen-card')
  @HttpCode(402)
  simulateStolenCard() {
    return this.stripeSimulator.triggerStolenCardError();
  }

  @Post('fraudulent')
  @HttpCode(402)
  simulateFraudulent() {
    return this.stripeSimulator.triggerFraudulentError();
  }
}
