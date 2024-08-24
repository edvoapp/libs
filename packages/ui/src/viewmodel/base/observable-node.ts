import {
  AwaitCondPromise,
  ChangeContext,
  ChangeListener,
  Guard,
  Guarded,
  IObservableObj,
  ItemEventOrigin,
  MemoizeOwned,
  Observable,
  ObservableReader,
  OwnedProperty,
  Unsubscriber,
  awaitObsCondition,
} from '@edvoapp/util';

import { ChildNodeCA, ChildNode, Node, Point, Rect } from './view-model-node';
import { BoundingBox } from './bounding-box';
import { Model } from '@edvoapp/common';
import { CloneContext } from '../../utils';

export interface ObservableNodeCA<T extends Node | null | undefined, Parent extends Node> extends ChildNodeCA<Parent> {
  childObs: ObservableReader<T>;
  label?: string;
}

export abstract class ObservableNode<T extends Node | null | undefined, Parent extends Node>
  extends ChildNode<Parent>
  implements IObservableObj<T>
{
  @OwnedProperty
  childObs: ObservableReader<T>;

  protected constructor({ childObs, label, ...args }: ObservableNodeCA<T, Parent>) {
    super(args);
    this.childObs = childObs;
    this.label = label;
  }
  protected init(): void {
    super.init();
    void this.childObs.load();
  }
  subscribe(
    fn: ChangeListener<T>,
    notifyInitialValue?: boolean | undefined,
    ctx?: ChangeContext | undefined,
    initialOrigin?: ItemEventOrigin | undefined,
  ): Unsubscriber {
    this.validate();
    return this.childObs.subscribe(fn, notifyInitialValue, ctx, initialOrigin);
  }
  async get(): Promise<Exclude<T, undefined>> {
    this.validate();
    return this.childObs.get();
  }

  async load(): Promise<void> {
    this.validate();
    await this.childObs.load();
  }

  get value(): T {
    return this.childObs.value;
  }

  get rendered() {
    return this.childObs.subscriberCount > 0;
  }

  doLayout() {
    if (this.value) this.value.doLayout();
  }
  getNextChildIndex() {
    return 0;
  }

  get children() {
    const value = this.value;
    return value ? [value] : [];
  }

  @MemoizeOwned()
  get visible(): ObservableReader<boolean> {
    const obs = new Observable(!!this.value);
    // Pretty strange that we're subscribing to ourselves here.
    // Lets use a basic subscribe instead of a managedSubscription to ensure we don't reference ourself
    this.onCleanup(this.subscribe((v) => obs.set(!!v)));
    return obs;
  }
  get isVisible(): boolean {
    return this.visible.value;
  }

  getNodeAtScreenPoint(clientPoint: Point, isPointer = false, matchFn?: (_node: Node) => boolean): Node | null {
    if (isPointer && !this.pointerEvents) return null;
    return this.value?.getNodeAtScreenPoint(clientPoint, isPointer, matchFn) ?? null; // ObservableNodes do not have a bounding box
  }

  getNodesAtScreenRect(clientRect: Rect, matchFn?: (_node: Node) => boolean): Node[] {
    return this.value?.getNodesAtScreenRect(clientRect, matchFn) ?? []; // ObservableNodes do not have a bounding box
  }

  getNodesInBoundingBox(bbox: BoundingBox, matchFn?: (_node: Node) => boolean): Node[] {
    return this.value?.getNodesInBoundingBox(bbox, matchFn) ?? []; // ObservableNodes do not have a bounding box
  }

  @Guarded
  async applyChildrenAsTemplate(
    targetParentVertex: Model.Vertex,
    cloneContext: CloneContext,
    filterChildren?: (child: NonNullable<T>) => boolean,
  ) {
    await Guard.while(this, async (self) => {
      const templateChild = await self.get();

      if (templateChild) {
        if (filterChildren?.(templateChild) === false) return;
        await Guard.while(templateChild, async (templateChild) => {
          const targetChildVertex = await templateChild.shallowClone(targetParentVertex, cloneContext);
          if (targetChildVertex) {
            await templateChild.applyChildrenAsTemplate(targetChildVertex, cloneContext);
          }
        });
      }
    });
  }

  /**
   * overwriting VMNode.shallowClone because we want to ensure that if this has a value, that value is considered for cloning.
   * No need to load here because applyChildrenAsTemplate loads
   */
  @Guarded
  shallowClone(targetParentVertex: Model.Vertex): Promise<Model.Vertex | null> {
    return Promise.resolve(targetParentVertex);
  }

  /**
   * awaitCondition is a helper function that allows you to wait for a condition to be truthy using a closure to check the condition.
   * It will return true if the condition matches, or false if the node is destroyed before the condition is met.
   */
  awaitCondition<R>(condition: (val: T | null | undefined) => R): AwaitCondPromise<R> {
    return awaitObsCondition(this, condition);
  }
}
