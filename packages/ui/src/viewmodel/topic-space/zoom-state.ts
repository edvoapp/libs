import { MemoizeOwned } from '@edvoapp/util';
import { Node, NodeCA, TopicSpace, Button } from '..';
import { Behaviors } from '../..';

export class ZoomState extends Node<TopicSpace> {
  constructor({ ...args }: NodeCA<TopicSpace>) {
    super(args);
  }

  static new(args: NodeCA<TopicSpace>) {
    const me = new ZoomState(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['zoomIn', 'zoomOut', 'resetZoom'];
  }

  @MemoizeOwned()
  get zoomPct() {
    // Format this as a percentage with no decimal places
    return this.parentNode.viewportState.mapObs((v) => `${Math.round(v.planeScale * 100)}%`);
  }

  @MemoizeOwned()
  get zoomIn() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.parentNode.findBehavior(Behaviors.Plane)?.zoomIn(this.parentNode, this.context.eventNav);
      },
    });
  }

  @MemoizeOwned()
  get zoomOut() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.parentNode.findBehavior(Behaviors.Plane)?.zoomOut(this.parentNode, this.context.eventNav);
      },
    });
  }

  @MemoizeOwned()
  get resetZoom() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.parentNode.findBehavior(Behaviors.Plane)?.resetZoom(this.parentNode, this.context.eventNav);
      },
    });
  }
}
