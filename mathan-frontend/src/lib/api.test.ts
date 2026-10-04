import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, getApiErrorMessage, getApiFieldErrors } from './api';

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
