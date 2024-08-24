import { Node, NodeCA, Point } from '../../base';
import * as Bindings from '@edvoapp/wasm-bindings';
import { OwnedProperty, getWasmBindings } from '@edvoapp/util';
import { COLLAPSED_SIZE, RadialNav } from './radial-nav';

interface TooltipCA extends NodeCA<RadialNav> {
  icon: Bindings.Svg;
}

export class Tooltip extends Node<RadialNav> {
  @OwnedProperty
  rustNode: Bindings.VM_Tooltip;
  allowHover = true;

  constructor({ icon: icon, ...args }: TooltipCA) {
    super(args);
    this.rustNode = getWasmBindings().VM_Tooltip.new(icon);
  }

  static new(args: TooltipCA) {
    const me = new Tooltip(args);
    me.init();
    return me;
  }

  init() {
    super.init();
  }

  intersectScreenpoint(clientPoint: Point): boolean {
    const parent = this.parentNode;
    const position = parent.cornerPosition.value; // center of the circle
    const a = position.x - clientPoint.x;
    const b = position.y - clientPoint.y;
    const distance = Math.sqrt(a * a + b * b);
    return distance < COLLAPSED_SIZE / 2;
  }
}
