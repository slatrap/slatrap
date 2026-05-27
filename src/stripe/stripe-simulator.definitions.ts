export type StripeErrorObject = {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
  param?: string;
  doc_url?: string;
  request_log_url?: string;
  request_id?: string;
};

export type StripeSimulationSpec = {
  endpoint: string;
  successMessage: string;
  buildBody: (externalRefId?: string) => URLSearchParams;
};

function buildCardPaymentIntentBody(
  paymentMethod: string,
  paymentMethodType: string,
) {
  return (externalRefId?: string) => {
    const body = new URLSearchParams({
      amount: '500',
      currency: 'usd',
      confirm: 'true',
      payment_method: paymentMethod,
      'payment_method_types[]': paymentMethodType,
    });

    if (externalRefId) {
      body.set('metadata[external_ref_id]', externalRefId);
    }

    return body;
  };
}

function buildInvalidBankAccountBody() {
  return (externalRefId?: string) => {
    const body = new URLSearchParams({
      amount: '500',
      currency: 'usd',
      confirm: 'true',
      'payment_method_types[]': 'us_bank_account',
      'payment_method_data[type]': 'us_bank_account',
      'payment_method_data[us_bank_account][country]': 'US',
      'payment_method_data[us_bank_account][account_holder_type]': 'individual',
      'payment_method_data[us_bank_account][routing_number]': '000000000',
      'payment_method_data[us_bank_account][account_number]': '000000000000',
    });

    if (externalRefId) {
      body.set('metadata[external_ref_id]', externalRefId);
    }

    return body;
  };
}

export const STRIPE_SIMULATIONS = {
  insufficientFunds: {
    endpoint: 'stripe/insufficient-funds',
    successMessage: 'Stripe NSF simulation failed as expected',
    buildBody: buildCardPaymentIntentBody(
      'pm_card_visa_chargeDeclinedInsufficientFunds',
      'card',
    ),
  },
  accountClosed: {
    endpoint: 'stripe/account-closed',
    successMessage: 'Stripe account-closed simulation failed as expected',
    buildBody: buildCardPaymentIntentBody(
      'pm_usBankAccount_accountClosed',
      'us_bank_account',
    ),
  },
  customerNotAuthorized: {
    endpoint: 'stripe/customer-not-authorized',
    successMessage:
      'Stripe customer-not-authorized simulation failed as expected',
    buildBody: buildCardPaymentIntentBody(
      'pm_usBankAccount_debitNotAuthorized',
      'us_bank_account',
    ),
  },
  invalidAccountRoutingNumber: {
    endpoint: 'stripe/invalid-account-routing-number',
    successMessage:
      'Stripe invalid-account-routing-number simulation failed as expected',
    buildBody: buildInvalidBankAccountBody(),
  },
  stolenCard: {
    endpoint: 'stripe/stolen-card',
    successMessage: 'Stripe stolen-card simulation failed as expected',
    buildBody: buildCardPaymentIntentBody(
      'pm_card_visa_chargeDeclinedStolenCard',
      'card',
    ),
  },
  fraudulent: {
    endpoint: 'stripe/fraudulent',
    successMessage: 'Stripe fraudulent simulation failed as expected',
    buildBody: buildCardPaymentIntentBody('pm_card_radarBlock', 'card'),
  },
} satisfies Record<string, StripeSimulationSpec>;
