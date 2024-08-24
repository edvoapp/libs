import { EdvoObj, ObservableList, OwnedProperty, QueryString, traceState } from '@edvoapp/util';
import { Behavior, DispatchStatus, isMac } from './Behavior';
import { AuthService, FocusState, NavigationHistory, SelectionState, uiParams } from '..';
import * as VM from '../viewmodel';
import { AppLocation, DropMenuBody } from '../viewmodel';
import { getCurrentUrl } from 'preact-router';

export type EventsMap =
  | 'handleKeyDown'
  | 'handleKeyUp'
  // | 'handleKeyPress'
  | 'handleInput'
  | 'handleMouseDown'
  | 'handleMouseUp'
  | 'handleMouseOver'
  | 'handleDoubleClick'
  | 'handleTripleClick'
  | 'handleMouseMove'
  | 'handleMouseEnter'
  | 'handleMouseLeave'
  | 'handleContextMenu'
  | 'handleRightMouseDown'
  | 'handleRightMouseUp'
  | 'handleRightMouseMove'
  | 'handleDragEnter'
  | 'handleDragLeave'
  | 'handleDragOver'
  | 'handleDrop'
  | 'handleWheel'
  | 'handleCut'
  | 'handleCopy'
  | 'handlePaste'
  | 'handleChange';

interface ConstructorArgs {
  readonly rootNode: VM.Node;
  readonly domRoot: DocumentFragment | Document | HTMLElement;
  authService: AuthService;
  isExtension?: boolean;
  selectionState: SelectionState;
  focusState: FocusState;
  navigationHistory: NavigationHistory;
  // defaultBehaviors: Behavior[];
}
export class EventNav extends EdvoObj {
  skipLeakDetection = true;
  readonly domRoot: DocumentFragment | Document | HTMLElement;
  @OwnedProperty
  rootNode: VM.Node;
  @OwnedProperty
  draggingElements = new ObservableList<HTMLElement>();
  eventContainers = new Set<HTMLElement>();
  mouseDown = false;
  clickTimeout: ReturnType<typeof setTimeout> | null = null;
  clickCounter = 0;
  downKeys = new Set<string>();
  @OwnedProperty
  selectionState: SelectionState;
  @OwnedProperty
  focusState: FocusState;
  @OwnedProperty
  authService: AuthService;
  @OwnedProperty
  navigationHistory: NavigationHistory;

  constructor({
    domRoot,
    rootNode,
    authService,
    isExtension,
    selectionState,
    focusState,
    navigationHistory,
  }: ConstructorArgs) {
    super();
    this.domRoot = domRoot;
    this.rootNode = rootNode;
    this.authService = authService;
    this.selectionState = selectionState;
    this.focusState = focusState;
    this.navigationHistory = navigationHistory;

    let refocusing = false;
    if (!isExtension) {
      this.addManagedListener(window, 'focusin', (e) => {
        if (!this.alive) return;
        if (refocusing) return;

        const target = e?.target as HTMLElement | null;

        if (target == this.focusState.currentFocus?.domElement) return;

        // HACK -- this is so that we can select text in pdf
        if (target?.matches('.page > canvas + .textLayer')) return;

        // We shouldn't actually be getting past this point. So getting here should be indicative of a bug in EventNav or SelectionState
        // TODO: sometimes we do get here. Investigate if it is actually OK to get here.
        // debugger;
        // const relatedTarget = e.relatedTarget as HTMLElement | null;
        //
        // refocusing = true;
        // if (relatedTarget) {
        //   relatedTarget.focus({ preventScroll: true });
        // } else {
        //   target?.blur();
        // }
        //
        // refocusing = false;
        // }
      });
    }

    this.addManagedListener(window, 'load', () => this.onLocationChange('load'));
    this.addManagedListener(window, 'popstate', () => this.onLocationChange('popstate'));

    this.addManagedListener(
      window,
      'wheel',
      (e: WheelEvent) => this.onWheel(e),
      // wheel event needs to be explicitly marked as not passive
      { passive: false },
    );

    this.addManagedListener(window, 'mousemove', (e: MouseEvent) => this.onMouseMove(e));
    // this.addManagedListener(window, 'pushstate', () =>
    //   this.onLocationChange('pushstate'),
    // );
    this.addManagedListener(window, 'hashchange', () => this.onLocationChange('hashchange'));

    this.addManagedListener(window, 'mousedown', (e: MouseEvent) => this.onMouseDown(e));
    this.addManagedListener(window, 'mouseup', (e: MouseEvent) => this.onMouseUp(e));
    // this.addManagedListener(window, 'dblclick', (e: MouseEvent) =>
    //   this.onDoubleClick(e),
    // );

    this.addManagedListener(window, 'contextmenu', (e: MouseEvent) => {
      if (!this.alive) return;
      const node = this.rootNode.getNodeAtScreenPoint(
        {
          x: e.clientX,
          y: e.clientY,
        },
        true,
      );
      if (node) this.handleEvent('handleContextMenu', node, e);
    });
    // element.onfocus = (e: FocusEvent) => this.onFocus(e);
    this.addManagedListener(window, 'copy', (e: ClipboardEvent) => {
      if (!this.alive) return;
      const node = this.focusState.currentFocus;
      if (node) this.handleEvent('handleCopy', node, e);
    });
    this.addManagedListener(window, 'cut', (e: ClipboardEvent) => {
      if (!this.alive) return;
      const node = this.focusState.currentFocus;
      if (node) this.handleEvent('handleCut', node, e);
    });

    this.addManagedListener(window, 'paste', (e: ClipboardEvent) => {
      if (!this.alive) return;
      const node = this.focusState.currentFocus;
      if (node) this.handleEvent('handlePaste', node, e);
    });
    this.addManagedListener(window, 'dragenter', (e: DragEvent) => {
      if (!this.alive) return;
      const node = this.rootNode.getNodeAtScreenPoint(
        {
          x: e.clientX,
          y: e.clientY,
        },
        true,
      );
      if (node) this.handleEvent('handleDragEnter', node, e);
    });
    this.addManagedListener(window, 'dragleave', (e: DragEvent) => {
      if (!this.alive) return;
      const node = this.rootNode.getNodeAtScreenPoint(
        {
          x: e.clientX,
          y: e.clientY,
        },
        true,
      );
      if (node) this.handleEvent('handleDragLeave', node, e);
    });
    this.addManagedListener(window, 'dragover', (e: DragEvent) => {
      if (!this.alive) return;
      const node = this.rootNode.getNodeAtScreenPoint(
        {
          x: e.clientX,
          y: e.clientY,
        },
        true,
      );
      if (node) this.handleEvent('handleDragOver', node, e);
    });
    this.addManagedListener(window, 'drop', (e: DragEvent) => {
      if (!this.alive) return;
      const node = this.rootNode.getNodeAtScreenPoint(
        {
          x: e.clientX,
          y: e.clientY,
        },
        true,
      );
      if (node) this.handleEvent('handleDrop', node, e);
    });
    this.addManagedListener(window, 'input', (e: InputEvent) => {
      if (!this.alive) return;
      const node = this.focusState.currentFocus;
      if (node) this.handleEvent('handleInput', node, e);
    });

    this.onLocationChange('init');

    this.addManagedListener(window, 'keydown', (e: KeyboardEvent) => {
      if (!this.alive) return;
      const key = e.key?.toLowerCase();
      if (typeof key === 'undefined') {
        this.trace(3, () => ['undefined key event', e]);
      } else if (key === 'dead') {
        // WTF is a dead key
        this.trace(3, () => ['dead key event', e]);
      } else if (!['control', 'alt', 'shift', 'meta'].includes(e.key)) {
        this.downKeys.add(e.key.toLowerCase());
      }

      this.updateSpecialKeys(e);

      const viewNode = this.focusState.currentFocus ?? this.rootNode;
      return this.handleEvent('handleKeyDown', viewNode, e);
    });

    this.addManagedListener(window, 'keyup', (e: KeyboardEvent) => {
      if (!this.alive) return;
      const key = e.key.toLowerCase();
      this.trace(3, () => ['handleKeyUp', key]);
      if (typeof key === 'undefined') return;
      this.downKeys.delete(key);

      this.updateSpecialKeys(e);

      const viewNode = this.focusState.currentFocus ?? this.rootNode;
      return this.handleEvent('handleKeyUp', viewNode, e);
    });
  }

  onLocationChange(origin: 'popstate' | 'pushstate' | 'hashchange' | 'load' | 'init' | 'preact') {
    if (!this.alive) return;
    // TODO: We would have to write our own helper function to handled the
    // hashed URL for our native app when we eventually move away from Preact.

    const loc = this.rootNode.context.currentLocation;
    const navigationHistory = this.rootNode.context.navigationHistory;

    traceState.level = parseInt(loc.params.traceLevel) || 0;
    traceState.regex = new RegExp(loc.params.traceRegex || '.');
    uiParams.animateForceDirection = !!parseInt(loc.params.animateForceDirection);

    this.trace(1, () => [`onLocationChange(${origin})`, loc]);

    // loc.path is stored as topic/1234. Empty string is the root path
    navigationHistory.updateLocation(loc.path[loc.path.length - 1] ?? '/');

    this.rootNode.context.setRoute(loc);
  }

  // getBehaviors(node: Node): Behavior[] {
  //   //Behavior[] | null {
  //   // Priority behaviors which apply globally
  //   let behaviors: Behavior[] = []; //Behavior[] = this.priorityBehaviors.concat();

  //   // TODO - find the eventContainer that most immediately contains e, and stop looping if we leave that

  //   while (e) {
  //     //!this.eventContainers.includes(e)) {
  //     let binding = e.nodeBinding; //let b = e.nodeBinding?.behaviors;
  //     if (binding) {
  //       behaviors.push(...binding.viewNode.behaviors); // The new hotness
  //       behaviors.push(...binding.behaviors); // Old bustedness TODO: remove this
  //       break;
  //     }
  //     e = e.parentElement as MaybeBoundElement; // & { handlers?: Behavior[] };
  //   }

  //   // and then, default modules
  //   behaviors.push(...this.defaultBehaviors);
  //   // and lastly, as a shim for behaviors on nodes that do not have backing elements
  //   if (this.focusState.currentFocus) {
  //     behaviors.push(...this.focusState.currentFocus?.behaviors);
  //   }

  //   behaviors = behaviors.sort(
  //     (a, b) => Number(b.priority) - Number(a.priority), // Move priority behaviors to the front
  //   );
  //   return behaviors;
  // }

  // findNearestBoundElement(el: HTMLElement): BoundElement | null {
  //   let e = el as BoundElement;

  //   // Assumes non-nested eventContainers for now
  //   while (!this.eventContainers.has(el)) {
  //     if (!e) return null;
  //     if (e.nodeBinding) return e;
  //     e = e.parentElement as BoundElement;
  //   }
  //   return e.nodeBinding ? e : null;
  // }

  // Capture events which may lead to navigations or mutations. Be sure to call
  // safeBindEventContainer on the fewest number of elements which contain entities,
  // BUT are not intercepted by other code. We don't want to have to teach each foreign
  // event handler to yield in order for us to get events relevant to entities.
  //
  // Each of our event handlers will stopEventPropagation ONLY if they handle that event

  onMouseDown(e: MouseEvent) {
    if (!this.alive) return;
    this.updateSpecialKeys(e);
    const isRightClick = this.isRightClick(e);

    const isShiftClick = e.shiftKey;
    if (!isRightClick && e.detail === 2) {
      // don't let double-right-click do anything for now
      return this.onDoubleClick(e);
    }
    if (!isRightClick && e.detail === 3) {
      // don't let triple-right-click do anything for now
      return this.onTripleClick(e);
    }
    this.trace(4, () => ['onMouseDown', e]);
    if (isRightClick && isShiftClick) {
      this.trace(4, () => ['onMouseDown', 'SHIFT-rightclick override']);
      return; // SHIFT-rightclick is an escape hatch to browser's context menu
    }

    const node = this.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      true,
    );
    this.trace(4, () => ['onMouseDown', { node, e }]);
    if (node) {
      this.handleEvent(isRightClick ? 'handleRightMouseDown' : 'handleMouseDown', node, e);
    }
  }

  onMouseUp(e: MouseEvent) {
    if (!this.alive) return;
    this.updateSpecialKeys(e);
    const isRightClick = this.isRightClick(e);

    this.mouseDown = false;

    // NOTE: should double-click be dispatched on mouse up or mouse down? Currently it's mouse down, but it could be argued to be on mouse up as well.
    if (e.detail !== 1) return;

    const node = this.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      true,
    );

    this.trace(4, () => ['onMouseUp', { node }]);

    if (node) {
      return this.handleEvent(isRightClick ? 'handleRightMouseUp' : 'handleMouseUp', node, e);
    }
    const priorityBehavior = this.globalBehaviorOverride['handleMouseUp']?.upgrade();
    const activeNode = priorityBehavior?.activeNode;
    if (activeNode) {
      priorityBehavior.handleMouseUp(this, e, activeNode);
    }
  }

  onWheel(e: WheelEvent) {
    if (!this.alive) return;
    const node = this.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      true,
    );
    if (node) this.handleEvent('handleWheel', node, e);
  }

  onMouseMove(e: MouseEvent) {
    if (!this.alive) return;
    const isRightClick = this.isRightClick(e);
    const node = this.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      true,
    );
    if (node) {
      if (uiParams.revealNodes) node.reveal();
      return this.handleEvent(isRightClick ? 'handleRightMouseMove' : 'handleMouseMove', node, e);
    }
    const priorityBehavior = this.globalBehaviorOverride['handleMouseMove']?.upgrade();
    const activeNode = priorityBehavior?.activeNode;
    if (activeNode) {
      priorityBehavior.handleMouseMove(this, e, activeNode);
    }
  }

  isRightClick(e: MouseEvent) {
    // ctrl-click on mac === right click
    return e.which === 3 || e.button === 2 || (isMac && e.ctrlKey);
  }

  onDoubleClick(e: MouseEvent) {
    const node = this.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      true,
    );
    if (node) this.handleEvent('handleDoubleClick', node, e);
  }

  onTripleClick(e: MouseEvent) {
    const node = this.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      true,
    );
    if (node) this.handleEvent('handleTripleClick', node, e);
  }

  onMouseOver(e: MouseEvent) {
    const node = this.rootNode.getNodeAtScreenPoint(
      {
        x: e.clientX,
        y: e.clientY,
      },
      true,
    );
    if (node) {
      this.handleEvent('handleMouseOver', node, e);
    }
  }

  updateSpecialKeys(e: KeyboardEvent | MouseEvent) {
    if (e.metaKey) this.downKeys.add('meta');
    else this.downKeys.delete('meta');

    if (e instanceof KeyboardEvent) {
      if (e.code === 'Space' && e.type === 'keydown') this.downKeys.add('space');
      else this.downKeys.delete('space');
    }

    if (e.ctrlKey) this.downKeys.add('control');
    else this.downKeys.delete('control');

    if (e.altKey) this.downKeys.add('alt');
    else this.downKeys.delete('alt');

    if (e.shiftKey) this.downKeys.add('shift');
    else this.downKeys.delete('shift');
  }
  // QUESTION 1: Should element be the currently focused element, or the element that received the event? (I think the former)
  // QUESTION 2: is entity navigation universal? If so, then navigation should be split out from mutation. If not, then mutation
  //             becomes context-dependent event handling, some of those handlings are mutation, and some are not.

  // The handler (if any) gets the first right of refusal
  // If the handler declines to handle the key (by returning false)
  // then we hand the key event off to the default key navigation routine.
  // This will give the handler the opportunity to contextually use those
  // key events which might be situationally dependent.

  handleEvent<T extends EventsMap>(method: T, viewNode: VM.Node, evt: Event) {
    this.dispatchBehaviors(method, viewNode.behaviors, evt, viewNode);
  }

  private dispatchBehaviors<T extends EventsMap>(method: T, behaviors: Behavior[], evt: Event, node: VM.Node) {
    const traceLv = ['handleMouseMove'].includes(method) ? 10 : 1;
    this.trace(traceLv, () => [
      '[[ handleEvent ]]',
      method,
      {
        node,
        behaviors,
        behaviorsLength: behaviors.length,
        key: evt instanceof KeyboardEvent ? evt.key : undefined,
        evt,
        downKeys: [...this.downKeys],
      },
    ]);

    let done = false;
    let native = false;
    const priorityBehavior = this.globalBehaviorOverride[method]?.upgrade();

    if (priorityBehavior) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const status = priorityBehavior[method](this, evt, node);
      this.trace(traceLv + 1, () => ['\t', priorityBehavior.constructor.name, method, `PRIORITY (${status})`]);
      if (status === 'stop' || status === 'native') done = true;
      if (status === 'native') native = true;
    }

    for (const behavior of behaviors) {
      // We already ran this one above
      if (behavior === priorityBehavior) continue;

      let status: DispatchStatus | 'skipped';

      if (done) {
        // Don't dispatch this behavior. Just print it in the trace so we can be aware of what *would* have run next
        status = 'skipped';
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        status = behavior[method](this, evt, node);
      }
      if (status === 'ignore') continue;

      this.trace(traceLv + 1, () => ['\t', behavior.constructor.name, method, `(${status})`]);

      // Precedence-based dispatching. Behaviors are dispatched in order of highest priority to least priority
      // Every behavior module has the right to say STOP - meaning that no other behaviors are dispatched afterward.
      // As much as possible (there may be a few weird exceptions, but as a general rule) We want to avoid having one
      // behavior module "yield" in anticipation of another behavior being run later. This violates the principle of
      // separation of concerns, and makes our code hard to reason about.
      //
      // Background:
      // The main reason we built this logic in the first place (vs using native browser events)
      // is so that we can *reorder* this precedence dynamically as conditions change.
      if (status === 'stop' || status === 'native') done = true;
      if (status === 'native') native = true;
    }

    // remove "other" keys so that we can maintain our "manipulator" keys
    // if you "cmd" + "c" to copy, you want "c" to be removed from the downKeys,
    // so that you can keep holding "cmd" and then press "v" to paste
    this.downKeys.forEach((key) => {
      if (key !== 'meta' && key !== 'shift' && key !== 'control' && key !== 'space') {
        this.downKeys.delete(key);
      }
    });

    // keyup events are never received by the iframe if focus shifts, therefore we need to manually clear the downKeys
    // primarily use case is "cmd"+"u" to full-screen
    if (
      done &&
      method === 'handleKeyDown' &&
      // we should not clear the downKeys if we are currently holding a "manipulator" key,
      // which seems to be the "shift" and "meta" keys (so far)
      !this.downKeys.has('shift') &&
      !this.downKeys.has('control') &&
      !this.downKeys.has('meta')
    ) {
      this.downKeys.clear();
    }

    // this prevents browser zooming
    if (method === 'handleWheel' && (evt as WheelEvent).ctrlKey) {
      evt.preventDefault();
    }

    if (!native) evt.preventDefault();
    evt.stopPropagation();
    evt.stopImmediatePropagation();
  }

  // using upgrade as a workaround for the lack of an implementation of a weakly owned map
  globalBehaviorOverride: { [Property in EventsMap]?: Behavior } = {};

  setGlobalBehaviorOverrides(behavior: Behavior, events: EventsMap[]) {
    for (const event of events) {
      if (!this.globalBehaviorOverride[event]) {
        this.globalBehaviorOverride[event] = behavior;
      }
    }
  }

  unsetGlobalBehaviorOverrides(behavior: Behavior, event?: EventsMap) {
    if (event) {
      if (this.globalBehaviorOverride[event]) {
        delete this.globalBehaviorOverride[event];
      }
    } else {
      for (const [evt, beh] of Object.entries(this.globalBehaviorOverride)) {
        if (beh === behavior) {
          delete this.globalBehaviorOverride[evt as EventsMap];
        }
      }
    }
  }
}
