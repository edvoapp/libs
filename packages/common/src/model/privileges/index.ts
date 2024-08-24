export * from './share';
export * from './privstate';

import { Share } from './share';

export type InheritedPrivsTuple = {
  userID: string;
  share: Share;
};

/**
 * `inheritedPrivs` - transfered state between ShareState objects. composition of N aggregatedPriv objects such that denies filter allows, and shareIDs are included
 */

export interface InheritedPrivs {
  read: InheritedPrivsTuple[];
  write: InheritedPrivsTuple[];
  admin: InheritedPrivsTuple[];

  // * allShareIDs are gathered by accumulating all shareIDs originating from a node in the current ViewModel lineage
  // * they are used to specify which shareIDs in the priv.shareID list are foreign to the current lineage
  // * foreign shareIDs are aggregated and coalesced with the local shares to maintain the privs of other trees
  allShares: Share[];
}

// A collection of ShareInstructionIds grouped by PermissionLevel
export interface SharesByPermissionLevel {
  read: Share[];
  write: Share[];
  admin: Share[];
  deny: Share[];
}

// regular userID or PUBLIC
type ShareTargetUserID = string | 'PUBLIC';

// Record<targetUserID, permission-specific shareIDs>
export type AggregatedSharesByUser = Record<ShareTargetUserID, SharesByPermissionLevel>;

export type PermissionLevel = 'read' | 'write' | 'admin';

// TODO: This is extraordinarily similar to share.ts's performCoalescence method,
// and we can optimize this for sure.
export function coalesceForeignAggregatedAndInheritedPrivs(
  agg: AggregatedSharesByUser,
  inh: InheritedPrivs,
): InheritedPrivs {
  const globallyDeniedUsers: string[] = [];

  // outgoing categories
  let newRead: InheritedPrivsTuple[] = [];
  let newWrite: InheritedPrivsTuple[] = [];
  let newAdmin: InheritedPrivsTuple[] = [];
  let newAllShares: Set<Share> = new Set(inh?.allShares || []);

  // add AggregatedSharesByUser fields to the new outgoing privs objects
  Object.entries(agg).map(([userID, privs]) => {
    // if this is not a denied user in the locally aggregated privs...
    if (!agg[userID].deny.length) {
      // For each share category in the locally aggregated privs:
      // push them to the new outgoing shareCategories
      // and add the shareID to the newAllShareIds for gathering all shareIds in this lineage
      privs.read.map((share) => {
        newAllShares.add(share);
        newRead.push({ userID, share });
      });
      privs.write.map((share) => {
        newAllShares.add(share);
        newWrite.push({ userID, share });
      });
      privs.admin.map((share) => {
        newAllShares.add(share);
        newAdmin.push({ userID, share });
      });
    } else {
      // ...else if this is a denied user
      // populate the globallyDeniedUsers
      // for roadblocking users from inheritedPrivs in the next step
      globallyDeniedUsers.push(userID);
    }
  });

  // coalescing inheritedPrivs with aggregatedPrivs
  interface CoalesceArg {
    inhCat?: InheritedPrivsTuple[];
    newCat: InheritedPrivsTuple[];
    catTitle: PermissionLevel;
  }

  const data: CoalesceArg[] = [
    { inhCat: inh?.read, newCat: newRead, catTitle: 'read' },
    { inhCat: inh?.write, newCat: newWrite, catTitle: 'write' },
    { inhCat: inh?.admin, newCat: newAdmin, catTitle: 'admin' },
  ];

  data.forEach(({ inhCat, newCat, catTitle }) => {
    if (inhCat) {
      inhCat.forEach(({ userID, share }) => {
        if (globallyDeniedUsers.includes(userID)) {
          // if the user has been denied at any point in the locally aggregated privs
          // they do not pass go
        } else if (agg[userID]) {
          // if the userID in the inheritedPriv exists in the aggregatedPrivs...
          const userAggregate = agg[userID];
          if (userAggregate.deny.length) {
            // ...and that user is denied in the aggregatedPrivs
            // add that user to the globallyDeniedUsers list
            globallyDeniedUsers.push(userID);
          } else if (!userAggregate[catTitle].includes(share)) {
            // if the inherited share is not already included in the userAggregate, then push it to the new privs
            newCat.push({ userID, share });
          }
        } else {
          // if that inherited userID does not have a user record in the aggregatedPrivs
          // push the inherited userID/share to the new inheritedPrivs
          newCat.push({ userID, share });
        }
      });
    }
  });

  const coalescedPrivs: InheritedPrivs = {
    read: newRead,
    write: newWrite,
    admin: newAdmin,
    allShares: [...newAllShares],
  };

  return coalescedPrivs;
}
