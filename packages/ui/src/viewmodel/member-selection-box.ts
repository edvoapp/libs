import { BoundingBox, ChildNode, ChildNodeCA, ConditionalNode, Node, OverrideBoundingBox } from './base';
import {
  FilteredObservableList,
  IObservable,
  MemoizeOwned,
  Observable,
  OwnedProperty,
  getWasmBindings,
} from '@edvoapp/util';
import * as Bindings from '@edvoapp/wasm-bindings';
import { TopicSpace } from './topic-space/topic-space';
import { Point } from '../utils';
import { AppDesktop } from './app-desktop';
import { Member } from './topic-space';
import { SELECTION_BOX_Z } from '../constants';
import { Behaviors, EventNav, SelectionState } from '..';
import { Resizable, ResizeCorner } from '../behaviors';
import _ from 'lodash';

interface CA extends ChildNodeCA<ConditionalNode<MemberSelectionBox, Node[], AppDesktop>> {
  selection: Node[];
}

export class MemberSelectionBox
  extends ChildNode<ConditionalNode<MemberSelectionBox, Node[], AppDesktop>>
  implements Resizable
{
  @OwnedProperty
  selection_box: Bindings.VM_SelectionBox;
  // Managing references in the constructor
  selection: Node[];
  _rendered?: boolean;
  allowHover = true;

  constructor({ ...args }: CA) {
    super(args);
    this.selection_box = getWasmBindings().VM_SelectionBox.new();
    this.selection = args.selection;
  }

  static new(args: CA) {
    const me = new MemberSelectionBox(args);
    me.init();
    return me;
  }
  init() {
    super.init();

    const selected = this.selection;

    const update = () => {
      const box = selected.reduce((acc, val) => acc.union(val.clientRectObs.value), selected[0].clientRectObs.value);
      if (selected.length === 0) return;
      if (this.parentNode.parentNode.tileContainer.visible.value) {
        this.selection_box.update(0, 0, 0, 0, 0);
      } else {
        this._rendered = true;

        // I can think of no good reason to ever clip the member selection box
        this.selection_box.update(box.x, box.y, box.width, box.height, SELECTION_BOX_Z);
        this._rect.set(box);
      }
    };

    this.selection.forEach((n) => {
      this.managedSubscription(n.clientRectObs, update, true);
      this.managedSubscription(this.parentNode.parentNode.tileContainer.visible, update, true);
    });
  }

  @OwnedProperty
  _rect: Observable<BoundingBox> = new Observable(BoundingBox.ZERO);
  get clientRectObs(): Observable<BoundingBox> {
    return this._rect;
  }

  intersectScreenpoint({ x, y }: Point): boolean {
    return this.selection_box.hit_test(x, y);
  }

  get rendered() {
    return this._rendered ?? false;
  }

  get resizable() {
    return true;
  }

  resizeCorners: ResizeCorner[] = Behaviors.ALL_CORNERS;
  @OwnedProperty
  _resizing = new Observable<OverrideBoundingBox | null>(null);
  resizeStep({ box, corner }: Behaviors.ResizeStepArgs) {
    this._resizing.set(box);
    // Call resizeStep on all selected members

    const memberSelectionBoxRect = getMemberSelectionBoxBbox(this.context.selectionState);
    const newWidth = box.width ?? memberSelectionBoxRect.width;
    const newHeight = box.height ?? memberSelectionBoxRect.height;

    // Calculate the resizing ratio
    const widthRatio = newWidth / memberSelectionBoxRect.width;
    const heightRatio = newHeight / memberSelectionBoxRect.height;

    for (const node of this.selection) {
      if (!Behaviors.isResizable(node)) continue;
      if (!box) {
        node.resizeStep({ box, corner });
        continue;
      }
      const rect = node.clientRectObs.value;
      const innerScale = rect.innerScale ?? 1;
      const totalScale = rect.totalScale ?? 1;

      let x: number | undefined = undefined;
      let y: number | undefined = undefined;
      let width: number | undefined = undefined;
      let height: number | undefined = undefined;

      if (corner.includes('w') || corner.includes('e')) {
        x = (box.x ?? 0) + (rect.x - memberSelectionBoxRect.x) * widthRatio;
        width = rect.width * widthRatio;
      }

      if (corner.includes('n') || corner.includes('s')) {
        y = (box.y ?? 0) + (rect.y - memberSelectionBoxRect.y) * heightRatio;
        height = rect.height * heightRatio;
      }

      const bbox = new OverrideBoundingBox({
        x,
        y,
        width,
        height,
        // note: innerScale is set to 1 by default in OverrideBoundingBox, so we have to copy the scale over
        innerScale,
        totalScale,
      });
      node.resizeStep({ box: bbox, corner });
    }
  }
  resizeCancel(): void {
    this._resizing.set(null);
    // Call resizeCancel on all selected members
    this.selection.forEach((member) => {
      if (Behaviors.isResizable(member)) {
        member.resizeCancel();
      }
    });
  }
  async resizeDone({ box: ovrbox, trx }: Behaviors.ResizeDoneArgs) {
    // compose this overridebox onto the selection box
    const box = this.clientRectObs.value.compose(ovrbox);
    this._resizing.set(null);

    // Call resizeDone on all selected members
    await Promise.all(
      this.selection.map(async (member) => {
        if (Behaviors.isResizable(member)) {
          const box = member._resizing.value;
          if (box) await member.resizeDone({ box, corner: 'n', trx });
        }
      }),
    );

    // update the selection box
    this.selection_box.update(box.x, box.y, box.width, box.height, SELECTION_BOX_Z);
  }
}

function getMemberSelectionBoxBbox(selectionState: SelectionState) {
  const members = selectionState.selection.value;
  const selectedMembers = members.filter((m) => m.isSelected.value);

  const upperLeft = [
    Math.min(...selectedMembers.map((member) => member.clientRectObs.value.x)),
    Math.min(...selectedMembers.map((member) => member.clientRectObs.value.y)),
  ];

  const lowerRight = [
    Math.max(...selectedMembers.map((member) => member.clientRectObs.value.x + member.clientRectObs.value.width)),
    Math.max(...selectedMembers.map((member) => member.clientRectObs.value.y + member.clientRectObs.value.height)),
  ];

  const selectionBoxWidth = lowerRight[0] - upperLeft[0];
  const selectionBoxHeight = lowerRight[1] - upperLeft[1];

  return new BoundingBox({
    x: upperLeft[0],
    y: upperLeft[1],
    width: selectionBoxWidth,
    height: selectionBoxHeight,
  });
}
