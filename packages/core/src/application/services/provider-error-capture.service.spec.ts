import { ProviderErrorCaptureService } from './provider-error-capture.service';
import { ItemMetadataService } from './item-metadata.service';

describe('FintechErrorCaptureService', () => {
  it('returns null when provider payload is missing', async () => {
    const itemMetadataService = {
      resolve: jest.fn(),
    };
    const service = new ProviderErrorCaptureService(
      itemMetadataService as unknown as ItemMetadataService,
    );

    const result = await service.captureProviderError({
      endpoint: '/plaid/transactions',
      provider: 'plaid',
    });

    expect(result).toBeNull();
    expect(itemMetadataService.resolve).not.toHaveBeenCalled();
  });

  it('builds plaid metadata using resolved item metadata', async () => {
    const itemMetadataService = {
      resolve: jest.fn().mockResolvedValue({
        itemId: 'item_001',
        institutionId: 'ins_109508',
        institutionName: 'First Platypus Bank',
      }),
    };
    const service = new ProviderErrorCaptureService(
      itemMetadataService as unknown as ItemMetadataService,
    );

    const result = await service.captureProviderError({
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: {
        error_code: 'ITEM_LOGIN_REQUIRED',
        error_type: 'ITEM_ERROR',
        error_message: 'Re-auth required',
        request_id: 'req_plaid_01',
        item_id: 'item_001',
      },
      provider: 'plaid',
      latency: 120,
    });

    expect(itemMetadataService.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'plaid',
        itemId: 'item_001',
      }),
    );

    expect(result).toEqual({
      normalizedProvider: 'plaid',
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorType: 'ITEM_ERROR',
      errorMessage: 'Re-auth required',
      requestId: 'req_plaid_01',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      metadata: {
        itemId: 'item_001',
        institutionId: 'ins_109508',
        institutionName: 'First Platypus Bank',
      },
    });
  });

  it('builds stripe metadata and does not resolve item metadata', async () => {
    const itemMetadataService = {
      resolve: jest.fn(),
    };
    const service = new ProviderErrorCaptureService(
      itemMetadataService as unknown as ItemMetadataService,
    );

    const result = await service.captureProviderError({
      endpoint: '/stripe/charge',
      statusCode: 402,
      providerPayload: {
        type: 'card_error',
        code: 'card_declined',
        message: 'Card declined',
        requestId: 'req_stripe_01',
        user_id: 'user_01',
      },
      provider: 'stripe',
    });

    expect(itemMetadataService.resolve).not.toHaveBeenCalled();
    expect(result).toEqual({
      normalizedProvider: 'stripe',
      errorCode: undefined,
      errorType: 'card_declined',
      errorMessage: 'Card declined',
      requestId: 'req_stripe_01',
      endpoint: '/stripe/charge',
      statusCode: 402,
      metadata: {
        userId: 'user_01',
      },
    });
  });
});
