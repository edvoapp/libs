import { Model, TrxRef, globalStore } from '@edvoapp/common';
import { ChangeContext, EdvoObj, Guard, Transactable } from '@edvoapp/util';
import { ViewModelContext } from './context';
import { raiseError } from '../../utils';
import { Node } from './view-model-node';
import { Updatable } from './updatables';
import { asTransaction } from '@edvoapp/common';
import { trxWrapSync } from '@edvoapp/common';

export interface AccumulatorItem {
  updatable: Model.Backref | Model.Edge | Model.Property;
  privs: Model.Priv.InheritedPrivs[];
}

const privUpdateEnabled = true;

export class PrivUpdateAccumulator extends EdvoObj {
  active = true;
  // items = new Set<Node>();
  privUpdateItems: Record<string, AccumulatorItem> = {};

  constructor(readonly viewCtx: ViewModelContext, trx?: Transactable) {
    super();

    const txr = asTransaction(trx);

    // Lets stick around until we get applied
    if (txr) {
      const guard = Guard.unsafe(this);
      txr.addPrecommitHook((txr) => {
        const updatePrivs = this.getUpdateOp();
        updatePrivs?.(txr);

        // Wait until the externallyManagedTrx is fully committed before releasing the guard
        txr.addPostCommitHook(() => {
          guard.release();
        });
      });

      // Note: addAbortHook currently no-ops; we'll have to make sure that the guard gets properly released once we implement it
      txr.addAbortHook(() => guard.release());
    } else {
      /* add the timeout on construction, using a deadline to trigger the accumulation */
      this.defer(() => {
        const updatePrivs = this.getUpdateOp();
        if (updatePrivs) {
          trxWrapSync(updatePrivs, 'PrivUpdateAccumulator-default-tx');
        }
      }, 50);
    }
  }

  accumulatePrivUpdate(node: Node, updatable: Updatable) {
    const privs = node.coalescedPrivileges?.value;
    if (!privs) return;

    const userID = globalStore.getCurrentUserID();

    // Essential to mirror the logic within the ACL (firestore.rules)
    // EITHER  I have been given admin privileges, therefore I can change who has access
    // OR I have created this, thus it is mine to control access to
    if (updatable.privs.value.adminID.includes(userID) || updatable.userID === userID) {
      const ref = (this.privUpdateItems[updatable.id] ||= {
        updatable,
        privs: [],
      });
      ref.privs.push(privs);

      if (!updatable.privs.value.loaded) {
        raiseError(
          `${this.constructor.name} updatable ${updatable.constructor.name}(${updatable.role.join(
            ',',
          )}) privs are not loaded`,
        );
      }
    }
  }
  private getUpdateOp(): ((txr: TrxRef) => void) | undefined {
    this.active = false; // No longer accepting new applicants, thx
    const items = Object.values(this.privUpdateItems);

    const itemsToUpdate: {
      item: AccumulatorItem;
      projectedPrivs: Model.Priv.PrivState;
    }[] = [];
    for (const item of items) {
      // Squash coalesced privileges for each accumulator item
      let mergedPrivs = mergeHeritablePrivStates(item.privs);

      // We should be loaded
      const shares = item.updatable.privs.value.shares;

      if (!shares) continue;

      const foreignShares = shares?.filter(
        (share) =>
          // These shares might have just been archived
          share.status.value === 'active' && !mergedPrivs.allShares.some((mergedShareID) => mergedShareID === share),
      );

      if (!foreignShares) {
        console.error(`Privilege update aborted - share instructions not loaded`, item.updatable);
        raiseError(`Privilege update aborted - share instructions not loaded`);
        return;
      }

      // get all the foreignShares from the viewModelContext
      // const foreignShares: Model.Priv.Share[] = []; /*= await Promise.all(
      // foreignShareIds.map((id) => context.getShareById(id)),
      // );*/
      // transform foreignShares and into aggregatedForeignShares
      const aggregatedForeignShares: Model.Priv.AggregatedSharesByUser = {};
      [...foreignShares /* ...denyShares */].forEach((shareInstruction) =>
        shareToAggregated({
          shareInstruction,
          aggregatedPrivs: aggregatedForeignShares,
        }),
      );
      // coalesce these aggregatedPrivs with the local inheritedPrivs to get the final inheritedPrivsObject
      const finalInheritedPrivs = Model.Priv.coalesceForeignAggregatedAndInheritedPrivs(
        aggregatedForeignShares,
        mergedPrivs,
      );
      // transform to projectedPrivs
      let projectedPrivs = Model.Priv.PrivState.fromInherited(finalInheritedPrivs);

      // Ensure the updatable creator is always included in the privs
      projectedPrivs = projectedPrivs.addUser(item.updatable.userID);

      // No changes from the db? No transaction!
      if (!item.updatable.privs.value.equal(projectedPrivs)) {
        itemsToUpdate.push({ item, projectedPrivs });
      }
    }
    if (itemsToUpdate.length === 0) return;
    return (trx) => {
      for (const { item, projectedPrivs } of itemsToUpdate) {
        item.updatable.setPrivs({
          trx,
          privs: projectedPrivs,
        });
      }
    };
  }
}

// /* get the accumulator and add the node to it */
// export function queueForTriggerConsideration(
//   changeCtx: ChangeContext,
//   item: Node,
// ) {
//   if (!privUpdateEnabled) return;
//   const acc = getAccumulatorForCtx(item.context, changeCtx);

//   let add = true;
//   acc.items.forEach((i) => {
//     // Avoid redundant processing
//     // Only add it if it's not already covered by one of the existing nodes
//     if (i.contains(item)) add = false;
//   });

//   if (add) acc.items.add(item);
// }

let globalFallbackAccumulator: null | PrivUpdateAccumulator = null;
const trx_accumulator_map: Record<string, PrivUpdateAccumulator> = {};
/**
 * Get the accumulator associated with the transaction key
 * OR create a new accumulator
 * OR use the globalFallbackAccumulator which is created without a transaction key
 * and is triggered through a deadline rather than integrating itself in a transaction lifetime
 */
export function getAccumulatorForCtx(viewCtx: ViewModelContext, changeCtx: ChangeContext): PrivUpdateAccumulator {
  if (changeCtx.trx) {
    return (trx_accumulator_map[changeCtx.trx.name] ??= new PrivUpdateAccumulator(viewCtx, changeCtx.trx));
    // On accumulator construction, add the trx.preCommitHook
  } else {
    if (globalFallbackAccumulator?.active) {
      return globalFallbackAccumulator;
    } else {
      return (globalFallbackAccumulator = new PrivUpdateAccumulator(viewCtx));
    }
  }
}

/**
 * Now that we have objects of all the transcluded node's privileges
 * we can confidently reduce them to a single object
 */
function mergeHeritablePrivStates(inputPrivs: Model.Priv.InheritedPrivs[]): Model.Priv.InheritedPrivs {
  // This is called once for each updatable with all of the InheritedPrivs gathered for each coalesced node that carries that updatable.
  // We need to track ShareIDs which we want to remove from the updatable, because we're not allowed to remove ShareIDs we don't recognize.
  // SO, we gather up those ShareIDs which grant access at a grandparent node, but are denied by a rule by a parent node

  const outputPrivs: Model.Priv.InheritedPrivs = {
    read: [],
    write: [],
    admin: [],
    allShares: [...new Set([...inputPrivs.flatMap((p) => p.allShares)])],
  };

  inputPrivs.forEach((priv) => {
    [
      { output: outputPrivs.read, cur: priv.read },
      { output: outputPrivs.write, cur: priv.write },
      { output: outputPrivs.admin, cur: priv.admin },
    ].forEach(({ output, cur }) => {
      cur.forEach(({ userID, share }) => {
        // if the outputPrivs does not contain that shareID already
        // add it to the outputPrivs
        if (!output.some((el) => el.share.equals(share))) {
          output.push({ userID, share });
        }
      });
    });
  });

  return outputPrivs;
}

export function notEmpty<TValue>(value: TValue): value is NonNullable<TValue> {
  return value !== null && value !== undefined;
}

function shareToAggregated({
  shareInstruction,
  aggregatedPrivs,
}: {
  shareInstruction?: Model.Priv.Share | null;
  aggregatedPrivs: Model.Priv.AggregatedSharesByUser;
}) {
  if (!shareInstruction) return;
  let category: Model.Priv.PermissionLevel | 'deny' = shareInstruction.shareCategory;
  if (shareInstruction.shareType === 'deny' || !['read', 'write', 'admin'].includes(category)) {
    category = 'deny';
  }

  const currentShareBucket: Model.Priv.SharesByPermissionLevel = (aggregatedPrivs[shareInstruction.targetUserID] ||= {
    read: [],
    write: [],
    admin: [],
    deny: [],
  });

  currentShareBucket[category].push(shareInstruction);
}
