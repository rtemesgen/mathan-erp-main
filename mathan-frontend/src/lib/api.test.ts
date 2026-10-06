import test from 'node:test';
import assert from 'node:assert/strict';
import { api, apiWithoutStoredBusinessHeader, ApiError, getApiErrorMessage, getApiFieldErrors, restoreSession, session } from './api';

test('formats field validation errors for a toast', () => {
  const error = new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid voucher', fieldErrors: { date: 'Date is required', lines: 'Add at least one line' } });
  assert.equal(getApiErrorMessage(error, 'Request failed'), 'Date is required; Add at least one line');
  assert.deepEqual(getApiFieldErrors(error), { date: 'Date is required', lines: 'Add at least one line' });
});

test('uses the server message for structured API errors', () => {
  const error = new ApiError({ status: 409, code: 'PERIOD_CLOSED', message: 'The accounting period is closed' });
  assert.equal(getApiErrorMessage(error, 'Request failed'), 'The accounting period is closed');
});

test('uses a safe fallback for unknown failures', () => {
  assert.equal(getApiErrorMessage(new TypeError('Failed to fetch'), 'Could not save voucher'), 'Could not save voucher');
  assert.deepEqual(getApiFieldErrors(new Error('no fields')), {});
});

test('restores an authenticated user from the refresh cookie after an app restart', async () => {
  const originalFetch = globalThis.fetch;
  session.setToken(null);
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), '/api/v1/auth/refresh');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'include');
    return new Response(JSON.stringify({
      accessToken: 'renewed-access-token',
      user: { id: 'user-1', name: 'Ada', username: 'ada', memberships: [] },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const user = await restoreSession();
    assert.deepEqual(user, { id: 'user-1', name: 'Ada', username: 'ada', memberships: [] });
    assert.equal(session.getToken(), 'renewed-access-token');
  } finally {
    globalThis.fetch = originalFetch;
    session.setToken(null);
  }
});

test('clears a stale access token when refresh-session restoration is rejected', async () => {
  const originalFetch = globalThis.fetch;
  session.setToken('expired-access-token');
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 401,
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid or expired',
  }), { status: 401, headers: { 'content-type': 'application/json' } });

  try {
    assert.equal(await restoreSession(), null);
    assert.equal(session.getToken(), null);
  } finally {
    globalThis.fetch = originalFetch;
    session.setToken(null);
  }
});

test('uses an explicit business header instead of a stale stored selection', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let requestHeaders: Headers | undefined;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'removed-business' },
  });
  session.setToken(null);
  globalThis.fetch = async (_input, init) => {
    requestHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    await api('/businesses', { headers: { 'X-Business-Id': 'candidate-business' } });
    assert.equal(requestHeaders?.get('X-Business-Id'), 'candidate-business');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
    session.setToken(null);
  }
});

test('membership validation request omits the stored business header', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let requestHeaders: Headers | undefined;
  const observedHeaders: Headers[] = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'stale-business' },
  });
  session.setToken(null);
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), '/api/v1/businesses');
    requestHeaders = new Headers(init?.headers);
    observedHeaders.push(requestHeaders);
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    await apiWithoutStoredBusinessHeader('/businesses');
    assert.equal(requestHeaders?.has('X-Business-Id'), false);
    await apiWithoutStoredBusinessHeader('/businesses', { headers: { 'X-Business-Id': 'explicit-business' } });
    assert.equal(observedHeaders[1].get('X-Business-Id'), 'explicit-business');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
    session.setToken(null);
  }
});

test('shares one refresh request between startup restoration and an expired API request', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const refreshResolvers: Array<(response: Response) => void> = [];
  let refreshCalls = 0;
  let protectedCalls = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  session.setToken('expired-access-token');
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === '/api/v1/auth/refresh') {
      refreshCalls++;
      return new Promise<Response>(resolve => refreshResolvers.push(resolve));
    }
    if (url === '/api/v1/protected') {
      protectedCalls++;
      return new Response(protectedCalls === 1 ? '' : JSON.stringify({ ok: true }), {
        status: protectedCalls === 1 ? 401 : 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const restored = restoreSession<{ id: string }>();
    const protectedRequest = api<{ ok: boolean }>('/protected');
    await new Promise(resolve => setTimeout(resolve, 0));
    const observedRefreshCalls = refreshCalls;
    refreshResolvers.forEach(resolve => resolve(new Response(JSON.stringify({ accessToken: 'renewed-token', user: { id: 'user-1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    assert.deepEqual(await restored, { id: 'user-1' });
    assert.deepEqual(await protectedRequest, { ok: true });
    assert.equal(observedRefreshCalls, 1);
  } finally {
    refreshResolvers.forEach(resolve => resolve(new Response(JSON.stringify({ accessToken: 'cleanup-token', user: { id: 'cleanup' } }), { status: 200 })));
    globalThis.fetch = originalFetch;
    if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
    session.setToken(null);
  }
});
