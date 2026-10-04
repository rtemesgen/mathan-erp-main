import test from 'node:test';
import assert from 'node:assert/strict';
import { positiveNumber, required, validateDateRange } from './validation';

test('required rejects whitespace-only values', () => {
  assert.equal(required('   ', 'Business name'), 'Business name is required');
});

test('positiveNumber rejects zero and negative values', () => {
  assert.equal(positiveNumber('0', 'Amount'), 'Amount must be greater than zero');
  assert.equal(positiveNumber('-2', 'Amount'), 'Amount must be greater than zero');
  assert.equal(positiveNumber('12.50', 'Amount'), undefined);
});

test('validateDateRange rejects an end date before the start date', () => {
  assert.equal(validateDateRange('2026-03-10', '2026-03-01'), 'End date must be on or after start date');
  assert.equal(validateDateRange('2026-03-01', '2026-03-10'), undefined);
});
