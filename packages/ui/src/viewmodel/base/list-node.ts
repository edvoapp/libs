import { Model } from '@edvoapp/common';
import {
  ChangeListener,
  Guard,
  Guarded,
  IObservable,
  ItemListener,
  ObservableList,
  awaitObsCondition,
  AwaitCondPromise,
  OwnedProperty,
  SubscribeArgs,
  SubscribeItemizedListeners,
  Unsubscriber,
} from '@edvoapp/util';
import { FocusContext } from '../..';
import { CloneContext } from '../../utils';

import { ChildNodeCA, ChildNode, Point, Node, Rect } from './view-model-node';
import { BoundingBox } from './bounding-box';

export interface ListNodeCA<Parent extends Node, T extends Node, TPrecursor> extends ChildNodeCA<Parent> {
  precursor: ObservableList<TPrecursor>;
  factory: (pre: TPrecursor, parentNode: ListNode<Parent, T, TPrecursor>, offset: number) => T;
  label?: string;
}

export class ListNode<Parent extends Node, T extends Node, TPrecursor = any>
  extends ChildNode<Parent>
  implements IObservable<T[]>
{
  factory: (pre: TPrecursor, parentNode: ListNode<Parent, T, TPrecursor>, offset: number) => T;
  @OwnedProperty
  readonly precursor: ObservableList<TPrecursor>;
  private _previousVal: T[] = [];
  private _val: T[] = [];
  protected _listeners: {
    ITEM_LISTENER: ItemListener<T>[];
    CHANGE: ChangeListener<T[]>[];
  } = {
    ITEM_LISTENER: [],
    CHANGE: [],
  };
  get rendered() {
    // A ListNode is "rendered" by being observed
    return this._listeners.ITEM_LISTENER.length > 0 || this._listeners.CHANGE.length > 0;
  }
  private constructor(options: ListNodeCA<Parent, T, TPrecursor>) {
    const { precursor, factory, label, ...args } = options;
    super(args);
    this.label = label;
    this.precursor = precursor;
    this.factory = factory;
  }

  static new<Parent extends Node, T extends Node, TPrecursor = any>(
    args: ListNodeCA<Parent, T, TPrecursor>,
  ): ListNode<Parent, T, TPrecursor> {
    const me = new ListNode(args);
    me.init();
    return me;
  }

  protected cleanup() {
    this._val.forEach((item) => {
      item.deregisterReferent(this, '_val');
    });
    super.cleanup();
  }

  // async getDescendingFocusDelegate(ctx: FocusContext): Promise<Node> {
  //   return (
  //     this.firstChild()?.getDescendingFocusDelegate(ctx) ??
  //     super.getDescendingFocusDelegate(ctx)
  //   );
  // }

  init() {
    super.init();
    // this.managedSubscription(this.precursor);
    this.onCleanup(
      this.precursor.subscribe({
        ITEM_LISTENER: (precursorItem, op, origin, changeCtx, offset, newOffset) => {
          if (this.destroyed) return;

          if (origin === 'USER' && !changeCtx.trx) throw 'We really should have a trx for any origin == USER action';

          let item: T;
          if (op === 'ADD') {
            item = this.factory(precursorItem, this, offset); // It's new. Definitely have to call the factory
            item.registerReferent(this, '_val');

            this.insert(offset, item);
          } else if (op === 'REMOVE') {
            item = this.remove(offset);
          } else if (op === 'MOVE') {
            if (newOffset === null || isNaN(newOffset)) throw 'sanity error';
            item = this._val[offset];
            this.move(offset, newOffset);
          } else {
            throw 'invalid op';
          }

          // if (origin === 'USER') queueForTriggerConsideration(changeCtx, item);

          // TODO - copy this this into insert, remove, and move
          this._listeners.ITEM_LISTENER.forEach((itemListener, i) => {
            itemListener(item, op, origin, changeCtx, offset, newOffset);
          });

          if (op === 'REMOVE') item.deregisterReferent(this, '_val');
        },
        MODIFY_LISTENER: (obj, op, origin, ctx) => {
          //
        },
        CHANGE: (_, origin, changeCtx) => {
          if (this.destroyed) return;

          this._listeners.CHANGE.forEach((changeListener) => {
            changeListener(this.value, origin, changeCtx);
          });

          // TODO only do this if we just added stuff
          // this.recalcSubsequentSiblingZindex();
        },
      }),
    );
  }

  get children(): T[] {
    return this.value;
  }
  getNextChildIndex() {
    return this._val.length;
  }

  get clientRect(): BoundingBox | null {
    return null;
  }

  getNodeAtScreenPoint(clientPoint: Point, isPointer = false, matchFn?: (_node: Node) => boolean): Node | null {
    if (isPointer && !this.pointerEvents) return null;

    const children = this.children;
    if (this.iterateChildrenForwards) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const match = child.getNodeAtScreenPoint(clientPoint, isPointer, matchFn);
        if (match) return match;
      }
    } else {
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        const match = child.getNodeAtScreenPoint(clientPoint, isPointer, matchFn);
        if (match) return match;
      }
    }

    return null; // ListNodes do not have a bounding box
  }

  getNodesAtScreenRect(clientRect: Rect, matchFn?: (_node: Node) => boolean): Node[] {
    const res: Node[] = [];
    const children = this.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      const matches = child.getNodesAtScreenRect(clientRect, matchFn);
      res.push(...matches);
    }

    return res; // ListNodes do not have a bounding box
  }

  getNodesInBoundingBox(bbox: BoundingBox, matchFn?: (_node: Node) => boolean): Node[] {
    const res: Node[] = [];
    const children = this.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      const matches = child.getNodesInBoundingBox(bbox, matchFn);
      res.push(...matches);
    }

    return res;
  }

  private insert(offset: number, item: T) {
    if (offset > this._val.length) {
      console.error('insert at this offset would result in sparsity', this._val, item);
      throw new Error('sanity error - insert at this offset would result in sparsity');
    }
    this._val.splice(offset, 0, item);

    // How do we make this a function on VM.Node {
    // updateIndexRange? updateIndexAfter
    // let lastZindex = this._val[offset - 1]?.zIndex.value ?? this.zIndex.value;
    // this._val.slice(offset).forEach((v, i) => {
    //   lastZindex = v.assignZindex(lastZindex + 1);
    // });
    // }
  }
  private remove(offset: number): T {
    if (offset >= this._val.length) {
      throw 'sanity error - removeAt is beyond current range';
    }
    const [removed] = this._val.splice(offset, 1);
    return removed;
  }
  private move(oldOffset: number, newOffset: number) {
    if (oldOffset >= this._val.length) {
      throw 'sanity error - removeAt is beyond current range';
    }
    if (newOffset > this._val.length) {
      console.error('move to this offset would result in sparsity', this._val, newOffset);
      throw new Error('sanity error - move to this offset would result in sparsity');
    }
    const [item] = this._val.splice(oldOffset, 1);
    this._val.splice(newOffset, 0, item);

    // let lastZindex =
    //   this._val[newOffset - 1]?.zIndex.value ?? this.zIndex.value;
    // this._val.slice(newOffset).forEach((v, i) => {
    //   lastZindex = v.assignZindex(lastZindex + 1);
    // });
  }

  subscribe(args: SubscribeArgs<T> /*, initialCtx?: ChangeContext = {}*/): Unsubscriber {
    const { ITEM_LISTENER, CHANGE }: SubscribeItemizedListeners<T> =
      typeof args === 'function' ? { CHANGE: args } : args;

    const initialCtx = {}; // TODO take an initialCtx arg
    // if (this.onSubscribe) this.onSubscribe();

    const isLoaded = this.loaded; // ObservableList is always loaded, but the child classes might not be

    if (ITEM_LISTENER) {
      this._val.forEach((value, index) => {
        ITEM_LISTENER(value, 'ADD', 'DATABASE', initialCtx, index, index);
      });
    }
    if (CHANGE && (isLoaded || this._val.length > 0)) void CHANGE(this.value, 'DATABASE', initialCtx);

    if (ITEM_LISTENER) this._listeners.ITEM_LISTENER.push(ITEM_LISTENER);
    if (CHANGE) this._listeners.CHANGE.push(CHANGE);

    return () => {
      this._listeners.ITEM_LISTENER = this._listeners.ITEM_LISTENER.filter((l) => l !== ITEM_LISTENER);
      this._listeners.CHANGE = this._listeners.CHANGE.filter((l) => l !== CHANGE);
    };
  }

  closest(cb: (n: Node) => boolean): Node | undefined {
    if (cb(this)) return this;
    const parentNode = this.parentNode;
    if (parentNode) return parentNode.closest(cb);
    return undefined;
  }

  get length() {
    return this._val.length;
  }
  idx(index: number): T | undefined {
    return this.value[index];
  }

  get value() {
    return this._val;
  }

  want() {
    void this.precursor.load();
    return this;
  }

  async load() {
    await this.precursor.load();
  }

  protected async loadSelf() {
    await this.load();
  }

  /**
   * awaitCondition is a helper function that allows you to wait for a condition to be truthy using a closure to check the condition.
   * It will return R if the condition matches with thruty, or false if the node is destroyed before the condition is met.
   */
  async awaitCondition<R>(condition: (val: T[]) => R): AwaitCondPromise<R> {
    return awaitObsCondition(this, condition);
  }

  sort(fn?: (a: T, b: T) => number): T[] {
    return this.value.sort(fn);
  }

  async get(): Promise<T[]> {
    await this.precursor.load();
    // throw 'use getLive() instead';
    return this.value;
  }

  async setAndAwaitChange(cb: () => void | Promise<void>): Promise<T[]> {
    this.validate();

    const currentVal = [...this.value];

    let done: (v: T[]) => void;

    const prom = new Promise<T[]>((resolve) => {
      done = resolve;
    });

    const unsub = this.subscribe({
      CHANGE: (val) => {
        if (currentVal.length !== val.length) return done(val);

        // silly deep-equal
        for (let i = 0; i < currentVal.length; i++) {
          const currentItem = currentVal[i];
          const item = val[i];
          if (currentItem !== item) {
            return done(val);
          }
        }
      },
    });

    await cb();
    const v = await prom;
    unsub();
    return v;
  }

  async awaitItemsInList(count = 1): Promise<T[]> {
    this.validate();
    await this.precursor.load();
    if (this.value.length >= count) return Promise.resolve(this.value);

    return new Promise((resolve) => {
      const unsub = this.subscribe((value) => {
        if (value.length >= count) {
          unsub();
          return resolve(value);
        }
      });
    });
  }

  @Guarded
  async applyChildrenAsTemplate(
    targetParentVertex: Model.Vertex,
    cloneContext: CloneContext,
    filterChildren?: (child: Node) => boolean,
  ) {
    const templateChildren = await this.get();

    await Promise.all(
      templateChildren.map(async (templateChild) => {
        if (filterChildren?.(templateChild) === false) return;

        await Guard.while(templateChild, async (templateChild) => {
          const targetChildVertex = await templateChild.shallowClone(targetParentVertex, cloneContext);
          if (targetChildVertex) {
            await templateChild?.applyChildrenAsTemplate(targetChildVertex, cloneContext);
          }
        });
      }),
    );
  }

  /**
   * overwriting VMNode.shallowClone because we want to ensure that if this has children, they are considered for cloning.
   * No need to load here because applyChildrenAsTemplate loads
   */
  @Guarded
  shallowClone(targetParentVertex: Model.Vertex): Promise<Model.Vertex | null> {
    return Promise.resolve(targetParentVertex);
  }
}
