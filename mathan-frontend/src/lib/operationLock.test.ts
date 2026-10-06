import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationLock } from './operationLock';

test('business creation lock rejects a duplicate submission until the first finishes', () => {
  const lock = createOperationLock();

  assert.equal(lock.tryAcquire(), true);
  assert.equal(lock.tryAcquire(), false);
  lock.release();
  assert.equal(lock.tryAcquire(), true);
});
