import { Business, Currency } from '../types';

export type OpenBusinessResult =
  | { ok: true; business: Business; currency: Currency | null }
  | {
      ok: false;
      code: 'OPEN_IN_PROGRESS' | 'BUSINESS_NOT_AVAILABLE' | 'BUSINESS_CONTEXT_UNAVAILABLE';
      message: string;
    };

interface BusinessContextControllerDependencies {
  listBusinesses: () => Promise<Business[]>;
  storage: Pick<Storage, 'setItem' | 'removeItem'>;
  setBusiness: (business: Business | null) => void;
  setCurrency: (currency: Currency | null) => void;
  setLoading: (loading: boolean) => void;
}

const OPEN_IN_PROGRESS: OpenBusinessResult = {
  ok: false,
  code: 'OPEN_IN_PROGRESS',
  message: 'A business is already being opened',
};

const BUSINESS_NOT_AVAILABLE: OpenBusinessResult = {
  ok: false,
  code: 'BUSINESS_NOT_AVAILABLE',
  message: 'This business is not available to the current user',
};

const BUSINESS_CONTEXT_UNAVAILABLE: OpenBusinessResult = {
  ok: false,
  code: 'BUSINESS_CONTEXT_UNAVAILABLE',
  message: 'Unable to load the business currency context',
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidBaseCurrency(business: Business): business is Business & { baseCurrency: Currency } {
  const currency = business.baseCurrency;
  return !!currency
    && isNonEmptyString(currency.id)
    && currency.id === business.baseCurrencyId
    && isNonEmptyString(currency.code)
    && isNonEmptyString(currency.name)
    && isNonEmptyString(currency.symbol)
    && typeof currency.exchangeRate === 'number'
    && Number.isFinite(currency.exchangeRate)
    && currency.exchangeRate > 0
    && typeof currency.active === 'boolean';
}

export function createBusinessContextController(deps: BusinessContextControllerDependencies) {
  let generation = 0;
  let openingGeneration: number | null = null;
  let lastRequestedBusinessId: string | null = null;

  const clearActiveBusiness = () => {
    deps.storage.removeItem('currentBusinessId');
    deps.setBusiness(null);
    deps.setCurrency(null);
  };

  const openBusiness = async (id: string): Promise<OpenBusinessResult> => {
    if (openingGeneration !== null) return OPEN_IN_PROGRESS;

    const requestGeneration = generation;
    openingGeneration = requestGeneration;
    lastRequestedBusinessId = id;
    deps.setLoading(true);

    try {
      const businesses = await deps.listBusinesses();
      if (requestGeneration !== generation) return BUSINESS_CONTEXT_UNAVAILABLE;
      const business = businesses.find(candidate => candidate.id === id);
      if (!business) {
        clearActiveBusiness();
        return BUSINESS_NOT_AVAILABLE;
      }

      const baseCurrency = business.baseCurrency;
      const hasNoConfiguredCurrency = baseCurrency === null && business.baseCurrencyId === '';
      if (!hasNoConfiguredCurrency && !hasValidBaseCurrency(business)) {
        clearActiveBusiness();
        return BUSINESS_CONTEXT_UNAVAILABLE;
      }

      // Persist only after the authorized business and its nested currency are validated.
      deps.storage.setItem('currentBusinessId', id);
      deps.setBusiness(business);
      deps.setCurrency(baseCurrency);
      return { ok: true, business, currency: baseCurrency };
    } catch {
      if (requestGeneration !== generation) return BUSINESS_CONTEXT_UNAVAILABLE;
      clearActiveBusiness();
      return BUSINESS_CONTEXT_UNAVAILABLE;
    } finally {
      if (openingGeneration === requestGeneration) {
        deps.setLoading(false);
        openingGeneration = null;
      }
    }
  };

  return {
    openBusiness,
    clearBusiness() {
      lastRequestedBusinessId = null;
      generation += 1;
      openingGeneration = null;
      clearActiveBusiness();
      deps.setLoading(false);
    },
    retryOpenBusiness() {
      if (!lastRequestedBusinessId) return Promise.resolve(BUSINESS_NOT_AVAILABLE);
      return openBusiness(lastRequestedBusinessId);
    },
  };
}
