import { Model, trxWrap } from '@edvoapp/common';
import { ObservableList } from '@edvoapp/util';

import { Behavior } from '../service';
import * as VM from '../viewmodel';

export type ShareStatus = 'read' | 'write' | 'private' | 'unshared';

export function getShareStatus(shares: Model.Priv.Share[]): ShareStatus {
  const existing_share = shares.find((s) => s.shareType === 'allow');
  const existing_nshare = shares.find((s) => s.shareType === 'deny');

  if (existing_share) {
    if (existing_share.shareCategory === 'read') {
      return 'read';
    } else if (existing_share.shareCategory === 'write' || existing_share.shareCategory === 'admin') {
      return 'write';
    }
  } else if (existing_nshare) {
    return 'private';
  } else {
    return 'unshared';
  }

  return 'unshared';
}

export class Sharing extends Behavior {
  // This is a temporary tool, but it's going to be changed soon once we have user-specific sharing
  getStatus(shares: Model.Priv.Share[]): ShareStatus {
    return getShareStatus(shares);
  }
  //  getActions(node: Node): Action[] {
  //   if (!(node instanceof VertexNode)) return [];

  //   let backref = node instanceof BranchNode ? node.backref : undefined;
  //   const { vertex } = node;
  //   const vertexUserID: string | undefined = await vertex.userID.get();
  //   const isOwner = Firebase.getCurrentUser()?.uid === vertexUserID;

  //   const shares = vertex.shares;

  //   const sharingActions: Action[] = [];

  //   const existing_share = (await shares.get()).find(
  //     (s) => s.shareType === 'allow',
  //   );
  //   const existing_nshare = (await shares.get()).find(
  //     (s) => s.shareType === 'deny',
  //   );

  //   // TODO: This is simply to archive all shares. This needs to be redone
  //   if (existing_share) {
  //     sharingActions.push({
  //       label: 'Unset as Public',
  //       icon: <PublicOffIcon />,
  //       onClick: () => {
  //         Analytics.track({
  //           category: 'Share',
  //           action: 'Unset as Public',
  //         });
  //         void doShare({
  //           shares,
  //           vertex,
  //           shareCategory: 'read',
  //           shareType: null,
  //           isOwner,
  //           backref,
  //         });
  //       },
  //     });
  //   } else if (existing_nshare) {
  //     // TODO: This is simply to archive all shares. This needs to be redone
  //     sharingActions.push({
  //       label: 'Unset as Private',
  //       icon: <NoEncryptionIcon />,
  //       onClick: () => {
  //         Analytics.track({
  //           category: 'Share',
  //           action: 'Unset as Private',
  //         });
  //         void doShare({
  //           shares,
  //           vertex,
  //           shareCategory: 'read',
  //           shareType: null,
  //           isOwner,
  //           backref,
  //         });
  //       },
  //     });
  //   } else {
  //     sharingActions.push(
  //       {
  //         label: 'Set as Public',
  //         icon: <GlobeIcon />,
  //         onClick: () => {
  //           Analytics.track({
  //             category: 'Share',
  //             action: 'Set as Public',
  //           });
  //           void doShare({
  //             shares,
  //             vertex,
  //             shareCategory: 'read',
  //             shareType: 'allow',
  //             isOwner,
  //             backref,
  //           });
  //         },
  //       },
  //       {
  //         label: 'Set as Private',
  //         icon: <LockIcon />,
  //         onClick: () => {
  //           Analytics.track({
  //             category: 'Share',
  //             action: 'Set as Private',
  //           });
  //           void doShare({
  //             shares,
  //             vertex,
  //             shareCategory: 'read',
  //             shareType: 'deny',
  //             isOwner,
  //             backref,
  //           });
  //         },
  //       },
  //     );
  //   }

  //   return [
  //     {
  //       label: 'Sharing',
  //       subActions: sharingActions,
  //     },
  //   ];
  // }
}

export function doShare({
  shares,
  node,
  shareType,
  shareCategory,
  isOwner,
  backref,
}: {
  shares: ObservableList<Model.Priv.Share>;
  node: VM.ShareMenu;
  shareType: 'allow' | 'deny' | null;
  shareCategory: Model.Priv.PermissionLevel;
  isOwner: boolean;
  backref?: Model.Backref;
}) {
  // TODO: Is this isOwner check necessary for shares moving forwards?
  if (isOwner) {
    void trxWrap(async (trx) => {
      // TODO: When adding new shares for the user picker, do not archive these.
      (await shares.get()).forEach((s) => s.archive(trx));
      if (shareType !== null) {
        Model.Priv.Share.create({
          trx,
          vertex: node.vertex,
          data: {
            shareType,
            shareCategory: shareCategory,
            targetUserID: 'PUBLIC',
            contextId: backref?.id,
          },
        });
      }
    });
  }
}
