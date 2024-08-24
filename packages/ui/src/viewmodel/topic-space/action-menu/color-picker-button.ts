import { MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { ChildNode, ChildNodeCA, ConditionalNode, Node } from '../../base';
import { ActionMenu } from './action-menu';
import { Clickable } from '../../../behaviors';
import { Behaviors } from '../../..';
import { ColorPalette } from './color-palette';
import { ConditionalPanel } from '../../conditional-panel';
import { Model } from '@edvoapp/common';

interface CA extends ChildNodeCA<ConditionalNode<ColorPickerButton, any, ActionMenu>> {}

export class ColorPickerButton extends ChildNode<ConditionalNode<ColorPickerButton, any, ActionMenu>> {
  allowHover = true;
  zIndexed = true;
  @OwnedProperty
  color: ObservableReader<string>;

  get cursor() {
    return 'pointer';
  }
  constructor({ ...args }: CA) {
    super(args);
    this.color = this.parentNode.parentNode.appearance.mapObs((a) => a?.color ?? '#FFFFFF');
  }

  static new(args: CA) {
    const me = new ColorPickerButton(args);
    me.init();
    return me;
  }
  get childProps(): (keyof this & string)[] {
    return ['colorPalette'];
  }

  onClick() {
    this.colorPalette.toggle();
  }
  @MemoizeOwned()
  get colorPalette() {
    return ConditionalPanel.new<ColorPalette, ColorPickerButton>({
      parentNode: this,
      factory: (parentNode) => {
        return ColorPalette.new({
          parentNode,
          context: this.context,
          vertex: this.parentNode.parentNode.vertex,
          color: this.color,
        });
      },
    });
  }
}
