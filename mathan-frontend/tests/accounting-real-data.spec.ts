import { test, expect, request, APIRequestContext, Browser } from '@playwright/test';
import fs from 'node:fs';

type Master = Record<string, any> & { id: string };

function localEnv(name: string, fallback: string) {
  if (process.env[name]) return process.env[name]!;
  try {
    const line = fs.readFileSync('../mathan-backend/.env', 'utf8').split('\n').find((x) => x.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : fallback;
  } catch { return fallback; }
}

async function post(ctx: APIRequestContext, path: string, body: any, headers?: Record<string, string>) {
  const response = await ctx.post(path, { data: body, headers });
  expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function createMaster(ctx: APIRequestContext, type: string, body: any, headers: Record<string, string>) {
  const response = await ctx.post(`/api/v1/masters/${type}`, { data: body, headers });
  expect(response.ok(), `${type}: ${await response.text()}`).toBeTruthy();
  return response.json() as Promise<Master>;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('realistic multi-master, inventory, multi-currency and report integrity flow', async ({ browser, baseURL }) => {
  const username = localEnv('MATHAN_BOOTSTRAP_USERNAME', 'admin');
  const pin = localEnv('MATHAN_BOOTSTRAP_PIN', '1234');
  const api = await request.newContext({ baseURL });
  const login = await post(api, '/api/v1/auth/login', { username, pin });
  const token = login.accessToken as string;
  const auth = { Authorization: `Bearer ${token}` };

  const business = await post(api, '/api/v1/businesses', { name: `Mathan Real-Data Trading Ltd ${Date.now()}`, baseCurrencyCode: 'USD' }, auth);
  const secondBusiness = await post(api, '/api/v1/businesses', { name: `Mathan Second Trading Ltd ${Date.now()}`, baseCurrencyCode: 'UGX' }, auth);
  const headers = { ...auth, 'X-Business-Id': business.id };
  const get = async (type: string) => (await api.get(`/api/v1/masters/${type}`, { headers })).json();
  const seed = async (type: string, body: any) => createMaster(api, type, body, headers);

  const groups = await get('account-groups');
  const group = (name: string) => groups.find((g: Master) => g.name === name)!.id;
  const period = await seed('periods', { name: 'FY 2026 Open', startDate: '2026-01-01', endDate: '2026-12-31', closed: false });
  await seed('periods', { name: 'FY 2025 Closed', startDate: '2025-01-01', endDate: '2025-12-31', isClosed: true });
  await seed('periods', { name: 'FY 2027 Planning', startDate: '2027-01-01', endDate: '2027-12-31', closed: false });
  const units = await Promise.all(['Piece', 'Box', 'Kilogram'].map((name) => seed('units', { name, active: true })));
  const warehouses = await Promise.all(['Kampala Main', 'Jinja Branch', 'Gulu Depot'].map((name) => seed('warehouses', { name, active: true })));
  await seed('currencies', { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 4100, active: true });
  const currencyRows = await get('currencies');
  expect(currencyRows.length).toBeGreaterThanOrEqual(5);
  const costCenters = await Promise.all(['Retail', 'Wholesale', 'Administration'].map((name) => seed('cost-centers', { name, active: true })));

  const ledgerDefinitions = [
    ['Cash on Hand', 'Bank & Cash', 250000, 'Dr'], ['Main Bank', 'Bank & Cash', 1000000, 'Dr'],
    ['Petty Cash', 'Bank & Cash', 50000, 'Dr'], ['Trade Receivables', 'Sundry Debtors', 0, 'Dr'],
    ['Trade Payables', 'Sundry Creditors', 0, 'Cr'], ['Sales Revenue', 'Direct Income', 0, 'Cr'],
    ['Purchases Expense', 'Direct Expense', 0, 'Dr'], ['Cost of Sales', 'Direct Expense', 0, 'Dr'],
    ['Payroll Expense', 'Direct Expense', 0, 'Dr'], ['Rent Expense', 'Direct Expense', 0, 'Dr'],
    ['Share Capital', 'Capital Account', 1300000, 'Cr'], ['Inventory Control', 'Current Assets', 0, 'Dr'],
    ['FX Gain Loss', 'Direct Income', 0, 'Cr'], ['Office Equipment', 'Fixed Assets', 0, 'Dr'],
  ] as const;
  const ledgers: Record<string, Master> = {};
  for (const [name, groupName, openingBalance, openingBalanceType] of ledgerDefinitions) {
    ledgers[name] = await seed('ledgers', { name, groupId: group(groupName), openingBalance, openingBalanceType, active: true });
  }
  const parties = await Promise.all([
    ['Nile Supermarket', 'Customer', 'Trade Receivables'], ['Pearl Hotel', 'Customer', 'Trade Receivables'],
    ['Kampala Schools', 'Customer', 'Trade Receivables'], ['East Africa Imports', 'Supplier', 'Trade Payables'],
    ['Lake Victoria Supplies', 'Supplier', 'Trade Payables'], ['Global Office Mart', 'Both', 'Trade Payables'],
  ].map(([name, type, ledger]) => seed('parties', { name, type, ledgerId: ledgers[ledger].id, active: true })));
  const products: Master[] = [];
  for (let i = 1; i <= 100; i++) products.push(await seed('products', { name: `SKU-${String(i).padStart(3, '0')} ${i % 2 ? 'Essential' : 'Premium'}`, baseUnitId: units[i % units.length].id, sellingPrice: 1000 + i * 25, active: true }));
  for (let i = 1; i <= 6; i++) await seed('employees', { name: `Employee ${i}`, designation: ['Accountant', 'Sales Officer', 'Storekeeper', 'Manager', 'HR Officer', 'Driver'][i - 1], basicSalary: 800000 + i * 50000, joinDate: '2025-01-15', active: true });
  expect(products).toHaveLength(100);

  const voucher = async (body: any) => post(api, '/api/v1/vouchers', { currencyId: currencyRows.find((c: Master) => c.code === (body.currencyCode || 'USD'))?.id || currencyRows[0].id, exchangeRate: 1, ...body }, headers);
  const line = (ledger: string, debit = 0, credit = 0, extra: any = {}) => ({ ledgerId: ledgers[ledger].id, debit, credit, ...extra });
  const stock = (index: number, warehouse: number, quantity: number, rate: number) => ({ productId: products[index].id, warehouseId: warehouses[warehouse].id, unitId: products[index].baseUnitId, quantity, rate });
  const posted: Master[] = [];
  posted.push(await voucher({ type: 'Receipt', date: '2026-01-05', narration: 'Opening capital deposit', lines: [line('Main Bank', 500000, 0), line('Share Capital', 0, 500000)] }));
  posted.push(await voucher({ type: 'Purchase', date: '2026-02-02', partyId: parties[3].id, narration: 'Inventory purchase - supplier invoice EA-1001', lines: [line('Purchases Expense', 300000, 0), line('Trade Payables', 0, 300000, { billDetails: [{ billNo: 'EA-1001', amount: 300000, type: 'New Ref', dueDate: '2026-03-04' }] })], stockLines: [stock(0, 0, 100, 1500), stock(1, 0, 100, 1500)] }));
  posted.push(await voucher({ type: 'Sale', date: '2026-02-10', partyId: parties[0].id, narration: 'Credit sale - Nile Supermarket', lines: [line('Trade Receivables', 250000, 0, { billDetails: [{ billNo: 'NS-2001', amount: 250000, type: 'New Ref', dueDate: '2026-03-10' }] }), line('Sales Revenue', 0, 250000)], stockLines: [stock(0, 0, -50, 2000)] }));
  posted.push(await voucher({ type: 'Payment', date: '2026-02-20', partyId: parties[3].id, narration: 'Part settlement of EA-1001', lines: [line('Trade Payables', 100000, 0, { billDetails: [{ billNo: 'EA-1001', amount: 100000, type: 'Against Ref' }] }), line('Main Bank', 0, 100000)] }));
  posted.push(await voucher({ type: 'Journal', date: '2026-03-01', narration: 'Monthly rent and payroll accrual', lines: [line('Rent Expense', 60000, 0, { costCenterId: costCenters[2].id }), line('Payroll Expense', 120000, 0, { costCenterId: costCenters[2].id }), line('Main Bank', 0, 180000)] }));
  posted.push(await voucher({ type: 'Sale', date: '2026-03-05', currencyCode: 'EUR', exchangeRate: 4100, partyId: parties[1].id, narration: 'Foreign currency hotel sale', lines: [line('Trade Receivables', 410000, 0, { txnDebit: 100, billDetails: [{ billNo: 'PH-EUR-1', amount: 100, type: 'New Ref', dueDate: '2026-04-05' }] }), line('Sales Revenue', 0, 410000, { txnCredit: 100 })], stockLines: [stock(1, 0, -10, 2500)] }));
  expect(posted).toHaveLength(6);

  const rejectedUnbalanced = await api.post('/api/v1/vouchers', { headers, data: { currencyId: currencyRows[0].id, exchangeRate: 1, type: 'Journal', date: '2026-03-10', narration: 'Must be rejected', lines: [line('Main Bank', 10, 0)] } });
  expect(rejectedUnbalanced.status()).toBe(400);
  const rejectedClosedPeriod = await api.post('/api/v1/vouchers', { headers, data: { currencyId: currencyRows[0].id, exchangeRate: 1, type: 'Journal', date: '2025-06-10', narration: 'Must be rejected', lines: [line('Main Bank', 10, 0), line('Share Capital', 0, 10)] } });
  expect(rejectedClosedPeriod.status()).toBe(409);

  const trial = await (await api.get('/api/v1/reports/trial-balance', { headers })).json();
  const dr = trial.reduce((s: number, x: any) => s + Number(x.debit), 0);
  const cr = trial.reduce((s: number, x: any) => s + Number(x.credit), 0);
  expect(Math.abs(dr - cr)).toBeLessThan(0.01);
  const stockSummary = await (await api.get('/api/v1/reports/stock-summary', { headers })).json();
  expect(stockSummary.find((x: any) => x.productId === products[0].id).quantity).toBe(50);
  const balanceBeforeCancel = await (await api.get('/api/v1/reports/profit-loss', { headers })).json();
  expect(balanceBeforeCancel.length).toBeGreaterThan(0);
  await (await api.post(`/api/v1/vouchers/${posted[4].id}/cancel`, { headers })).dispose();
  const balanceAfterCancel = await (await api.get('/api/v1/reports/profit-loss', { headers })).json();
  const rentAfterCancel = balanceAfterCancel.find((x: any) => x.ledgerName === 'Rent Expense');
  expect(Number(rentAfterCancel?.balance || 0)).toBe(0);
  const balanceSheet = await (await api.get('/api/v1/reports/balance-sheet', { headers })).json();
  const trialAfterCancel = await (await api.get('/api/v1/reports/trial-balance', { headers })).json();
  const openingSigned = (x: any) => Number(x.openingBalance) * (x.openingBalanceType === 'Dr' ? 1 : -1);
  const accountBalance = (x: any) => openingSigned(x) + Number(x.debit) - Number(x.credit);
  const assets = trialAfterCancel.filter((x: any) => x.nature === 'Asset').reduce((s: number, x: any) => s + accountBalance(x), 0);
  const liabilities = trialAfterCancel.filter((x: any) => x.nature === 'Liability').reduce((s: number, x: any) => s - accountBalance(x), 0);
  const equity = trialAfterCancel.filter((x: any) => x.nature === 'Equity').reduce((s: number, x: any) => s - accountBalance(x), 0);
  const income = trialAfterCancel.filter((x: any) => x.nature === 'Income').reduce((s: number, x: any) => s - accountBalance(x), 0);
  const expenses = trialAfterCancel.filter((x: any) => x.nature === 'Expense').reduce((s: number, x: any) => s + accountBalance(x), 0);
  expect(Math.abs(assets - (liabilities + equity + income - expenses))).toBeLessThan(0.01);
  expect(balanceSheet.length).toBeGreaterThan(0);

  const page = await browser.newPage();
  await page.goto('/');
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(pin);
  await page.getByRole('button', { name: 'Unlock Terminal' }).click();
  await expect(page.getByText(business.name)).toBeVisible({ timeout: 30_000 });

  let nextOpenGate: { arrived: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | null = null;
  await page.route('**/api/v1/businesses', async (route) => {
    const gate = nextOpenGate;
    if (gate) {
      nextOpenGate = null;
      gate.arrived.resolve();
      await gate.release.promise;
    }
    await route.continue();
  });
  const holdNextOpen = () => {
    const gate = { arrived: deferred(), release: deferred() };
    nextOpenGate = gate;
    return gate;
  };

  const firstOpen = holdNextOpen();
  await page.getByText(business.name).click();
  await firstOpen.arrived.promise;
  await expect(page.locator('svg.animate-spin')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active Entities' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Switch business/i })).toHaveCount(0);
  firstOpen.release.resolve();
  await expect(page.getByRole('button', { name: /Switch business/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Change company' }).click();
  await expect(page.getByRole('heading', { name: 'Active Entities' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(secondBusiness.name)).toBeVisible();
  const secondOpen = holdNextOpen();
  await page.getByText(secondBusiness.name).click();
  await secondOpen.arrived.promise;
  await expect(page.locator('svg.animate-spin')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active Entities' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Switch business/i })).toHaveCount(0);
  secondOpen.release.resolve();
  await expect(page.getByRole('button', { name: /Switch business/i })).toBeVisible({ timeout: 30_000 });

  await page.getByText('Masters', { exact: true }).click();
  await expect(page.getByText('Master Foundations')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Products' }).click();
  await expect(page.getByText('SKU-001 Essential')).toBeVisible();
  await page.getByRole('button', { name: 'Currencies' }).click();
  await expect(page.getByText('EUR', { exact: true }).last()).toBeVisible();
  const navigate = async (label: string) => {
    const sidebar = page.locator('#sidebar-menu');
    const box = await sidebar.boundingBox();
    if (!box || box.width < 100) await page.locator('#sidebar-menu-btn').click();
    await page.getByText(label, { exact: true }).click();
  };
  await navigate('Transactions');
  await expect(page.getByText('Transaction Hub')).toBeVisible();
  for (const label of ['Cash/Credit Sale', 'Cash/Credit Purchase', 'Payment Voucher', 'Receipt Voucher', 'Contra Voucher', 'Journal Entry', 'Stock Adjustment', 'Stock Transfer', 'Salaries & Payroll']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await navigate('Reports');
  await expect(page.getByText('Reports Hub')).toBeVisible();
  for (const label of ['Voucher List', 'Ledger Statement', 'Trial Balance', 'Profit & Loss', 'Balance Sheet', 'Inventory', 'Outstanding Bills']) {
    await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
  }
  await page.getByRole('button', { name: /Trial Balance/i }).click();
  await expect(page.getByText(/Ledger Integrity/)).toBeVisible();
  await expect(page.getByText(/\$2,660,000/).first()).toBeVisible();
  await page.getByRole('button', { name: /Profit & Loss/i }).click();
  await expect(page.getByText(/Net Earnings Position/)).toBeVisible();
  await page.getByRole('button', { name: /Balance Sheet/i }).click();
  await expect(page.getByText('Balance Sheet', { exact: true }).last()).toBeVisible();
  await navigate('Audit Trail');
  await expect(page.getByText('System Audit Trail')).toBeVisible();
  await navigate('Users');
  await expect(page.getByText('Access Control')).toBeVisible();
  await navigate('Settings');
  await expect(page.getByText('Configuration')).toBeVisible();
  await page.screenshot({ path: 'test-results/real-data-masters.png', fullPage: true });
  await page.close();
  await api.dispose();
});

test('business selector shows Retry after a failed business list request', async ({ page }) => {
  const username = localEnv('MATHAN_BOOTSTRAP_USERNAME', 'admin');
  const pin = localEnv('MATHAN_BOOTSTRAP_PIN', '1234');
  const api = await request.newContext({ baseURL: process.env.BASE_URL || 'http://localhost:3000' });
  const login = await post(api, '/api/v1/auth/login', { username, pin });
  const business = await post(api, '/api/v1/businesses', {
    name: `Mathan Retry Fixture ${Date.now()}`,
    baseCurrencyCode: 'USD',
  }, { Authorization: `Bearer ${login.accessToken}` });
  let failedFirstListRequest = false;

  await page.route('**/api/v1/businesses', async (route) => {
    if (!failedFirstListRequest && route.request().method() === 'GET') {
      failedFirstListRequest = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Business list temporarily unavailable' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(pin);
  await page.getByRole('button', { name: 'Unlock Terminal' }).click();

  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('No business profiles yet')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Active Entities' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  await expect(page.getByText(business.name)).toBeVisible();
  await api.dispose();
});

test('created business stays in selector after open failure and retries without creating again', async ({ page }) => {
  const username = localEnv('MATHAN_BOOTSTRAP_USERNAME', 'admin');
  const pin = localEnv('MATHAN_BOOTSTRAP_PIN', '1234');
  const businessName = `Mathan Create Recovery ${Date.now()}`;
  let createPostCount = 0;
  let failedImmediateOpen = false;

  await page.route('**/api/v1/businesses', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      createPostCount += 1;
      await route.continue();
      return;
    }

    if (request.method() === 'GET' && createPostCount > 0 && !failedImmediateOpen) {
      failedImmediateOpen = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Business context temporarily unavailable' }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto('/');
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(pin);
  await page.getByRole('button', { name: 'Unlock Terminal' }).click();

  await expect(page.getByRole('heading', { name: 'Active Entities' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'New Business Profile' }).click();
  await page.getByPlaceholder('e.g. Jolly Trading Co.').fill(businessName);
  await page.getByRole('button', { name: 'Confirm Incorporation' }).click();

  await expect(page.getByRole('heading', { name: 'Active Entities' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Establish Business')).toHaveCount(0);
  await expect(page.getByText(businessName, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry opening' })).toBeVisible();
  expect(failedImmediateOpen).toBe(true);
  expect(createPostCount).toBe(1);

  await page.getByRole('button', { name: 'Retry opening' }).click();
  await expect(page.getByRole('button', { name: /Switch business/i })).toBeVisible({ timeout: 30_000 });
  expect(createPostCount).toBe(1);
});
