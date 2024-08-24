import { Model, TrxRef, sleep, subTrxWrapSync, trxWrap, subTrxWrap, Firebase } from '@edvoapp/common';
import { route } from 'preact-router';
import * as VM from '../../../viewmodel';
import { Action, EventNav, EventsMap } from '../../../service';
import { get, method } from 'lodash';
import { MemberAppearanceType } from '../../../behaviors';
import { AppDesktop, globalContext } from '../../../viewmodel';
import { Behaviors, getTopicSpace } from '../../..';
import { Guard, pretty_stack_with_snippets, race, raceOrFail, useSessionManager } from '@edvoapp/util';
import assert from 'assert';

function makeEmail(label?: string) {
  const now = Date.now();
  const rand = Math.random().toString().substring(2, 5);
  return `test_${label}_${rand}+${now}@test.com`;
}

export async function createUser(label?: string) {
  try {
    const authService = window.authService;
    await authService.signOut();
    await authService.currentUserVertexObs.awaitUndefined();
    const password = `password`;
    const fullName = 'Test Topic Creator';
    const email = makeEmail(label);

    const userID = await authService.createAccount({
      fullName,
      email,
      password,
      inviteCode: 'foo',
    });

    await authService.currentUserVertexObs.awaitDefined();

    return { email, password, fullName, userID };
  } catch (err) {
    console.error('err', err);
    throw new Error('Failed to create user');
  }
}

export async function signInAnon() {
  const authService = window.authService;
  await authService.signInAnonymously();
}

export async function signIn(email: string, password: string) {
  const authService = window.authService;
  const userObs = authService.currentUserVertexObs;
  await authService.signOut();
  await userObs.awaitUndefined();
  await authService.signIn(email, password);
}

export async function getRoot(): Promise<AppDesktop> {
  const context = globalContext();
  const rootNode = context.rootNode;
  if (!rootNode) throw new Error('Root node not found');
  if (!(rootNode instanceof AppDesktop)) throw new Error('Tests not supported in extension environment yet');
  await rootNode.load();
  return rootNode;
}

export async function setup() {
  const root = await getRoot();
  await createTopic('Test Topic', true);
  const topicSpace = getTopicSpace(root);
  await topicSpace.waitForDomElement(); // wait for it to render
  return { root, topicSpace };
}

export async function createTopic(name: string, nav?: boolean) {
  try {
    const vertex = await trxWrap(async (trx) => Model.Vertex.create({ name, trx }));
    if (nav) {
      const topicURL = `/topic/${vertex.id}`;
      route(topicURL);
      await awaitUrlChange(topicURL);
    }
    return vertex;
  } catch (err) {
    console.error('err', err);
    throw new Error('Failed to create topic');
  }
}

export async function createMember(
  memberType: MemberAppearanceType,
  space: VM.TopicSpace,
  meta: Model.TopicSpaceCardState,
  name?: string,
  seq?: number,
) {
  let length = space.members.length;
  const memberVertex = await trxWrap(async (trx) => {
    const memberVertex = Model.Vertex.create({ trx }).leak();
    const role = ['member-of', 'tag'];
    await memberVertex.setJsonPropValues(
      'appearance',
      {
        type: memberType,
      },
      trx,
    );
    memberVertex.createEdge({
      trx,
      role,
      target: space.vertex,
      seq: seq ?? 1,
      meta,
    });
    return memberVertex;
  });
  await space.members.awaitItemsInList(length + 1);

  const member = space.members.findChild((n) => n instanceof VM.Member && n.vertex === memberVertex && n);
  if (!member) throw new Error('Member not found');
  if (name && memberType !== 'stickynote' && memberType !== 'clean') {
    const header = await member.header.awaitDefined();
    header.nameTagField.topicName.textField.insertString(name);
  }
  return member;
}

/** creates a sticky in a topic space.
 * NOTE: It's your responsiblity to keep the topicspace alive until this yields a value.
 * we are intentionally not guarding anything here to avoid influencing (helping or hurting) results */
export async function createSticky(
  trx: TrxRef | null,
  ts: VM.TopicSpace,
  text: string,
  meta?: Model.TopicSpaceCardState,
) {
  const sv = subTrxWrapSync(trx, (trx) => {
    const sv = Model.Vertex.create({ trx });
    sv.createBodyTextProperty({ initialText: text, trx });
    sv.createEdge({
      trx,
      role: ['member-of'],
      target: ts.vertex,
      seq: 1,
      meta: meta ?? {},
    });
    return sv;
  });

  const member = await ts.members.awaitCondition((members) => members.filter((m) => m.vertex === sv)[0]);
  if (member === false) {
    throw 'sanity error - members collection went away';
  }
  return member;
}

export async function createShare(
  trx: TrxRef | null,
  vertex: Model.Vertex,
  shareType: 'allow' | 'deny',
  targetUserID: string,
  shareCategory: 'read' | 'write',
) {
  return subTrxWrap(
    trx,
    async (trx) =>
      Model.Priv.Share.create({
        trx,
        data: {
          shareType,
          targetUserID,
          shareCategory,
          // TODO(Frank): Add contextId for members in the future
          //contextId: node instanceof BranchNode ? node.backref : undefined
        },
        vertex,
      }),
    'createShare',
  );
}

export async function assertPrivs(prop: Model.Property, recipientIDs: string[], writeIDs: string[]): Promise<void> {
  try {
    assert.deepEqual(
      prop.privs.value.recipientID.sort(),
      recipientIDs.sort(),
      'recipientIDs did not match. Expected ' +
        recipientIDs.sort().join(',') +
        ' and observed ' +
        prop.privs.value.recipientID.sort().join(),
    );
    assert.deepEqual(
      prop.privs.value.writeID.sort(),
      writeIDs.sort(),
      'writeIDs did not match. Expected ' +
        writeIDs.sort().join(',') +
        ' and observed ' +
        prop.privs.value.writeID.sort().join(),
    );
  } catch (e) {
    const stack = await pretty_stack_with_snippets(e, 10, 1);
    console.error('MEOW', stack);
    throw new Error(`${e.message} ${stack}`);
  }
  // http://localhost:4000/@fs/Users/rasheedbustamam/Documents/coding/monorepo/packages/ui/dist/index.js?t=1712609558939:6422:7
  console.log('WOOF');
}

// Creates an outline with {count} outline items
export async function create_outline(
  space: VM.TopicSpace,
  meta: Model.TopicSpaceCardState,
  count = 3,
  name?: string,
  seq?: number,
) {
  const member = await createMember('normal', space, meta, name, seq);
  const body = await raceOrFail(member.body.awaitDefined(), 'Expected member body to be defined');
  const outline = await raceOrFail(body.outline.awaitDefined(), 'Expected member with type normal to have an outline');
  if (count > 0) {
    await trxWrap(async (trx) => {
      for (const i of Array(count).keys()) {
        const newBullet = Model.Vertex.create({ trx });
        newBullet.createProperty({
          trx,
          role: ['appearance'],
          contentType: 'application/json',
          initialString: JSON.stringify({
            type: 'bullet',
          }),
        });
        newBullet.createBodyTextProperty({
          trx,
          initialText: `Test bullet ${i}`,
        });
        newBullet.createEdge({
          trx,
          target: outline.vertex,
          role: ['category-item'],
          seq,
          meta: {},
        });
      }
    });
  }
  return outline;
}

export async function type(
  eventNavOrigin: VM.Node | EventNav,
  { key, text }: { text: string; key?: never } | { text?: never; key: string },
) {
  const eventNav = eventNavOrigin instanceof EventNav ? eventNavOrigin : eventNavOrigin.context.eventNav;
  const currentFocus = eventNav.focusState.currentFocus;
  const viewNode = currentFocus ?? eventNav.rootNode;

  if (key) {
    const kbdEvt = new KeyboardEvent('keydown', { key });
    eventNav.handleEvent('handleKeyDown', viewNode, kbdEvt);
  } else if (text) {
    for (const key of text) {
      const kbdEvt = new KeyboardEvent('keydown', { key });
      eventNav.handleEvent('handleKeyDown', viewNode, kbdEvt);
    }
  } else {
    throw new Error('must supply key or text');
  }
}

// export type ModifierKeys = 'ctrl' | 'alt' | 'shift';
// export function keypress(keys: string, modifier?: ModifierKeys[]) {
//   // get eventnav from globalContext
//   const eventNav = globalContext().eventNav;

//   const ctrlKey = modifier?.includes('ctrl');
//   const altKey = modifier?.includes('alt');
//   const shiftKey = modifier?.includes('shift');

//   modifier?.forEach((key) => {
//     const keydown = new KeyboardEvent('keydown', {
//       key: keys,
//       ctrlKey,
//       altKey,
//       shiftKey,
//     });
//     window.dispatchEvent(keydown);
//   });
// }

export async function pinch(
  node: VM.Node,
  {
    dir = 'in',
    coords,
    center,
  }: {
    dir: 'in' | 'out'; // pinch IN means o--><--o, pinch OUT means <--oo-->
    coords?: { x: number; y: number };
    center?: boolean;
  },
) {
  const eventNav = node.context.eventNav;
  const rect = node.clientRect ?? node.clientRectObs.value;
  const { x, y, width, height } = rect;
  if (!coords && center === undefined) throw new Error('Need to supply either coords or center params');
  const clientX = center ? x + width / 2 : coords?.x; // if center is true, then coords must be defined, otherwise the above error will throw
  const clientY = center ? y + height / 2 : coords?.y;
  if (clientX === undefined || clientY === undefined) throw new Error('Invalid coords');

  const mult = dir === 'in' ? 1 : -1;

  const wheelEvent = new WheelEvent('wheel', {
    ctrlKey: true,
    clientX,
    clientY,
    // big delta
    deltaX: 20.1 * mult,
    deltaY: 20.1 * mult,
    relatedTarget: window,
  });
  eventNav.onWheel(wheelEvent);
}

export async function wheel(
  node: VM.Node,
  {
    coords,
    times,
    center,
  }: {
    coords?: { x: number; y: number };
    times?: number;
    center?: boolean;
  },
) {
  const eventNav = node.context.eventNav;
  let i = 0;
  times = times ?? 100;

  const rect = node.clientRect ?? node.clientRectObs.value;
  const { x, y, width, height } = rect;
  if (!coords && !center) throw new Error('Must specify coords or center');
  const clientX = center ? x + width / 2 : coords?.x; // if center is true, then coords must be defined, otherwise the above error will throw
  const clientY = center ? y + height / 2 : coords?.y;
  if (clientX === undefined || clientY === undefined) throw new Error('Invalid coords');

  while (i < times + 1) {
    const wheelEvent = new WheelEvent('wheel', {
      clientX,
      clientY,
      deltaMode: 0,
      deltaX: -2,
      deltaY: -2,
      relatedTarget: window,
    });
    eventNav.onWheel(wheelEvent);
    i++;
  }
}

/** @deprecated use mouseDown instead
 *
 */
export async function _mouseDown(
  node: VM.Node,
  {
    rightClick,
    center,
    coords,
  }: {
    rightClick?: boolean;
    center?: boolean;
    coords?: { x: number; y: number };
  },
) {
  const rect = node.clientRect ?? node.clientRectObs.value;
  const { x, y, width, height } = rect;
  if (!coords && !center) throw new Error('Must specify coords or center');
  const clientX = center ? x + width / 2 : coords?.x; // if center is true, then coords must be defined, otherwise the above error will throw
  const clientY = center ? y + height / 2 : coords?.y;
  if (clientX === undefined || clientY === undefined) throw new Error('Invalid coords');
  const mouseDownEvent = new MouseEvent('mousedown', {
    clientX,
    clientY,
    relatedTarget: window,
    detail: 1,
    button: rightClick ? 2 : undefined,
  });
  node.context.eventNav.onMouseDown(mouseDownEvent);

  return { clientX, clientY };
}

/** @deprecated use mouseMove instead
 *
 */
export async function _mouseMove(
  node: VM.Node,
  {
    src,
    delta,
    times,
    rightClick,
  }: {
    src: { x: number; y: number };
    delta: { x: number; y: number };
    times?: number;
    rightClick?: boolean;
  },
) {
  const eventNav = node.context.eventNav;
  let i = 0;
  times = times ?? 10;
  while (i < times + 1) {
    const clientX = src.x + (delta.x / times) * i;
    const clientY = src.y + (delta.y / times) * i;
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX,
      clientY,
      relatedTarget: window,
      button: rightClick ? 2 : undefined,
    });
    eventNav.onMouseMove(mouseMoveEvent);
    // This sleep may not be ok
    await sleep(10);
    i++;
  }
  return { x: src.x + delta.x, y: src.y + delta.y };
}

/** @deprecated use mouseUp instead
 *
 */
export async function _mouseUp(
  node: VM.Node,
  {
    dest,
    rightClick,
    center,
  }: {
    dest?: { x: number; y: number };
    rightClick?: boolean;
    center?: boolean;
  },
) {
  const eventNav = node.context.eventNav;
  const rect = node.clientRect ?? node.clientRectObs.value;
  if (!center && !dest) throw new Error('Must supply center or dest');
  const coords = center ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : dest;
  if (!coords) throw new Error('Must supply center or dest');
  const mouseUpEvent = new MouseEvent('mouseup', {
    clientX: coords.x,
    clientY: coords.y,
    relatedTarget: window,
    detail: 1,
    button: rightClick ? 2 : undefined,
  });
  eventNav.onMouseUp(mouseUpEvent);
}

export async function dragDrop(rootNode: VM.Node, src: { x: number; y: number }, dest: { x: number; y: number }) {
  const eventNav = rootNode.context.eventNav;
  const mouseDownEvent = new MouseEvent('mousedown', {
    clientX: src.x,
    clientY: src.y,
    relatedTarget: window,
  });
  eventNav.onMouseDown(mouseDownEvent);

  await _mouseMove(rootNode, {
    src,
    delta: {
      x: dest.x - src.x,
      y: dest.y - src.y,
    },
  });
  await _mouseUp(rootNode, { dest });
}

/** @deprecated use mouseDown or related methods */
export function dispatchEventNavEvent(rootNode: VM.Node, eventType: EventsMap, node: VM.Node, data = {}) {
  const event = new Event(eventType, {
    bubbles: true,
    cancelable: true,
    ...data,
  });
  rootNode.context.eventNav.handleEvent(eventType, node, event);
}

export function getContextMenuAction(rootNode: VM.AppDesktop, label: string): Action | null | void {
  const { value } = rootNode.contextMenu.menuState;
  if (!value || !value.actionGroups?.length) return null;
  return value.actionGroups.flatMap((g) => g.actions).find((a: Action) => a.label?.includes(label));
}

const sessionId = '9876';
const deviceContextId = '1234';
const dummyTabs = [
  {
    url: 'https://stackoverflow.com/questions',
    faviconUrl: 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico?v=ec617d715196',
    title: 'Newest Questions on Stack Overflow',
  },
  {
    url: 'https://apple.com/',
    faviconUrl:
      'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico?v=ec617d715196https://www.apple.com/favicon.icopple',
  },
];

export async function createDummyBrowserContexts() {
  try {
    const win = await trxWrap(async (trx) =>
      Model.BrowserContext.create({
        trx,
        type: 'window',
        windowId: 123,
        deviceContextId,
        sessionId,
        originator: 'ext',
        onClose: () => {},
      }),
    );

    const tabs = await trxWrap(async (trx) => {
      dummyTabs.map(({ url, title, faviconUrl }, idx) =>
        Model.BrowserContext.create({
          trx,
          type: 'tab',
          url,
          faviconUrl,
          seq: idx + 1,
          deviceContextId,
          pinned: false,
          title,
          parent: win,
          originator: 'ext',
          // Attachment items
          onClose: () => {},
          sessionId,
          tabId: Math.floor(Math.random() * 100),
        }),
      );
    });
  } catch (err) {
    console.error('err', err);
    throw new Error('Failed to create dummy contexts');
  }
}

export function awaitUrlChange(match?: string): Promise<void> {
  let done: null | (() => void) = null;
  function handleChange() {
    if (!match || (match && window.location.href.includes(match))) {
      done?.();
      window.removeEventListener('pushstate', handleChange);
      window.removeEventListener('replacestate', handleChange);
    }
  }
  window.addEventListener('pushstate', handleChange);
  window.addEventListener('replacestate', handleChange);
  if (match && window.location.href.includes(match)) return Promise.resolve();
  return new Promise((resolve) => {
    done = resolve;
  });
}

/*
  Canonical keyboard event helpers
 */

export function keyDown(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
}

export function keyUp(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, ...init }));
}

export async function keyPress(key: string, init: KeyboardEventInit = {}) {
  keyDown(key, init);
  await sleep(10);
  keyUp(key, init);
  await sleep(10);
}

export async function typeKeys(text: string) {
  for (const key of text) {
    await keyPress(key);
  }
}

export type ClientCoordsArgs =
  | {
      node: VM.Node;
      relativeCoords?: { x: number; y: number };
    }
  | {
      clientCoords: { x: number; y: number };
    };
/**
 * Returns the client coordinates based on the given parameters.
 *
 * @param {Object} config - The configuration object.
 * @param {VM.Node} [config.node] - The node for which to retrieve the client coordinates.
 * @param {Object} [config.clientCoords] - The absolute client coordinates.
 * @param {Object} [config.relativeCoords] - The relative client coordinates.
 * @returns {Object} The client coordinates.
 * @throws {Error} Throws an error if a coordinate is outside the node's bounding box, or if neither node nor clientCoords are specified.
 */
function getClientCoords(args: ClientCoordsArgs): {
  clientX: number;
  clientY: number;
} {
  if ('clientCoords' in args) {
    let { x, y } = args.clientCoords;
    return {
      clientX: x,
      clientY: y,
    };
  }
  const { node, relativeCoords } = args;

  const rect = node.clientRect ?? node.clientRectObs.value;
  if (relativeCoords) {
    const clientX = rect.x + relativeCoords.x;
    const clientY = rect.y + relativeCoords.y;

    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom)
      throw new Error("Got a coordinate outside of the node's bounding box");

    return { clientX, clientY };
  }

  const clientX = rect.x + rect.width / 2;
  const clientY = rect.y + rect.height / 2;
  return { clientX, clientY };
}

/**
 * Sends a mouseDown event to eventNav, using a node's bounding box or a specific coordinate on the page.
 *
 * @param {Object} options - The arguments for the mouse event.
 * @param {VM.Node} [options.node] - The node whose bounding box is used to generate, if provided. node or clientCoords must be specified.
 * @param {Object} [options.clientCoords] - The client coordinates where the mouse event should be performed. node or clientCoords must be specified.
 * @param {number} options.clientCoords.x - The x-coordinate of the mouse event location.
 * @param {number} options.clientCoords.y - The y-coordinate of the mouse event location.
 * @param {Object} [options.relativeCoords] - The relative coordinates where the mouse event should be performed. If not specified, uses the center of the node.
 * @param {number} options.relativeCoords.x - The x-coordinate of the mouse event location relative to the node.
 * @param {number} options.relativeCoords.y - The y-coordinate of the mouse event location relative to the node.
 * @param {boolean} [options.rightClick=false] - Indicates whether the mouse event should be a right click.
 * @param {number} [options.detail=1] - Mouse Event detail. 1 is single-click (default), 2 is double-click, 3 is triple-click
 *
 * @returns {Object} - An object containing the client coordinates of the mouse move event.
 * @returns {number} Object.clientX - The x coordinate of the mouse move event.
 * @returns {number} Object.clientY - The y coordinate of the mouse move event.
 */
export function mouseDown({
  middleClick,
  rightClick,
  detail = 1,
  ...clientCoordsArgs
}: {
  middleClick?: boolean;
  rightClick?: boolean;
  detail?: number;
} & ClientCoordsArgs): { clientX: number; clientY: number } {
  const eventNav = globalContext().eventNav;

  const { clientX, clientY } = getClientCoords(clientCoordsArgs);
  const mouseDownEvent = new MouseEvent('mousedown', {
    clientX,
    clientY,
    relatedTarget: window,
    detail,
    button: middleClick ? 1 : rightClick ? 2 : undefined,
  });
  eventNav.onMouseDown(mouseDownEvent);

  return { clientX, clientY };
}

/**
 * Sends a mouseUp event to eventNav, using a node's bounding box or a specific coordinate on the page.
 *
 * @param {Object} options - The arguments for the mouse event.
 * @param {VM.Node} [options.node] - The node whose bounding box is used to generate, if provided. node or clientCoords must be specified.
 * @param {Object} [options.clientCoords] - The client coordinates where the mouse event should be performed. node or clientCoords must be specified.
 * @param {number} options.clientCoords.x - The x-coordinate of the mouse event location.
 * @param {number} options.clientCoords.y - The y-coordinate of the mouse event location.
 * @param {Object} [options.relativeCoords] - The relative coordinates where the mouse event should be performed. If not specified, uses the center of the node.
 * @param {number} options.relativeCoords.x - The x-coordinate of the mouse event location relative to the node.
 * @param {number} options.relativeCoords.y - The y-coordinate of the mouse event location relative to the node.
 * @param {boolean} [options.rightClick=false] - Indicates whether the mouse event should be a right click.
 * @param {number} [options.detail=1] - Mouse Event detail. 1 is single-click (default), 2 is double-click, 3 is triple-click

 *
 * @returns {Object} - An object containing the client coordinates of the mouse move event.
 * @returns {number} Object.clientX - The x coordinate of the mouse move event.
 * @returns {number} Object.clientY - The y coordinate of the mouse move event.
 */
export function mouseUp({
  middleClick,
  rightClick,
  detail = 1,
  ...clientCoordsArgs
}: {
  middleClick?: boolean;
  rightClick?: boolean;
  detail?: number;
} & ClientCoordsArgs): { clientX: number; clientY: number } {
  const eventNav = globalContext().eventNav;

  const { clientX, clientY } = getClientCoords(clientCoordsArgs);
  const mouseUp = new MouseEvent('mouseup', {
    clientX,
    clientY,
    relatedTarget: window,
    detail,
    button: middleClick ? 1 : rightClick ? 2 : undefined,
  });
  eventNav.onMouseUp(mouseUp);

  return { clientX, clientY };
}

/**
 * Sends a mouseMove event to eventNav, using a node's bounding box or a specific coordinate on the page.
 *
 * @param {Object} options - The arguments for the mouse event.
 * @param {VM.Node} [options.node] - The node whose bounding box is used to generate, if provided. node or clientCoords must be specified.
 * @param {Object} [options.clientCoords] - The client coordinates where the mouse event should be performed. node or clientCoords must be specified.
 * @param {number} options.clientCoords.x - The x-coordinate of the mouse event location.
 * @param {number} options.clientCoords.y - The y-coordinate of the mouse event location.
 * @param {Object} [options.relativeCoords] - The relative coordinates where the mouse event should be performed. If not specified, uses the center of the node.
 * @param {number} options.relativeCoords.x - The x-coordinate of the mouse event location relative to the node.
 * @param {number} options.relativeCoords.y - The y-coordinate of the mouse event location relative to the node.
 * @param {boolean} [options.rightClick=false] - Indicates whether the mouse event should be a right click.
 * @param {number} [options.detail=1] - Mouse Event detail. 1 is single-click (default), 2 is double-click, 3 is triple-click
 *
 * @returns {Object} - An object containing the client coordinates of the mouse move event.
 * @returns {number} Object.clientX - The x coordinate of the mouse move event.
 * @returns {number} Object.clientY - The y coordinate of the mouse move event.
 */
export function mouseMove({
  rightClick,
  detail = 1,
  ...clientCoordsArgs
}: {
  rightClick?: boolean;
  detail?: number;
} & ClientCoordsArgs): { clientX: number; clientY: number } {
  const eventNav = globalContext().eventNav;

  const { clientX, clientY } = getClientCoords(clientCoordsArgs);
  const mouseMoveEvent = new MouseEvent('mousemove', {
    clientX,
    clientY,
    relatedTarget: window,
    detail,
    button: rightClick ? 2 : undefined,
  });
  eventNav.onMouseMove(mouseMoveEvent);

  return { clientX, clientY };
}

/**
 * Sends a mousedown event to eventNav, waits 20ms, then a mouseup event, using a node's bounding box or a specific coordinate on the page.
 *
 * @param {Object} options - The arguments for the mouse event.
 * @param {VM.Node} [options.node] - The node whose bounding box is used to generate, if provided. node or clientCoords must be specified.
 * @param {Object} [options.clientCoords] - The client coordinates where the mouse event should be performed. node or clientCoords must be specified.
 * @param {number} options.clientCoords.x - The x-coordinate of the mouse event location.
 * @param {number} options.clientCoords.y - The y-coordinate of the mouse event location.
 * @param {Object} [options.relativeCoords] - The relative coordinates where the mouse event should be performed. If not specified, uses the center of the node.
 * @param {number} options.relativeCoords.x - The x-coordinate of the mouse event location relative to the node.
 * @param {number} options.relativeCoords.y - The y-coordinate of the mouse event location relative to the node.
 * @param {boolean} [options.rightClick=false] - Indicates whether the mouse event should be a right click.
 * @param {number} [options.detail=1] - Mouse Event detail. 1 is single-click (default), 2 is double-click, 3 is triple-click
 * @returns {Promise<void>} - Promise that resolves when the operation is performed
 */
export async function click({
  rightClick,
  detail,
  ...clientCoordsArgs
}: {
  rightClick?: boolean;
  detail?: number;
} & ClientCoordsArgs): Promise<void> {
  const { clientX, clientY } = getClientCoords(clientCoordsArgs);
  const calculatedOptions = {
    clientCoords: {
      x: clientX,
      y: clientY,
    },
    rightClick,
    detail,
  };
  mouseDown(calculatedOptions);
  await sleep(20);
  mouseUp(calculatedOptions);
}

export async function awaitSessionManagerChange(cb: () => Promise<void>) {
  const sm = useSessionManager();
  const smObs = sm.status();
  const currentVal = smObs.get();

  let done: () => void;

  const prom = new Promise<void>((resolve) => {
    done = resolve;
  });

  const unsub = smObs.subscribe((val: any) => {
    // if the value is different, then resolve.
    if (currentVal !== val) done();
  });
  await cb();
  const v = await race(prom, 5_000, true);
  unsub();
  return v;
}

export async function awaitTillSessionManagerValue<R>(
  cb: (value: string) => { value: R } | (undefined | null | false),
): Promise<R> {
  const sm = useSessionManager();
  const smObs = sm.status();
  const currentVal = smObs.get();

  const result = cb(currentVal);
  if (result) {
    return Promise.resolve(result.value);
  }

  return new Promise((resolve) => {
    const unsub = smObs.subscribe(() => {
      const result = cb(smObs.get());
      if (result) {
        // call the callback and resolve the promise
        unsub();
        resolve(result.value);
      }
    });
  });
}

export async function archiveItem(node: VM.Member | VM.TopicSpace) {
  const label = node instanceof VM.Member ? 'Card' : 'Page';
  await click({ node, rightClick: true });
  const ctxMenu = (node.root as VM.AppDesktop).contextMenu;
  const actionGroups = await ctxMenu.actionGroups.awaitItemsInList();
  const nodeActionGroup = actionGroups.find((x) => x.actionGroup.label === label);
  assert.ok(nodeActionGroup, `Expected ${label} action group to be in context menu when right-clicking on a ${label}`);
  const nodeActions = await raceOrFail(
    nodeActionGroup.actions.awaitItemsInList(),
    `Expected items to be in ${label} action group`,
  );
  const nodeArchiveAction = nodeActions.find((x) => x.action.label === 'Archive');
  console.debug('NODE ACTIONS', nodeActions, nodeArchiveAction);
  assert.ok(nodeArchiveAction, `Expected Archive action to be in ${label} action group`);
  await click({ node: nodeArchiveAction });
}

function patchHistoryMethod(method: 'pushState' | 'replaceState') {
  const history = window.history;
  const original = history[method];

  history[method] = function (state) {
    // @ts-ignore
    const result = original.apply(this, arguments);
    const event = new Event(method.toLowerCase());

    (event as any).state = state;

    window.dispatchEvent(event);

    return result;
  };
}

patchHistoryMethod('pushState');
patchHistoryMethod('replaceState');

interface MockFn {
  (...args: any[]): any;
  calls: any[][];
  mockImplementation: (func: (...args: any[]) => any) => void;
}

function mockFn(): MockFn {
  let implementation = (...args: any[]) => {};

  const fn: MockFn = Object.assign(
    (...args: any[]): any => {
      fn.calls.push(args);
      return implementation(...args);
    },
    {
      calls: [] as any[][],
      mockImplementation(func: (...args: any[]) => any) {
        implementation = func;
      },
    },
  );

  return fn;
}

export function mock<F extends (...args: any[]) => any>(fn: F) {
  const f = mockFn();
  f.mockImplementation(fn);
  return f;
}
