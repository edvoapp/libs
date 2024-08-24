import { Node, NodeCA, Point } from '../../base';
import { COLLAPSED_SIZE, RadialNav } from '..';
import * as Bindings from '@edvoapp/wasm-bindings';
import { OwnedProperty, getWasmBindings } from '@edvoapp/util';
import { MemberType } from '../../../behaviors';

interface RadialNavButtonCA extends NodeCA<RadialNav> {
  icon: Bindings.Svg;
  tooltipIcon: Bindings.Svg;
  onClick: () => void;
}

export class RadialNavButton extends Node<RadialNav> {
  zIndexed = true;
  // could have two render modules here for now, and separate them out into separate viewmodel nodes later
  @OwnedProperty
  rustNode: Bindings.VM_RadialNavButton;
  @OwnedProperty
  tooltipNode: Bindings.VM_Tooltip;
  allowHover = true;
  onClick: () => void;

  constructor({ icon: icon, tooltipIcon: tooltipIcon, onClick, ...args }: RadialNavButtonCA) {
    super(args);
    this.rustNode = getWasmBindings().VM_RadialNavButton.new(icon);
    this.tooltipNode = getWasmBindings().VM_Tooltip.new(tooltipIcon);
    this.onClick = () => {
      onClick();
      this.tooltipNode.update(-100, -100);
    };
  }

  static new(args: RadialNavButtonCA) {
    const me = new RadialNavButton(args);
    me.init();
    return me;
  }

  init() {
    super.init();

    this.hover.subscribe((hover) => {
      const { x, y, expanded } = this.parentNode.state.value;
      const hide_x = -100;
      const hide_y = -100;

      if (hover) {
        this.tooltipNode.update(x, y);
        // TODO - stop reaching into parent. Who should be reponsible for doing this?
        this.parentNode.rustDefaultTooltip.update(hide_x, hide_y);
        return;
      }

      if (expanded) {
        this.tooltipNode.update(hide_x, hide_y);
        this.parentNode.rustDefaultTooltip.update(x, y);
        return;
      }

      this.tooltipNode.update(hide_x, hide_y);
      this.parentNode.rustDefaultTooltip.update(hide_x, hide_y);
      return;
    });
  }

  get cursor(): string {
    return 'pointer';
  }

  get rotation() {
    // this.parentNode.i
    const myIndex = this.index;
    const totalButtons = this.parentNode.children.reduce((acc, c) => (c instanceof RadialNavButton ? acc + 1 : acc), 0);

    // 0 / 5 buttons = 0
    // 1 / 5 buttons = .2

    return (myIndex / totalButtons) * 360;
  }

  get memberType(): MemberType | null {
    switch (this.label) {
      case 'search':
        return 'card-search';
      case 'note':
        return 'normal';
      case 'sticky':
        return 'stickynote';
      case 'browser':
        return 'browser';
      case 'portal':
        return 'subspace';
      default:
        return null;
    }
  }

  // Radial nav is a circle, not a box, so we have to override the base class here
  intersectScreenpoint(clientPoint: Point): boolean {
    const parent = this.parentNode;
    const state = parent.state.value; // center of the circle
    const a = state.x - clientPoint.x;
    const b = state.y - clientPoint.y;
    const distance = Math.sqrt(a * a + b * b);

    const { x, y } = convertCoords(clientPoint.x, clientPoint.y);
    const { x: centerX, y: centerY } = convertCoords(state.x, state.y);

    const totalButtons = this.parentNode.children.reduce((acc, c) => (c instanceof RadialNavButton ? acc + 1 : acc), 0);
    const eachAngle = 360 / totalButtons;
    let angle = getAngle(x, y, centerX, centerY);
    angle -= 90 + eachAngle / 2;
    angle *= -1;
    angle = angle < 0 ? 360 + angle : angle;
    const startAngle = this.rotation;
    const endAngle = this.rotation + eachAngle;

    return COLLAPSED_SIZE / 2 < distance && distance <= parent.radius && startAngle <= angle && angle < endAngle;
  }
}

function convertCoords(x: number, y: number): { x: number; y: number } {
  const { innerWidth: w, innerHeight: h } = window;
  const xCoord = (2 * x) / w - 1;
  const yCoord = 1 - (2 * y) / h;
  return { x: xCoord, y: yCoord } as Point;
}

function getAngle(x: number, y: number, centerX: number, centerY: number): number {
  return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
}
