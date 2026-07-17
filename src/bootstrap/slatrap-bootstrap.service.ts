import { Injectable, OnModuleInit } from '@nestjs/common';
import { Slatrap } from '@slatrap/slatrap';
import { EventBusService, PROVIDER_ERROR_EVENT } from '@slatrap/slatrap-engine';

@Injectable()
export class SlatrapBootstrapService implements OnModuleInit {
  constructor(private readonly inspector: EventBusService) { }

  onModuleInit(): void {
    Slatrap.configureForCoreInspector({
      emitter: this.inspector,
      providerErrorEventName: PROVIDER_ERROR_EVENT,
      defaultProvider: 'plaid',
    });
  }
}
