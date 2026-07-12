import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Slatrap } from '../../packages/slatrap/src';
import { ProviderErrorInterceptor } from '../../packages/slatrap/src/nestjs';

/** Replay-attack window: reject webhooks with timestamps older than 5 minutes. */
const STRIPE_TOLERANCE_SECONDS = 300;

/** Express request shape expected after NestFactory is created with rawBody: true. */
interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  created?: number;
  request?: {
    id?: string;
  };
  data?: {
    object?: {
      metadata?: Record<string, string>;
      last_payment_error?: StripeErrorObject;
      error?: StripeErrorObject;
    } & Record<string, unknown>;
  };
};

type StripeErrorObject = {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
  param?: string;
  doc_url?: string;
  request_log_url?: string;
  request_id?: string;
};

@Controller('stripe')
@UseInterceptors(ProviderErrorInterceptor)
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly configService: ConfigService) { }

  @Post('webhook')
  @HttpCode(200)
  handleWebhook(@Req() req: WebhookRequest, @Body() event: StripeWebhookEvent) {
    this.verifyStripeSignature(req);

    if (event?.type !== 'payment_intent.payment_failed') {
      this.logger.debug(
        `Ignored Stripe webhook event type ${event?.type ?? 'unknown'}`,
      );
      return { received: true, ignored: true };
    }

    const paymentIntent = event.data?.object ?? {};
    const stripeError =
      paymentIntent.last_payment_error ?? paymentIntent.error ?? {};
    const userId = paymentIntent.metadata?.external_ref_id;

    if (
      event.request?.id &&
      typeof stripeError === 'object' &&
      stripeError !== null
    ) {
      stripeError.request_id = event.request.id;
    }

    const stripePayload = {
      ...stripeError,
      ...(userId ? { userId } : {}),
      ...this.readSimulatorStartedAt(paymentIntent.metadata),
    };

    this.logger.log(
      {
        webhook_event: event.id,
        stripe_error: Slatrap.sanitize(stripePayload),
      },
      'Processed Stripe payment_intent.payment_failed webhook event',
    );

    throw new HttpException(stripePayload, 402);
  }

  /** Reads the simulator start timestamp stored in PaymentIntent metadata. */
  private readSimulatorStartedAt(
    metadata?: Record<string, string>,
  ): { startedAt: number } | Record<never, never> {
    const raw = metadata?.['start'];
    if (!raw) return {};
    const startTs = parseInt(raw, 10);
    if (isNaN(startTs)) return {};
    return { startedAt: startTs };
  }

  /**
   * Verifies the Stripe-Signature header using HMAC-SHA256.
   * Algorithm: https://stripe.com/docs/webhooks/signatures
   *
   * Throws UnauthorizedException if the secret is not configured, the header is
   * missing/malformed, the signature does not match, or the timestamp is stale.
   */
  private verifyStripeSignature(req: WebhookRequest): void {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!secret) {
      // No secret configured — reject all webhook requests to avoid silent bypass.
      throw new UnauthorizedException(
        'Stripe webhook secret is not configured.',
      );
    }

    const signatureHeader = req.headers['stripe-signature'];
    if (!signatureHeader || typeof signatureHeader !== 'string') {
      throw new UnauthorizedException('Missing Stripe-Signature header.');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body is unavailable; cannot verify webhook signature.',
      );
    }

    // Parse t= and v1= from the header
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => {
        const idx = part.indexOf('=');
        return [part.slice(0, idx), part.slice(idx + 1)];
      }),
    );

    const timestamp = parts['t'];
    const receivedSig = parts['v1'];

    if (!timestamp || !receivedSig) {
      throw new UnauthorizedException('Malformed Stripe-Signature header.');
    }

    // Replay-attack guard
    const timestampSeconds = parseInt(timestamp, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > STRIPE_TOLERANCE_SECONDS) {
      throw new UnauthorizedException(
        'Stripe webhook timestamp is too old (possible replay attack).',
      );
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const receivedBuf = Buffer.from(receivedSig, 'hex');

    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new UnauthorizedException(
        'Stripe webhook signature verification failed.',
      );
    }
  }
}
