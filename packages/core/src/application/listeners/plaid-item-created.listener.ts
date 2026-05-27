import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { PLAID_ITEM_CREATED } from '../../domain/events/events.constants';
import { type PlaidItemCreatedEvent } from '../../domain/events/events.types';
import { ItemMetadataService } from '../services/item-metadata.service';

@Injectable()
export class PlaidItemCreatedListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlaidItemCreatedListener.name);

  private readonly listener = (payload: unknown) => {
    const event = payload as PlaidItemCreatedEvent;
    void this.handlePlaidItemCreated(event).catch((error) => {
      this.logger.error(
        `Failed to handle PLAID_ITEM_CREATED event: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  };

  constructor(
    private readonly inspector: EventBusService,
    private readonly itemMetadataService: ItemMetadataService,
  ) { }

  onModuleInit() {
    this.inspector.on(PLAID_ITEM_CREATED, this.listener);
  }

  onModuleDestroy() {
    this.inspector.off(PLAID_ITEM_CREATED, this.listener);
  }

  private async handlePlaidItemCreated(event: PlaidItemCreatedEvent) {
    const itemId = event.itemId;
    const institutionId = event.institutionId;
    const institutionName = event.institutionName;

    this.logger.debug('Received PLAID_ITEM_CREATED event');

    if (!itemId) {
      this.logger.warn(
        'PLAID_ITEM_CREATED event missing itemId; skipping persistence',
      );
      return;
    }

    await this.itemMetadataService.resolve({
      itemId,
      institutionId,
      institutionName,
    });
    this.logger.debug('Persisted Plaid item metadata');
  }
}
