import { Observable } from '@edvoapp/util';
import assert from 'assert';
import { mock } from '../quarantine/utility/test-utils';

export function subscribeAndUnsubscribe() {
  const obs = new Observable(false);
  const fn1 = mock(() => {});
  const fn2 = mock(() => {});
  const unsub1 = obs.subscribe(fn1);
  obs.subscribe(fn2);
  obs.set(true);
  assert.equal(fn1.calls.length, 1, `Expected fn1 to be called once, but was called ${fn1.calls.length} times`);
  assert.equal(fn2.calls.length, 1, `Expected fn2 to be called once, but was called ${fn2.calls.length} times`);
  unsub1();
  obs.set(false);
  assert.equal(fn1.calls.length, 1, `Expected fn1 not to be called after subscription, but it was`);
  assert.equal(fn2.calls.length, 2, `Expected fn2 to be called twice, but was called ${fn2.calls.length} times`);

  return true;
}

export function subscriberThatUnsubscribesSimple() {
  const obs = new Observable(false);
  const fn1 = mock(() => {});
  const unsub1 = obs.subscribe(fn1);
  const fn2 = mock(() => unsub1());
  const fn3 = mock(() => {});
  obs.subscribe(fn2);
  obs.subscribe(fn3);
  obs.set(true);
  assert.equal(fn1.calls.length, 1, `Expected fn1 to be called once, but was called ${fn1.calls.length} times`);
  assert.equal(fn2.calls.length, 1, `Expected fn2 to be called once, but was called ${fn2.calls.length} times`);
  assert.equal(fn3.calls.length, 1, `Expected fn3 to be called once, but was called ${fn3.calls.length} times`);

  return true;
}

/*
subscribe 5 listeners
configure listener 2 to unsubscribe listener 3
notify (once)
listener 1 is run
listener 2 is run (and unsubs 3)
listener 3 is NOT run
listener 4 is run ( this is erroneously skipped by the current paranoidForEach )
listener 5 is run
 */

export function subscriberThatUnsubscribesComplex() {
  const obs = new Observable(false);
  const fn1 = mock(() => {});
  const fn2 = mock(() => unsub3());
  const fn3 = mock(() => {});
  const fn4 = mock(() => {});
  const fn5 = mock(() => {});
  const unsub1 = obs.subscribe(fn1);
  const unsub2 = obs.subscribe(fn2);
  const unsub3 = obs.subscribe(fn3);
  const unsub4 = obs.subscribe(fn4);
  const unsub5 = obs.subscribe(fn5);
  obs.set(true);
  assert.equal(fn1.calls.length, 1, `Expected fn1 to be called once, but was called ${fn1.calls.length} times`);
  assert.equal(fn2.calls.length, 1, `Expected fn2 to be called once, but was called ${fn2.calls.length} times`);
  assert.equal(fn3.calls.length, 0, `Expected fn3 never to be called, but was called ${fn3.calls.length} times`);

  assert.equal(fn4.calls.length, 1, `Expected fn4 to be called once, but was called ${fn4.calls.length} times`);
  assert.equal(fn5.calls.length, 1, `Expected fn5 to be called once, but was called ${fn5.calls.length} times`);
  return true;
}

export function subscriberThatUnsubscribesSelf() {
  const obs = new Observable(false);
  const fn1 = mock(() => {});
  const fn2 = mock(() => {});
  const fn3 = mock(() => unsub3());
  const fn4 = mock(() => {});
  const fn5 = mock(() => {});
  const unsub1 = obs.subscribe(fn1);
  const unsub2 = obs.subscribe(fn2);
  const unsub3 = obs.subscribe(fn3);
  const unsub4 = obs.subscribe(fn4);
  const unsub5 = obs.subscribe(fn5);
  obs.set(true);
  assert.equal(fn1.calls.length, 1, `Expected fn1 to be called once, but was called ${fn1.calls.length} times`);
  assert.equal(fn2.calls.length, 1, `Expected fn2 to be called once, but was called ${fn2.calls.length} times`);
  assert.equal(fn3.calls.length, 1, `Expected fn3 to be called once, but was called ${fn3.calls.length} times`);

  assert.equal(fn4.calls.length, 1, `Expected fn4 to be called once, but was called ${fn4.calls.length} times`);
  assert.equal(fn5.calls.length, 1, `Expected fn5 to be called once, but was called ${fn5.calls.length} times`);
  obs.set(false);

  assert.equal(fn1.calls.length, 2, `Expected fn1 to be called twice, but was called ${fn1.calls.length} times`);
  assert.equal(fn2.calls.length, 2, `Expected fn2 to be called twice, but was called ${fn2.calls.length} times`);
  assert.equal(fn3.calls.length, 1, `Expected fn3 not to be called again, but was called ${fn3.calls.length} times`);

  assert.equal(fn4.calls.length, 2, `Expected fn4 to be called twice, but was called ${fn4.calls.length} times`);
  assert.equal(fn5.calls.length, 2, `Expected fn5 to be called twice, but was called ${fn5.calls.length} times`);

  return true;
}
