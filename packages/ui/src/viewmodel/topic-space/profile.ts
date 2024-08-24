import { BranchNode, BranchNodeCA, ChildNode, ChildNodeCA, ListNode, Node } from '../base';
import { ProfileSelector } from './profile-selector';
import { MemoizeOwned, ObservableReader, OwnedProperty } from '@edvoapp/util';

import { PropertyConfig, TextField } from '../text-field';
import { Behavior, DispatchStatus, EventNav } from '../../service';
import { trxWrapSync } from '@edvoapp/common';

interface CA extends BranchNodeCA<ListNode<ProfileSelector, Profile>> {}

export class Profile extends BranchNode<ListNode<ProfileSelector, Profile>> {
  static new(args: CA) {
    const me = new Profile(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['textField', 'selectProfileButton', 'archiveProfileButton'];
  }

  @MemoizeOwned()
  get textField() {
    return TextField.singleString({
      parentNode: this,
      fitContentParent: this.parentNode,
      emptyText: 'Enter a profile name',
      propertyConfig: PropertyConfig.fromVertex({
        vertex: this.vertex,
        role: ['profile-name'],
        visibleUserIDsForDescendants: this.visibleUserIDsForDescendants,
      }),
    });
  }

  @MemoizeOwned()
  get selectProfileButton() {
    return SelectProfileButton.new({
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get archiveProfileButton() {
    return ArchiveProfileButton.new({
      parentNode: this,
    });
  }

  @MemoizeOwned()
  get profileName() {
    return this.vertex
      .filterProperties({
        role: ['profile-name'],
        contentType: 'text/plain',
      })
      .firstObs()
      .mapObs<string | undefined>((prop) => prop?.text);
  }
}

interface DefaultProfileCA extends ChildNodeCA<ProfileSelector> {}

export class DefaultProfile extends ChildNode<ProfileSelector> {
  static new(args: DefaultProfileCA) {
    const me = new DefaultProfile(args);
    me.init();
    return me;
  }

  initChildren(): Node[] {
    return [this.selectProfileButton];
  }

  @MemoizeOwned()
  get selectProfileButton() {
    return SelectProfileButton.new({
      parentNode: this,
    });
  }
}

interface SelectProfileButtonCA extends ChildNodeCA<Profile | DefaultProfile> {}

export class SelectProfileButton extends ChildNode<Profile | DefaultProfile> {
  @OwnedProperty
  partitionObs: ObservableReader<string | null | undefined>;
  profileId: string | 'default';
  allowHover = true;
  constructor(args: SelectProfileButtonCA) {
    super(args);

    const profileSelector = this.closestInstance(ProfileSelector)!;
    this.partitionObs = profileSelector.parentNode.partition;
    this.profileId = this.parentNode instanceof Profile ? this.parentNode.vertex.id : 'default';
  }

  getLocalBehaviors(): Behavior[] {
    return [new SelectProfileButtonClick()];
  }

  @MemoizeOwned()
  get active() {
    return this.partitionObs.mapObs((v) => (v ? v.slice(8) === this.profileId : false));
  }

  static new(args: SelectProfileButtonCA) {
    const me = new SelectProfileButton(args);
    me.init();
    return me;
  }
}

interface ArchiveProfileButtonCA extends ChildNodeCA<Profile> {}

export class ArchiveProfileButton extends ChildNode<Profile> {
  allowHover = true;

  static new(args: ArchiveProfileButtonCA) {
    const me = new ArchiveProfileButton(args);
    me.init();
    return me;
  }

  getLocalBehaviors(): Behavior[] {
    return [new ArchiveProfileButtonClick()];
  }
}

interface AddProfileButtonCA extends ChildNodeCA<ProfileSelector> {}

export class AddProfileButton extends ChildNode<ProfileSelector> {
  allowHover = true;

  static new(args: AddProfileButtonCA) {
    const me = new AddProfileButton(args);
    me.init();
    return me;
  }

  getLocalBehaviors(): Behavior[] {
    return [new AddProfileButtonClick()];
  }
}

class SelectProfileButtonClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const btn = originNode.closestInstance(SelectProfileButton);
    if (!btn) return 'decline';
    const profileSelector = btn.closestInstance(ProfileSelector);
    const node = profileSelector?.parentNode;
    if (!node) return 'decline';

    const profile = btn.closestInstance(Profile);
    node.switchProfile(profile?.vertex);
    return 'stop';
  }
}

class ArchiveProfileButtonClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const btn = originNode.closestInstance(ArchiveProfileButton);
    if (!btn) return 'decline';
    const profile = btn.closestInstance(Profile);
    if (!profile) return 'decline';
    trxWrapSync((trx) => profile.vertex.archive(trx));
    return 'stop';
  }
}

class AddProfileButtonClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const btn = originNode.closestInstance(AddProfileButton);
    if (!btn) return 'decline';
    const profileSelector = btn.closestInstance(ProfileSelector);
    if (!profileSelector) return 'decline';
    const card = profileSelector.parentNode;
    card.profileFormOpen.set(true);
    return 'stop';
  }
}
