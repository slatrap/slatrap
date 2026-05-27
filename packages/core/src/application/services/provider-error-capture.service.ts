import { Injectable, Logger } from '@nestjs/common';
import { normalizeFintechPayload } from '../../domain/errors/provider-error-normalizer';
import { ItemMetadataService } from './item-metadata.service';
import {
  type MetadataContext,
  type MetadataBuilder,
  type CapturedProviderError,
  type FintechErrorContext,
} from '../../domain/errors/provider-error.types';

export { type CapturedProviderError } from '../../domain/errors/provider-error.types';

function compact(obj: Record<string, string | undefined>): MetadataContext {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as MetadataContext;
}

const PROVIDER_METADATA_BUILDERS: Record<string, MetadataBuilder> = {
  stripe: ({ userId }) => compact({ userId }),
  plaid: ({ itemId, institutionId, institutionName }) =>
    compact({ itemId, institutionId, institutionName }),
};

@Injectable()
export class ProviderErrorCaptureService {
  private readonly logger = new Logger(ProviderErrorCaptureService.name);

  constructor(private readonly itemMetadataService: ItemMetadataService) {}

  async captureProviderError(params: {
    endpoint?: string;
    statusCode?: number;
    providerPayload?: unknown;
    latency?: number;
    provider?: string;
  }): Promise<CapturedProviderError | null> {
    const errorContext: FintechErrorContext | null = params.providerPayload
      ? normalizeFintechPayload(params.providerPayload, params.provider)
      : null;

    if (!errorContext) {
      return null;
    }

    const itemMetadata =
      errorContext.provider === 'plaid' && errorContext.itemId
        ? await this.itemMetadataService.resolve(errorContext)
        : null;

    const logPayload: {
      endpoint?: string;
      statusCode?: number;
      provider?: string;
      providerPayload: unknown;
      latency?: number;
    } = {
      providerPayload: errorContext.payload,
      endpoint: params.endpoint,
      statusCode: params.statusCode,
      provider: errorContext.provider,
      latency: params.latency,
    };

    this.logger.warn(logPayload, 'Fintech provider error captured');

    const metadataCtx: MetadataContext = {
      userId: errorContext.userId,
      itemId: itemMetadata?.itemId,
      institutionId: itemMetadata?.institutionId,
      institutionName: itemMetadata?.institutionName,
    };

    const buildMetadata =
      PROVIDER_METADATA_BUILDERS[errorContext.provider ?? ''] ?? (() => ({}));
    const metadata = buildMetadata(metadataCtx);

    return {
      normalizedProvider: errorContext.provider,
      errorCode: errorContext.errorCode,
      errorType: errorContext.errorType,
      errorMessage: errorContext.errorMessage,
      requestId: errorContext.requestId,
      endpoint: params.endpoint,
      statusCode: params.statusCode,
      metadata,
    };
  }
}
