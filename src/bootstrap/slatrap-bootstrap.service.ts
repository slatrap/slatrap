import { Injectable, OnModuleInit } from '@nestjs/common';
import { Slatrap } from '../../packages/slatrap/src';
import { EventBusService, PROVIDER_ERROR_EVENT } from '../../packages/core/src';

@Injectable()
export class SlatrapBootstrapService implements OnModuleInit {
  constructor(private readonly inspector: EventBusService) {}

  onModuleInit(): void {
    Slatrap.configureForCoreInspector({
      emitter: this.inspector,
      providerErrorEventName: PROVIDER_ERROR_EVENT,
      defaultProvider: 'plaid',
    });
  }
}
