import { sleep, trxWrap } from '@edvoapp/common';
import { VM } from '../../..';
import * as utils from './test-utils';
import { MemberAppearanceType } from '../../../behaviors';
import { Model } from '@edvoapp/common';
import { AppDesktop, globalContext } from '../../../viewmodel';
import assert from 'assert';
import { Guard, raceOrFail } from '@edvoapp/util';
import { route } from 'preact-router';

type Millisecond = number;
type Point = VM.Position;
type AssertFn = () => void;
type PauseFn = () => Promise<unknown>;

interface Opt {
  assertion?: AssertFn;
  pause?: PauseFn;
  keyCode?: number;
}

enum Key {
  Space = 'space',
}

export function pause(duration: Millisecond): PauseFn {
  return async () => await sleep(duration);
}

export function grab(root: VM.AppDesktop, src: Point) {
  const mouseDownEvent = new MouseEvent('mousedown', {
    clientX: src.x,
    clientY: src.y,
    relatedTarget: window,
    detail: 1,
  });
  root.context.eventNav.onMouseDown(mouseDownEvent);
}

export async function drag(root: VM.AppDesktop, src: Point, dest: Point, { assertion, pause }: Opt) {
  const dx = (dest.x - src.x) / 10;
  const dy = (dest.y - src.y) / 10;

  let i = 0;
  while (i < 11) {
    const clientX = src.x + dx * i;
    const clientY = src.y + dy * i;
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX,
      clientY,
      relatedTarget: window,
      detail: 1,
    });
    root.context.eventNav.onMouseMove(mouseMoveEvent);

    if (pause) await pause();
    if (assertion && i > 1) assertion();
    i++;
  }
}

export function drop(root: VM.AppDesktop, dest: Point) {
  const mouseUpEvent = new MouseEvent('mouseup', {
    clientX: dest.x,
    clientY: dest.y,
    relatedTarget: window,
    detail: 1,
  });
  root.context.eventNav.onMouseUp(mouseUpEvent);
}

/** @deprecated use mouseUp instad */
export function _click(root: VM.AppDesktop, { x, y }: Point, right = false) {
  const mouseUpEvent = new MouseEvent('mouseup', {
    clientX: x,
    clientY: y,
    relatedTarget: window,
    detail: 1,
    button: right ? 2 : undefined,
  });
  root.context.eventNav.onMouseUp(mouseUpEvent);
}

export function keydown(root: VM.AppDesktop, key: Key) {
  root.context.eventNav.downKeys.add(key);
}

// Clears all down keys.
export function keyup(root: VM.AppDesktop) {
  root.context.eventNav.downKeys.clear();
}

export async function pan(root: VM.AppDesktop, src: Point, dest: Point, { pause }: Opt) {
  keydown(root, Key.Space);
  grab(root, src);
  await drag(root, src, dest, { pause });
  drop(root, dest);
  keyup(root);
}

export async function initRoot(args?: { topicName: string; navToNewTopic?: boolean }): Promise<VM.AppDesktop> {
  await utils.signIn('rasheed@edvo.com', 'password');
  if (args) {
    await utils.createTopic(args.topicName, args.navToNewTopic);
  }
  const root = await utils.getRoot();
  if (!(root instanceof AppDesktop)) throw new Error('Tests are not yet supported in extension environment');
  await root.recursiveLoad();
  return root;
}

export async function signInAndCreateTopic(): Promise<[VM.TopicSpace, string]> {
  const root = await initRoot({ topicName: 'test', navToNewTopic: true });
  const ts = getTopicSpace(root);
  const myUid = globalContext().currentUser.value!.id;
  return [ts, myUid];
}

export function getTopicSpace(root: VM.AppDesktop): VM.TopicSpace {
  const topicspace = root.findChild((n) => n instanceof VM.TopicSpace && n);
  if (!topicspace) throw new Error('topicspace must exist');
  return topicspace;
}

// Given client coords `x` and `y`, creates a member at that position.
export async function createMember(
  x: number,
  y: number,
  w: number,
  h: number,
  type: MemberAppearanceType,
  ts: VM.TopicSpace,
  name?: string,
  seq?: number,
): Promise<VM.Member> {
  const sc = ts.clientCoordsToSpaceCoords({
    x,
    y,
  });

  return utils.createMember(
    type,
    ts,
    {
      x_coordinate: sc.x,
      y_coordinate: sc.y,
      width: w,
      height: h,
    } as Model.TopicSpaceCardState,
    name,
    seq,
  );
}

export async function removeMember(m: VM.Member): Promise<void> {
  await m.archive();
}

// Creates an arrow between two members.
export async function createArrow(a: VM.Member, b: VM.Member): Promise<VM.Arrow> {
  await trxWrap(async (trx) =>
    a.vertex.createEdge({
      role: ['arrow'],
      trx,
      target: b.vertex,
      meta: {},
    }),
  );
  return b.inboundArrows.value[0];
}

// Creates a blobby between two members.
export async function createBlobby(a: VM.Member, b: VM.Member): Promise<VM.ImplicitRelationBlob> {
  await trxWrap(async (trx) =>
    a.vertex.createEdge({
      role: ['implicit'],
      trx,
      target: b.vertex,
      meta: {},
    }),
  );
  return b.inboundBlobs.value[0];
}

/**
 * Creates a publicly-shared topic space.
 *
 * @returns {Object} - An object containing the client coordinates of the mouse move event.
 * @returns {Node} Object.rootNode - The root ViewModelNode
 * @returns {Node} Object.space - The space that got created & shared
 */
export async function createSharedTopic() {
  // regular boilerplate
  let rootNode = await initRoot({ topicName: 'test', navToNewTopic: true });
  let space = getTopicSpace(rootNode);

  let guards = [rootNode, space].map((x) => Guard.unsafe(x));

  // Create the share instruction
  await trxWrap(async (trx) => {
    Model.Priv.Share.create({
      trx,
      vertex: space.vertex,
      data: {
        shareType: 'allow',
        targetUserID: 'PUBLIC',
        shareCategory: 'write',
      },
    });
  });

  // "jiggle" the mouse to make a user presence
  utils.mouseMove({ node: space });
  utils.mouseMove({ node: space, relativeCoords: { x: 100, y: 100 } });

  const userPresence = await raceOrFail(space.userPresence.awaitDefined(), 'User presence not found after 1s');

  const presence = await raceOrFail(
    userPresence.userPresences.awaitItemsInList(),
    'User presence still empty after 1s',
  );

  assert.ok(presence.length > 0, 'Expected at least one user presence after a mouse jiggle');

  guards.forEach((g) => g.release());
  return { rootNode, space };
}
