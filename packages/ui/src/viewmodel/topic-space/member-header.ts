import {
  debug,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  tryJsonParse,
} from '@edvoapp/util';
import { BoundingBox, ChildNode, ChildNodeCA, ConditionalNode, Node } from '../base';
import { TopicSpace } from './topic-space';
import * as Behaviors from '../../behaviors';
import { Model } from '@edvoapp/common';
import { NameTagField } from '../name-tag-field';
import { Behavior, EventNav } from '../../service';
import { Member } from './member';
import { CloneContext } from '../../utils';

interface CA extends ChildNodeCA<ConditionalNode<MemberHeader, boolean, Member>> {
  collapsible?: boolean;
  showCount?: boolean;
  members?: ObservableList<Model.Backref>;
}

export class MemberHeader extends ChildNode<ConditionalNode<MemberHeader, boolean, Member>> {
  collapsible?: boolean;
  showCount?: boolean;
  zIndexed = true;
  @OwnedProperty
  members?: ObservableList<Model.Backref>;

  constructor({ collapsible, showCount, members, ...args }: CA) {
    super(args);
    this.collapsible = collapsible;
    this.showCount = showCount;
    this.members = members;
    if (showCount) this.allowHover = true;
  }

  static new(args: CA) {
    const me = new MemberHeader(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['nameTagField'];
  }
  height = 48;

  // eslint-disable-next-line @typescript-eslint/require-await
  // async getDescendingFocusDelegate(ctx: FocusContext): Promise<Node> {
  //   return this.nameTagField.getDescendingFocusDelegate(ctx);
  // }

  get inheritedZIndex() {
    return this.parentNode.parentNode.zIndex;
  }

  @MemoizeOwned()
  get nameTagField() {
    const vertexTagToHide = this.findClosest((n) => n instanceof TopicSpace && n)?.vertex;
    return NameTagField.new({
      parentNode: this,
      vertex: this.parentNode.parentNode.vertex,
      vertexTagToHide,
    });
  }

  @MemoizeOwned()
  get surroundViewEnabled() {
    return this.context.authService.currentUserVertexObs.mapObs<boolean>(
      (user) => user?.getFlagPropertyObs('tile-mode-surround-enabled').mapObs((v) => !!v) ?? false,
    );
  }

  @MemoizeOwned()
  get clientRectObs() {
    const memberClientRectObs = this.parentNode.parentNode.clientRectObs; //parent member clientrectobs
    const value = () => {
      const memberClientRect = memberClientRectObs.value;
      return new BoundingBox({
        x: memberClientRect.left + (!this.surroundViewEnabled.value && this.isTiling.value ? 10 : 0),
        y: memberClientRect.top - 28, // 24 is height of header
        height: 28,
        width: memberClientRect.width,
      });
    };

    const obs = new Observable<BoundingBox>(value());

    const calc = () => obs.set(value());

    this.managedSubscription(memberClientRectObs, calc);
    this.managedSubscription(this.isTiling, calc);
    return obs;
  }

  /** CSS clip-path for this node.
   * false means the node is fully clipped/off screen.
   * null means the node needs no clipping and is fully visible  */
  @MemoizeOwned()
  get clipPath(): ObservableReader<string | null | false> | null {
    const clipBoxObs = this.parentNode.parentNode.clipBox;

    if (!clipBoxObs) return null;
    const clientRectObs = this.clientRectObs;
    const planeScaleObs = this.parentNode.parentNode.planeScaleObs;

    const value = (): string | null | false => {
      const clipBox = debug(clipBoxObs?.value, 'CLIP BOX', true);
      const myRect = debug(clientRectObs.value, 'MY RECT', true);
      const planeScale = debug(planeScaleObs?.value ?? 1, 'LOCAL SCALE', true);

      if (!clipBox || clipBox.fullyContains(myRect)) return null;
      if (!clipBox.intersects(myRect)) return false;

      const myBox = debug(clipBox.map_origin(myRect).unscale(planeScale), 'MY BOX', true);
      const { left, top, right, bottom } = myBox;
      return `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
    };

    const obs = new Observable(value());
    const calc = () => obs.set(value());
    obs.managedSubscription(clipBoxObs, calc);
    obs.managedSubscription(clientRectObs, calc);
    if (planeScaleObs) obs.managedSubscription(planeScaleObs, calc);

    return obs;
  }

  // @MemoizeOwned()
  // get contextCrumbs() {
  //   // TODO - rewrite this
  //   const p = this.findClosest((n) => n instanceof TopicSpace && n);
  //   if (!p) return this.topicName.textField.value;
  //   // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  //   return p.topicName.textField.value + ' > ' + this.topicName.textField.value;
  // }

  @MemoizeOwned()
  get appearanceProperty(): ObservableReader<Model.Property | null | undefined> {
    return this.parentNode.parentNode.vertex
      .filterProperties({
        role: ['appearance'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  @MemoizeOwned()
  get appearance() {
    return this.appearanceProperty.mapObs<Behaviors.MemberAppearance | undefined>((p) => {
      // Formatted for your reading pleasure o/
      if (typeof p === 'undefined') return undefined;
      if (!p) return {};

      return p.text.mapObs((c) => tryJsonParse<Behaviors.MemberAppearance>(c));
    });
  }

  /**
   * overwriting VMNode.shallowClone because we want to ensure we traverse this node's tree
   */
  shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    return Promise.resolve(targetParentVertex);
  }
}
