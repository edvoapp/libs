import { ActionGroup, Behavior, DispatchStatus, EventNav } from '..';
import * as VM from '../viewmodel';
import { trxWrapSync } from '@edvoapp/common';
import { toast } from 'react-toastify';
import { WeakProperty, debug } from '@edvoapp/util';

const MIN_SCALE = 0.01;
const MAX_SCALE = 4;
const THRESHOLD = 5;

type TouchOrWheelEvent = WheelEvent & {
  wheelDeltaY?: number;
  wheelDeltaX?: number;
};

export class Plane extends Behavior {
  @WeakProperty
  activeNode: VM.TopicSpace | null = null;
  moved = false;
  startPos: VM.Position | null = null;

  getActions(originNode: VM.Node): ActionGroup[] {
    const space = originNode.closestInstance(VM.TopicSpace);
    if (!space) return [];

    const label = 'Space';

    return [
      {
        label,
        actions: [
          {
            label: 'Save Default View',
            apply: () => void space.saveDefaultView(),
          },
        ],
      },
    ];
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    if (!this.activeNode && e.code === 'Space') document.documentElement.style.cursor = 'grab';
    return 'continue';
  }

  handleKeyUp(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    document.documentElement.style.cursor = 'default';
    return 'continue';
  }

  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const node = originNode.closestInstance(VM.TopicSpace);
    if (!node) return 'decline';
    if (this.activeNode && this.activeNode !== node) {
      this.save(eventNav);
    }
    this.activeNode = node;
    const focusCoords = node.clientCoordsToSpaceCoords({
      x: e.clientX,
      y: e.clientY,
    });
    node.focusCoordinates.set(focusCoords);

    const isRightClick = eventNav.isRightClick(e);
    const spacePressed = eventNav.downKeys.has('space');
    if (!spacePressed && !isRightClick) return 'decline';
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseUp', 'handleMouseMove']);
    this.startPos = node.clientCoordsToSpaceCoords({
      x: e.clientX,
      y: e.clientY,
    });
    node.panning.set(false);
    return 'stop';
  }

  handleRightMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    // we can use closest instance here since we explicitly want to pan on right-mouse
    const node = originNode.closestInstance(VM.TopicSpace);
    if (!node || !allowedToPanOrZoom(node)) return 'decline';

    this.activeNode = node;
    const focusCoords = node.clientCoordsToSpaceCoords({
      x: e.clientX,
      y: e.clientY,
    });
    node.focusCoordinates.set(focusCoords);
    eventNav.setGlobalBehaviorOverrides(this, ['handleRightMouseUp', 'handleRightMouseMove']);
    this.startPos = node.clientCoordsToSpaceCoords({
      x: e.clientX,
      y: e.clientY,
    });
    node.panning.set(false);
    return 'stop';
  }

  handleMouseMove(eventNav: EventNav, e: MouseEvent, node: VM.Node): DispatchStatus {
    return this.handleMousePan(eventNav, e, node);
  }

  handleRightMouseMove(eventNav: EventNav, e: MouseEvent, node: VM.Node): DispatchStatus {
    return this.handleMousePan(eventNav, e, node);
  }

  handleMousePan(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    let activeNode = this.activeNode;
    if (!activeNode || !this.startPos) return 'decline';
    const spaceRect = activeNode.clientRectObs.value;
    const { x, y } = this.startPos;
    const deltaX = e.clientX - x;
    const deltaY = e.clientY - y;
    const startCoords = this.startPos;
    const dbViewportState = activeNode.dbViewportState.value;
    const focusCoords = activeNode.clientCoordsToSpaceCoords(
      {
        x: e.clientX,
        y: e.clientY,
      },
      dbViewportState,
    );
    activeNode.focusCoordinates.set(focusCoords);
    if (Math.abs(deltaX) < THRESHOLD && Math.abs(deltaY) < THRESHOLD) {
      return 'decline';
    }
    const { x: startX, y: startY } = startCoords;
    const { x: coordsX, y: coordsY } = focusCoords;
    const deltaCoordsX = startX - coordsX;
    const deltaCoordsY = startY - coordsY;
    // use DB viewport state because viewport state will return WIP state, and we want to apply deltas to
    // the original viewport stored in the DB, OR whatever nextVPS was set by another operation
    const { x: vpx, y: vpy } = dbViewportState ?? { x: 0, y: 0 };

    // but we still want to copy over the old viewport state in case we did an operation that hasn't yet saved.
    const viewportStateObs = activeNode.viewportState;
    const viewportState = viewportStateObs.value ?? dbViewportState;
    const vps = clampViewportState(
      {
        ...viewportState,
        x: vpx + deltaCoordsX,
        y: vpy + deltaCoordsY,
      },
      spaceRect,
    );
    viewportStateObs.set(vps);
    this.moved = true;
    activeNode.panning.set(true);
    document.documentElement.style.cursor = activeNode.cursor;
    return 'stop';
  }

  handleMouseUp(eventNav: EventNav, e: MouseEvent): DispatchStatus {
    return this.handlePanStop(eventNav, e);
  }
  handleRightMouseUp(eventNav: EventNav, e: MouseEvent): DispatchStatus {
    return this.handlePanStop(eventNav, e);
  }

  handlePanStop(eventNav: EventNav, e: MouseEvent): DispatchStatus {
    const activeNode = this.activeNode;
    const moved = this.moved;
    if (!activeNode) return 'decline';
    this.save(eventNav);

    // activeNode.wipState.set(null);
    this.moved = false;
    activeNode.panning.set(false);
    document.documentElement.style.cursor = activeNode.cursor;
    this.activeNode = null;

    // If we moved, then nobody else should get the mouseUp, but we should always unset overrides
    eventNav.unsetGlobalBehaviorOverrides(this);
    this.startPos = null;
    return moved ? 'stop' : 'continue';
  }

  getDelta(evt: WheelEvent) {
    const { deltaX, deltaY } = evt;
    if (deltaY) return -Math.sign(deltaY);
    // Note: I don't think we care about deltaX. may consider just returning 0 if there is no deltaY
    if (deltaX) return Math.sign(deltaX);
    return 0;
  }

  shouldUpdateViewportState = false;

  scheduleUpdateViewportState(eventNav: EventNav) {
    this.shouldUpdateViewportState = true;
    requestAnimationFrame(() => this.updateViewportState(eventNav));
  }

  updateViewportState(eventNav: EventNav) {
    const node = this.activeNode;
    if (!node) return;

    this.debounceSave(eventNav);

    if (this.shouldUpdateViewportState) {
      this.shouldUpdateViewportState = false;
      requestAnimationFrame(() => this.updateViewportState(eventNav));
    }
  }

  toastId?: number;

  async setPanDirection(natural: boolean) {
    await VM.globalContext().authService.currentUserVertexObs.value?.setJsonPropValues(
      'pan-direction',
      { natural },
      null,
    );
  }

  async setZoomDirection(swipeUpToZoomIn: boolean) {
    await VM.globalContext().authService.currentUserVertexObs.value?.setJsonPropValues(
      'zoom-direction',
      { swipeUpToZoomIn },
      null,
    );
  }

  handleTouchPan(eventNav: EventNav, e: TouchOrWheelEvent, node: VM.TopicSpace): DispatchStatus {
    const panDirection = node.panDirection.value;
    const spaceRect = node.clientRectObs.value;

    // this is redundant, but I'm leaving it here because I want to be paranoid
    if (!node || !allowedToPanOrZoom(node)) return 'decline';

    let natural = true;

    if (!panDirection && !this.toastId) {
      // surface a toast
      this.toastId = toast.info(
        "If things aren't moving the way you expect them to, click here to update your preferences.",
        {
          onClick: () => {
            void this.setPanDirection(!natural);
            this.toastId = undefined;
          },
          onClose: () => {
            void this.setPanDirection(natural);
            this.toastId = undefined;
          },
          delay: 15_000,
        },
      ) as number;
    } else if (panDirection) {
      natural = panDirection.natural;
    }

    const dir = natural ? -1 : 1;

    const { wheelDeltaX = 0, wheelDeltaY = 0, clientX, clientY } = e;

    const focalPoint = node.clientCoordsToSpaceCoords({
      x: clientX,
      y: clientY,
    });

    node.focusCoordinates.set(focalPoint);
    node.panning.set(true);

    // how much to scale back the pan speed. higher number is faster. probably should keep it between 0.2-0.5, but need to tweak
    const step = 0.3;
    const deltaCoordsX = wheelDeltaX * dir * step;
    const deltaCoordsY = wheelDeltaY * dir * step;
    const state = node.viewportState.value;
    if (!state) return 'decline';
    const { x: vpx = 0, y: vpy = 0, planeScale: scale = 1 } = state;
    const x = vpx + deltaCoordsX / scale;
    const y = vpy + deltaCoordsY / scale;
    const nextVPS = debug(
      clampViewportState(
        {
          ...state,
          x,
          y,
        },
        spaceRect,
      ),
      'NEXT VIEWPORT STATE',
      true,
    );
    node.viewportState.set(nextVPS);
    this.scheduleUpdateViewportState(eventNav);
    return 'stop';
  }

  handlePinchZoom(eventNav: EventNav, event: TouchOrWheelEvent, node: VM.TopicSpace): DispatchStatus {
    const { clientX, clientY } = event;
    const spaceRect = node.clientRectObs.value;
    const { width, height } = spaceRect;
    const state = node.viewportState.value;
    if (!state) return 'decline';
    if (!node || !allowedToPanOrZoom(node)) return 'decline';

    const { planeScale: scale } = state;
    node.panning.set(true);

    const focalPoint = node.clientCoordsToSpaceCoords({
      x: clientX,
      y: clientY,
    });

    node.focusCoordinates.set(focalPoint);

    // negative pinch distance means zoom in ("unpinch", increase scale), positive pinch distance means zoom out ("pinch", decrease scale)
    const distance = event.deltaY;
    const proportion = (100 - distance) / 100;
    const targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * proportion));
    const totalScale = node.baseScale * targetScale;
    const newWidth = width / totalScale;
    const newHeight = height / totalScale;

    // compute new top-left coords after having "zoomed" into/out of the point
    const spaceX = spaceRect.x;
    const spaceY = spaceRect.y;
    const offsetX = debug((clientX - spaceX) / totalScale, 'offsetX', true);
    const offsetY = debug((clientY - spaceY) / totalScale, 'offsetY', true);
    const newX = debug(focalPoint.x - offsetX, 'newX', true);
    const newY = debug(focalPoint.y - offsetY, 'newY', true);

    const nextVPS = debug(
      clampViewportState(
        {
          width: newWidth,
          height: newHeight,
          planeScale: targetScale,
          x: newX,
          y: newY,
        },
        spaceRect,
      ),
      'NEXT VPS',
      true,
    );

    if (targetScale !== MIN_SCALE) node.viewportState.set(nextVPS);

    this.scheduleUpdateViewportState(eventNav);
    return 'stop';
  }

  handleWheel(eventNav: EventNav, e: TouchOrWheelEvent, originNode: VM.Node): DispatchStatus {
    let closestSpace = originNode.closestInstance(VM.TopicSpace);
    if (!closestSpace || !allowedToPanOrZoom(closestSpace)) return 'decline';

    this.activeNode = closestSpace;

    const memberSelectionBox = originNode.closestInstance(VM.MemberSelectionBox);
    // allow wheel actions over memberselectionbox, but do not allow wheel events if we do not have a space
    if (!closestSpace && memberSelectionBox) {
      // if we do not have a closest space but we have a quick action list, then check if
      const nodesAtScreenPoint = originNode.root!.getNodesAtScreenRect(
        {
          left: e.clientX,
          top: e.clientY,
          width: 1,
          height: 1,
        },
        (node) => node instanceof VM.TopicSpace,
      );
      closestSpace = nodesAtScreenPoint[0] as null | VM.TopicSpace;
    }
    if (!closestSpace) return 'decline';

    // This is kinda goofy, but it will allow us to scroll a focused member (or anything else that may be focused)
    // We could just add a Scroll behavior to individual nodes, but we would need to implement a "scrollable" property to every node
    // that can scroll, which would cause more bugs because we would likely miss a few on our first pass.
    const closestFocusedNode = originNode.findClosest((n) => n.isFocused.value !== false && n);

    const closestFocusedSpace = closestFocusedNode?.findClosest((n) => n === closestSpace && n);

    if (
      // only do this if we are not currently panning.
      !closestSpace.panning.value &&
      closestFocusedSpace &&
      closestFocusedNode &&
      // HACK: the parentNode is in case one member is selected, and I try to pan over a sibling member. The closest
      // focused node is the ListNode that contains the two of them.
      !(closestFocusedNode === closestSpace || closestFocusedNode.parentNode === closestSpace)
    ) {
      return 'decline';
    }
    const inputDevice = closestSpace.inputDevice.value?.type ?? 'auto';

    this.addEvent(e);
    let isTouchPad = this.inputMode === 'touchpad';

    // override
    if (inputDevice === 'mouse') {
      isTouchPad = false;
    }
    if (inputDevice === 'touchpad') {
      isTouchPad = true;
    }

    const dk = eventNav.downKeys;
    const isPinch = e.ctrlKey && (e.deltaY !== 0 || e.deltaX !== 0);

    if (isTouchPad && !dk.has('meta') && !isPinch) {
      return this.handleTouchPan(eventNav, e, closestSpace);
    }

    if (isPinch) return this.handlePinchZoom(eventNav, e, closestSpace);

    let swipeUpToZoomIn = true;

    const zoomDirection = closestSpace.zoomDirection.value;

    if (isTouchPad && !zoomDirection && !this.toastId) {
      // surface a toast
      this.toastId = toast.info(
        "If the space isn't zooming the way you expect it to, click here to update your preferences.",
        {
          onClick: () => {
            void this.setZoomDirection(!swipeUpToZoomIn);
            this.toastId = undefined;
          },
          onClose: () => {
            void this.setZoomDirection(swipeUpToZoomIn);
            this.toastId = undefined;
          },
          delay: 15_000,
        },
      ) as number;
    } else if (isTouchPad && zoomDirection) {
      swipeUpToZoomIn = zoomDirection.swipeUpToZoomIn;
    }

    const { clientX, clientY } = e;
    const spaceRect = debug(closestSpace.clientRectObs.value, 'SPACE RECT', true);
    const { width, height } = spaceRect;
    const step = 0.1;
    const viewportState = closestSpace.viewportState.value;
    if (!viewportState) return 'decline';
    const delta = this.getDelta(e) * (swipeUpToZoomIn ? 1 : -1);
    const { planeScale: scale } = viewportState;
    const targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta * (scale - scale * step) * step));

    const focalPoint = debug(
      closestSpace.clientCoordsToSpaceCoords({
        x: clientX,
        y: clientY,
      }),
      'focalPoint',
      true,
    );

    closestSpace.focusCoordinates.set(focalPoint);

    // compute new top-left coords after having "zoomed" into/out of the point
    const spaceX = spaceRect.x;
    const spaceY = spaceRect.y;
    const totalScale = closestSpace.baseScale * targetScale;
    const offsetX = debug((clientX - spaceX) / totalScale, 'offsetX', true);
    const offsetY = debug((clientY - spaceY) / totalScale, 'offsetY', true);
    const newX = debug(focalPoint.x - offsetX, 'newX', true);
    const newY = debug(focalPoint.y - offsetY, 'newY', true);
    const newWidth = width / totalScale;
    const newHeight = height / totalScale;

    // reminder:
    // x, y, height and width are all in the Plane coordinate system
    // innerHeight/innerWidth are all in the screen coordinate system
    const vps = debug(
      clampViewportState(
        {
          width: newWidth,
          height: newHeight,
          planeScale: targetScale,
          x: newX,
          y: newY,
        },
        spaceRect,
      ),
      'SCROLLWHEEL ZOOM NEXT VPS',
      true,
    );

    if (targetScale !== MIN_SCALE) closestSpace.viewportState.set(vps);

    if (!isTouchPad) {
      closestSpace.zooming.set(true);
    } else {
      closestSpace.panning.set(true);
    }

    eventNav.setGlobalBehaviorOverrides(this, ['handleWheel']);
    this.debounceSave(eventNav);
    return 'stop';
  }

  zoomIn(node: VM.TopicSpace, eventNav: EventNav) {
    const state = node.viewportState.value;
    if (!state) return;

    // Calculate the new scale, ensuring each increment is 10% of the base scale
    const baseScale = 1;
    const currentIncrement = Math.round((state.planeScale - baseScale) / (baseScale * 0.1));
    const newScale = Math.min(MAX_SCALE, baseScale + baseScale * 0.1 * (currentIncrement + 1));

    const vps = clampViewportState(
      {
        ...state,
        planeScale: newScale,
      },
      node.clientRectObs.value,
    );
    node.viewportState.set(vps);
    node.zooming.set(true);
    this.debounceSave(eventNav);
  }

  zoomOut(node: VM.TopicSpace, eventNav: EventNav) {
    const state = node.viewportState.value;
    if (!state) return;

    // Calculate the new scale, ensuring each decrement is 10% of the base scale
    const baseScale = 1;
    const currentIncrement = Math.round((state.planeScale - baseScale) / (baseScale * 0.1));
    const newScale = Math.max(MIN_SCALE, baseScale + baseScale * 0.1 * (currentIncrement - 1));

    const vps = clampViewportState(
      {
        ...state,
        planeScale: newScale,
      },
      node.clientRectObs.value,
    );
    node.viewportState.set(vps);
    node.zooming.set(true);
    this.debounceSave(eventNav);
  }

  resetZoom(node: VM.TopicSpace, eventNav: EventNav) {
    const state = node.viewportState.value;
    if (!state) return;
    // Current viewport dimensions and scale
    const currentScale = state.planeScale;
    const centerX = state.x + node.clientRectObs.value.width / currentScale / 2;
    const centerY = state.y + node.clientRectObs.value.height / currentScale / 2;

    // Reset the scale to 1
    const newScale = 1;

    // Calculate new viewport position to keep the center consistent
    const newX = centerX - node.clientRectObs.value.width / newScale / 2;
    const newY = centerY - node.clientRectObs.value.height / newScale / 2;

    const vps = clampViewportState(
      {
        ...state,
        planeScale: newScale,
        x: newX,
        y: newY,
      },
      node.clientRectObs.value,
    );
    node.viewportState.set(vps);
    node.zooming.set(true);
    this.debounceSave(eventNav);
  }

  clearDefer?: () => void;

  debounceSave(eventNav: EventNav) {
    this.clearDefer?.();
    this.clearDefer = this.defer(() => this.save(eventNav), 500);
  }

  save(eventNav: EventNav) {
    this.clearDefer?.();
    this.clearDefer = undefined;

    const activeNode = this.activeNode;
    if (!activeNode) return;

    const state = activeNode.viewportState.value;
    if (!state) return;
    activeNode.panning.set(false);
    activeNode.zooming.set(false);
    eventNav.unsetGlobalBehaviorOverrides(this);
    const { x, y, planeScale } = state;
    const newState: VM.ViewportData = {
      planeX: x,
      planeY: y,
      positionX: -x * planeScale,
      positionY: -y * planeScale,
      scale: planeScale,
    };
    trxWrapSync((trx) => activeNode.setViewportProp(newState, trx));
  }

  wheelEvents: TouchOrWheelEvent[] = [];
  inputMode: 'mouse' | 'touchpad' = 'mouse';

  addEvent(event: TouchOrWheelEvent) {
    // Add new event to the list
    this.wheelEvents.push(event);

    const evictThreshold = event.timeStamp - 1000; // 1 second
    while (this.wheelEvents.length > 0 && this.wheelEvents[0].timeStamp < evictThreshold) {
      this.wheelEvents.shift(); // Remove the oldest event
    }

    // Update the analysis with the current set of events
    this.inputMode = this.predictInputMode();
  }

  predictInputMode() {
    const lastEvent = this.wheelEvents[this.wheelEvents.length - 1];

    let totalDeltaX = 0;
    //   totalDeltaY = 0,
    //   totalDuration = 0,
    //   totalDXWDX = 0,
    //   totalDYWDY = 0,
    //   totalXYRatio = 0;

    // let prevTimestamp = this.wheelEvents[0].timeStamp;

    for (let i = 1; i < this.wheelEvents.length; i++) {
      const event = this.wheelEvents[i];
      // const duration = event.timeStamp - prevTimestamp;
      // totalDuration += duration;
      // prevTimestamp = event.tim]eStamp;

      totalDeltaX += Math.abs(event.deltaX);
      // totalDeltaY += Math.abs(event.deltaY);
      // if (event.wheelDeltaX)
      //   totalDXWDX += Math.abs(event.deltaX / event.wheelDeltaX);
      // if (event.wheelDeltaY)
      //   totalDYWDY += Math.abs(event.deltaY / event.wheelDeltaY);

      // if (event.deltaY !== 0) {
      //   totalXYRatio += Math.abs(event.deltaX / event.deltaY);
      // }
    }

    // const avgDuration = totalDuration / (this.wheelEvents.length - 1);
    const avgDeltaX = totalDeltaX / this.wheelEvents.length;
    // const avgDeltaY = totalDeltaY / this.wheelEvents.length;
    // const avgXYRatio = totalXYRatio / this.wheelEvents.length;
    // const avgDXWDX = totalDXWDX / this.wheelEvents.length;
    // const avgDYWDY = totalDYWDY / this.wheelEvents.length;
    const isPinch = lastEvent.ctrlKey && (lastEvent.deltaY !== 0 || lastEvent.deltaX !== 0);

    // console.log('wheel event analysis', {
    //   avgDuration,
    //   avgDeltaX,
    //   avgDeltaY,
    //   avgDXWDX,
    //   avgDYWDY,
    //   avgXYRatio,
    //   isPinch,
    // });

    // It's a near certainty that the user is using a trackpad
    if (isPinch) return 'touchpad';

    // DeltaX is consistently zero for mouse, which indicates no horizontal scrolling.
    if (avgDeltaX === 0) return 'mouse';

    // TODO:
    // Consider variance in duration between events - Touchpad events are typically smaller and more regular (but still can vary a lot) and mouse events are more variable in duration
    // Consider variance in deltaX and deltaY - DeltaY values are generally much higher with a mouse wheel, showing large jumps, which is typical of mouse wheels that scroll in more noticeable increments.
    // avgDXWDX and avgDYWDY dont' seem to have much predictive power

    return 'touchpad';
  }
}

export function transformCoords({
  scale,
  screenRect,
  clientCoords,
  logicalCoords = { x: 0, y: 0 },
}: {
  scale: number;
  clientCoords: { x: number; y: number };
  logicalCoords?: { x: number; y: number };
  screenRect: VM.BoundingBox;
}) {
  const x = (clientCoords.x - screenRect.x) / scale + logicalCoords.x;
  const y = (clientCoords.y - screenRect.y) / scale + logicalCoords.y;
  return { x, y };
}

function clampViewportState(state: ConstructorParameters<typeof VM.ViewportState>[0], spaceRect: VM.BoundingBox) {
  const { width: spaceWidth, height: spaceHeight } = spaceRect;
  // if (state.planeScale)
  let planeScale = Math.max(MIN_SCALE, state.planeScale);
  const innerScale = state.innerScale ?? 1;
  const width = spaceWidth / planeScale;
  const height = spaceHeight / planeScale;

  const x = state.x;
  const y = state.y;
  return debug(
    new VM.ViewportState({
      planeScale,
      x,
      y,
      width,
      height,
      // note: not sure if this is appropriate.
      innerScale,
    }),
    'CLAMPED VIEWPORT',
    true,
  );
}

function allowedToPanOrZoom(node: VM.TopicSpace) {
  const root = node.root;
  if (!(root instanceof VM.AppDesktop)) return 'decline';
  const tiledItems = root.tileContainer.tiledItems;

  // You can only interact with topicspaces which are actively on scren
  // if we're tiling, then the node in question has to be one of the (featured) tiled items
  // otherwise we should decline the event
  if (tiledItems.length > 0) {
    const found = tiledItems.find((ti) => ti.featured && (ti.node?.contains(node) ?? false));
    if (!found) return false;
  }
  return true;
}
