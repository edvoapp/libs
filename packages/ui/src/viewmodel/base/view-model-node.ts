/* eslint-disable @typescript-eslint/no-unused-vars */
import { config, Model, TrxRef } from '@edvoapp/common';
import * as Bindings from '@edvoapp/wasm-bindings';

import {
  EdvoObj,
  getWasmBindings,
  Guard,
  Guarded,
  MemoizeOwned,
  MemoizeWeak,
  Observable,
  ObservableReader,
  OwnedProperty,
  sleep,
  WeakProperty,
} from '@edvoapp/util';

import { Action, ActionGroup, Behavior, FocusContext, FocusTarget } from '../../service';
import { CloneContext, DiagBox } from '../../utils';

import { ViewModelContext } from './context';
import { getAccumulatorForCtx } from './utility';
import { DragItem } from '../../behaviors';
import { UpdatablesSet } from './updatables';
import { BoundingBox } from './bounding-box';
import { AppDesktop } from '../app-desktop';

export interface NodeCA<Parent extends Node | null> {
  context: ViewModelContext;
  parentNode: Parent;
  label?: string;
  transparent?: boolean;
  pointerEvents?: boolean;
  index?: number;
  overflow?: boolean;
  allowHover?: boolean;
  iterateChildrenForwards?: boolean;
  cursor?: string;
  observeResize?: boolean;
  privilegeCoalescenceParent?: PrivilegeComputingObject | null;
}

export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };

export type NodeAndContext = {
  node: Node;
  ctx?: Omit<FocusContext, 'edge' | 'trigger'>;
};

export type IndicationFlag = 'drag' | 'navigate'; // TODO add other ways we indicate things

/** Starting to separate out the privilege coelescence and update logic from
 * VM Node so it can be implemented by non-VM-node services in addition to VM nodes */
export interface PrivilegeComputingObject {
  coalescedPrivileges: ObservableReader<Model.Priv.InheritedPrivs | undefined> | null;
}

export abstract class Node<Parent extends Node | null = Node<any> | null>
  extends EdvoObj
  implements FocusTarget, Bindings.TSViewModelNode
{
  static audit(cb: (obj: Node) => any): any[] {
    return EdvoObj.audit((o) => o instanceof this && cb(o));
  }
  get rendered() {
    return this.domElement?.isConnected ?? false;
  }
  @WeakProperty
  context: ViewModelContext;
  @WeakProperty
  parentNode: Parent;
  /** Parent object used for privilege coalescence. Defaults to parentNode if unspecified */
  @WeakProperty
  privilegeCoalescenceParent: PrivilegeComputingObject | null;

  label?: string;

  hasDepthMask = false;
  depthMaskId?: number;
  zIndexed = false;
  @OwnedProperty
  isFocused = new Observable<false | 'leaf' | 'branch'>(false);
  @OwnedProperty
  indicated = new Observable<Record<IndicationFlag, boolean>>({} as Record<IndicationFlag, boolean>);
  @OwnedProperty
  isSelected = new Observable(false);
  selectOnFocus = false;
  propagateFocus = true;
  transparent: boolean;
  overflow = false;
  pointerEvents: boolean;
  skipFocus = false;
  _index: number;
  _bindProm: Promise<HTMLElement>;
  _bindDone: (el: HTMLElement) => void = () => {};
  allowHover: boolean;
  // This is dumb, but it allows us to specify how children are iterated for getNodeAtScreenPoint, which defaults to reverse
  iterateChildrenForwards: boolean;
  _depthMaskZ?: number;
  @OwnedProperty
  _defaultClientRectObs?: Observable<BoundingBox>;
  _cursorFromParent?: string;
  resizeObserver?: ResizeObserver;
  focusChildOrdering: 'forward' | 'reverse' = 'forward';
  constructor({
    context,
    parentNode,
    privilegeCoalescenceParent,
    index,
    label,
    transparent = false,
    pointerEvents = true,
    overflow = false,
    allowHover = false,
    iterateChildrenForwards = false,
    cursor,
    observeResize,
  }: NodeCA<Parent>) {
    super();

    this.parentNode = parentNode;
    this.privilegeCoalescenceParent = privilegeCoalescenceParent ?? parentNode;
    this.overflow = overflow;
    this.allowHover = allowHover;
    this.iterateChildrenForwards = iterateChildrenForwards;
    this._cursorFromParent = cursor;

    const c = context ?? parentNode?.context;
    if (!c) throw 'sanity error';
    this.context = c;
    this.label = label;
    this.transparent = transparent;
    this.pointerEvents = pointerEvents;
    this._index = index ?? parentNode?.getNextChildIndex() ?? -1;
    this._bindProm = new Promise<HTMLElement>((r) => (this._bindDone = r));
    if (observeResize)
      this.resizeObserver = new ResizeObserver((entries) => {
        if (entries.length && this.alive) this.doLayout(); // just in case. We don't fully control when this gets called
      });
  }

  domElement: HTMLElement | null = null;

  get childProps(): string[] {
    return [];
  }

  _children?: Node[];
  _loadingChildren?: true;

  /**
   * returns the presently loaded children, if any. Otherwise, returns an empty array.
   *
   * We used to load the children on demand, but given that loadChildren is automatically
   * called based on the visibility state its better to assume passivity when iterating over children
   *
   * Note that Privilege updating uses walkTree, which calls .loadChildren() on each node
   */
  get children(): Node[] {
    if (this._children) return this._children;

    return [];
  }

  private loadChildren(): Node[] {
    if (this._children) return this._children;
    if (this._loadingChildren)
      throw 'Recursive double-load detected. Defer the part of your code that is calling this until after init';

    this._loadingChildren = true;

    let children: Node[] = [];
    // NOTE: children must be listed in reverse priority order
    // IE, if there is an absolutely positioned that has a higher z-index, it should be at the END of the list

    this.childProps.forEach((childProp) => {
      // Should call the getter to automatically construct and register the property if using @OwnedProperty
      let child = this[childProp as keyof this] as unknown as Node;
      if (!child) {
        debugger;
        throw `child ${childProp} returned false`;
      }
      children.push(child);
    });

    // Currently each child is using MemoizeOwned in their respective getter
    this._children = children;
    delete this._loadingChildren;
    return children;
  }

  @MemoizeOwned()
  get zIndex() {
    return new Observable(0);
    // TODO - always inherit parent observable in base class
    // override Member.zIndex getter such that each member's zIndex is calculated
    // from the preceeding node's zIndex + 1 (first child's preceeding node is the parent itself)
    // This requires that each child notify the parent when their seq changes
    // And parent notify their children when their preceeding node changes
  }

  @MemoizeOwned()
  get zIndexOverride(): Observable<null | number> {
    return new Observable<null | number>(null);
  }

  /**
   * Update the global z-index.
   *
   * Css zIndex only allows integers which is *super dumb* because its not subdivisible, and rendering only
   * requires partial ordering anyway. SMHHHH >_>
   *
   * The way this is implemented is super inefficient, because we have to enumerate and re-enumerate sooo much
   * as this is a total order over the whole tree.
   *
   * I've optimized it a little bit to try to leave zIndexes as stable as possible, but this likely needs more optimization
   *
   */
  zEnumerateAll() {
    // TODO optimize this. we're calling it too much
    this.root?.zEnumerateRecurse(0);
  }
  zEnumerateRecurse(lastZIndex: number): number {
    // TODO
    // let firstZindexedChildZi = -Infinity;

    const overrideValue = this.zIndexOverride.value ?? 0;

    if (this.zIndexed) {
      // TODO: audit the override logic
      const myZi = this.zIndex.value;
      const minZi = lastZIndex + 1 + overrideValue;
      const maxZi = minZi; // Math.max(minZi, firstZindexedChild?.zIndex.value);
      // Increment regardless.
      if (myZi < minZi || myZi > maxZi) {
        // Only apply it if we're outside the allowable range
        this.zIndex.set(minZi);
        lastZIndex = minZi;
      } else {
        lastZIndex = myZi;
      }
    }

    for (let child of [...this.children].sort((a, b) => a.seq - b.seq)) {
      lastZIndex = Math.max(lastZIndex, child.zEnumerateRecurse(lastZIndex));
    }

    // HACK: tell next sibling what the values would have been if it hadn't been overriden
    return lastZIndex - overrideValue;
  }
  get seq() {
    return 0;
  }
  allowChildUnloading = false;
  private conditionalUnloadChildren() {
    if (this.destroyed) return;
    // Only unload children if we're not visible and not forcing load of children
    if (this.context.forceLoadChildren || this.visible.value) return;
    if (!this.allowChildUnloading) return;

    // How do we un-set the individual child objects?
    const children = this._children;
    this._children = undefined;

    this.childProps.forEach((childProp) => {
      // This should automatically deregister those properties using @OwnedProperty
      this[childProp as keyof this] = undefined as any;
    });
  }
  protected init() {
    this.onCleanup(
      this.visible.subscribe((vis) => {
        if (vis || this.context.forceLoadChildren) {
          this.loadChildren();
        } else {
          this.conditionalUnloadChildren();
        }
      }, true),
    );

    this.onCleanup(() => {
      this.resizeObserver?.disconnect();
    });

    if (this.selectOnFocus)
      this.onCleanup(
        this.isFocused.subscribe((focused) => {
          if (focused === 'leaf') {
            this.context.selectionState.setSelect([this]);
          } else {
            this.context.selectionState.clear();
          }
        }),
      );

    const privs = this.coalescedPrivileges;
    const updatables = this.updatables;

    if (privs && updatables) {
      // Must have the potential for both privileges and updatables
      this.onCleanup(
        privs.subscribe((privs, origin, ctx) => {
          // if (origin === 'USER') {
          //   if (!ctx.trx)
          //     throw 'We really should have a trx for any origin == USER action';
          // console.log('PRIV SUB', this, privs, origin, ctx);
          const acc = getAccumulatorForCtx(this.context, ctx);
          updatables.forEach((updatable) => {
            acc.accumulatePrivUpdate(this, updatable);
          });
        }, true),
      );

      this.onCleanup(
        updatables.subscribe((updatable, op, ctx) => {
          // console.log('PRIV UPD SUB', this, origin, ctx);
          const acc = getAccumulatorForCtx(this.context, ctx);
          acc.accumulatePrivUpdate(this, updatable);
        }),
      );
    }

    if (this.hasDepthMask) this.initDepthMask();
  }

  initDepthMask() {
    // register the initial depth mask
    const { x, y, width, height } = this.clientRectObs.value;
    this.depthMaskId = this.context?.depthMaskService?.add_instance(x, y, this.zIndex.value, width, height);
    this.managedReference(
      Observable.forEach(
        ({ visible, zIndex, clientRect, clipBox }) => {
          if (!this.alive || !this.depthMaskId) return;
          const maskRect = ((visible && clipBox?.intersect(clientRect)) ?? clientRect) || null;
          this.context?.depthMaskService?.update_instance(
            this.depthMaskId,
            maskRect?.x ?? 0,
            maskRect?.y ?? 0,
            maskRect?.width ?? 0,
            maskRect?.height ?? 0,
            this._depthMaskZ ?? zIndex,
          );
        },
        {
          visible: this.visible,
          zIndex: this.zIndex,
          clientRect: this.clientRectObs,
          clipBox: (this.clipBox as Observable<BoundingBox | null>) ?? undefined,
        },
      ),
      'depthMaskUpdater',
    );
  }

  @MemoizeOwned()
  get visible(): ObservableReader<boolean> {
    return this.parentNode?.visible ?? new Observable(true);
  }

  get cursor(): string {
    return this._cursorFromParent ?? 'default';
  }

  get index(): number {
    const parent = this.parentNode;
    if (!parent) return -1;

    const pchildren = parent.children;
    if (!pchildren) return this._index;
    return pchildren.indexOf(this);
  }
  nextChildIndex = 0;
  getNextChildIndex() {
    // HACK - this will misalign with actual children indexing in pretty much any case other than get children being called first
    return this.nextChildIndex++;
  }

  // set index(val: number) {
  //   this.index = val;
  // }

  // assignChildZindex() {
  //   return ++this.lastZindex;
  // }
  // initialZindex() {
  //   return this.parentNode?.assignChildZindex() ?? 0;
  // }
  // /**
  //  * Recalculate the Zindex for MY latter siblings
  //  */
  // recalcSubsequentSiblingZindex() {
  //   // debugger;
  //   this.parentNode?.recalcChildZindexAfter(this.index);
  // }

  // recalcChildZindexAfter(lastChildIndex: number) {
  //   const children = this.children || [];
  //   // debugger;
  //   const lastChild = children[lastChildIndex];
  //   if (!lastChild) return;
  //   let lastZindex = lastChild.lastZindex;

  //   [...children].splice(lastChildIndex + 1).forEach((child, i) => {
  //     lastZindex = child.assignZindex(lastZindex + 1);
  //   });
  //   this.bumpLastZIndex(lastZindex);

  //   this.recalcSubsequentSiblingZindex();
  // }

  // bumpLastZIndex(lastZIndex: number) {
  //   // console.log('MARK 3 bumpLastZIndex(lastZIndex)', lastZIndex);
  //   this.lastZindex = Math.max(this.lastZindex, lastZIndex);
  // }

  // assignZindex(zIndex?: number): number {
  //   // console.log('MARK 4 assignZindex(zIndex)', zIndex);

  //   zIndex ??=
  //     (this.prevSibling()?.lastZindex ?? this.parentNode?.zIndex.value ?? 0) +
  //     this.index;
  //   // if(this.zIndex.value >= zIndex) return this.zIndex.value
  //   this.zIndex.set(zIndex);

  //   let lastZIndex = zIndex; // we just used this one, so it's the "last"
  //   const children = this.children;
  //   if (!children)
  //     throw new Error('No children, likely forgot to call node.init()');
  //   children.forEach((child) => {
  //     // Every child needs a new index, thus the +1
  //     // And returns the last one by its children
  //     lastZIndex = child.assignZindex(lastZIndex + 1);
  //   });

  //   this.parentNode?.bumpLastZIndex(lastZIndex);
  //   return lastZIndex; // + gap;
  // }

  // recalcZindex() {
  //   const parent = this.parentNode;
  //   if (parent) {
  //     // Upward
  //     parent.recalcZindex();
  //   } else {
  //     // We're the root, so now go downward
  //     // this.assignZindex(1);
  //   }
  // }

  @MemoizeOwned()
  get fitContentObs(): ObservableReader<boolean> {
    return new Observable(false);
  }

  @MemoizeOwned()
  get behaviors(): Behavior[] {
    // This is what sets (most of) the order of behavior precedence - except temporary PRIORITY behaviors, because that is a global state, not specific to this VM node.
    return [
      ...this.getLocalBehaviors(), // Mine only
      ...this.heritableBehaviors,
    ];
  }

  @MemoizeOwned()
  get heritableBehaviors(): Behavior[] {
    return [
      ...this.getHeritableBehaviors(), // For me and my children
      ...(this.parentNode?.heritableBehaviors || []), // Passed down from my parents
    ];
  }

  // this IS overridden in child classes
  getLocalBehaviors(): Behavior[] {
    return [];
  }

  // this IS overridden in child classes
  getHeritableBehaviors(): Behavior[] {
    return [];
  }
  findBehavior<T extends new (...args: any[]) => any>(
    cls: T,
  ): InstanceType<T> | null {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.behaviors.find(
      (b) => b instanceof cls,
    ) as InstanceType<T> | null;
  }
  @MemoizeOwned()
  get coalescedPrivileges(): ObservableReader<Model.Priv.InheritedPrivs | undefined> | null {
    return this.privilegeCoalescenceParent?.coalescedPrivileges ?? null;

    // No parent node means no privilege coalescence is possible here
    // It is important to note that VertexNode overrides this method *without* calling super
  }

  @MemoizeOwned()
  get validUserIDsForInstructions(): ObservableReader<string[] | undefined> {
    const parent = this.parentNode;
    if (parent) {
      return parent.validUserIDsForInstructions;
    }
    return new Observable<string[] | undefined>([]);
  }
  @MemoizeOwned()
  get visibleUserIDsForDescendants(): ObservableReader<string[] | undefined> {
    const parent = this.parentNode;
    if (parent) {
      return parent.visibleUserIDsForDescendants;
    }
    // the default case is that it's undefined and loaded
    return new Observable<string[] | undefined>(undefined, () => Promise.resolve());
  }
  minWidth = 25;
  minHeight = 25;

  maxWidth?: number;
  maxHeight?: number;
  @OwnedProperty
  marginLeft = new Observable(0);
  doLayout() {
    // this.children.forEach((child) => child.doLayout());

    // HACK. TODO: call doLayout whenever we are resizing
    if (!this.clientRect) return;
    this._defaultClientRectObs?.set(this.clientRect, undefined, undefined, true);
  }
  unbind?: () => void;
  lastEl?: HTMLElement;
  _bindTimeout?: NodeJS.Timeout;
  // elHistory: (HTMLElement|null)[] = [];
  safeBindDomElement(el: HTMLElement | null) {
    // this.elHistory.push(el);
    if (!this.alive || !el) return;
    if (el.isConnected) {
      this.bindDomElement(el);
    } else {
      setTimeout(() => {
        if (!this.alive) return;
        if (el.isConnected) {
          this.bindDomElement(el);
        } else {
          console.error('safeBindDomElement not connected', this, el, el.isConnected);
        }
      }, 100);
    }
  }
  private bindDomElement(el: HTMLElement) {
    if (this.domElement !== el && this.domElement?.isConnected) {
      console.error('re-bind dom element from', this.domElement, 'to', el, 'for node', this);
    }

    const { eventNav } = this.context;

    if (el !== this.domElement) {
      this.unbind?.();
      const enter = (e: MouseEvent) => eventNav.handleEvent('handleMouseEnter', this, e);
      const over = (e: MouseEvent) => eventNav.handleEvent('handleMouseOver', this, e);
      const leave = (e: MouseEvent) => eventNav.handleEvent('handleMouseLeave', this, e);

      const change = (e: Event) => eventNav.handleEvent('handleChange', this, e);
      this.addManagedListener(el, 'change', change);

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseover', over);
      el.addEventListener('mouseleave', leave);

      this.unbind = () => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseover', over);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('change', change);
      };
      this.domElement = el;
      this.resizeObserver?.observe(el);
      this._bindDone(el);
    }

    // focusChanged means there was some pendingFocus which was activated
    // and maybe that was for us, or maybe that was for a delegate, but either way,
    // it was done and we shouldn't contravene that

    const matched = eventNav.focusState.checkPendingFocus(this);

    if (
      !matched && // Some other node did not just get focused
      this.isFocused.value === 'leaf' /* && */ // AND I am the leaf
      // document.activeElement !== el // AND the document doesn't consider me to be active yet
    ) {
      // Otherwise, we were the delegate before we rendered
      this.applyPendingFocus();
    }

    // Until we transition off of the native browser DOM, we will have to doLayout after binding to the element
    this.doLayout();
  }
  waitForDomElement(): Promise<HTMLElement> {
    if (this.domElement) return Promise.resolve(this.domElement);
    return this._bindProm;
  }
  protected cleanup() {
    this.setHover(false);

    if (this.depthMaskId) this.context?.depthMaskService?.remove_instance(this.depthMaskId);

    const children = this._children;
    this._children = undefined;

    this.childProps.forEach((childProp) => {
      // This should automatically deregister those properties using @OwnedProperty
      this[childProp as keyof this] = undefined as any;
    });

    this.unbind?.();
    super.cleanup();
  }
  get root(): Node | undefined | null {
    if (this.parentNode) {
      return this.parentNode.upgrade()?.root;
    } else {
      return this;
    }
  }
  // Array of weak references
  get path(): Node[] {
    let parent = this.parentNode?.upgrade();
    if (parent) {
      return [...parent.path, parent];
    } else {
      return [];
    }
  }
  lowestCommonAncestor(node: Node): Node | null {
    const pathA = this.path;
    const pathB = node.path;
    const len = pathA.length;
    let last: Node | null = null;

    for (let i = 0; i < len; i++) {
      const a = pathA[i];
      const b = pathB[i];
      if (a && b && a.equals(b)) {
        last = a;
      } else {
        break;
      }
    }
    return last;
  }
  // gets the lowest common ancestor of each node, that are siblings
  lowestCommonSiblingAncestors(node: Node): Node[] {
    if (this.contains(node)) return [this];
    if (node.contains(this)) return [node];
    const lca = this.lowestCommonAncestor(node);
    if (!lca) return [];
    const a1 = lca.findChildShallow((n) => n.contains(this) && n);
    const a2 = lca.findChildShallow((n) => n.contains(node) && n);
    let r: Node[] = [];
    if (a1) r.push(a1);
    if (a2) r.push(a2);
    return r;
  }
  handleBlur(prevFocusType: 'leaf' | 'branch') {}
  onBlur(stopAt?: Node | null) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: Node | null = this.upgrade();

    while (node) {
      if (stopAt?.equals(node)) return;
      // do this up here in case any of the below causes the node to be destroyed, we can't access parentNode or domElement
      const p: Node | null = node.parentNode?.upgrade() ?? null;
      const el = node.domElement;
      // in case the isFocused obs got destroyed
      const isFocused = node.isFocused.upgrade();
      const prevFocusType = isFocused?.value;
      isFocused?.set(false);
      el?.blur();
      if (prevFocusType) node.handleBlur(prevFocusType);
      node = p;
    }
  }
  handleFocus(focusType: 'leaf' | 'branch', ctx: FocusContext, prevState: false | 'leaf' | 'branch') {}
  /**
   * Accept the tip of the delgated focus and notify all non-tip nodes that they are also focused
   */
  onFocus(context: FocusContext) {
    this.validate();
    const prevFocusState = this.isFocused.value;
    this.isFocused.set('leaf');
    this.handleFocus('leaf', context, prevFocusState);
    const el = this.domElement;

    this.trace(3, () => ['onFocus', el?.tagName, el?.isConnected]);
    this.setFocus(context);

    if (!this.propagateFocus) return;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    let parentNode = this.parentNode as Node | null;
    while (parentNode) {
      // this.trace(11, () => ['onFocus traverse parent', parentNode]);

      const prevFocusState = parentNode.isFocused.value;
      if (prevFocusState !== 'branch') {
        parentNode.isFocused.set('branch');
        parentNode.handleFocus('branch', context, prevFocusState);
      }
      parentNode = parentNode?.parentNode;
    }
  }

  get focusContext(): FocusContext {
    return {};
  }
  get focusCoords(): { x: number; y: number } | null {
    const cr = this.clientRect;
    if (!cr) return null;
    return {
      x: cr.x,
      y: cr.y,
    };
  }

  pendingFocusContext?: FocusContext;
  applyPendingFocus() {
    if (this.pendingFocusContext && this.domElement?.isConnected) {
      this.domElement.focus({ preventScroll: true });
      const context = this.pendingFocusContext;
      this.pendingFocusContext = undefined;
      this.applyFocusContext(context);
    }
  }
  setFocus(context: FocusContext) {
    if (this.domElement?.isConnected) {
      this.domElement.focus({ preventScroll: true });
      return this.applyFocusContext(context);
    }
    this.pendingFocusContext = context;
  }

  applyFocusContext(context: FocusContext) {
    // base implementation does nothing
  }

  @OwnedProperty
  _hover = new Observable<'leaf' | 'branch' | false>(false);
  get hover(): ObservableReader<'leaf' | 'branch' | false> {
    return this._hover;
  }
  setHover(type: 'leaf' | 'branch' | false = 'leaf') {
    // Noop to avoid redundant recursion in the case that multiple VM nodes are cleaned up
    if (type === this._hover.value) return;

    this._hover.set(type);
  }

  focusPreviousCharacter(): boolean {
    return false;
  }

  focusNextCharacter(): boolean {
    return false;
  }

  private _depth: number | undefined;
  get depth(): number {
    this._depth ??= (this.parentNode?.depth || 0) + 1;
    return this._depth;
  }

  contains(other: Node): boolean {
    return other.findClosest((n) => n.equals(this)) ?? false;
  }

  siblingsBetween(node: Node): Node[] {
    // if they dont have the same parent, they are not siblings
    if (node.parentNode !== this.parentNode) return [];
    if (node.equals(this)) return [];
    let startIdx = Math.min(node.index, this.index);
    let endIdx = Math.max(node.index, this.index);
    return this.parentNode?.children.slice(startIdx + 1, endIdx) ?? [];
  }

  /** returns the nearest node or parent node that matches the criteria */
  closest(cb: (n: Node) => boolean): Node | undefined {
    if (cb(this)) return this;
    const parentNode = this.parentNode;
    if (parentNode) return parentNode.closest(cb);
    return undefined;
  }
  closestParent(cb: (n: Node) => boolean): Node | undefined {
    const parentNode = this.parentNode;
    if (parentNode) return parentNode.closest(cb);
    return undefined;
  }
  closestInstance<T extends new (...args: any[]) => any>(cls: T): InstanceType<T> | null {
    if (this instanceof cls) return this as InstanceType<T>;
    return (this.parentNode?.closestInstance(cls) as InstanceType<T>) ?? null;
  }
  findClosest<T>(cb: (n: Node) => T | undefined | false): T | undefined {
    const v: T | undefined | false = cb(this);
    if (v) return v;
    const parentNode = this.parentNode;
    if (parentNode) return parentNode.findClosest(cb);
    return undefined;
  }

  findChildren<T>(matchFn: (n: Node) => T | undefined | false): T[] {
    const c: T[] = [];
    const cc = matchFn(this);
    if (cc) c.push(cc);
    for (const child of this.children) {
      c.push(...child.findChildren(matchFn));
    }
    return c;
  }

  /**
   * Return the first child (recursively) which matches the provided matchFn
   */
  findChild<T>(
    matchFn: (n: Node) => T | undefined | false,
    prefilterFn?: (n: Node, children: Node[]) => Node[],
  ): T | null {
    const children = prefilterFn ? prefilterFn(this, this.children) : this.children;
    const len = children.length;

    // when iterating through children, we want to go sequentially rather than backwards because first should take priority
    for (let i = 0; i < len; i++) {
      const child = children[i];
      // console.log('child', child, this.children);
      const match = matchFn(child);
      if (match) return match;

      // False means discontinue recursion for this node
      // if (match !== false) {
      const match2 = child.findChild(matchFn, prefilterFn);
      if (match2) return match2;
      // }
    }
    return null;
  }

  /**
   * Return the first child index (recursively) which matches the provided matchFn
   */
  findChildIdx<T>(matchFn: (n: Node) => T | undefined | false): number {
    const children = this.children;
    const len = children.length;
    // when iterating through children, we want to go sequentially rather than backwards because first should take priority
    for (let i = 0; i < len; i++) {
      const child = children[i];
      // console.log('child', child, this.children);
      const match = matchFn(child);
      if (match) return i;

      // False means discontinue recursion for this node
      // if (match !== false) {
      const match2 = child.findChild(matchFn);
      if (match2) return i;
      // }
    }
    return -1;
  }

  /**
   * Return the first child (shallowly) which matches the provided matchFn
   */
  findChildShallow<T>(matchFn: (n: Node) => T | undefined | false): T | null {
    const children = this.children;
    const len = children.length;
    // when iterating through children, we want to go sequentially rather than backwards because first should take priority
    for (let i = 0; i < len; i++) {
      const child = children[i];
      // console.log('child', child, this.children);
      const match = matchFn(child);
      if (match) return match;
    }
    return null;
  }

  /**
   * Return the deepest/last child (recursively) which matches the provided matchFn
   */
  findDeepestChild<T>(matchFn: (n: Node) => T | undefined | false): T | null {
    const children = this.children;
    const len = children.length;
    for (let i = len - 1; i >= 0; i--) {
      const child = children[i];

      // if (myMatch != false) {
      const deepMatch = child.findDeepestChild(matchFn);
      if (deepMatch) return deepMatch;
      // }

      const myMatch = matchFn(child);
      if (myMatch) return myMatch;
    }
    return null;
  }

  /**
   * return this object's next sibling matching the provided matchFn
   */
  findNextSibling<T>(matchFn: (n: Node) => T | undefined | false): T | null {
    const parent = this.parentNode;
    if (!parent) return null;
    const pchildren = parent.children;
    const len = pchildren.length;
    for (let i = this.index + 1; i < len; i++) {
      const match = matchFn(pchildren[i]);
      if (match) return match;
    }
    return null;
  }
  /**
   * get this object's previous sibling from the parentNode, _IF_ it is the same type as this object
   */
  prevSibling(): this | null {
    const parent = this.parentNode;
    if (!parent) return null;
    const sibling = parent.children[this.index - 1] ?? null;

    if (sibling && sibling.constructor == this.constructor) {
      return sibling as this;
    }
    return null;
  }

  /**
   * get this object's next sibling, _IF_ it is the same type as this object
   */
  nextSibling(): this | null {
    const parent = this.parentNode;
    if (!parent) return null;
    const sibling = parent.children[this.index + 1] ?? null;

    if (sibling && sibling.constructor == this.constructor) {
      return sibling as this;
    }
    return null;
  }

  prevSiblingAny(): Node | undefined {
    const parent = this.parentNode;
    if (!parent) return undefined;
    let pchildren = parent.children;
    const i = pchildren.indexOf(this);
    if (i === -1) {
      console.warn(
        `nextSiblingAny: object ${this.constructor.name} not found in children of ${parent.constructor.name}`,
      );
      return undefined;
    }
    if (i == 0) return undefined;
    return pchildren[i - 1];
  }
  nextSiblingAny(): Node | undefined {
    const parent = this.parentNode;
    if (!parent) return undefined;
    const pchildren = parent.children;
    const i = pchildren.indexOf(this);
    if (i === -1) {
      console.warn(
        `nextSiblingAny: object ${this.constructor.name} not found in children of ${parent.constructor.name}`,
      );
      return undefined;
    }
    if (i !== this.index) {
      console.warn(`index mismatch for ${this.constructor.name}`);
    }

    return pchildren[i + 1] ?? undefined;
  }

  firstChild(): this['children'][0] | null {
    return this.children[0] ?? null;
  }

  lastChild(): this['children'][0] | null {
    return this.children[this.children.length - 1] ?? null;
  }

  /**
   * Return the first "successive" node matching the provided matchFn.
   * "successive" meaning the first child, next sibling, or next uncle (recursively)
   *
   * matchFn is a function that returns:
   *   T when a match is found
   *   undefined when recursion down that branch is acceptable
   *   false when recursion down that branch should be halted
   *
   * Example:
   * A
   *   B (succeeds A)
   *   C (succeeds B)
   * D (succeeds C)
   */

  findSucceedingNode<T>(matchFn: (n: Node) => T | undefined | false): T | null {
    // search my children
    const childMatch = this.findChild(matchFn);
    if (childMatch) return childMatch;

    const parent = this.parentNode;

    // No parent means no siblings and no uncles
    if (!parent) return null;

    // Search the latter siblings
    const sibLen = parent.children.length;

    for (let i = sibLen - 1; i > this.index; i--) {
      const sibling = parent.children[i];
      const match: T | undefined | false = matchFn(sibling);
      if (match) return match; // matched the sibling - we're done

      // False means do not continue to recurse this sibling
      // if (match !== false) {
      const match2 = sibling.findChild(matchFn);
      if (match2) return match2;
      // }
    }

    // Because we are searching successive nodes, the parentage itself is never considered
    // But we do have to search our uncles after that parent

    // Search the latter uncles
    let uncle;

    // search upward through my parents / grandparents
    let searchParent: Node | null = this.parentNode;
    // Walk the parents until I find an uncle
    while (searchParent) {
      // Consider the subsequent siblings of my parent/grandparent - but never the parent/grandparent itself
      uncle = searchParent.nextSiblingAny();
      searchParent = searchParent.parentNode;

      // walk the successive uncles on that tier
      while (uncle) {
        const match: T | undefined | false = matchFn(uncle);
        if (match) return match; // matched the uncle - we're done

        // False means do not continue to recurse
        // if (match !== false) {
        const match2 = uncle.findChild(matchFn);
        if (match2) return match2;
        // }
        uncle = uncle.nextSiblingAny();
      }
    }

    return null;
  }

  /**
   * Return the first "preceding" node matching the provided matchFn.
   * This is the opposide of succession as defined by findSuccessiveNode
   *
   * matchFn is a function that returns:
   *   T when a match is found
   *   undefined when recursion down that branch is acceptable
   *   false when recursion down that branch should be halted
   *
   * Example:
   * A
   *   B (succeeds A)
   *   C (succeeds B)
   * D (succeeds C)
   */

  findPrecedingNode<T>(matchFn: (n: Node) => T | undefined | false): T | null {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let searchNode: Node | null = this;
    while (searchNode) {
      // Don't consider the original `this`
      let nodeMatch = searchNode === this ? null : matchFn(searchNode);
      if (nodeMatch) return nodeMatch;

      const siblings = searchNode.parentNode?.children;
      // search preceeding siblings of the search node
      if (siblings) {
        for (let i = searchNode.index - 1; i >= 0; i--) {
          const sibling = siblings[i];
          const sibMatch = sibling.findDeepestChild(matchFn);
          if (sibMatch) return sibMatch;

          const match = matchFn(sibling);
          if (match) return match; // matched the sibling - we're done
        }
      }

      // look upward
      searchNode = searchNode.parentNode;
    }

    return null;
  }

  /**
   * Creates a shallow clone of a given vertex. This should be overridden in child classes as-needed to achieve the desired effect upon cloning (eg cloning properties).
   * If overwritten, document why.
   * If this method returns null (as is the default case), stop traversal.
   *
   * @param {Model.Vertex} targetParentVertex - The target parent vertex that we should be cloning properties to.
   * @param {CloneContext} cloneContext - The clone context used for cloning.
   * @return {Promise<Model.Vertex | null>} - A promise that resolves with the vertex that ought to be used for cloning purposes downstream, or null if the buck stops here
   */
  @Guarded
  async shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    return Promise.resolve(null);
  }

  // top-level template cloning
  @Guarded
  async applyAsTemplate(
    targetParentVertex: Model.Vertex,
    cloneContext: CloneContext,
    filterChildren?: (child: Node) => boolean,
  ) {
    // clone my own properties first
    const targetChildVertex = await this.shallowClone(targetParentVertex, cloneContext);
    if (targetChildVertex) await this.applyChildrenAsTemplate(targetChildVertex, cloneContext, filterChildren);
  }

  /**
   * Explicitly not cloning the root node, either use applyAsTemplate or clone it separately
   */

  @Guarded
  async applyChildrenAsTemplate(
    targetParentVertex: Model.Vertex,
    cloneContext: CloneContext,
    filterChildren?: (child: Node) => boolean,
  ) {
    await Promise.all(
      this.children.map(async (templateChild) => {
        if (filterChildren?.(templateChild) === false) return;
        await Guard.while(templateChild, async (templateChild) => {
          const targetChildVertex = await templateChild.shallowClone(targetParentVertex, cloneContext);
          if (targetChildVertex) {
            await templateChild.applyChildrenAsTemplate(targetChildVertex, cloneContext);
          }
        });
      }),
    );
  }

  // Most nodes are already loaded as soon as they are initialized
  load(): Promise<void> {
    this.loadChildren();
    return Promise.resolve();
  }

  // typically only used in testing
  async recursiveLoad(): Promise<void> {
    await this.load();
    await Promise.all(this.children.map((child) => child.recursiveLoad()));
  }

  /**
   * Non-parallelized tree walk
   */
  async walkTree(filterChildren?: (child: Node) => boolean, completionFn?: (node: Node) => Promise<void>) {
    await this.load();
    for (const child of this.children) {
      if (filterChildren?.(child) === false) return;
      await child.walkTree(filterChildren, completionFn);
    }

    await completionFn?.(this);
    this.conditionalUnloadChildren();
  }

  /**
   * Each property should be updated by their respective Node, not by the branch
   */
  get updatables(): null | UpdatablesSet {
    return null;
  }

  lineageContains(vertex: Model.Vertex): boolean {
    return this.parentNode?.lineageContains(vertex) || false;
  }

  projectedPrivileges() {
    const inh = this.coalescedPrivileges?.value;
    if (!inh) throw 'coalescedPrivileges not loaded';

    return Model.Priv.PrivState.fromInherited(inh);
  }

  private _loading?: Promise<void>;
  private _loaded = false;
  get loaded() {
    return this._loaded;
  }
  get loading() {
    return !!this._loading;
  }

  // Do NOT override!
  // async load(): Promise<void> {
  //   if (this._loaded) return;

  //   if (this._loading) {
  //     // the 2nd caller onwards should await the completion of `loadOnce`
  //     await this._loading;
  //     return;
  //   }
  //   let resolve: () => void;
  //   this._loading = new Promise((r) => {
  //     resolve = r;
  //   });

  //   // Load self first, because it may be necessary for children
  //   await this.loadSelf();

  //   await Promise.all([this.loadChildren()]).catch((e) => {
  //     console.error('Loading failed', e);
  //     raiseError('Loading failed');
  //   });

  //   this._loaded = true;
  //   resolve!();
  //   this.trace(4, () => ['LOADED NODE', this.key, this.children, this]);
  // }

  // Override this (not .load())
  // a funnel for async methods in all nodes
  protected loadSelf(): Promise<void> {
    return Promise.resolve();
  }

  @WeakProperty
  get isTiling() {
    const root = this.context.rootNode;
    if (!(root instanceof AppDesktop)) return new Observable(false);
    return root.tileContainer.visible;
  }

  get isVisible(): boolean {
    return this.visible.value && (this.parentNode?.isVisible ?? true);
  }

  get isRendered() {
    return !!this.domElement;
  }

  indicate(flag: IndicationFlag) {
    if (this.indicated.value[flag] == true) return;
    this.indicated.set({ ...this.indicated.value, [flag]: true });
  }
  deindicate(flag: IndicationFlag) {
    if (!!this.indicated.value[flag] == false) return;
    this.indicated.set({ ...this.indicated.value, [flag]: false });
  }
  /* This is different from transparent in that we want behaviors to stop at this node, and not look
  at the children. It serves to allow access to the children or not. */
  get opaque() {
    return false;
  }
  intersectScreenpoint(clientPoint: Point): boolean {
    const box = this.clientRect ?? this.clientRectObs.value;
    if (!box) return false;
    return (
      clientPoint.x >= box.left && clientPoint.x <= box.right && clientPoint.y >= box.top && clientPoint.y <= box.bottom
    );
  }

  getNodeAtScreenPoint(clientPoint: Point, isPointer: boolean, matchFn?: (_node: Node) => boolean): Node | null {
    this.validate();
    if (isPointer && !this.pointerEvents) return null;
    if (!this.visible.value) return null;

    // @ts-ignore
    if (this.root === this) {
      // first iterate through attachedPanels, but only if we are at the root.
      // @ts-ignore
      const attachedPanels = this.context.floatingPanels;

      // iterate in reverse because attached panels may spawn other attached panels
      for (const panel of Array.from<Node>(attachedPanels).reverse()) {
        const intersect = panel.intersectScreenpoint(clientPoint);

        if (intersect) {
          for (let i = panel.children.length - 1; i >= 0; i--) {
            const child = panel.children[i];
            // if (!child.visible.value) continue;
            const match = child.getNodeAtScreenPoint(clientPoint, isPointer, matchFn);
            if (match) {
              if (matchFn && !matchFn(match)) continue;
              return match;
            }
          }
          if (!panel.transparent) return panel;
        }
      }
    }

    // if no attachedPanel intersects, the continue as normal.

    const intersect = this.intersectScreenpoint(clientPoint);

    // If a node is overflow, it means that the node itself doesn't need to intersect in order for us to look at its children
    if (intersect || this.overflow) {
      if (!this.children) throw new Error('no children');
      // need to reverse because if items are sorted, they should be sorted in increasing z-index, which means
      // higher z-index items are at the end of the list
      // higher z-index items should get priority
      if (this.iterateChildrenForwards) {
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          // if (!child.visible.value) continue;
          const match = child.getNodeAtScreenPoint(clientPoint, isPointer, matchFn);
          if (match) {
            if (matchFn && !matchFn(match)) continue;
            return match;
          }
        }
      } else {
        for (let i = this.children.length - 1; i >= 0; i--) {
          const child = this.children[i];
          const match = child.getNodeAtScreenPoint(clientPoint, isPointer, matchFn);
          if (match) {
            if (matchFn && !matchFn(match)) continue;
            return match;
          }
        }
      }
    }
    if (intersect && !this.transparent) {
      if (matchFn && !matchFn(this)) return null;
      return this;
    }
    return null;
  }

  getNodesAtScreenRect(clientRect: Rect, matchFn?: (_node: Node) => boolean): Node[] {
    if (!this.visible.value) return [];
    const res: Node[] = [];
    const box = this.clientRect ?? { left: 0, right: 0, top: 0, bottom: 0 };

    const intersect = !(
      clientRect.left + clientRect.width < box.left ||
      box.right < clientRect.left ||
      clientRect.top + clientRect.height < box.top ||
      box.bottom < clientRect.top
    );

    if (intersect) {
      if (!matchFn || matchFn(this)) res.push(this);
    }

    if (intersect || this.overflow) {
      // need to reverse because if items are sorted, they should be sorted in increasing z-index, which means
      // higher z-index items are at the end of the list
      // higher z-index items should get priority
      const children = this.children;
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        const matches = child.getNodesAtScreenRect(clientRect, matchFn);
        res.push(...(matchFn ? matches.filter(matchFn) : matches));
      }
    }

    return res;
  }

  getNodesInBoundingBox(bbox: BoundingBox, matchFn?: (_node: Node) => boolean): Node[] {
    const res: Node[] = [];
    const box = this.clientRectObs.value;

    const intersect = !(
      bbox.left + bbox.width < box.left ||
      box.right < bbox.left ||
      bbox.top + bbox.height < box.top ||
      box.bottom < bbox.top
    );

    if (intersect) {
      if (!matchFn || matchFn(this)) res.push(this);
    }

    if (intersect || this.overflow) {
      const children = this.children;
      // need to reverse because if items are sorted, they should be sorted in increasing z-index, which means
      // higher z-index items are at the end of the list
      // higher z-index items should get priority
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        const matches = child.getNodesInBoundingBox(bbox, matchFn);
        res.push(...(matchFn ? matches.filter(matchFn) : matches));
      }
    }

    return res;
  }

  // difference between dragHandle and draggable is that dragHandle is "am I allowed to drag by this item
  get dragHandle(): boolean {
    return false;
  }

  // TODO move this to interface Draggable
  // draggable is "what is the thing actually being dragged?"
  get draggable(): boolean {
    return false;
  }

  get selectable(): boolean {
    return false;
  }

  droppable(items: Node[]): boolean {
    return false;
  }

  /** Default getter for the current (non-observable) client screen coordinates.
   * Uses the DOM element to query the layout engine (in this case, the browser DOM)
   * This will be overridden in cases where we are not using the DOM for layout.
   */
  get clientRect(): BoundingBox | null {
    if (!this.isVisible) return null;
    if (!this.isRendered) {
      if ((window as any).warnUnrendered) {
        console.error(
          `${this.constructor.name} is not bound to a DOM element (child of ${
            this.parentNode?.constructor.name ?? 'null'
          })`,
        );
      }
      return null;
    }

    const element = this.domElement;
    if (!element) return null; // Cannot establish a coordinate frame without an element

    return BoundingBox.fromDomRect(element.getBoundingClientRect());
  }

  // Default clientRectObs updates with clientRect on doLayout
  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    // TODO: add Mutation/Resize observer so that we can keep this up-to-date
    const rect = this.clientRect;
    const obs = new Observable(rect ?? new BoundingBox({ x: 0, y: 0, height: 0, width: 0 }));

    this._defaultClientRectObs = obs;

    return obs;
  }
  /**
   * The bounding box outside of which the component is forbidden to render
   * expressed in client screen coordinates
   */
  @MemoizeOwned()
  get clipBox(): ObservableReader<BoundingBox | null> | null {
    // TODO: we should probably be scaling this in vertex shader?
    return this.parentNode ? this.parentNode.clipBox : null;
  }

  @MemoizeOwned()
  get diagBox() {
    return new DiagBox(null);
  }

  reveal() {
    const rect = this.clientRect || this.clientRectObs.value;
    console.log('revealNodeDiag', this);
    if (rect)
      this.diagBox.ping(
        {
          x: rect.x,
          y: rect.y,
          height: rect.height,
          width: rect.width,
          label: `${this.label ?? this.constructor.name} ${this._loaded ? '' : ' (not loaded)'}`,
        },
        !this._loaded,
      );
  }

  handleDrop(items: DragItem[], dropEvent: MouseEvent, trx: TrxRef, isTransclusion: boolean): Promise<Node[]> {
    return Promise.resolve([]);
  }

  handleDepart(trx: TrxRef): boolean {
    return false;
  }

  includeParentActions: boolean | null = null;
  getActions(): ActionGroup[] {
    let indexed: { [label: string]: Action[] } = {};

    // flat map and group actions by label
    for (const behavior of this.behaviors) {
      const actionGroups = behavior.getActions(this);
      for (const { label, actions: axns } of actionGroups) {
        if (!indexed[label]) {
          indexed[label] = [];
        }
        indexed[label] = [...indexed[label], ...axns];
      }
    }

    const actions = Object.entries(indexed)
      .map(([label, actions]) => {
        if (actions.length === 0) return null;
        return {
          label,
          actions,
        };
      })
      .filter(Boolean) as ActionGroup[];

    this.trace(2, () => ['getActions', this, this.behaviors, actions]);

    // const inc = this.includeParentActions;
    // if (inc === null ? !(this instanceof BranchNode) : inc) {
    //   actions.push(...(this.parentNode?.getActions() ?? []));
    // }
    return actions;
  }

  getFocusContextForEvent(e: MouseEvent): FocusContext {
    return {};
  }

  get focusable(): boolean {
    return false;
  }

  /**
   *
   * @returns When focus is being sent FROM this node, elect a node to send it to
   */
  parentwardNode(): NodeAndContext | null {
    const ancestor = this.parentNode?.findClosest((n) => n.isVisible && n.focusable && !n.transparent && n);
    if (!ancestor) return null;
    return { node: ancestor };
  }
  upwardNode(): NodeAndContext | null {
    const node = this.findPrecedingNode((n) => n.isVisible && n.focusable && !n.transparent && n);
    if (!node) return null;
    return { node };
  }
  downwardNode(): NodeAndContext | null {
    const node = this.findSucceedingNode((n) => n.isVisible && n.focusable && !n.transparent && n);
    if (!node) return null;
    return { node };
  }
  leftwardNode(): NodeAndContext | null {
    const node = this.findPrecedingNode((n) => n.isVisible && n.focusable && !n.transparent && n);
    if (!node) return null;
    return { node };
  }
  rightwardNode(): NodeAndContext | null {
    const node = this.findSucceedingNode((n) => n.isVisible && n.focusable && !n.transparent && n);
    if (!node) return null;
    return { node };
  }
}
export interface ChildNodeCA<Parent extends Node> extends Omit<NodeCA<Parent>, 'context'> {
  parentNode: Parent;
}

export abstract class ChildNode<Parent extends Node = Node> extends Node<Parent> {
  constructor(args: ChildNodeCA<Parent>) {
    super({ ...args, context: args.parentNode.context });
  }
}
