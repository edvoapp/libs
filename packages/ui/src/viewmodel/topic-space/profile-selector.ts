import { ListNode, Node, VertexNode, VertexNodeCA } from '../base';
import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import { Model } from '@edvoapp/common';
import { AddProfileButton, DefaultProfile, Profile } from './profile';
import { Member } from './member';
import { ContentCard } from './content-card';
import { globalAuthService } from '../../service';

interface CA extends VertexNodeCA<Member | ContentCard> {
  open: Observable<boolean>;
}

export class ProfileSelector extends VertexNode<Member | ContentCard> {
  @OwnedProperty
  open: Observable<boolean>;

  constructor(args: CA) {
    super(args);
    this.open = args.open;
  }

  static new(args: CA) {
    const me = new ProfileSelector(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['defaultProfile', 'profiles', 'addProfileButton'];
  }

  @MemoizeOwned()
  get defaultProfile() {
    return DefaultProfile.new({
      parentNode: this,
    });
  }
  @MemoizeOwned()
  get addProfileButton(): AddProfileButton {
    return AddProfileButton.new({
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get profiles() {
    const authService = globalAuthService();
    const currentUser = authService.currentUserVertexObs.value;
    const precursor = currentUser!.filterBackrefs({ role: ['profile-of'] });

    return ListNode.new<ProfileSelector, Profile, Model.Backref>({
      parentNode: this,
      precursor,
      factory: (backref, parentNode) =>
        Profile.new({
          parentNode,
          vertex: backref.target,
          backref,
          context: parentNode.context,
        }),
    });
  }

  get isVisible(): boolean {
    return this.open.value;
  }
}
