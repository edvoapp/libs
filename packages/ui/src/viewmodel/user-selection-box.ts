import { Model, TrxRef, trxWrap, config, Analytics, globalStore } from '@edvoapp/common';
import { ListNode, Node as VMNode, NodeCA } from './base';
import { MemoizeOwned, Observable, ObservableList, OwnedProperty } from '@edvoapp/util';
import { ShareList } from './share-list';
import { AttachedPanel, AttachedPanelCA } from './attached-panel';
import { UserLozenge, UserItem, UserEmailLozenge, TextItem } from './user-lozenge';
import { TextField } from './text-field';
import { Guard, Guarded } from '@edvoapp/util';

const emailRegex = new RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

export interface UserDataDB {
  email: string;
  vertex: Model.Vertex;
}

interface CA extends NodeCA<ShareList> {}

type CreateFriend = {
  nickname: string;
  vertexId: string;
  trx: TrxRef;
};

export class UserSelectionBox extends VMNode<ShareList> {
  @OwnedProperty
  readonly users: ObservableList<Model.Vertex | string> = new ObservableList();
  @OwnedProperty
  readonly results: ObservableList<Model.Vertex | string> = new ObservableList();
  @OwnedProperty
  readonly isLoading: Observable<boolean> = new Observable(false);

  static new(args: CA) {
    const me = new UserSelectionBox(args);
    me.init();
    return me;
  }

  // This allows the React components for select to be interactable, and not be de-focused/delegated by other focusable children (i.e. TextFields) via PointerFocus.
  // TODO: Convert select component to a VM component
  get focusable() {
    return true;
  }

  get childProps(): (keyof this & string)[] {
    return ['selectedUsers', 'searchField', 'searchResults'];
  }

  @MemoizeOwned()
  get selectedUsers(): ListNode<UserSelectionBox, UserLozenge | UserEmailLozenge, Model.Vertex | string> {
    return ListNode.new<UserSelectionBox, UserLozenge | UserEmailLozenge, Model.Vertex | string>({
      parentNode: this,
      precursor: this.users,
      factory: (user, parentNode) => {
        if (user instanceof Model.Vertex) {
          return UserLozenge.new({
            parentNode,
            context: parentNode.context,
            vertex: user,
            onClose: () => this.users.removeWhere((vertex) => vertex instanceof Model.Vertex && user.id === vertex.id),
          });
        } else {
          return UserEmailLozenge.new({
            parentNode,
            context: parentNode.context,
            email: user,
            onClose: () => this.users.removeWhere((email) => email == user),
          });
        }
      },
    });
  }

  @MemoizeOwned()
  get searchField(): TextField {
    return TextField.singleString({
      parentNode: this,
      fitContentParent: null,
      emptyText: 'Email',
      onChange: this.debounce(async (value) => {
        const text = value.trim();
        if (text.length === 0) {
          this.searchResults.hide();
          this.results.replaceAll([]);
        } else {
          this.searchResults.show();
          this.isLoading.set(true);
          const [results, isEmail] = await UserSelectionBox.searchFriendsOrUser(text);
          if (isEmail && results.length == 0) {
            this.results.replaceAll([text]);
          } else {
            this.results.replaceAll(results);
          }
        }
        this.isLoading.set(false);
      }),
    });
  }

  @MemoizeOwned()
  get searchResults(): UserSearchList {
    return UserSearchList.new({
      parentNode: this,
      isLoading: this.isLoading,
    });
  }

  @Guarded
  async sendInvitations(shareCategory: Model.Priv.PermissionLevel) {
    this.clearUserSearch();
    if (this.users.length == 0) return;

    Guard.while(this.users, async (uu) => {
      const emails = uu.value.map((u) => {
        if (typeof u === 'string') {
          return u;
        } else {
          let emailObs = u.filterProperties({ role: ['email'] }).firstObs();
          if (!emailObs.value) {
            throw `Sanity check: email property must be loaded`;
          }
          return emailObs.value.text.value;
        }
      });
      let resultEmails = await this.inviteUsersByEmails(emails, shareCategory);

      const userVertices = uu.value.filter((x) => x instanceof Model.Vertex) as Model.Vertex[];

      const users = resultEmails.map(({ user_id: id }) => Model.Vertex.getById({ id }));

      const usersToShareWith = [...new Set([...userVertices, ...users])];
      const vertexOwnerID = this.parentNode.parentNode.vertex.userID.value;
      const vertex = this.parentNode.parentNode.vertex;

      await trxWrap(async (trx) => {
        if (vertexOwnerID) {
          Model.Priv.Share.create({
            trx,
            vertex,
            data: {
              shareType: 'allow',
              targetUserID: vertexOwnerID,
              shareCategory,
            },
          });
        }

        await Promise.all(
          usersToShareWith.map(async (user) => {
            if (this.hasShare(user) || this.isOwner(user)) return;
            Model.Priv.Share.create({
              trx,
              vertex,
              data: {
                shareType: 'allow',
                targetUserID: user.id,
                shareCategory,
              },
            });
            const friend = await Model.Friend.findFriendByTargetUserID({
              userID: user.id,
            });
            if (friend) return;
            const prop = (await user.filterProperties({ role: ['full-name'] }).toArray())[0] as
              | Model.Property
              | undefined;

            if (!prop) return;
            const nickname = prop.text.value;
            this.createFriend({
              vertexId: user.id,
              nickname,
              trx,
            });
            //toast(`${nickname} was added as friend`);
          }),
        );
      });

      uu.replaceAll([]);

      Analytics.event('share', {
        action: 'with users',
        shareCategory,
      });
    });
  }

  canUserBeAdded(user: Model.Vertex) {
    return !this.wasUserSelected(user) && !this.isOwner(user) && !this.hasShare(user);
  }

  selectVertexUser(selectedUser: Model.Vertex) {
    if (this.canUserBeAdded(selectedUser)) {
      //this.users.insert(selectedUser, 'USER', {}, true);
      this.users.insert(selectedUser);
    }
    this.searchField.clearContent();
    this.searchResults.hide();
  }

  selectEmailUser(selectedEmail: string) {
    const email = this.users.value.find((u) => u === selectedEmail);
    if (email === undefined) {
      this.users.insert(selectedEmail);
    }
    this.searchField.clearContent();
    this.searchResults.hide();
  }

  wasUserSelected(selectedUser: Model.Vertex): boolean {
    for (const user of this.users.value) {
      if (user instanceof Model.Vertex && selectedUser.id === user.id) {
        return true;
      }
    }
    return false;
  }

  isOwner(user: Model.Vertex): boolean {
    const ownerItem = this.parentNode.ownerItem.value;
    if (ownerItem && ownerItem.vertex.id == user.id) {
      return true;
    }
    return false;
  }

  hasShare(user: Model.Vertex): boolean {
    for (const share of this.parentNode.userShares.value) {
      if (share.share.user.id == user.id) {
        return true;
      }
    }
    return false;
  }

  clearUserSearch() {
    this.searchField.clearContent();
  }

  static async searchFriendsOrUser(text: string): Promise<[Model.Vertex[], boolean]> {
    const trimmed = text.trim();
    const isEmail = emailRegex.test(trimmed);
    let vertices;
    if (isEmail) {
      vertices = await Model.Vertex.searchUserBy({ email: trimmed });
    } else {
      const friends = await Model.Friend.searchFriendsByNickname({
        nickname: trimmed,
      });
      vertices = friends.map((f) => Model.Vertex.getById({ id: f.targetUserID }));
    }
    return [vertices, isEmail];
  }

  @Guarded
  createFriend(friend: CreateFriend): Model.Friend {
    return Model.Friend.create({
      trx: friend.trx,
      nickname: friend.nickname,
      targetUserID: friend.vertexId,
    });
  }

  @Guarded
  async inviteUsersByEmails(
    emails: string[],
    permissionLevel: Model.Priv.PermissionLevel,
  ): Promise<{ email: string; user_id: string }[]> {
    const serverUrl = config.serverUrl;

    const curretUser = globalStore.getCurrentUser();
    if (!curretUser) throw `sanity check: user must be loaded`;
    const accessToken = await curretUser.getIdToken();

    await this.parentNode.parentNode.name.get();

    const inviter = Model.Vertex.getById({ id: curretUser.uid });

    return Guard.while(inviter, async (inviter) => {
      const inviter_name = await inviter.properties
        .filterObs((p) => p.role.includes('full-name'))
        .firstObs()
        .mapObs<string | undefined>((p) => p?.text)
        .get();
      if (inviter_name === undefined) {
        throw `Sanity check: inviter_name must be defined`;
      }

      const topic_space_name = await this.parentNode.parentNode.name.get();
      if (topic_space_name === undefined) {
        throw `Sanity check: topic_space_name must be defined`;
      }
      try {
        let result = await fetch(`${serverUrl}/invite_users`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inviter_name,
            topic_space_id: this.parentNode.vertex.id,
            topic_space_name: topic_space_name,
            permission_level:
              // FIXME: there's a mismatch of write vs edit in the server code
              permissionLevel === 'write' ? 'edit' : permissionLevel,
            items: emails.map((email) => {
              return { email };
            }),
            // invitation_message: '',
          }),
        });
        let invitation_status_list = (await result.json()) as InviteUserResponse;
        return invitation_status_list.items.filter(
          (item) => item.user_id !== undefined && (item.status == 'AlreadyRegistered' || item.status == 'Invited'),
        ) as {
          [K in keyof UserInviteResult]-?: NonNullable<UserInviteResult[K]>;
        }[];
      } catch (err) {
        console.warn('err', err);
        return [];
      }
    });
  }
}

type InviteUserResponse = {
  items: UserInviteResult[];
};
type UserInviteResultStatus = 'AlreadyRegistered' | 'Invited' | 'InvalidEmail' | { error: string };
type UserInviteResult = {
  email: string;
  user_id?: string;
  status: UserInviteResultStatus;
};

interface UserSearchListCA extends AttachedPanelCA<UserSelectionBox> {
  isLoading: Observable<boolean>;
}

export class UserSearchList extends AttachedPanel<UserSelectionBox> {
  @OwnedProperty
  isLoading: Observable<boolean>;

  private constructor({ isLoading, ...args }: UserSearchListCA) {
    super(args);
    this.isLoading = isLoading;
  }

  static new(args: UserSearchListCA): UserSearchList {
    const me = new UserSearchList(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['results'];
  }

  @MemoizeOwned()
  get results(): ListNode<UserSearchList, UserItem | TextItem, Model.Vertex | string> {
    return ListNode.new<UserSearchList, UserItem | TextItem, Model.Vertex | string>({
      parentNode: this,
      precursor: this.parentNode.results,
      label: 'user-result',
      factory: (user, parentNode) => {
        if (user instanceof Model.Vertex) {
          return UserItem.new({
            parentNode,
            context: this.context,
            vertex: user,
            onClick: () => this.selectVertexUser(user),
          });
        } else {
          return TextItem.new({
            parentNode,
            context: this.context,
            value: user,
            onClick: () => this.selectEmailUser(user),
          });
        }
      },
    });
  }

  selectVertexUser(vertex: Model.Vertex) {
    this.parentNode.selectVertexUser(vertex);
  }

  selectEmailUser(email: string) {
    this.parentNode.selectEmailUser(email);
  }
}
