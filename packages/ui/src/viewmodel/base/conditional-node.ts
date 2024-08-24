import { IObservableObj, Observable, OwnedProperty } from '@edvoapp/util';

import { ChildNodeCA, Node } from './view-model-node';
import { ObservableNode } from './observable-node';

export interface ConditionalNodeCA<T extends Node, TPrecursor, Parent extends Node = Node> extends ChildNodeCA<Parent> {
  precursor: IObservableObj<TPrecursor>;
  factory: (pre: TPrecursor, parentNode: ConditionalNode<T, TPrecursor, Parent>) => T | null | undefined;
  label?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ConditionalNode<T extends Node, TPrecursor = any, Parent extends Node = Node> extends ObservableNode<
  T | null | undefined,
  Parent
> {
  factory: (pre: TPrecursor, parentNode: ConditionalNode<T, TPrecursor, Parent>) => T | null | undefined;
  @OwnedProperty
  precursor: IObservableObj<TPrecursor>;

  private initSubscription: () => void;
  _last_precursor?: TPrecursor;

  constructor({ precursor, factory, ...args }: ConditionalNodeCA<T, TPrecursor, Parent>) {
    const childObs = new Observable<T | null | undefined>(undefined, () => precursor.load());

    super({
      ...args,
      childObs,
    });

    this.precursor = precursor;
    this.factory = factory;

    this.initSubscription = () => {
      const value = factory(precursor.value, this);
      if (typeof value !== 'undefined') childObs.set(value);
      childObs.managedSubscription(precursor, (p, origin, changeCtx) => {
        if (this.destroyed) return;

        // Now we get a new val
        const value = factory(p, this);
        if (value && childObs.value && childObs.value.equals(value)) return;
        childObs.set(value, origin, changeCtx, true);
      });
    };
  }

  static new<T extends Node, TPrecursor = any, Parent extends Node = Node>(
    args: ConditionalNodeCA<T, TPrecursor, Parent>,
  ): ConditionalNode<T, TPrecursor, Parent> {
    const me = new ConditionalNode<T, TPrecursor, Parent>(args);
    me.init();
    return me;
  }

  protected init() {
    super.init();
    this.initSubscription();
  }

  async awaitDefined(): Promise<T> {
    await this.load();
    const val = await this.awaitCondition((v) => v !== null && v !== undefined && { v });
    if (!val) throw new Error(`${this.constructor.name} was cleaned up`);
    return val.v;
  }
}
