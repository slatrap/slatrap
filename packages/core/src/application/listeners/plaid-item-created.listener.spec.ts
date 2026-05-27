import { Logger } from '@nestjs/common';
import { PLAID_ITEM_CREATED } from '../../domain/events/events.constants';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { ItemMetadataService } from '../services/item-metadata.service';
import { PlaidItemCreatedListener } from './plaid-item-created.listener';

describe('PlaidItemCreatedListener', () => {
  const flushPromises = async () => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  it('subscribes and unsubscribes on module lifecycle hooks', () => {
    const inspector = {
      on: jest.fn(),
      off: jest.fn(),
    };
    const itemMetadataService = {
      resolve: jest.fn(),
    };

    const listener = new PlaidItemCreatedListener(
      inspector as unknown as EventBusService,
      itemMetadataService as unknown as ItemMetadataService,
    );

    listener.onModuleInit();
    expect(inspector.on).toHaveBeenCalledWith(
      PLAID_ITEM_CREATED,
      expect.any(Function),
    );

    listener.onModuleDestroy();
    expect(inspector.off).toHaveBeenCalledWith(
      PLAID_ITEM_CREATED,
      expect.any(Function),
    );
  });

  it('skips resolve when itemId is missing', async () => {
    const loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PLAID_ITEM_CREATED) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const itemMetadataService = {
      resolve: jest.fn(),
    };

    const listener = new PlaidItemCreatedListener(
      inspector as unknown as EventBusService,
      itemMetadataService as unknown as ItemMetadataService,
    );

    listener.onModuleInit();
    registeredListener?.({ institutionId: 'ins_109508' });

    await flushPromises();

    expect(itemMetadataService.resolve).not.toHaveBeenCalled();
    expect(loggerWarnSpy).toHaveBeenCalled();

    loggerWarnSpy.mockRestore();
  });

  it('resolves and persists metadata when itemId exists', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PLAID_ITEM_CREATED) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const itemMetadataService = {
      resolve: jest.fn().mockResolvedValue({
        itemId: 'item_01',
        institutionId: 'ins_109508',
        institutionName: 'Test Bank',
      }),
    };

    const listener = new PlaidItemCreatedListener(
      inspector as unknown as EventBusService,
      itemMetadataService as unknown as ItemMetadataService,
    );

    listener.onModuleInit();

    registeredListener?.({
      itemId: 'item_01',
      institutionId: 'ins_109508',
      institutionName: 'Test Bank',
    });

    await flushPromises();

    expect(itemMetadataService.resolve).toHaveBeenCalledWith({
      itemId: 'item_01',
      institutionId: 'ins_109508',
      institutionName: 'Test Bank',
    });
  });

  it('logs errors thrown by metadata resolve', async () => {
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PLAID_ITEM_CREATED) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const itemMetadataService = {
      resolve: jest.fn().mockRejectedValue(new Error('db write failed')),
    };

    const listener = new PlaidItemCreatedListener(
      inspector as unknown as EventBusService,
      itemMetadataService as unknown as ItemMetadataService,
    );

    listener.onModuleInit();
    registeredListener?.({ itemId: 'item_01' });

    await flushPromises();

    expect(loggerErrorSpy).toHaveBeenCalled();

    loggerErrorSpy.mockRestore();
  });
});
