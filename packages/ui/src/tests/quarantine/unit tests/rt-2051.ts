import { Model, Firebase, trxWrapSync, trxWrap } from '@edvoapp/common';
import assert from 'assert';
import * as VM from '../../../viewmodel';
import { initRoot, getTopicSpace, signInAndCreateTopic } from '../utility/helpers-temp';
import { createSticky, createShare, assertPrivs } from '../utility/test-utils';

// works on 875681a6b094b02214df7c7f2b21d9bfecabfe17
export async function RT2051_A() {
  // Create a sticky in a new topic space
  const [ts, myUID] = await signInAndCreateTopic();
  const sticky: VM.Member = await createSticky(null, ts, '');
  const prop = sticky.bodyProperty.value!;

  // Share the TS as write and the sticky should be shared
  const s = await createShare(null, ts.vertex, 'allow', 'PUBLIC', 'write');
  await assertPrivs(prop, [myUID, 'PUBLIC'], [myUID, 'PUBLIC']);

  // Now un-share it and the sticky should be un-shared
  await trxWrap(async (trx) => s.archive(trx));
  await assertPrivs(prop, [myUID], [myUID]);

  // re-share it and the sticky should be shared as read-only
  const s2 = await createShare(null, ts.vertex, 'allow', 'PUBLIC', 'read');
  await assertPrivs(prop, [myUID, 'PUBLIC'], [myUID]);
}

// fails on 875681a6b094b02214df7c7f2b21d9bfecabfe17
export async function RT2051_B() {
  // Create a sticky in a new topic space
  const [ts, myUID] = await signInAndCreateTopic();

  // TODO: Post crunch time
  // const opLog = Transaction.auditLog();
  const sticky = await createSticky(null, ts, '');
  const prop = sticky.bodyProperty.value!;

  // Share the TS as write and the sticky should be shared
  const share = await createShare(null, ts.vertex, 'allow', 'PUBLIC', 'write');
  await assertPrivs(prop, [myUID, 'PUBLIC'], [myUID, 'PUBLIC']);

  // Now un-share it and the sticky should be un-shared
  await trxWrap(async (trx) => {
    share.replace({ trx, data: { shareCategory: 'read' } });
  });

  // re-share it and the sticky should be shared as read-only
  await assertPrivs(prop, [myUID, 'PUBLIC'], [myUID]);

  // TODO:
  // await niceAssert(opLog, [
  // create stickynote vertex
  // + create body prop
  // + create edge
  // + create backref
  // + create share prop on ts vertex
  // + update stickynote edge/backref/prop with new privs
  // NOTABLY: Not duplicates we wouldn't want to see a series of revoke updates and then grants separately
  // This will fail now, but we should do something like Observable.transact(() =>{ archive; create })
  // ])
}
