import { ChildNodeCA, ConditionalNode, Node, NodeCA } from './base';
import { Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { DEPTH_MASK_Z } from '../constants';
import { ActionMenu } from './topic-space';

export interface Panel extends Node {
  // Does panel actually need to have any api surface?
}

export interface ConditionalPanelCA<P extends Panel, Parent extends Node> extends ChildNodeCA<Parent> {
  factory: (parentNode: ConditionalPanel<P, Parent>) => P | null;
  initialOpenState?: boolean;
  getInitialOpenState?: () => Promise<boolean>;
  // remotelyChangableOpenState?: Observable<boolean>
  // If you only want to set the initialOpenState
}

export interface Closable extends Node {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
  get closable(): boolean;
}

export function isClosable(thing: Node): thing is Closable {
  return 'close' in thing && 'closable' in thing && (thing as Closable).closable;
}

// Typescript really doesn't like overriding statics, but that's dumb
// and it works as is
//@ts-expect-error
export class ConditionalPanel<T extends Panel, Parent extends Node>
  extends ConditionalNode<T, boolean, Parent>
  implements Closable
{
  overflow = true;
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  private setState: (state?: boolean) => void;

  constructor({ factory, initialOpenState, getInitialOpenState, ...args }: ConditionalPanelCA<T, Parent>) {
    let openState: Observable<boolean>;
    if (initialOpenState !== undefined) {
      openState = new Observable(initialOpenState);
    } else if (getInitialOpenState) {
      const obs = new Observable<boolean>(false, async () => {
        const o = await getInitialOpenState();
        obs.set(o);
      });
      openState = obs;
    } else {
      openState = new Observable(false);
    }
    super({
      ...args,
      factory: (p: boolean, parentNode) => {
        return p ? factory(parentNode as ConditionalPanel<T, Parent>) : null;
      },
      precursor: openState,
    });
    this.setState = (newState) => {
      const stateObs = openState.upgrade();
      if (!stateObs) return;

      // Toogle
      if (newState === undefined) {
        stateObs.set(!stateObs.value);
        return;
      }
      // updates the state if necessary
      if (stateObs.value !== newState) stateObs.set(newState);
    };
    const context = this.context;
    context.floatingPanels.add(this);
    this.onCleanup(() => {
      context.floatingPanels.delete(this);
    });

    // Pretty strange that we're subscribing to ourselves here.
    // Lets use a basic subscribe instead of a managedSubscription to ensure we don't reference ourself
    this.subscribe((value) => {
      // check if action menu is stealing focus
      if (!(this.parentNode.parentNode?.parentNode instanceof ActionMenu)) {
        if (value) {
          void this.context.focusState.setFocus(this, {});
        }
      }
    });
  }

  protected init() {
    super.init();
  }

  static new<Parent extends Panel, ParentNode extends Node>(
    args: ConditionalPanelCA<Parent, ParentNode>,
  ): ConditionalPanel<Parent, ParentNode> {
    const self = new ConditionalPanel(args);
    self.init();
    return self;
  }
  get isOpen() {
    return this.precursor!.value;
  }
  open() {
    this.setState(true);
  }
  close() {
    this.setState(false);
  }
  toggle() {
    this.setState(!this.isOpen);
  }

  get closable() {
    return true;
  }

  handleBlur(prevFocusType: 'leaf' | 'branch'): void {
    this.close();
  }
}
