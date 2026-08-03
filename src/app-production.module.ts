import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { StripeRuntimeModule } from './stripe/stripe-runtime.module';
import { createAppCoreImports } from './app-core-imports';
import { SlatrapBootstrapService } from './bootstrap/slatrap-bootstrap.service';

@Module({
  imports: [...createAppCoreImports(), StripeRuntimeModule],
  controllers: [AppController],
  providers: [SlatrapBootstrapService],
})
export class AppProductionModule {}
