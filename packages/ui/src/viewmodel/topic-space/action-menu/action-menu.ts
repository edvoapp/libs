import { MemoizeOwned, Observable, ObservableReader, WeakProperty, tryJsonParse } from '@edvoapp/util';
import { BoundingBox, ChildNode, ChildNodeCA, ConditionalNode, VertexNode, VertexNodeCA, Node } from '../../base';
import { UrlBar } from '../url-bar';
import * as Behaviors from '../../../behaviors';
import { Model, trxWrap } from '@edvoapp/common';
import { Member } from '../member';
import { ColorPickerButton } from './color-picker-button';
import { AppearanceButton } from './appearance-button';
import { AppDesktop } from '../../app-desktop';
import { useNavigator } from '../../..';
import { TopicSpace } from '../topic-space';
import { NameTagField } from '../../name-tag-field';
import { ContextMenuButton } from '../context-menu-button';
import { Button } from '../../button';
import { ContentCard } from '../content-card';

interface CA extends VertexNodeCA<ConditionalNode<ActionMenu, boolean, Member | ContentCard>> {}

export class ActionMenu extends VertexNode<ConditionalNode<ActionMenu, boolean, Member | ContentCard>> {
  overflow = true;
  hasDepthMask = true;
  zIndexed = true;

  constructor({ ...args }: CA) {
    super(args);
    this.zEnumerateRecurse(100_000);
    const context = this.context;

    context.floatingPanels.add(this);
    this.onCleanup(() => {
      context.floatingPanels.delete(this);
    });
  }

  static new(args: CA) {
    const me = new ActionMenu(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return [
      'urlBar',
      'tileButton',
      'removeButton',
      'colorPickerButton',
      'jumpToButton',
      'appearanceButton',
      'downloadButton',
      'nameTagField',
      'contextMenu',
    ];
  }
  height = 48;

  @MemoizeOwned()
  get clientRectObs() {
    const memberClientRectObs = this.parentNode.parentNode.clientRectObs; //parent member clientrectobs
    const value = () => {
      const memberClientRect = memberClientRectObs.value;
      return new BoundingBox({
        x: memberClientRect.left,
        y: memberClientRect.top - (this.isTiling.value ? 45 : 70),
        height: this.isTiling.value ? 46 : 36,
        width: memberClientRect.width,
      });
    };

    const obs = new Observable<BoundingBox>(value());

    const calc = () => obs.set(value());

    this.managedSubscription(memberClientRectObs, calc);
    this.managedSubscription(this.isTiling, calc);
    return obs;
  }

  @WeakProperty
  get isTiling() {
    const root = this.context.rootNode;
    if (!(root instanceof AppDesktop)) return new Observable(false);
    return root.tileContainer.visible;
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
  get nameTagField() {
    const vertexTagToHide = this.findClosest((n) => n instanceof TopicSpace && n)?.vertex;
    return NameTagField.new({
      parentNode: this,
      vertex: this.parentNode.parentNode.vertex,
      vertexTagToHide,
    });
  }

  @MemoizeOwned()
  get appearance() {
    const node = this.parentNode.parentNode;
    return node instanceof Member ? node.computedAppearance : new Observable(null);
  }

  @MemoizeOwned()
  get urlBar() {
    return ConditionalNode.new<UrlBar, boolean, ActionMenu>({
      parentNode: this,
      precursor: this.appearance.mapObs((appearance) => appearance?.type === 'browser'),
      factory: (want, parentNode) => {
        if (!want) return null;

        return UrlBar.new({
          vertex: this.vertex,
          parentNode,
          context: this.context,
        });
      },
    });
  }

  @MemoizeOwned()
  get tileButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const appDesktop = this.root as AppDesktop;
        const tileContainer = appDesktop.tileContainer;
        const active = tileContainer.visible.value;
        let items = [this.parentNode.parentNode];
        if (active) {
          tileContainer.clear();
        } else {
          tileContainer.set(items);
        }
      },
    });
  }
  @MemoizeOwned()
  get removeButton() {
    return ConditionalNode.new<Button<Node>, boolean, ActionMenu>({
      parentNode: this,
      precursor: this.appearance.mapObs((appearance) => appearance !== null),
      factory: (want, _parentNode) => {
        if (!want) return null;
        return Button.new({
          parentNode: this,
          onClick: () => {
            const member = this.parentNode.parentNode;
            if (!(member instanceof Member)) return;
            const appDesktop = this.root as AppDesktop;
            const tileContainer = appDesktop.tileContainer;
            if (this.isTiling.value) tileContainer.remove(member);
            Behaviors.UnlinkItem.unlinkNodes([member]);
          },
        });
      },
    });
  }

  @MemoizeOwned()
  get jumpToButton() {
    return ConditionalNode.new<Button<Node>, boolean, ActionMenu>({
      parentNode: this,
      precursor: this.appearance.mapObs((appearance) => {
        return appearance?.type
          ? ['normal', 'subspace', 'list', 'clean', 'file', 'browser'].includes(appearance.type)
          : false;
      }),
      factory: (want, parentNode) => {
        if (!want) return null;
        return Button.new({
          parentNode,
          onClick: () => useNavigator().openTopic(this.vertex),
        });
      },
    });
  }

  @MemoizeOwned()
  get colorPickerButton() {
    return ConditionalNode.new<ColorPickerButton, boolean, ActionMenu>({
      parentNode: this,
      precursor: this.appearance.mapObs((appearance) => appearance?.type === 'stickynote'),
      factory: (want, parentNode) => {
        if (!want) return null;
        return ColorPickerButton.new({
          parentNode,
        });
      },
    });
  }
  @MemoizeOwned()
  get appearanceButton() {
    return ConditionalNode.new<AppearanceButton, boolean, ActionMenu>({
      parentNode: this,
      precursor: this.appearance.mapObs((appearance) => {
        return appearance?.type === 'normal' || appearance?.type === 'subspace' || appearance?.type === 'list';
      }),
      factory: (want, parentNode) => {
        if (!want) return null;

        return AppearanceButton.new({
          parentNode,
        });
      },
    });
  }
  @MemoizeOwned()
  get downloadButton() {
    return ConditionalNode.new<Button<Node>, boolean, ActionMenu>({
      parentNode: this,
      precursor: this.appearance.mapObs((appearance) => appearance?.type === 'clean' || appearance?.type === 'file'),
      factory: (want, parentNode) => {
        if (!want) return null;

        return Button.new({
          parentNode,
          onClick: () => {
            const vertexNode = this.context.vertexNodeRegistry.get(this.vertex.id);
            const bodyProperty = vertexNode?.bodyProperty.value;

            if (!bodyProperty) return;

            Behaviors.handleDownload(bodyProperty, vertexNode.vertex);
          },
        });
      },
    });
  }

  @MemoizeOwned()
  get contextMenu() {
    return ContextMenuButton.new({
      parentNode: this,
    });
  }
}
