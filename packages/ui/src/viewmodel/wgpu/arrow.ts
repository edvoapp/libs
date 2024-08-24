import * as Bindings from '@edvoapp/wasm-bindings';
import {
  getWasmBindings,
  MemoizeOwned,
  Observable,
  ObservableReader,
  OwnedProperty,
  WeakProperty,
} from '@edvoapp/util';
import { BoundingBox, ListNode, RelationNode, RelationNodeCA } from '../base';
import { ArrowPath, calculateHypotenuse, Point } from '../../utils';
import { Node as VMNode } from '../base';
import { Member } from '../topic-space';

interface ArrowCA extends RelationNodeCA<ListNode<Member, any, any>> {
  sourceNode: VMNode;
  targetNode: VMNode;
}

export class Arrow extends RelationNode<ListNode<Member, any, any>> {
  @OwnedProperty
  rustNode: Bindings.VM_Arrow;
  @WeakProperty
  sourceNode: VMNode;
  @OwnedProperty
  sourceCoords: ObservableReader<BoundingBox>;
  @WeakProperty
  targetNode: VMNode;
  @OwnedProperty
  targetBoxCoords: ObservableReader<BoundingBox>;
  selectOnFocus = true;
  propagateFocus = false;

  constructor({ sourceNode, targetNode, ...args }: ArrowCA) {
    super(args);

    this.sourceNode = sourceNode;
    this.sourceCoords = sourceNode.clientRectObs;

    this.targetNode = targetNode;
    this.targetBoxCoords = targetNode.clientRectObs;

    this.rustNode = getWasmBindings().VM_Arrow.new();
  }
  get rendered() {
    // TODO - check if we're actually on the screen
    return true;
  }
  allowHover = true;

  static new(args: ArrowCA): Arrow {
    const me = new Arrow(args);
    me.init();
    return me;
  }

  init() {
    super.init();

    const membersObs = this.parentNode.parentNode.myTopicSpace?.members;
    if (!membersObs) throw new Error('members must exist');

    const arrowPath = this.arrowPath;
    const focused = this.isFocused;
    const clipBoxObs = this.clipBox;
    const selectedObs = this.isSelected;

    const calc = () => {
      // We don't really need instancing for arrows right now, but it's a good
      // thing to have in the `PathRenderModule`, so let's go with it.
      const {
        from: { x: src_x, y: src_y },
        to: { x: dest_x, y: dest_y },
      } = arrowPath.value;
      const clipbox = clipBoxObs?.value;

      const color = new Float32Array(focused.value ? [128.0, 0.0, 255.0] : [0, 0, 0]);

      // Find the lowest z-index of all members in the topic space, and pass
      // (that z-index - 1) to the blob. This ensures that the arrows don't
      // appear on top of items.
      // Also, z-index must be >= 0.
      const minZ = Math.min(...membersObs.value.map((m) => m.zIndex.value));
      const zIndex = minZ > 1 ? minZ - 1 : 0;

      this.rustNode.update(
        src_x,
        src_y,
        dest_x,
        dest_y,
        color,
        zIndex,
        clipbox?.left,
        clipbox?.top,
        clipbox?.width,
        clipbox?.height,
      );
    };

    this.managedSubscription(arrowPath, calc);
    this.managedSubscription(focused, calc);
    this.managedSubscription(selectedObs, calc);
    if (clipBoxObs) this.managedSubscription(clipBoxObs, calc);
    if (membersObs) this.onCleanup(membersObs.subscribe(calc));
    calc();
  }

  get cursor(): string {
    return 'pointer';
  }

  intersectScreenpoint({ x, y }: Point): boolean {
    return this.rustNode.hit_test(x, y);
  }

  @MemoizeOwned()
  get arrowPath(): ObservableReader<ArrowPath> {
    const obs = new Observable<ArrowPath>(this.getArrowPath());
    const calc = () => {
      obs.set(this.getArrowPath());
    };
    obs.managedSubscription(this.sourceCoords, calc, false);
    obs.managedSubscription(this.targetBoxCoords, calc, false);
    return obs;
  }

  private getArrowPath(): ArrowPath {
    const from = getConnectionPointCoords(this.sourceCoords.value);
    const to = getConnectionPointCoords(this.targetBoxCoords.value);
    const from_nodes = [from.north, from.east, from.south, from.west];
    const to_nodes = [to.north, to.east, to.south, to.west];
    let shortest = Infinity;
    let shortest_pair = { from: from_nodes[0], to: to_nodes[0] } as ArrowPath;
    from_nodes.forEach((fn) => {
      to_nodes.forEach((tn) => {
        const d = calculateHypotenuse(fn, tn);
        if (d < shortest) {
          shortest = d;
          shortest_pair = { from: fn, to: tn } as ArrowPath;
        }
      });
    });
    return shortest_pair;
  }
}

// Coordinates of all eight points of a card.
interface Coords {
  north: Point;
  south: Point;
  west: Point;
  east: Point;
}

// Returns the coordinates of all four corners of a card,
// whose pixel coordinates get converted to normalized device coordinates (NDC).
function getConnectionPointCoords({ left, top, width, height }: BoundingBox): Coords {
  return {
    north: { x: left + width / 2, y: top },
    south: { x: left + width / 2, y: top + height },
    west: { x: left, y: top + height / 2 },
    east: { x: left + width, y: top + height / 2 },
  };
}
