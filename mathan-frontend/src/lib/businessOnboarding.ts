import { ApiError, getApiFieldErrors } from './api';
import { Currency } from '../types';
import type { OpenBusinessResult } from './businessContext';

export interface BusinessCreateFormRecovery {
  showCreate: boolean;
  name: string;
  currencyId: string;
  errors: { name?: string; summary?: string };
}

export const ONBOARDING_CURRENCIES: Currency[] = [
  { id: 'USD', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, active: true },
  { id: 'UGX', code: 'UGX', name: 'Uganda Shilling', symbol: 'USh', exchangeRate: 3800, active: true },
  { id: 'KES', code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', exchangeRate: 130, active: true },
  { id: 'SSP', code: 'SSP', name: 'South Sudanese Pound', symbol: 'SSP', exchangeRate: 1, active: true },
];

const BUSINESS_CREATE_FALLBACK = 'We could not create this business. Please try again.';

export function isSupportedOnboardingCurrency(code: string): boolean {
  return ONBOARDING_CURRENCIES.some(currency => currency.code === code);
}

export function mapBusinessCreateError(error: unknown): { name?: string; summary?: string } {
  const fieldErrors = getApiFieldErrors(error);
  const name = fieldErrors.name?.trim();
  const summary = error instanceof ApiError && error.body.message?.trim()
    ? error.body.message
    : Object.values(fieldErrors).find(message => message.trim()) || BUSINESS_CREATE_FALLBACK;

  return {
    ...(name ? { name } : {}),
    summary,
  };
}

export function getBusinessCreateSuccessRecovery(
  businessId: string,
  openResult: OpenBusinessResult,
): BusinessCreateFormRecovery & { retryBusinessId: string | null; retryMessage: string | null } {
  if (!('message' in openResult)) {
    return {
      showCreate: false,
      name: '',
      currencyId: 'USD',
      errors: {},
      retryBusinessId: null,
      retryMessage: null,
    };
  }
  return {
    showCreate: false,
    name: '',
    currencyId: 'USD',
    errors: {},
    retryBusinessId: businessId,
    retryMessage: 'message' in openResult ? openResult.message : null,
  };
}

export function getBusinessCreateFailureRecovery(
  form: Pick<BusinessCreateFormRecovery, 'name' | 'currencyId'>,
  error: unknown,
): BusinessCreateFormRecovery {
  return {
    showCreate: true,
    name: form.name,
    currencyId: form.currencyId,
    errors: mapBusinessCreateError(error),
  };
}
