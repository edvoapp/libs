import { ChildNodeCA, ChildNode, Rect, Node, ConditionalNode } from './base';
import { MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { Behavior, DispatchStatus, EventNav, getLowestCommonSiblingAncestors } from '../service';
import { AppDesktop } from './app-desktop';
import { TopicSpace } from './topic-space';

const THRESHOLD = 2;

type Parent = ConditionalNode<Lasso, boolean, AppDesktop>;

export class Lasso extends ChildNode<Parent> {
  @OwnedProperty
  active = new Observable(false);
  initialPosition: null | { x: number; y: number } = null;
  @OwnedProperty
  rect = new Observable<null | Rect>(null);

  @MemoizeOwned()
  get visible(): ObservableReader<boolean> {
    return super.visible.mapObs<boolean>((v) => v && this.active);
  }

  static new(args: ChildNodeCA<Parent>) {
    const me = new Lasso(args);
    me.init();
    return me;
  }

  show() {
    this.active.set(true);
  }

  hide() {
    this.active.set(false);
  }
}

export class LassoBehavior extends Behavior {
  @OwnedProperty
  activeNode: Lasso | null = null;
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof AppDesktop && n);
    if (!node || !(originNode instanceof TopicSpace)) return 'decline';
    eventNav.focusState.blur();
    node.setLassoOpen(true);

    const lasso = node.lasso.value;
    if (!lasso) return 'decline';

    this.activeNode = lasso;
    const { clientX, clientY } = e;
    lasso.initialPosition = { x: clientX, y: clientY };

    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseMove', 'handleMouseUp']);
    return 'stop';
  }

  handleMouseMove(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const lasso = this.activeNode;

    if (!lasso) return 'decline';
    // if (!e.shiftKey) {
    //   eventNav.unsetGlobalBehaviorOverrides(this);
    //   this.stopLasso(lasso);
    //   return 'decline';
    // }
    const { clientX, clientY } = e;
    const initialPosition = lasso.initialPosition;
    if (!initialPosition) return 'decline';

    const { x, y } = initialPosition;

    this.trace(4, () => ['LASSO', initialPosition, { clientX, clientY }, x - clientX, y - clientY]);
    if (Math.abs(x - clientX) < THRESHOLD && Math.abs(y - clientY) < THRESHOLD) return 'decline';

    lasso.show();
    let left: number;
    let right: number;
    let top: number;
    let bottom: number;
    if (clientX < x) {
      left = clientX;
      right = x;
    } else {
      left = x;
      right = clientX;
    }
    if (clientY < y) {
      top = clientY;
      bottom = y;
    } else {
      top = y;
      bottom = clientY;
    }

    const width = right - left;
    const height = bottom - top;
    const rect = { left, top, width, height };
    lasso.rect.set(rect);
    const nodes = lasso.parentNode.parentNode.getNodesAtScreenRect(rect, (node) => node.selectable);
    eventNav.selectionState.setSelect(getLowestCommonSiblingAncestors(nodes));
    return 'stop';
  }

  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const lasso = this.activeNode;
    eventNav.unsetGlobalBehaviorOverrides(this);
    this.activeNode = null;
    if (!lasso) return 'decline';
    if (!lasso.rect.value) {
      this.stopLasso(lasso);
      return 'continue';
    }
    this.stopLasso(lasso);
    return 'stop';
  }

  stopLasso(lasso: Lasso) {
    this.activeNode = null;
    lasso.hide();
    lasso.initialPosition = null;
    lasso.rect.set(null);
    lasso.parentNode.parentNode.setLassoOpen(false);
  }
}
