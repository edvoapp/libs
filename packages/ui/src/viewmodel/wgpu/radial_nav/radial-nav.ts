import { RadialNavButton } from './button';
import { BoundingBox, ConditionalNode, Node, NodeCA, Point } from '../../base';
import { Guarded, MemoizeOwned, Observable, ObservableReader, OwnedProperty, getWasmBindings } from '@edvoapp/util';
import * as Bindings from '@edvoapp/wasm-bindings';
import { AppDesktop } from '../../app-desktop';
import { Behaviors } from '../../..';
import { MemberType } from '../../../behaviors';
import { TSPage } from '../../page/topic-space-page';
import { TopicSpace } from '../../topic-space';

type Parent = ConditionalNode<RadialNav, boolean, TSPage>;

interface RadialNavCA extends NodeCA<Parent> {}

export const COLLAPSED_SIZE = 80;
export const EXPANDED_SIZE = 200;

const hide_x = -100;
const hide_y = -100;

interface PieSliceState {
  angle: number;
  progress: number;
}

export class RadialNav extends Node<Parent> {
  zIndexed = true;
  @OwnedProperty
  circle: Bindings.VM_RadialNav;
  @OwnedProperty
  rustCenterNode: Bindings.VM_Tooltip;
  @OwnedProperty
  rustDefaultTooltip: Bindings.VM_Tooltip;
  @OwnedProperty
  summoned = new Observable<{
    x: number;
    y: number;
    topicSpace: TopicSpace;
  } | null>(null);
  allowHover = true;
  @OwnedProperty
  pieSliceState = new Observable<PieSliceState | null>(null);

  constructor({ ...args }: RadialNavCA) {
    super(args);
    const centerThingyIcon = getWasmBindings().get_center_thingy();
    const defaultTooltipIcon = getWasmBindings().get_default_tooltip_icon();
    this.circle = getWasmBindings().VM_RadialNav.new();
    this.rustCenterNode = getWasmBindings().VM_Tooltip.new(centerThingyIcon);
    this.rustDefaultTooltip = getWasmBindings().VM_Tooltip.new(defaultTooltipIcon);
  }

  static new(args: RadialNavCA) {
    const me = new RadialNav(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get cornerPosition() {
    const clientSizeObs = this.context.clientSizeObs;
    const hoverObs = this.hover;

    const value = () => {
      const { width, height } = clientSizeObs.value;
      const hover = hoverObs.value;
      const offset = (hover ? EXPANDED_SIZE : COLLAPSED_SIZE) / 2 + 30;

      return {
        x: 1000000000,
        y: 1000000000,
        // x: width - offset,
        // y: height - offset,
      };
    };

    const obs = new Observable(value());
    const calc = () => obs.set(value());
    obs.managedSubscription(clientSizeObs, calc);
    obs.managedSubscription(hoverObs, calc);

    return obs;
  }

  @MemoizeOwned()
  get state() {
    const cornerPosition = this.cornerPosition;
    const hoverObs = this.hover;
    const summonedObs = this.summoned;

    const value = () => {
      const summoned = summonedObs.value;
      const hover = hoverObs.value;
      const { x, y } = summoned ?? cornerPosition.value;
      const expanded = !!summoned || !!hover;

      return {
        x,
        y,
        expanded,
      };
    };

    const obs = new Observable(value());
    const calc = () => obs.set(value());

    // obs.managedSubscription(cornerPosition, calc);
    obs.managedSubscription(summonedObs, calc);
    obs.managedSubscription(hoverObs, calc);

    return obs;
  }

  init() {
    super.init();
    this.initPieSlices();

    const panningObs = this.parentNode.parentNode.topicSpace.panning;
    const cornerPositionObs = this.cornerPosition;
    const summonedObs = this.summoned;
    const hoverObs = this.hover;

    let wasExpandedAt: { x: number; y: number } | null = null;
    let wasSummoned = false;
    const update = async () => {
      const summoned = summonedObs.value;
      const { x, y } = summoned ?? { x: 1000000, y: 1000000 }; //make corner position off screen
      const hover = hoverObs.value;
      const panning = panningObs.value;
      const expanded = !!summoned || !!hover;

      if (panning) {
        await this.hideAt(x, y);
        return;
      }

      if (summoned && !wasSummoned) {
        wasExpandedAt = { x, y };
        wasSummoned = true;
        await this.expandAt(x, y);
        return;
      }

      // if (hover && !wasSummoned) {
      //   wasExpandedAt = { x, y };
      //   await this.expandAt(x, y);
      //   return;
      // }

      // if (!expanded && wasExpandedAt) {
      //   await this.hideAt(wasExpandedAt.x, wasExpandedAt.y);
      //   await this.collapseAt(x, y, wasSummoned);
      //   wasExpandedAt = null;
      //   wasSummoned = false;
      //   return;
      // }

      if (expanded) return;

      await this.collapseAt(x, y);
      wasExpandedAt = null;
      wasSummoned = false;
      return;
    };

    this.managedSubscription(panningObs, update);
    this.managedSubscription(cornerPositionObs, update);
    this.managedSubscription(hoverObs, update);
    this.managedSubscription(summonedObs, update);

    update();
  }

  get childProps(): (keyof this & string)[] {
    return ['search', 'note', 'sticky', 'browser', 'portal'];
  }

  initPieSlices() {
    // There might be a better way to do this

    // Have to use setTimeout to avoid recursive child loading scenario inside init
    this.defer(() => {
      // Now we're juuust outside of init

      const numOfActions = this.children.length;
      this.children.forEach((child, i) => {
        if (child instanceof RadialNavButton) {
          child.onCleanup(
            child.hover.subscribe((hover) => {
              const summoned = this.summoned.value;
              const { x, y } = summoned ?? this.cornerPosition.value;
              const rotation = (i / numOfActions) * 360;
              child.rustNode.update(x, y, rotation, !!hover);
              // we will call this twice when moving from one button to the next
              // But it will be very momentary
              // child.rustNode.hello(child.name ?? '');
              // child.rustNode.update_color(hover ? child.name : '');
              this.circle.set_hovered_pie_slice_angle(hover ? child.rotation : undefined, numOfActions);
            }),
          );
        }
      });
    }, 0);
  }

  @Guarded
  async expandAt(x: number, y: number): Promise<void> {
    // Hide the icon that's in the center of radial nav.
    this.rustCenterNode.update(hide_x, hide_y);
    // Expand the radial nav's circle with animation.
    let expanded = await this.circle.expanded(x, y);
    if (!expanded) return;
    // Then show the icons after if the animation ran to completion.
    this.toggleButtonsAppearance(x, y); // show buttons
    if (this.children.every((c) => c instanceof RadialNavButton && !c.hover.value))
      this.rustDefaultTooltip.update(x, y);
  }

  @Guarded
  async hideAt(x: number, y: number): Promise<void> {
    this.toggleButtonsAppearance(); // hide buttons
    this.rustDefaultTooltip.update(hide_x, hide_y);
    this.rustCenterNode.update(hide_x, hide_y);
    await this.circle.hide(x, y);
  }

  @Guarded
  async collapseAt(x: number, y: number, summoned?: boolean): Promise<void> {
    this.toggleButtonsAppearance(); // hide buttons
    this.rustDefaultTooltip.update(hide_x, hide_y);
    await this.circle.collapsed(x, y, summoned);
    this.rustCenterNode.update(x, y);
  }

  // Radial nav is a circle, not a box, so we have to override the base class here
  intersectScreenpoint(clientPoint: Point): boolean {
    const { x, y } = this.state.value;
    const a = x - clientPoint.x;
    const b = y - clientPoint.y;
    const distance = Math.sqrt(a ** 2 + b ** 2);
    const { expanded } = this.state.value;
    let hover = false;
    if (expanded) {
      const offset = (EXPANDED_SIZE - COLLAPSED_SIZE) / 2;
      const a2 = a + offset;
      const b2 = b + offset;
      hover = Math.sqrt(a2 ** 2 + b2 ** 2) < COLLAPSED_SIZE / 2;
    }
    return distance <= this.radius || hover;
  }

  get radius() {
    const { expanded } = this.state.value;
    const diameter = expanded ? EXPANDED_SIZE : COLLAPSED_SIZE;
    return diameter / 2;
  }

  get isVisible(): boolean {
    return true;
  }

  get clientRect(): BoundingBox | null {
    return this.clientRectObs.value;
  }

  // Don't memoize this pls
  quickAdd(memberType: MemberType) {
    // Once quickAdding Observable is moved to VM Context we can remove this silly part
    const rootNode = this.findClosest((n) => n instanceof AppDesktop && n);
    if (!rootNode) throw 'AppDesktop node not found. Sanity error';

    // Probably a better way to dispatch this
    const qa = rootNode.behaviors.find((b) => b instanceof Behaviors.QuickAdd) as Behaviors.QuickAdd | undefined;

    if (!qa) throw 'QuickAdd behavior not found. Sanity error';

    let summoned = this.summoned.value;
    if (summoned) {
      const { x, y, topicSpace } = summoned;
      if (!topicSpace.destroyed) {
        qa.quickAdd(topicSpace, memberType, { x, y });
      }
    } else {
      qa.activateQuickAddMode(rootNode, memberType);
    }

    this.summoned.set(null);
    this.setHover(false);
    this.hideTooltip();
  }

  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    const stateObs = this.state;

    const value = () => {
      let { x, y, expanded } = stateObs.value;
      let size = expanded ? EXPANDED_SIZE : COLLAPSED_SIZE;

      return new BoundingBox({
        x: x - size / 2,
        y: y - size / 2,
        height: size,
        width: size,
      });
    };

    const obs = new Observable(value());
    const calc = () => obs.set(value());

    obs.managedSubscription(stateObs, calc);
    return obs;
  }

  @MemoizeOwned()
  get search() {
    return RadialNavButton.new({
      parentNode: this,
      context: this.context,
      icon: getWasmBindings().get_search_icon(),
      tooltipIcon: getWasmBindings().get_search_tooltip_icon(),
      label: 'search',
      onClick: () => this.quickAdd('card-search'),
    });
  }
  // TODO Rename to blankCard pls
  @MemoizeOwned()
  get note() {
    return RadialNavButton.new({
      parentNode: this,
      context: this.context,
      icon: getWasmBindings().get_note_icon(),
      tooltipIcon: getWasmBindings().get_note_tooltip_icon(),
      label: 'note',
      onClick: () => this.quickAdd('normal'),
    });
  }
  @MemoizeOwned()
  get sticky() {
    return RadialNavButton.new({
      parentNode: this,
      context: this.context,
      icon: getWasmBindings().get_sticky_icon(),
      tooltipIcon: getWasmBindings().get_sticky_tooltip_icon(),
      label: 'sticky',
      onClick: () => this.quickAdd('stickynote'),
    });
  }
  @MemoizeOwned()
  get browser() {
    return RadialNavButton.new({
      parentNode: this,
      context: this.context,
      icon: getWasmBindings().get_browser_icon(),
      tooltipIcon: getWasmBindings().get_browser_tooltip_icon(),
      label: 'browser',
      onClick: () => this.quickAdd('browser'),
    });
  }
  @MemoizeOwned()
  get portal() {
    return RadialNavButton.new({
      parentNode: this,
      context: this.context,
      icon: getWasmBindings().get_portal_icon(),
      tooltipIcon: getWasmBindings().get_portal_tooltip_icon(),
      label: 'portal',
      onClick: () => this.quickAdd('subspace'),
    });
  }

  /// If `x` and `y` values are given, show buttons.
  /// Hide them otherwise.
  private toggleButtonsAppearance(x?: number, y?: number) {
    if (x && y) {
      const totalButtons = this.children.length;
      this.children.forEach((c, i) => {
        if (c instanceof RadialNavButton) {
          const rotation = (i / totalButtons) * 360;
          c.rustNode.update(x, y, rotation, !!c.hover.value);
        }
      });
      return;
    }

    this.children.forEach((c) => {
      if (c instanceof RadialNavButton) c.rustNode.update(hide_x, hide_y, 0);
    });
  }

  private hideTooltip() {
    this.children.forEach((c, i) => {
      if (c instanceof RadialNavButton) {
        c.tooltipNode.update(hide_x, hide_y);
      }
    });
  }
}
