import { MemoizeOwned, Observable, ObservableList, ObservableReader, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { ChildNode, ChildNodeCA, ListNode, VertexNode, VertexNodeCA } from '../../base';
import * as Behaviors from '../../../behaviors';
import { Member } from '../member';
import { getContrastColor } from '../../../lib/color';
import { ConditionalPanel } from '../../conditional-panel';
import { ActionMenu } from './action-menu';
import { Clickable } from '../../../behaviors';
import { ColorPickerButton } from './color-picker-button';

interface ColorsCA extends VertexNodeCA<ConditionalPanel<ColorPalette, ColorPickerButton>> {
  color: ObservableReader<string>;
}

export class ColorPalette extends VertexNode<ConditionalPanel<ColorPalette, ColorPickerButton>> {
  hasDepthMask = true;
  zIndexed = true;
  @OwnedProperty
  color: ObservableReader<string>;

  constructor({ color, ...args }: ColorsCA) {
    super(args);
    this.zEnumerateRecurse(100_000);
    this.color = color;
    const context = this.context;

    context.floatingPanels.add(this);
    this.onCleanup(() => {
      context.floatingPanels.delete(this);
    });
  }

  static new(args: ColorsCA) {
    const me = new ColorPalette(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['colorButtons'];
  }

  get colors() {
    return [
      '#e0e31a', //default yellow
      '#FFFFFF', //white
      '#FEE2E2', //red
      '#FEF3C7', //amber
      '#ECFCCB', //lime
      '#D1FAE5', //emerald
      '#CFFAFE', //cyan
      '#DBEAFE', //blue
      '#EDE9FE', //violet
      '#FDF2F8', //pink
    ];
  }

  @MemoizeOwned()
  get colorButtons() {
    return ListNode.new<ColorPalette, ColorButton, string>({
      parentNode: this,
      precursor: new ObservableList(this.colors),
      factory: (color, parentNode) =>
        ColorButton.new({
          color,
          parentNode,
          selected: this.color.mapObs((c) => c.toLowerCase() === color.toLowerCase()),
        }),
    });
  }
}

interface ColorButtonCA extends ChildNodeCA<ListNode<ColorPalette, ColorButton, string>> {
  color: string;
  selected: ObservableReader<boolean>;
}

export class ColorButton extends ChildNode<ListNode<ColorPalette, ColorButton, string>> implements Clickable {
  color: string;
  @OwnedProperty
  selected: ObservableReader<boolean>;

  constructor({ color, selected, ...args }: ColorButtonCA) {
    super(args);
    this.color = color;
    this.selected = selected;
  }

  static new(args: ColorButtonCA) {
    const me = new ColorButton(args);
    me.init();
    return me;
  }

  onClick() {
    const color = this.color;
    const panel = this.closestInstance(ConditionalPanel);

    void this.parentNode.parentNode.vertex.setJsonPropValues<Behaviors.MemberAppearance>(
      'appearance',
      {
        color,
        textColor: getContrastColor(color),
      },
      null,
    );
    panel?.close();
  }
}
