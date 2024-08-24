import assert from 'assert';
import { route } from 'preact-router';
import * as utils from '../utility/test-utils';
import { awaitUrlChange } from '../utility/test-utils';
import * as VM from '../../../viewmodel';

export async function createTopic() {
  await utils.signIn('rasheed@edvo.com', 'password');
  const vertex = await utils.createTopic('test topic', true);
  const url = `/topic/${vertex.id}`;
  assert.strictEqual(url, window.location.pathname);
  return true;
}

export async function recentTopic() {
  await utils.signIn('rasheed@edvo.com', 'password');
  await utils.createTopic('recentTopic Test', true);

  let root = await utils.getRoot();
  await root.recursiveLoad();
  route('/new-topic');
  await awaitUrlChange('/topic');
  root = await utils.getRoot();
  await root.recursiveLoad();
  const space = root.findChild((n) => n instanceof VM.TopicSpace && n);
  if (!space) throw new Error('Expected a new space to have been navigated to');
  const spaceUrl = window.location.pathname;
  route('/recent-topic');
  await awaitUrlChange('/topic');
  root = await utils.getRoot();
  await root.recursiveLoad();

  assert.equal(
    spaceUrl,
    window.location.pathname,
    'Expected the recent-topic page to navigate to the most recently created topic',
  );

  return true;
}
