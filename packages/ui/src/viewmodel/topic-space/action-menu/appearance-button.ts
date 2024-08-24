import { MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { ChildNode, ChildNodeCA, ConditionalNode } from '../../base';
import { Member } from '../member';
import { ConditionalPanel } from '../../conditional-panel';
import { ActionMenu } from './action-menu';
import { Clickable } from '../../../behaviors';
import { AppearanceDropdown } from './appearance-dropdown';
import { Behaviors } from '../../..';

interface CA extends ChildNodeCA<ConditionalNode<AppearanceButton, any, ActionMenu>> {}

export class AppearanceButton extends ChildNode<ConditionalNode<AppearanceButton, any, ActionMenu>> {
  allowHover = true;
  overflow = true;
  zIndexed = true;
  @OwnedProperty
  appearanceType: ObservableReader<Behaviors.MemberAppearanceType>;

  get cursor() {
    return 'pointer';
  }
  constructor({ ...args }: CA) {
    super(args);
    this.appearanceType = this.parentNode.parentNode.appearance.mapObs((a) => a?.type ?? 'normal');
  }

  static new(args: CA) {
    const me = new AppearanceButton(args);
    me.init();
    return me;
  }
  get childProps(): (keyof this & string)[] {
    return ['appearanceDropdown'];
  }

  onClick() {
    this.appearanceDropdown.toggle();
  }
  @MemoizeOwned()
  get appearanceDropdown() {
    return ConditionalPanel.new<AppearanceDropdown, AppearanceButton>({
      parentNode: this,
      factory: (parentNode) => {
        return AppearanceDropdown.new({
          parentNode,
          context: this.context,
          vertex: this.parentNode.parentNode.vertex,
          appearanceType: this.appearanceType,
        });
      },
    });
  }
}
