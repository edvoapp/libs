import { ChildNode, ChildNodeCA, Node, VertexNode, VertexNodeCA } from '../base';
import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import { Member } from './member';
import { ContentCard } from './content-card';
import { TextField } from '../text-field';
import { Behavior, DispatchStatus, EventNav } from '../../service';

interface CA extends VertexNodeCA<Member | ContentCard> {
  open: Observable<boolean>;
}

export class ProfileForm extends VertexNode<Member | ContentCard> {
  @OwnedProperty
  open: Observable<boolean>;

  constructor(args: CA) {
    super(args);
    this.open = args.open;
  }

  static new(args: CA) {
    const me = new ProfileForm(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['profileFormField', 'profileFormCreateButton', 'profileFormCancelButton'];
  }

  @MemoizeOwned()
  get profileFormField(): TextField {
    const bodyNode = this.parentNode;
    return TextField.singleString({
      parentNode: this,
      fitContentParent: this.parentNode,
      emptyText: 'Profile name',
      onChange: bodyNode.debounce((val) => bodyNode.profileName.set(val)),
      onSubmit: () => bodyNode.handleCreateProfile(),
    });
  }

  @MemoizeOwned()
  get profileFormCreateButton() {
    return new ProfileFormActionButton({
      parentNode: this,
      type: 'create',
    });
  }

  @MemoizeOwned()
  get profileFormCancelButton() {
    return new ProfileFormActionButton({
      parentNode: this,
      type: 'cancel',
    });
  }
}

interface ActionButtonCA extends ChildNodeCA<ProfileForm> {
  type: 'create' | 'cancel';
}

export class ProfileFormActionButton extends ChildNode<ProfileForm> {
  type: 'create' | 'cancel';

  constructor({ type, ...args }: ActionButtonCA) {
    super(args);
    this.type = type;
  }

  getLocalBehaviors(): Behavior[] {
    return [new ProfileFormActionButtonClick()];
  }

  static new(args: ActionButtonCA) {
    const me = new ProfileFormActionButton(args);
    me.init();
    return me;
  }
}

export class ProfileFormActionButtonClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const closestActionButton = originNode.closestInstance(ProfileFormActionButton);

    if (!closestActionButton) return 'decline';
    const body = closestActionButton.parentNode.parentNode;
    switch (closestActionButton.type) {
      case 'create':
        void body.handleCreateProfile();
        break;
      case 'cancel':
        body.profileFormOpen.set(false);
        break;
      default:
        break;
    }
    return 'stop';
  }
}
