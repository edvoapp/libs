import { Observable, ObservableReader } from '@edvoapp/util';
import { ChildNodeCA, Node, ChildNode } from './base';
import { Clickable } from '../behaviors';

export interface ButtonCA<Parent extends Node = Node> extends ChildNodeCA<Parent> {
  onClick?: (e: MouseEvent) => boolean | void | null | undefined;
}
export class Button<Parent extends Node = Node> extends ChildNode<Parent> implements Clickable {
  allowHover = true;
  _onClick?: (e: MouseEvent) => boolean | void | null | undefined;
  onClick(e: MouseEvent): boolean | void | null | undefined {
    return this._onClick?.(e);
  }

  constructor({ onClick, ...args }: ButtonCA<Parent>) {
    super(args);
    this._onClick = onClick;
  }

  static new(args: ButtonCA<Node>) {
    const me = new Button(args);
    me.init();
    return me;
  }

  get cursor() {
    return 'pointer';
  }
}

// interface ToggleButtonCA<Parent extends Node> extends ChildNodeCA<Parent> {
//   pressed
// }
// export class ToggleButton<Parent extends Node> extends Button<Parent> {
//   private _pressed = new Observable<boolean>(false);
//   get pressed(): ObservableReader<boolean> {
//     return this._pressed;
//   }
//   constructor(args: ToggleButtonCA<Parent>) {
//     super({ ...args, onClick: () => this._onClick() });
//   }
//   static new(args: ToggleButtonCA<Node>) {
//     const me = new ToggleButton(args);
//     me.init();
//     return me;
//   }
//   _onClick() {
//     this._pressed.set(!this.pressed.value);
//   }
// }
