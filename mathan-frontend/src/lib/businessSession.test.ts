import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSelectedBusinessId } from './businessSession';
import { Membership } from '../types';

const permissions = { masters: true, transactions: true, reports: true, audit: true, users: true, settings: true };
const memberships: Membership[] = [
  { businessId: 'business-a', businessName: 'Alpha', role: 'admin', permissions },
  { businessId: 'business-b', businessName: 'Beta', role: 'accountant', permissions },
];

test('retains a stored company only when it belongs to the signed-in user', () => {
  assert.equal(resolveSelectedBusinessId('business-b', memberships), 'business-b');
});

test('rejects a stale company selection from another user or a removed membership', () => {
  assert.equal(resolveSelectedBusinessId('business-c', memberships), null);
});

test('keeps the selector open when no company has been selected yet', () => {
  assert.equal(resolveSelectedBusinessId(null, memberships), null);
});
