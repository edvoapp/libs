// TODO: Change PropertyNode to have a non-observable Property inside
// And update call sites to instantiate a VMNodeConditional<PropertyNode|undefined> instead

import { Model } from '@edvoapp/common';
import {
  ChangeListener,
  IObservable,
  Observable,
  Unsubscriber,
  MemoizeOwned,
  ItemEventOrigin,
  ChangeContext,
  OwnedProperty,
  Guarded,
  ObservableReader,
} from '@edvoapp/util';

import { ConditionalNode } from './conditional-node';
import { CloneContext } from '../../utils';

import { notEmpty } from './utility';
import { ChildNodeCA, ChildNode, Node } from './view-model-node';

import { Behavior, DispatchStatus, EventNav, FocusContext } from '../..';
import { UpdatablesSet } from './updatables';

export interface PropertyCA extends ChildNodeCA<Node> {
  property: Model.Property;
}

export class PropertyNode extends ChildNode {
  @OwnedProperty
  property: Model.Property;
  constructor({ property, ...args }: PropertyCA) {
    super(args);
    this.property = property;
  }

  static new(options: PropertyCA): PropertyNode {
    const me = new PropertyNode(options);
    me.init();
    return me;
  }

  protected async loadSelf() {
    await this.property.privs.value.load();
  }

  /**
   * overwriting VMNode.shallowClone because we want to clone this property, and we do not want to traverse this tree.
   */
  @Guarded
  shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    cloneContext.cloneProperty(targetParentVertex, this.property);
    return Promise.resolve(null);
  }
}

export interface PropertyObsCA extends ChildNodeCA<any> {
  property: ObservableReader<Model.Property | null | undefined>;
}

export interface PropertyValueCA<T> extends PropertyObsCA {
  valueTransform: (property: Model.Property | null | undefined) => T | ObservableReader<T>;
}

export class PropertyValueNode<T> extends ChildNode implements IObservable<T> {
  @OwnedProperty
  readonly property: ObservableReader<Model.Property | null | undefined>;
  @OwnedProperty
  readonly transformedValue: Observable<T>;
  constructor({ property, valueTransform, ...args }: PropertyValueCA<T>) {
    super(args);

    this.property = property;

    const value = () => valueTransform(property.value);
    let initialValue = value();
    if (initialValue instanceof ObservableReader) {
      initialValue = initialValue.value;
    }

    const transformedValue = new Observable<T>(initialValue, () => property.load());
    this.transformedValue = transformedValue;

    const calc = (_: unknown, origin: ItemEventOrigin, ctx: ChangeContext) => {
      // If the property has changed and we area already loading/loaded, kick the priv load
      if (this.loading || this.loaded) property.value?.privs.value.load();
      transformedValue.input(value(), origin, ctx);
    };

    transformedValue.managedSubscription(property, calc);
  }

  static new<T>(args: PropertyValueCA<T>): PropertyValueNode<T> {
    const me = new PropertyValueNode<T>(args);
    me.init();
    return me;
  }

  async load(): Promise<void> {
    await this.property.load();
  }
  protected async loadSelf() {
    await this.property.load();
    await this.property.value?.privs.value.load();
  }

  get() {
    return this.transformedValue.get();
  }

  get value() {
    return this.transformedValue.value;
  }

  want(): this {
    void this.transformedValue.load();
    return this;
  }

  subscribe(fn: ChangeListener<T>, notifyInitialValue?: boolean): Unsubscriber {
    return this.transformedValue.subscribe(fn, notifyInitialValue);
  }

  get rendered() {
    // A ConditionalNode is "rendered" by being observed
    return this.transformedValue.subscriberCount > 0;
  }
  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.property]);
  }

  /**
   * overwriting VMNode.shallowClone because we want to clone this property, and we do not want to traverse this tree.
   */
  @Guarded
  async shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    await this.load();
    if (this.property.value) cloneContext.cloneProperty(targetParentVertex, this.property.value);

    return null;
  }
}
