import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export {
  PLAID_ITEM_CREATED,
  PROVIDER_ERROR_EVENT,
} from '../../domain/events/events.constants';
export {
  type ProviderErrorInspectionEvent,
  type PlaidItemCreatedEvent,
} from '../../domain/events/events.types';

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter();

  emit(eventName: string, payload: unknown) {
    this.emitter.emit(eventName, payload);
  }

  on(eventName: string, listener: (payload: unknown) => void) {
    this.emitter.on(eventName, listener as (...args: unknown[]) => void);
  }

  off(eventName: string, listener: (payload: unknown) => void) {
    this.emitter.off(eventName, listener as (...args: unknown[]) => void);
  }
}
