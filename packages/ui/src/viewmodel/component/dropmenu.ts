import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import { Clickable } from '../../behaviors';
import { ChildNode, ChildNodeCA, ConditionalNode, globalContext, Node } from '../base';
import { DEPTH_MASK_Z } from '../..';

interface CA extends ChildNodeCA<Node> {
  menuFactory: (parentNode: DropMenuBody) => Node;
  buttonFactory?: (parentNode: DropMenu) => DropMenuButton;
  initialExpandState?: boolean;
}

/**
 * VM Node representing a "drop-down menu" which includes a "button" and a "menu"
 * EG:
 * [ The button is always visible ]
 *   [ the menu is  ]
 *   [ hidden until ]
 *   [ button press ]
 */
export class DropMenu extends ChildNode<Node> {
  hasDepthMask = true;
  zIndexed = true;
  overflow = true;
  @OwnedProperty
  expanded = new Observable<boolean>(false);
  menuFactory: (parentNode: DropMenuBody) => Node;
  buttonFactory?: (parentNode: DropMenu) => DropMenuButton;
  initialExpandState?: boolean;
  constructor({ menuFactory, buttonFactory, initialExpandState, ...args }: CA) {
    super(args);
    this.menuFactory = menuFactory;
    this.buttonFactory = buttonFactory;
    this.initialExpandState = initialExpandState;
    if (initialExpandState) {
      this.expanded.set(true);
    }
  }

  static new(args: CA) {
    const me = new DropMenu(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['modal', 'button'];
  }

  @MemoizeOwned()
  get button(): DropMenuButton {
    return (
      this.buttonFactory?.(this) ??
      DropMenuButton.new({
        parentNode: this,
      })
    );
  }

  @MemoizeOwned()
  get modal() {
    return ConditionalNode.new<DropMenuBody, boolean, DropMenu>({
      parentNode: this,
      precursor: this.expanded,
      factory: (want, parentNode) => (want ? DropMenuBody.new({ menuFactory: this.menuFactory, parentNode }) : null),
    });
  }

  expand() {
    this.expanded.set(true);
    if (this.modal) {
      void this.context.focusState.setFocus(this.modal, {});
    }
  }

  collapse() {
    this.expanded.set(false);
  }

  toggle() {
    this.expanded.set(!this.expanded.value);
  }

  handleBlur(prevFocusType: 'leaf' | 'branch'): void {
    this.collapse();
  }
}

interface BodyCA extends ChildNodeCA<ConditionalNode<DropMenuBody, boolean, DropMenu>> {
  menuFactory: (parentNode: DropMenuBody) => Node;
}

// TODO: this may need to extend AttachedPanel
export class DropMenuBody extends ChildNode<ConditionalNode<DropMenuBody, boolean, DropMenu>> {
  readonly label = 'drop-menu';
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  zIndexed = true;
  menuFactory: (parentNode: DropMenuBody) => Node;
  constructor({ menuFactory, ...args }: BodyCA) {
    super(args);
    this.menuFactory = menuFactory;
  }

  static new(args: BodyCA) {
    const me = new DropMenuBody(args);
    me.init();
    return me;
  }

  init() {
    super.init();
    const ctx = globalContext();
    ctx.floatingPanels.add(this);
    this.onCleanup(() => {
      ctx.floatingPanels.delete(this);
    });
  }

  get childProps(): (keyof this & string)[] {
    return ['menu'];
  }

  @MemoizeOwned()
  get menu() {
    return this.menuFactory(this);
  }

  show() {
    this.parentNode.parentNode.expand();
  }

  hide() {
    this.parentNode.parentNode.collapse();
  }
}

export interface DropMenuButtonCA extends ChildNodeCA<DropMenu> {}

export class DropMenuButton extends ChildNode<DropMenu> implements Clickable {
  static new(args: DropMenuButtonCA) {
    const me = new DropMenuButton(args);
    me.init();
    return me;
  }

  onClick() {
    this.parentNode.expand();
  }
}
