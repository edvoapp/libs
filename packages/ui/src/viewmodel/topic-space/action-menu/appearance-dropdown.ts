import { MemoizeOwned, Observable, ObservableList, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { ChildNode, ChildNodeCA, ListNode, VertexNode, VertexNodeCA } from '../../base';
import * as Behaviors from '../../../behaviors';
import { Member } from '../member';
import { ConditionalPanel } from '../../conditional-panel';
import { Clickable, MemberAppearanceType } from '../../../behaviors';
import { ComponentChildren } from 'preact';
import { AppearanceButton } from './appearance-button';
import { DEPTH_MASK_Z } from '../../../constants';

interface AppearanceCA extends VertexNodeCA<ConditionalPanel<AppearanceDropdown, AppearanceButton>> {
  appearanceType: ObservableReader<Behaviors.MemberAppearanceType>;
}
export class AppearanceDropdown extends VertexNode<ConditionalPanel<AppearanceDropdown, AppearanceButton>> {
  hasDepthMask = true;
  zIndexed = true;
  @OwnedProperty
  appearanceType: ObservableReader<Behaviors.MemberAppearanceType>;
  _depthMaskZ = DEPTH_MASK_Z;

  constructor({ appearanceType, ...args }: AppearanceCA) {
    super(args);
    this.zEnumerateRecurse(100_000);
    this.appearanceType = appearanceType;
  }

  static new(args: AppearanceCA) {
    const me = new AppearanceDropdown(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['appearanceTypeButtons'];
  }

  get appearances(): AppearanceTypes[] {
    return [
      {
        type: 'normal',
        label: 'Note',
      },
      {
        type: 'list',
        label: 'List',
      },
      {
        type: 'subspace',
        label: 'Portal',
      },
    ];
  }

  @MemoizeOwned()
  get appearanceTypeButtons() {
    return ListNode.new<AppearanceDropdown, AppearanceTypeButton, AppearanceTypes>({
      parentNode: this,
      precursor: new ObservableList(this.appearances),
      factory: (type, parentNode) =>
        AppearanceTypeButton.new({
          type,
          parentNode,
          selected: this.appearanceType.value === type.type,
        }),
    });
  }
}

export interface AppearanceTypes {
  type: MemberAppearanceType;
  label: string;
  hotkey?: string;
  icon?: ComponentChildren;
}

interface AppearanceTypeButtonCA
  extends ChildNodeCA<ListNode<AppearanceDropdown, AppearanceTypeButton, AppearanceTypes>> {
  type: AppearanceTypes;
  selected: boolean;
}

export class AppearanceTypeButton
  extends ChildNode<ListNode<AppearanceDropdown, AppearanceTypeButton, AppearanceTypes>>
  implements Clickable
{
  type: AppearanceTypes;
  selected: boolean;

  constructor({ type, selected, ...args }: AppearanceTypeButtonCA) {
    super(args);
    this.type = type;
    this.selected = selected;
  }

  static new(args: AppearanceTypeButtonCA) {
    const me = new AppearanceTypeButton(args);
    me.init();
    return me;
  }

  onClick() {
    const type = this.type;
    const panel = this.closestInstance(ConditionalPanel);

    void this.parentNode.parentNode.vertex.setJsonPropValues<Behaviors.MemberAppearance>(
      'appearance',
      { type: type.type },
      null,
    );
    panel?.close();
  }
}
