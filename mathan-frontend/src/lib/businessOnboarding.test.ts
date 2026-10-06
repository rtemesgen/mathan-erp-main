import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './api';
import { getBusinessCreateFailureRecovery, getBusinessCreateSuccessRecovery, isSupportedOnboardingCurrency, mapBusinessCreateError } from './businessOnboarding';

test('accepts only the four onboarding currency codes', () => {
  assert.equal(isSupportedOnboardingCurrency('USD'), true);
  assert.equal(isSupportedOnboardingCurrency('UGX'), true);
  assert.equal(isSupportedOnboardingCurrency('KES'), true);
  assert.equal(isSupportedOnboardingCurrency('SSP'), true);
  assert.equal(isSupportedOnboardingCurrency('EUR'), false);
});

test('maps a structured business name error and keeps the server summary', () => {
  const error = new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Business details are invalid',
    fieldErrors: { name: 'Business name is already in use' },
  });

  assert.deepEqual(mapBusinessCreateError(error), {
    name: 'Business name is already in use',
    summary: 'Business details are invalid',
  });
});

test('provides a fallback summary for an unstructured create error', () => {
  assert.deepEqual(mapBusinessCreateError(new Error('offline')), {
    summary: 'We could not create this business. Please try again.',
  });
});

test('successful create with failed opening clears the form and exposes card retry', () => {
  assert.deepEqual(getBusinessCreateSuccessRecovery('business-new', {
    ok: false,
    code: 'BUSINESS_CONTEXT_UNAVAILABLE',
    message: 'Unable to open this business. Please try again.',
  }), {
    showCreate: false,
    name: '',
    currencyId: 'USD',
    errors: {},
    retryBusinessId: 'business-new',
    retryMessage: 'Unable to open this business. Please try again.',
  });
});

test('failed create request preserves entered name and currency', () => {
  assert.deepEqual(getBusinessCreateFailureRecovery({ name: 'Jolly Trading', currencyId: 'UGX' }, new Error('offline')), {
    showCreate: true,
    name: 'Jolly Trading',
    currencyId: 'UGX',
    errors: { summary: 'We could not create this business. Please try again.' },
  });
});
