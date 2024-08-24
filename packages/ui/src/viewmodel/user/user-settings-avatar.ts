import { ChildNode, ChildNodeCA, ListNode, VertexNode, VertexNodeCA } from '../base';
import { MemoizeOwned, MemoizeWeak, Observable, ObservableList, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { DropMenu, DropMenuBody, DropMenuButton, DropMenuButtonCA } from '../component';
import { UserSettingsModal } from './user-settings-modal';
import { Clickable } from '../../behaviors';
import { AppDesktop } from '../app-desktop';
import { config, Model } from '@edvoapp/common';
import { UserAvatar } from '../user-avatar';

interface CA extends VertexNodeCA {}

export class CurrentUserAvatar extends VertexNode {
  overflow = true; // for dropmenu

  static new(args: CA) {
    const me = new CurrentUserAvatar(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['userSettingsDropmenu'];
  }

  @MemoizeOwned()
  get email(): ObservableReader<string | undefined> {
    return this.vertex
      .filterProperties({ role: ['email'] })
      .firstObs()
      .mapObs<string | undefined>((p) => p?.text);
  }

  @MemoizeOwned()
  get fullName(): ObservableReader<string | undefined> {
    return this.vertex
      .filterProperties({ role: ['full-name'] })
      .firstObs()
      .mapObs<string | undefined>((p) => p?.text);
  }

  @MemoizeOwned()
  get userSettingsDropmenu(): DropMenu {
    return DropMenu.new({
      parentNode: this,
      menuFactory: (parentNode) =>
        UserSettingsMenu.new({
          parentNode,
          vertex: this.vertex,
          context: this.context,
        }),
      buttonFactory: (parentNode) =>
        UserSettingsAvatarButton.new({
          parentNode,
          vertex: this.vertex,
        }),
    });
  }
}

interface UserSettingsAvatarButtonCA extends DropMenuButtonCA {
  vertex: Model.Vertex;
}

export class UserSettingsAvatarButton extends DropMenuButton {
  @OwnedProperty
  vertex: Model.Vertex;

  constructor({ vertex, ...args }: UserSettingsAvatarButtonCA) {
    super(args);
    this.vertex = vertex;
  }

  static new(args: UserSettingsAvatarButtonCA) {
    const me = new UserSettingsAvatarButton(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['avatar'];
  }

  @OwnedProperty
  missingExt = this.context.extBridge!.extensionStatus.mapObs((x) => x === 'NOT_INJECTED') ?? null;

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      size: 'small',
    });
  }
}

const dropdownButtonTypes = [
  'install-extension',
  'sign-out',
  'open-app-settings',
  'open-user-settings',
  'discord',
  // 'feedback',
] as const;

type DropdownButtonTypes = typeof dropdownButtonTypes[number];

interface UserSettingsMenuCA extends VertexNodeCA<DropMenuBody> {}

export class UserSettingsMenu extends VertexNode<DropMenuBody> {
  static new(args: UserSettingsMenuCA) {
    const me = new UserSettingsMenu(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['buttons', 'avatar'];
  }

  @MemoizeOwned()
  get buttons() {
    const precursor = ObservableList.calculated(
      ({ extensionStatus }) => {
        const missingExt = extensionStatus === 'NOT_INJECTED';
        return dropdownButtonTypes.filter((d) => {
          // if we don't have the extension, show all of the buttons
          if (missingExt) return true;
          // if we have the extension, hide the install extension button
          return d !== 'install-extension';
        });
      },
      {
        extensionStatus: this.context.extBridge?.extensionStatus,
      },
    );

    return ListNode.new<UserSettingsMenu, UserSettingsButton, DropdownButtonTypes>({
      parentNode: this,
      precursor,
      factory: (type, parentNode) => UserSettingsButton.new({ type, parentNode }),
    });
  }

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      size: 'medium',
    });
  }
}

type UserSettingsButtonParent = ListNode<UserSettingsMenu, UserSettingsButton, DropdownButtonTypes>;

interface UserSettingsButtonCA extends ChildNodeCA<UserSettingsButtonParent> {
  type: DropdownButtonTypes;
}

export class UserSettingsButton extends ChildNode<UserSettingsButtonParent> implements Clickable {
  type: DropdownButtonTypes;
  allowHover = true;

  constructor({ type, ...args }: UserSettingsButtonCA) {
    super(args);
    this.type = type;
  }

  static new(args: UserSettingsButtonCA) {
    const me = new UserSettingsButton(args);
    me.init();
    return me;
  }

  @MemoizeWeak()
  get parentDropMenu() {
    return this.closestInstance(DropMenu);
  }

  get textLabel() {
    switch (this.type) {
      case 'install-extension':
        return 'Install Extension';
      case 'sign-out':
        return 'Logout';
      case 'open-app-settings':
        return 'App Settings';
      case 'open-user-settings':
        return 'User Settings';
      case 'discord':
        return 'Discord';
      default:
        return '';
    }
  }

  get cursor() {
    return 'pointer';
  }

  get target() {
    if (this.href) return '_blank';
  }

  get href() {
    switch (this.type) {
      case 'install-extension':
        return config.extensionURL;
      case 'discord':
        return 'https://discord.gg/dfekCjfwHw';
      default:
        return;
    }
  }

  get as() {
    if (this.href) return 'a';
  }

  onClick() {
    switch (this.type) {
      case 'sign-out':
        void this.context.authService.signOut();
        break;
      case 'open-app-settings':
        (this.root as AppDesktop).appSettingsModal.open();
        this.parentDropMenu?.collapse();
        break;
      case 'open-user-settings':
        (this.root as AppDesktop).userSettingsModal.open();
        this.parentDropMenu?.collapse();
        break;
      default:
        break;
    }
  }
}
