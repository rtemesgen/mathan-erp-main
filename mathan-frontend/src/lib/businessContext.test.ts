import test from 'node:test';
import assert from 'node:assert/strict';
import { createBusinessContextController } from './businessContext';
import { Business, Currency } from '../types';

const currency: Currency = {
  id: 'currency-ugx',
  code: 'UGX',
  name: 'Ugandan Shilling',
  symbol: 'USh',
  exchangeRate: 1,
  active: true,
};

const business: Business = {
  id: 'business-a',
  name: 'Alpha',
  baseCurrencyId: currency.id,
  baseCurrency: currency,
  ownerId: 'owner-a',
};

function setup(listBusinesses: () => Promise<Business[]>) {
  const saved: string[] = [];
  const removed: string[] = [];
  const active: { business: Business | null; currency: Currency | null; loading: boolean } = {
    business: null,
    currency: null,
    loading: false,
  };
  const controller = createBusinessContextController({
    listBusinesses,
    storage: {
      setItem: (key, value) => saved.push(`${key}=${value}`),
      removeItem: key => removed.push(key),
    },
    setBusiness: value => { active.business = value; },
    setCurrency: value => { active.currency = value; },
    setLoading: value => { active.loading = value; },
  });
  return { controller, saved, removed, active };
}

test('commits storage and active context only after the allowed business and currency are present', async () => {
  let finish!: (businesses: Business[]) => void;
  const { controller, saved, active } = setup(() => new Promise(resolve => { finish = resolve; }));

  const pending = controller.openBusiness(business.id);
  assert.deepEqual(saved, []);
  assert.equal(active.business, null);
  assert.equal(active.currency, null);
  finish([business]);

  assert.deepEqual(await pending, { ok: true, business, currency });
  assert.deepEqual(saved, ['currentBusinessId=business-a']);
  assert.equal(active.business, business);
  assert.equal(active.currency, currency);
  assert.equal(active.loading, false);
});

test('a business outside the allowed list leaves storage and active state empty', async () => {
  const { controller, saved, removed, active } = setup(async () => []);

  const result = await controller.openBusiness(business.id);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'BUSINESS_NOT_AVAILABLE');
  assert.deepEqual(saved, []);
  assert.deepEqual(removed, ['currentBusinessId']);
  assert.equal(active.business, null);
  assert.equal(active.currency, null);
});

test('a rejected allowed-business lookup leaves storage and active state empty', async () => {
  const { controller, saved, removed, active } = setup(async () => { throw new Error('network unavailable'); });

  const result = await controller.openBusiness(business.id);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'BUSINESS_CONTEXT_UNAVAILABLE');
  assert.deepEqual(saved, []);
  assert.deepEqual(removed, ['currentBusinessId']);
  assert.equal(active.business, null);
  assert.equal(active.currency, null);
});

test('a business without nested currency context leaves storage and active state empty', async () => {
  const { baseCurrency: _currency, ...businessWithoutCurrency } = business;
  const { controller, saved, removed, active } = setup(async () => [businessWithoutCurrency]);

  const result = await controller.openBusiness(business.id);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'BUSINESS_CONTEXT_UNAVAILABLE');
  assert.deepEqual(saved, []);
  assert.deepEqual(removed, ['currentBusinessId']);
  assert.equal(active.business, null);
  assert.equal(active.currency, null);
});

test('opens an authorized business with an explicitly absent base currency', async () => {
  const businessWithoutBaseCurrency: Business = {
    id: 'business-no-currency',
    name: 'No Currency',
    baseCurrencyId: '',
    baseCurrency: null,
    ownerId: 'owner-a',
  };
  const { controller, saved, removed, active } = setup(async () => [businessWithoutBaseCurrency]);

  const result = await controller.openBusiness(businessWithoutBaseCurrency.id);

  assert.deepEqual(result, { ok: true, business: businessWithoutBaseCurrency, currency: null });
  assert.deepEqual(saved, ['currentBusinessId=business-no-currency']);
  assert.deepEqual(removed, []);
  assert.equal(active.business, businessWithoutBaseCurrency);
  assert.equal(active.currency, null);
});

test('a nested currency missing the required active field is rejected', async () => {
  const incompleteBusiness = {
    ...business,
    baseCurrency: {
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchangeRate: currency.exchangeRate,
    },
  } as Business;
  const { controller, saved, removed, active } = setup(async () => [incompleteBusiness]);

  const result = await controller.openBusiness(business.id);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'BUSINESS_CONTEXT_UNAVAILABLE');
  assert.deepEqual(saved, []);
  assert.deepEqual(removed, ['currentBusinessId']);
  assert.equal(active.business, null);
  assert.equal(active.currency, null);
});

test('a nested currency with malformed required fields is rejected', async t => {
  const malformedCurrencies: Array<[string, unknown]> = [
    ['blank id', { ...currency, id: '' }],
    ['blank code', { ...currency, code: '' }],
    ['blank name', { ...currency, name: '  ' }],
    ['blank symbol', { ...currency, symbol: '' }],
    ['non-finite exchange rate', { ...currency, exchangeRate: Number.POSITIVE_INFINITY }],
    ['non-positive exchange rate', { ...currency, exchangeRate: 0 }],
    ['non-boolean active flag', { ...currency, active: 'yes' }],
  ];

  for (const [description, malformedCurrency] of malformedCurrencies) {
    await t.test(description, async () => {
      const malformedBusiness = { ...business, baseCurrency: malformedCurrency } as Business;
      const { controller, saved, removed, active } = setup(async () => [malformedBusiness]);

      const result = await controller.openBusiness(business.id);

      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, 'BUSINESS_CONTEXT_UNAVAILABLE');
      assert.deepEqual(saved, []);
      assert.deepEqual(removed, ['currentBusinessId']);
      assert.equal(active.business, null);
      assert.equal(active.currency, null);
    });
  }
});

test('retry can succeed after the allowed-business lookup previously failed', async () => {
  let attempts = 0;
  const { controller, saved, active } = setup(async () => {
    attempts += 1;
    return attempts === 1 ? [] : [business];
  });

  const failed = await controller.openBusiness(business.id);
  const retried = await controller.retryOpenBusiness();

  assert.equal(failed.ok, false);
  assert.deepEqual(retried, { ok: true, business, currency });
  assert.equal(attempts, 2);
  assert.deepEqual(saved, ['currentBusinessId=business-a']);
  assert.equal(active.business, business);
  assert.equal(active.currency, currency);
});

test('concurrent opens return OPEN_IN_PROGRESS without starting a second load', async () => {
  let finish!: (businesses: Business[]) => void;
  let loads = 0;
  const { controller } = setup(() => {
    loads += 1;
    return new Promise(resolve => { finish = resolve; });
  });

  const first = controller.openBusiness(business.id);
  const second = await controller.openBusiness(business.id);
  assert.equal(loads, 1);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, 'OPEN_IN_PROGRESS');

  finish([business]);
  assert.equal((await first).ok, true);
});

test('clearing during an open invalidates its late lookup result', async () => {
  let finish!: (businesses: Business[]) => void;
  const { controller, saved, removed, active } = setup(() => new Promise(resolve => { finish = resolve; }));

  const pending = controller.openBusiness(business.id);
  controller.clearBusiness();
  finish([business]);

  const result = await pending;
  assert.equal(result.ok, false);
  assert.deepEqual(saved, []);
  assert.deepEqual(removed, ['currentBusinessId']);
  assert.equal(active.business, null);
  assert.equal(active.currency, null);
  assert.equal(active.loading, false);
});
