import { Firebase, Model, sleep, trxWrap } from '@edvoapp/common';
import { VM, DEFAULT_CARD_DIMS, DEFAULT_PORTAL_DIMS, DEFAULT_WEBCARD_DIMS, EventNav } from '../..';
import { AppDesktop, Member, globalContext } from '../../viewmodel';
import { route } from 'preact-router';
import { MemberAppearanceType } from '../../behaviors';
import { Guard, raceOrFail } from '@edvoapp/util';
import assert from 'assert';

// TYPES

export type ClientCoordsArgs =
  | {
      node: VM.Node;
      relativeCoords?: { x: number; y: number };
    }
  | {
      clientCoords: { x: number; y: number };
    };

// SETUP FUNCTIONS

type SetupTopicResponse = {
  root: VM.AppDesktop;
  topicSpace: VM.TopicSpace;
  tsPage: VM.TSPage;
  ctx: VM.ViewModelContext;
  tsVertex: Model.Vertex;
};

let currentSessionLabel: string | null = null;
let currentTopicLabel: string | null = null;
let cachedTopicReturn: SetupTopicResponse | null = null;

interface SetupTopicParams {
  sessionLabel: string;
  topicLabel: string;
  wgpu?: boolean;
}
export async function signInAnon() {
  const authService = window.authService;
  await authService.signInAnonymously();
  return authService;
}

export async function signIn(email: string, password: string) {
  const authService = window.authService;
  const userObs = authService.currentUserVertexObs;
  await authService.signOut();
  await userObs.awaitUndefined();
  await authService.signIn(email, password);
  return authService;
}

export async function signOut() {
  const authService = window.authService;
  await authService.signOut();
  await authService.currentUserVertexObs.awaitUndefined();
  return authService;
}

// not exported
async function cachedSignin(sessionLabel: string = 'default', topicLabel: string = 'Test Topic') {
  // selectively reuse sessions in cases where it might cross-contaminate, reusing by default
  // This is not about guaranteed session reuse, but rather about guaranteeing non-reuse when needed
  if (sessionLabel != currentSessionLabel) {
    const authService = window.authService;
    await authService.signInAnonymously();
    await authService.currentUserVertexObs.awaitHasValue();
  }
}
/**
 *
 * @returns root and default created topicSpace named 'Test Topic'
 */

export async function cachedSetup({ sessionLabel, topicLabel, wgpu = false }: SetupTopicParams) {
  await cachedSignin(sessionLabel, topicLabel);
  // TODO: How do we selectively load (but not unload) the wgpu app controller without reloading the page?

  // Create a new topic, route, and await the VM nodes ONLY if it's not been done, or we need a different topic space
  if (topicLabel != currentTopicLabel) {
    currentTopicLabel = topicLabel;
    // create a new topic
    const tsVertex = await createTopic(topicLabel, true);

    const root = await getRoot();
    const tsPage = await getTSPage(root);
    const topicSpace = await getTopicSpace(root);
    cachedTopicReturn = { root, tsPage, topicSpace, tsVertex, ctx: root.context };
  }

  return cachedTopicReturn!;
}

export async function setup() {
  const root = await getRoot();
  const tsPage = await getTSPage(root);
  const topicSpace = await getTopicSpace(root);
  const ctx = root.context;

  return { root, tsPage, topicSpace, ctx };
}

export async function getRoot(): Promise<VM.AppDesktop> {
  const context = globalContext();
  const rootNode = context.rootNode;
  if (!rootNode) throw new Error('Root node not found');
  if (!(rootNode instanceof VM.AppDesktop)) throw new Error('Tests not supported in extension environment yet');
  await rootNode.load();
  return rootNode;
}

export async function getTSPage(root: VM.AppDesktop): Promise<VM.TSPage> {
  const tsPage = await root.topicSpace.awaitDefined();
  if (!tsPage) throw new Error('TSPage must exist');
  return tsPage;
}

export async function getTopicSpace(root: VM.AppDesktop): Promise<VM.TopicSpace> {
  const topicspace = (await root.topicSpace.awaitDefined()).topicSpace;
  if (!topicspace) throw new Error('topicspace must exist');
  return topicspace;
}

// CREATE FUNCTIONS

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

export async function createUser(label?: string) {
  try {
    const authService = await signOut();
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

/**
 * Creates a member with a default position of 0,0 and default card size, if no meta is supplied.
 * @param memberType - the appearance type of the member
 * @param space
 * @param meta - optional
 * @param name - optional
 * @param seq - optional
 * @returns the created member
 */
export async function createMember(
  memberType: MemberAppearanceType,
  space: VM.TopicSpace,
  meta?: Model.TopicSpaceCardState,
  name?: string,
  seq?: number,
  initialText?: string,
) {
  let length = space.members.length;
  let height, width;
  if (memberType === 'subspace') {
    height = DEFAULT_PORTAL_DIMS.height;
    width = DEFAULT_PORTAL_DIMS.width;
  } else if (memberType === 'browser') {
    height = DEFAULT_WEBCARD_DIMS.height;
    width = DEFAULT_WEBCARD_DIMS.width;
  } else {
    height = DEFAULT_CARD_DIMS.height;
    width = DEFAULT_CARD_DIMS.width;
  }
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
      meta: meta
        ? meta
        : {
            x_coordinate: 0,
            y_coordinate: 0,
            width: width,
            height: height,
          },
    });
    if (memberType === 'stickynote') {
      memberVertex.createProperty({
        trx,
        role: ['body'],
        contentType: 'text/plain',
        initialString: name ?? 'Sticky Note',
      });
    }
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

// Creates an outline with {count} outline items
export async function createOutline(
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

/**
 * Creates a publicly-shared topic space.
 *
 * @returns {Object} - An object containing the client coordinates of the mouse move event.
 * @returns {Node} Object.rootNode - The root ViewModelNode
 * @returns {Node} Object.space - The space that got created & shared
 */
export async function createSharedTopic() {
  // regular boilerplate
  await window.authService.signOut();
  await signIn('rasheed@edvo.com', 'password');
  await createTopic('shared topic', true);

  const root = await getRoot();
  const topicSpace = await getTopicSpace(root);

  let guards = [root, topicSpace].map((x) => Guard.unsafe(x));

  // Create the share instruction
  await trxWrap(async (trx) => {
    Model.Priv.Share.create({
      trx,
      vertex: topicSpace.vertex,
      data: {
        shareType: 'allow',
        targetUserID: 'PUBLIC',
        shareCategory: 'write',
      },
    });
  });

  // "jiggle" the mouse to make a user presence
  mouseMove({ node: topicSpace });
  mouseMove({ node: topicSpace, relativeCoords: { x: 100, y: 100 } });

  const userPresence = await raceOrFail(topicSpace.userPresence.awaitDefined(), 'User presence not found after 1s');

  const presence = await raceOrFail(
    userPresence.userPresences.awaitItemsInList(),
    'User presence still empty after 1s',
  );

  assert.ok(presence.length > 0, 'Expected at least one user presence after a mouse jiggle');

  guards.forEach((g) => g.release());
  return { root, topicSpace };
}

// UTILITY FUNCTIONS

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

function makeEmail(label?: string) {
  const now = Date.now();
  const rand = Math.random().toString().substring(2, 5);
  return `test_${label}_${rand}+${now}@test.com`;
}

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

// MOUSE EVENT FUNCTIONS

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
  destDelta,
  ...clientCoordsArgs
}: {
  middleClick?: boolean;
  rightClick?: boolean;
  detail?: number;
  destDelta?: { x: number; y: number };
} & ClientCoordsArgs): { clientX: number; clientY: number } {
  const eventNav = globalContext().eventNav;
  let mouseUp;

  const { clientX, clientY } = getClientCoords(clientCoordsArgs);

  if (destDelta) {
    mouseUp = new MouseEvent('mousemove', {
      clientX: clientX + destDelta.x,
      clientY: clientY + destDelta.y,
      relatedTarget: window,
      detail,
      button: rightClick ? 2 : undefined,
    });
  } else {
    mouseUp = new MouseEvent('mouseup', {
      clientX,
      clientY,
      relatedTarget: window,
      detail,
      button: middleClick ? 1 : rightClick ? 2 : undefined,
    });
  }
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
  destDelta,
  ...clientCoordsArgs
}: {
  rightClick?: boolean;
  detail?: number;
  destDelta?: { x: number; y: number };
} & ClientCoordsArgs): { clientX: number; clientY: number } {
  const eventNav = globalContext().eventNav;
  let mouseMoveEvent;

  const { clientX, clientY } = getClientCoords(clientCoordsArgs);

  if (destDelta) {
    mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: clientX + destDelta.x,
      clientY: clientY + destDelta.y,
      relatedTarget: window,
      detail,
      button: rightClick ? 2 : undefined,
    });
  } else {
    mouseMoveEvent = new MouseEvent('mousemove', {
      clientX,
      clientY,
      relatedTarget: window,
      detail,
      button: rightClick ? 2 : undefined,
    });
  }
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

/**
 * Sends a drag and drop event to eventNav, using a node's bounding box or a specific coordinate on the page. Can be used for selection box and panning when dragging topicSpace.
 *
 * @param {Object} options - The arguments for the mouse event.
 * @param {VM.Node} [options.node] - The node whose bounding box is used to generate, if provided. node or clientCoords must be specified.
 * @param {Object} [options.clientCoords] - The client coordinates where the mouse event should be performed. node or clientCoords must be specified.
 * @param {number} options.clientCoords.x - The x-coordinate of the mouse event location.
 * @param {number} options.clientCoords.y - The y-coordinate of the mouse event location.
 * @param {Object} [options.relativeCoords] - The relative coordinates where the mouse event should be performed. If not specified, uses the center of the node.
 * @param {number} options.relativeCoords.x - The x-coordinate of the mouse event location relative to the node.
 * @param {number} options.relativeCoords.y - The y-coordinate of the mouse event location relative to the node.
 * @param {VM.Node} [options.destNode] - The node to drop the dragged node onto.
 * @param {Object} [options.destCoords] - The client coordinates where the mouse event should be performed.
 * @param {number} options.destCoords.x - The x-coordinate of the mouse event location.
 * @param {number} options.destCoords.y - The y-coordinate of the mouse event location.
 * @param {Object} [options.destDelta] - The relative coordinates where the mouse event should be performed.
 * @param {number} options.destDelta.x - The x-coordinate of the mouse event location relative to the node.
 * @param {number} options.destDelta.y - The y-coordinate of the mouse event location relative to the node.
 *
 * @returns {Promise<void>} - Promise that resolves when the operation is performed
 */
export async function dragDrop({
  destCoords,
  destNode,
  destDelta,
  rightClick,
  middleClick,
  ...clientCoordsArgs
}: {
  destCoords?: { x: number; y: number };
  destNode?: VM.Node;
  destDelta?: { x: number; y: number };
  rightClick?: boolean;
  middleClick?: boolean;
} & ClientCoordsArgs): Promise<void> {
  const { clientX, clientY } = getClientCoords(clientCoordsArgs);
  const calculatedOptions = {
    clientCoords: {
      x: clientX,
      y: clientY,
    },
    rightClick: rightClick,
    middleClick: middleClick,
  };
  mouseDown(calculatedOptions);

  if (destCoords) {
    mouseMove({ clientCoords: destCoords });
    mouseUp({ clientCoords: destCoords });
  } else if (destNode) {
    mouseMove({ node: destNode });
    mouseUp({ node: destNode });
  } else if (destDelta) {
    mouseMove({
      clientCoords: { x: clientX + destDelta.x, y: clientY + destDelta.y },
    });
    mouseUp({
      clientCoords: { x: clientX + destDelta.x, y: clientY + destDelta.y },
    });
  }
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

// KEYBOARD EVENT FUNCTIONS
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

/**
 *
 * @param eventNavOrigin Node or eventnav
 * @param key for single key press
 * @param text for multiple key press
 */
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
