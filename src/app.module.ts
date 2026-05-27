import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlaidModule } from './plaid/plaid.module';
import { StripeModule } from './stripe/stripe.module';
import { createAppCoreImports } from './app-core-imports';

@Module({
  imports: [...createAppCoreImports(), PlaidModule, StripeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
