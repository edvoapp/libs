import * as Bindings from '@edvoapp/wasm-bindings';
import {
  getWasmBindings,
  MemoizeOwned,
  Observable,
  ObservableReader,
  OwnedProperty,
  WeakProperty,
} from '@edvoapp/util';
import { BoundingBox, ListNode, RelationNode, RelationNodeCA, VertexNode } from '../base';
import { calculateHypotenuse, Point } from '../../utils';
import { Member, TopicSpace, Node as VMNode } from '..';
import { Backref } from '@edvoapp/common/dist/model';

type BoxSide = {
  side: Point;
  points: [Point, Point];
};
type BoxSidePair = { from: BoxSide; to: BoxSide };

interface BlobCA extends RelationNodeCA<ListNode<Member, ImplicitRelationBlob, [Backref, VertexNode]>> {
  clusterColor: number[];
  originNode: VMNode;
  targetNode: VMNode;
}

export class ImplicitRelationBlob extends RelationNode<ListNode<Member, ImplicitRelationBlob, [Backref, VertexNode]>> {
  @OwnedProperty
  rustNode: Bindings.VM_ImplicitRelationBlob;
  @OwnedProperty
  sourceCoords: ObservableReader<BoundingBox>;
  @OwnedProperty
  targetCoords: ObservableReader<BoundingBox>;
  clusterColor: number[];
  allowHover = true;
  @WeakProperty
  sourceNode: VMNode;
  @WeakProperty
  targetNode: VMNode;
  selectOnFocus = true;
  propagateFocus = false;

  constructor({ clusterColor, originNode, targetNode, ...args }: BlobCA) {
    super(args);
    this.clusterColor = clusterColor;

    this.sourceNode = originNode;
    this.sourceCoords = originNode.clientRectObs;

    this.targetNode = targetNode;
    this.targetCoords = targetNode.clientRectObs;

    this.rustNode = getWasmBindings().VM_ImplicitRelationBlob.new();

    this.relate();
  }

  static new(args: BlobCA): ImplicitRelationBlob {
    const me = new ImplicitRelationBlob(args);
    me.init();
    return me;
  }

  init() {
    super.init();

    const membersObs = this.parentNode.parentNode.myTopicSpace?.members;

    const blobPath = this.boxSidePair;
    const focused = this.isFocused;
    const clipBoxObs = this.clipBox;
    const selectedObs = this.isSelected;

    const calc = () => {
      // We don't really need instancing for blobs right now, but it's a good
      // thing to have in the `PathRenderModule`, so let's go with it.
      const { from, to } = blobPath.value;
      const { points: src } = from;
      const { points: dest } = to;
      const [{ x: src_x0, y: src_y0 }, { x: src_x1, y: src_y1 }] = src;
      const [{ x: dest_x0, y: dest_y0 }, { x: dest_x1, y: dest_y1 }] = dest;
      const clipbox = clipBoxObs?.value;

      const color = new Float32Array(focused.value ? [128.0, 0.0, 255.0] : this.clusterColor);

      // Find the lowest z-index of all members in the topic space, and pass
      // (that z-index - 1) to the blob. This ensures that the blobbies don't
      // appear on top of items.
      // Also, z-index must be >= 0.
      const minZ = membersObs?.alive ? Math.min(...membersObs.value.map((m) => m.zIndex.value)) : 0;
      const zIndex = minZ > 1 ? minZ - 1 : 0;

      this.rustNode.update(
        src_x0,
        src_y0,
        src_x1,
        src_y1,
        dest_x0,
        dest_y0,
        dest_x1,
        dest_y1,
        color,
        zIndex,
        clipbox?.left,
        clipbox?.top,
        clipbox?.width,
        clipbox?.height,
      );
    };

    this.managedSubscription(blobPath, calc);
    this.managedSubscription(focused, calc);
    this.managedSubscription(selectedObs, calc);
    if (clipBoxObs) this.managedSubscription(clipBoxObs, calc);
    if (membersObs) this.onCleanup(membersObs.subscribe(calc));
    calc();
  }

  get rendered() {
    // TODO - check if we're actually on the screen
    return true;
  }

  private relate() {
    const member1 = (this.sourceNode as Member).rustNode;
    const member2 = (this.targetNode as Member).rustNode;
    const topicSpace = this.closestInstance(TopicSpace);
    if (topicSpace && member1 && member2) topicSpace.rustGraph?.relate(member1, member2);
  }

  private unrelate() {
    const member1 = (this.sourceNode as Member | null)?.rustNode;
    const member2 = (this.targetNode as Member | null)?.rustNode;
    const topicSpace = this.findClosest((n) => n instanceof TopicSpace && n);
    if (topicSpace && member1 && member2) topicSpace.rustGraph?.unrelate(member1, member2);
  }

  protected cleanup() {
    this.unrelate();
    super.cleanup();
  }

  get cursor(): string {
    return 'pointer';
  }

  intersectScreenpoint({ x, y }: Point): boolean {
    return this.rustNode.hit_test(x, y);
  }

  @MemoizeOwned()
  get boxSidePair(): ObservableReader<BoxSidePair> {
    const obs = new Observable<BoxSidePair>(this.getBlobBoxSides());
    const calc = () => {
      obs.set(this.getBlobBoxSides());
    };
    obs.managedSubscription(this.sourceCoords, calc, false);
    obs.managedSubscription(this.targetCoords, calc, false);
    return obs;
  }

  private getBlobBoxSides(): { from: BoxSide; to: BoxSide } {
    const from = getConnectionPointCoords(this.sourceCoords.value);
    const to = getConnectionPointCoords(this.targetCoords.value);

    const from_nodes: {
      top: BoxSide;
      bottom: BoxSide;
      left: BoxSide;
      right: BoxSide;
    } = {
      top: { side: from.edgeTop, points: [from.upperLeft, from.upperRight] },
      bottom: {
        side: from.edgeBottom,
        points: [from.lowerLeft, from.lowerRight],
      },
      left: { side: from.edgeLeft, points: [from.upperLeft, from.lowerLeft] },
      right: {
        side: from.edgeRight,
        points: [from.upperRight, from.lowerRight],
      },
    };

    const to_nodes: {
      top: BoxSide;
      bottom: BoxSide;
      left: BoxSide;
      right: BoxSide;
    } = {
      top: { side: to.edgeTop, points: [to.upperLeft, to.upperRight] },
      bottom: { side: to.edgeBottom, points: [to.lowerLeft, to.lowerRight] },
      left: { side: to.edgeLeft, points: [to.upperLeft, to.lowerLeft] },
      right: { side: to.edgeRight, points: [to.upperRight, to.lowerRight] },
    };

    let shortest = calculateHypotenuse(from.edgeTop, to.edgeBottom);
    let shortest_pair = { from: from_nodes.top, to: to_nodes.bottom };

    const d1 = calculateHypotenuse(from.edgeBottom, to.edgeTop);
    if (d1 < shortest) {
      shortest = d1;
      shortest_pair = { from: from_nodes.bottom, to: to_nodes.top };
    }
    const d2 = calculateHypotenuse(from.edgeLeft, to.edgeRight);
    if (d2 < shortest) {
      shortest = d2;
      shortest_pair = { from: from_nodes.left, to: to_nodes.right };
    }
    const d3 = calculateHypotenuse(from.edgeRight, to.edgeLeft);
    if (d3 < shortest) {
      shortest = d3;
      shortest_pair = { from: from_nodes.right, to: to_nodes.left };
    }

    return shortest_pair;
  }
}

// Coordinates of all eight points of a card.
interface Coords {
  upperLeft: Point;
  upperRight: Point;
  lowerRight: Point;
  lowerLeft: Point;
  edgeTop: Point;
  edgeBottom: Point;
  edgeLeft: Point;
  edgeRight: Point;
}

// Returns the coordinates of all four corners of a card,
// whose pixel coordinates get converted to normalized device coordinates (NDC).
function getConnectionPointCoords({ left, top, width, height }: BoundingBox): Coords {
  return {
    upperLeft: { x: left, y: top },
    upperRight: { x: left + width, y: top },
    lowerRight: { x: left + width, y: top + height },
    lowerLeft: { x: left, y: top + height },
    edgeTop: { x: left + width / 2, y: top },
    edgeBottom: { x: left + width / 2, y: top + height },
    edgeLeft: { x: left, y: top + height / 2 },
    edgeRight: { x: left + width, y: top + height / 2 },
  };
}
