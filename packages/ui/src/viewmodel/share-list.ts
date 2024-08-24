import { Guard, MemoizeOwned, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { ConditionalNode, ListNode, Node, NodeCA, VertexNode, VertexNodeCA } from './base';
import { trxWrap, Model, Analytics, trxWrapSync } from '@edvoapp/common';
import { ShareMenu } from './topic-space';
import { UserSelectionBox } from './user-selection-box';
import { UserItem } from './user-lozenge';
import { UserAvatar } from './user-avatar';

interface UserShareCA extends NodeCA<ListNode<ShareList, UserShare, Model.Priv.Share>> {
  share: Model.Priv.Share;
}

export class UserShare extends Node<ListNode<ShareList, UserShare, Model.Priv.Share>> {
  @OwnedProperty
  share: Model.Priv.Share;
  private constructor({ share, ...args }: UserShareCA) {
    super(args);
    this.share = share;
  }

  static new(args: UserShareCA): UserShare {
    return new UserShare(args);
  }

  get childProps(): string[] {
    return ['avatar'];
  }

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      parentNode: this,
      vertex: this.share.user,
      context: this.context,
      size: 'small',
    });
  }

  get targetUserId(): string {
    return this.share.targetUserID;
  }

  remove() {
    trxWrapSync((trx) => {
      this.share.archive(trx);
    });
  }
  changePermission(shareCategory: Model.Priv.PermissionLevel) {
    if (!this.alive) return; // paranoid - probably won't happen
    const targetUserID = this.share.targetUserID;
    const vertex = this.share.property.parent;

    Guard.while(vertex, (vertex) => {
      trxWrapSync((trx) => {
        this.share.archive(trx);
        // New share is going to cause this node to be destroyed
        // so we don't need to set it here
        Model.Priv.Share.create({
          trx,
          vertex,
          data: {
            shareType: 'allow', // could be "deny" but we aren't implementing that right now I guess
            shareCategory,
            targetUserID,
            //contextId: this.share.property.
          },
        });
      });
    });
  }
}

interface GeneralShareCA extends NodeCA<ShareList> {}

type GeneralPermissionLevel = 'read' | 'write';
type SharePermission = { type: 'RESTRICTED' } | { type: 'LINK'; category: GeneralPermissionLevel };

export class GeneralShare extends Node<ShareList> {
  @OwnedProperty
  share: ObservableReader<Model.Priv.Share | null | undefined>;
  private constructor({ ...args }: GeneralShareCA) {
    super(args);

    this.share = this.parentNode.vertex.shares.filterObs((s) => s.targetUserID == 'PUBLIC').firstObs();
  }

  static new(args: GeneralShareCA): GeneralShare {
    return new GeneralShare(args);
  }

  get targetUserId() {
    return 'PUBLIC';
  }

  get status(): SharePermission {
    const share = this.share.value;
    if (!share) return { type: 'RESTRICTED' };
    return {
      type: 'LINK',
      category: share.shareCategory == 'read' ? 'read' : 'write',
    };
  }

  async setRestricted() {
    const share = this.share.value;
    if (!share) return;
    await trxWrap(async (trx) => {
      share.archive(trx);
    });
  }

  async setAnyOneWithTheLink(shareCategory: GeneralPermissionLevel) {
    const share = this.share.value?.upgrade();
    Analytics.event('share', {
      action: 'anyone with link',
      shareCategory,
    });
    if (share) {
      await Guard.while(
        share,
        async (share) =>
          await trxWrap(async (trx) => {
            share.replace({
              trx,
              data: {
                shareCategory,
              },
            });
          }),
      );
    } else {
      const vertex = this.parentNode.parentNode.vertex;
      await trxWrap(async (trx) => {
        Model.Priv.Share.create({
          trx,
          data: {
            shareType: 'allow',
            targetUserID: 'PUBLIC',
            shareCategory,
            // TODO(Frank): Add contextId for members in the future
            //contextId: node instanceof BranchNode ? node.backref : undefined
          },
          vertex,
        });
      });
    }
  }
}

/** The box containing the list of share instructions */
export class ShareList extends VertexNode<ShareMenu> {
  private constructor({ ...args }: VertexNodeCA<ShareMenu>) {
    super(args);
  }
  static new(args: VertexNodeCA<ShareMenu>): ShareList {
    let me = new ShareList(args);
    me.init();
    return me;
  }
  get childProps(): (keyof this & string)[] {
    return ['userSelectionBox', 'ownerItem', 'userShares', 'generalShare'];
  }

  @MemoizeOwned()
  get userSelectionBox(): UserSelectionBox {
    return UserSelectionBox.new({
      parentNode: this,
      context: this.context,
    });
  }

  @MemoizeOwned()
  get ownerItem(): ConditionalNode<UserItem, string | undefined, ShareList> {
    const targetUserId = this.vertex.userID;

    return ConditionalNode.new<UserItem, string | undefined, ShareList>({
      parentNode: this,
      precursor: targetUserId,
      factory: (targetUserId, parentNode) => {
        if (targetUserId === undefined) return undefined;
        const vertex = Model.Vertex.getById({ id: targetUserId });
        return UserItem.new({
          parentNode,
          context: this.context,
          vertex,
        });
      },
    });
  }

  @MemoizeOwned()
  get userShares() {
    return ListNode.new<ShareList, UserShare, Model.Priv.Share>({
      parentNode: this,
      label: 'share-items',
      precursor: this.vertex.shares.filterObs(
        (s) => s.targetUserID !== 'PUBLIC' && s.targetUserID !== this.vertex.userID.value,
      ),
      iterateChildrenForwards: true,
      factory: (share, parentNode) => {
        return UserShare.new({
          parentNode,
          share,
          context: this.context,
        });
      },
    });
  }

  @MemoizeOwned()
  get generalShare(): GeneralShare {
    return GeneralShare.new({
      parentNode: this,
      context: this.context,
    });
  }
}
