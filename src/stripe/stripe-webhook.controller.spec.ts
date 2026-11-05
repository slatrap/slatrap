import {
  type ExecutionContext,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { defer, lastValueFrom, of } from 'rxjs';
import { Slatrap } from '@slatrap/slatrap';
import { ProviderErrorInterceptor } from '@slatrap/slatrap/nestjs';
import { StripeWebhookController } from './stripe-webhook.controller';

type WebhookRequest = Parameters<StripeWebhookController['handleWebhook']>[0];
type WebhookBody = Parameters<StripeWebhookController['handleWebhook']>[1];

const SECRET = 'whsec_test';

function signedRequest(body: object, secret = SECRET): WebhookRequest {
  const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`, 'utf8')
    .digest('hex');

  return {
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    rawBody,
  } as unknown as WebhookRequest;
}

function paymentFailedEvent(account?: string) {
  return {
    id: 'evt_pi',
    type: 'payment_intent.payment_failed',
    ...(account ? { account } : {}),
    request: { id: 'req_1' },
    data: {
      object: {
        id: 'pi_1',
        metadata: { external_ref_id: 'user_9', start: '1700000000000' },
        last_payment_error: {
          code: 'card_declined',
          decline_code: 'insufficient_funds',
          message: 'Your card has insufficient funds.',
        },
      },
    },
  };
}

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;

  const send = (body: object) =>
    controller.handleWebhook(signedRequest(body), body as WebhookBody);

  const thrownPayload = (body: object): Record<string, unknown> => {
    try {
      send(body);
    } catch (error) {
      return (error as HttpException).getResponse() as Record<string, unknown>;
    }
    throw new Error('Expected the webhook to throw');
  };

  beforeEach(() => {
    const configService = { get: jest.fn().mockReturnValue(SECRET) };
    controller = new StripeWebhookController(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a webhook with a bad signature', () => {
    const body = paymentFailedEvent('acct_123');

    expect(() =>
      controller.handleWebhook(
        signedRequest(body, 'whsec_wrong'),
        body as WebhookBody,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('puts the event account in the thrown payload next to userId', () => {
    expect(thrownPayload(paymentFailedEvent('acct_123'))).toMatchObject({
      code: 'card_declined',
      decline_code: 'insufficient_funds',
      request_id: 'req_1',
      userId: 'user_9',
      connectedAccountId: 'acct_123',
      startedAt: 1700000000000,
    });
  });

  it('omits connectedAccountId when the event has no account', () => {
    expect(thrownPayload(paymentFailedEvent())).not.toHaveProperty(
      'connectedAccountId',
    );
  });

  it('acknowledges other event types without throwing', () => {
    expect(send({ id: 'evt_other', type: 'customer.created' })).toEqual({
      received: true,
      ignored: true,
    });
  });

  it('emits the account inside providerPayload through the interceptor', async () => {
    const emitSpy = jest
      .spyOn(Slatrap, 'emit')
      .mockImplementation(() => undefined);
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: '/stripe/webhook' }),
      }),
    } as unknown as ExecutionContext;
    const body = paymentFailedEvent('acct_123');
    const next = {
      handle: () => defer(() => of(send(body))),
    };

    await expect(
      lastValueFrom(new ProviderErrorInterceptor().intercept(context, next)),
    ).rejects.toBeInstanceOf(HttpException);

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy.mock.calls[0][0]).toMatchObject({
      provider: 'stripe',
      endpoint: '/stripe/webhook',
      statusCode: 402,
      startedAt: 1700000000000,
      providerPayload: {
        code: 'card_declined',
        userId: 'user_9',
        connectedAccountId: 'acct_123',
      },
    });
  });
});
