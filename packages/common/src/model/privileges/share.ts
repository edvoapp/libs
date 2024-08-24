import { Property } from '../property';
import { Vertex, Backref } from '..';
import { TrxRef } from '../../transaction';
import {
  ObservableList,
  EdvoObj,
  ItemEventOrigin,
  IObservable,
  ChangeListener,
  Unsubscriber,
  ChangeContext,
  tryJsonParse,
  MemoizeOwned,
  OwnedProperty,
} from '@edvoapp/util';
import { PrivState } from './privstate';
import {
  PermissionLevel,
  AggregatedSharesByUser,
  InheritedPrivs,
  SharesByPermissionLevel,
  InheritedPrivsTuple,
} from '.';
import { QueryObservable } from '../../dataset/query-observable';
import { globalStore } from '../../dataset/store';

export type ShareType = 'allow' | 'deny';

export interface ShareInstructionData {
  shareType: ShareType;
  shareCategory: PermissionLevel;
  targetUserID: string;
  // contextId is the backref LEADING to the share
  contextId?: string;
}

export interface ShareInstructionReplaceData {
  shareType?: ShareType;
  shareCategory?: PermissionLevel;
}

// Can only be created and archived. NOT modified.
export class Share extends EdvoObj {
  private values: ShareInstructionData;
  constructor(readonly property: Property) {
    super();
    this.values = tryJsonParse<ShareInstructionData>(property.text.value);
  }

  /**
   * Creates a new share. Use when you want to add a new row for a share instruction.
   * @param trx: TrxRef
   * @param vertex
   * @param data
   */
  static create({ trx, vertex, data }: { trx: TrxRef; vertex: Vertex; data: ShareInstructionData }) {
    const property = vertex.createProperty({
      trx,
      role: ['share'],
      contentType: 'application/x-share',
      initialString: JSON.stringify(data),
      origin: 'USER',
      // Everyone should be able to see the list of share instructions so that they can know if they are allowed to view the Vertex's other properties or not.
      // TODO: Change PUBLIC to "UNLISTED" and enforce that it be used only for access control but not for query filtering on the server side
      // Otherwise all PUBLIC things are listable
      privs: PrivState.read(undefined, ['PUBLIC', data.targetUserID]),
    });
    return new Share(property);
  }

  /**
   * Replaces an existing share. Use when you are "updating" a share instruction that already exists. Since share instructions
   * are immutable, we should archive that share instruction and create a new one in its place.
   * @param trx: TrxRef
   * @param data
   */
  replace({ trx, data }: { trx: TrxRef; data: ShareInstructionReplaceData }) {
    // archive first -- otherwise there will be a brief moment of time where the Vertex has two Share
    // instructions that may conflict, which messes up coalescence
    this.archive(trx);
    return Share.create({
      trx,
      vertex: this.property.parent,
      data: {
        shareType: data.shareType ?? this.shareType,
        shareCategory: data.shareCategory ?? this.shareCategory,
        targetUserID: this.targetUserID,
        contextId: this.contextId,
      },
    });
  }

  get id() {
    return this.property.id;
  }
  get shareType(): ShareType {
    return this.values.shareType;
  }
  get shareCategory(): PermissionLevel {
    return this.values.shareCategory;
  }
  get targetUserID() {
    return this.values.targetUserID;
  }
  get contextId(): string | undefined {
    return this.values.contextId;
  }
  get status() {
    return this.property.status;
  }
  @MemoizeOwned()
  get user() {
    return Vertex.getById({ id: this.values.targetUserID });
  }
  archive(trx: TrxRef) {
    const origin = 'USER';
    this.property.archive(trx, origin);
  }

  equals(other: Share): boolean {
    return this.id === other.id;
  }
}

// Local store for share instructions, is essentially an observable for AggregatedSharesByUser
export class VertexShareState extends EdvoObj implements IObservable<AggregatedSharesByUser> {
  @OwnedProperty
  shareInstructions: ObservableList<Share>;
  private aggregatedSharesByUser: AggregatedSharesByUser;
  protected _listeners: ChangeListener<AggregatedSharesByUser>[] = [];
  constructor(vertex: Vertex, backref?: Backref) {
    super();

    let shareInstructions = vertex.shares;
    // if there is no backref this is NOT the topic space node
    if (backref) {
      shareInstructions = shareInstructions.filterObs(
        // allow shares without a contextId (these are shares originating from the node as apex node?)
        // and allow shares where the context is equal to the current backref
        // i.e. these are shares placed on the node WHILE in a current context
        (share) => !share.contextId || share.contextId === backref.id,
      );
    }

    this.shareInstructions = shareInstructions;
    this.aggregatedSharesByUser = {};

    this.onCleanup(
      shareInstructions.subscribe({
        ITEM_LISTENER: (item: Share, type: string, origin: ItemEventOrigin) => {
          if (type === 'ADD') {
            this.rawInsert(item);
          } else {
            this.rawRemove(item);
          }
        },
        CHANGE: (_, origin: ItemEventOrigin, ctx: ChangeContext) => {
          this.notify(origin, ctx);
        },
      }),
    );
  }

  isLoaded() {
    return this.shareInstructions.isLoaded();
  }
  async load() {
    await this.shareInstructions.load();
  }

  async shares() {
    return await this.shareInstructions.get();
  }

  get value() {
    return this.aggregatedSharesByUser;
  }

  async get() {
    await this.load();
    return this.aggregatedSharesByUser;
  }

  private rawInsert(shareInstruction: Share) {
    let category: PermissionLevel | 'deny' = shareInstruction.shareCategory;
    if (shareInstruction.shareType === 'deny' || !['read', 'write', 'admin'].includes(category)) {
      category = 'deny';
    }

    const currentShareBucket: SharesByPermissionLevel = (this.aggregatedSharesByUser[shareInstruction.targetUserID] ||=
      {
        read: [],
        write: [],
        admin: [],
        deny: [],
      });

    currentShareBucket[category].push(shareInstruction);
  }

  private rawRemove(shareInstruction: Share) {
    const { shareCategory, shareType, id: shareID } = shareInstruction;
    const aggregatedPriv = this.aggregatedSharesByUser[shareInstruction.targetUserID];
    if (aggregatedPriv) {
      if (shareType === 'allow') {
        aggregatedPriv[shareCategory] = aggregatedPriv[shareCategory].filter((share) => share.id !== shareID);
      } else {
        aggregatedPriv.deny = aggregatedPriv.deny.filter((share) => share.id !== shareID);
      }
    }
  }

  notify(origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext) {
    this.validate();
    this._listeners.forEach((l) => {
      l(this.aggregatedSharesByUser, origin, ctx);
    });
  }

  subscribe(fn: ChangeListener<AggregatedSharesByUser>, notifyInitialValue = false): Unsubscriber {
    this._listeners.push(fn);

    if (notifyInitialValue) {
      fn(this.value, 'UNKNOWN', {});
    }

    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  // performCoalescence has no side effects. Therefore ShareState may be safely contained within Inner.
  performCoalescence(inh: InheritedPrivs | undefined): InheritedPrivs {
    // used to record denied users
    const globallyDeniedUsers: string[] = [];

    const agg = this.aggregatedSharesByUser;

    // TODO: Consider the implications of copied data
    // * and whether we should do a deep compare

    // New Categories
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

    /**
     * an array of:
     * {
     *    inhCat: inheritedPriv share category array of inheritedPrivTuples
     *    newCat: the new outgoing array of inheritedPrivTuples
     *    catTitle: the string of the shareCategory name
     * }
     */
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
              // if the inherited shareID is not already included in the userAggregate, then push it to the new privs
              newCat.push({ userID, share });
            }
          } else {
            // if that inherited userID does not have a user record in the aggregatedPrivs
            // push the inherited userID/shareID to the new inheritedPrivs
            newCat.push({ userID, share });
          }
        });
      }
    });

    const coalescedPrivs: InheritedPrivs = {
      read: newRead,
      write: newWrite,
      admin: newAdmin,
      allShares: Array.from(newAllShares),
    };

    return coalescedPrivs;
  }
}

export class ShareCache {
  constructor() {}

  // TODO - Change this to an LRU cache, but for now: lookup via shareID
  private cache: Record<string, [QueryObservable<Property>, Promise<Share | null>]> = {};

  async getShareById(shareID: string): Promise<Share | null> {
    let ref = this.cache[shareID];
    if (ref) return ref[1];

    // We only want to pass here ONCE for a given shareID
    let resolve: (s: Share | null) => void = () => {};

    ref = this.cache[shareID] = [
      globalStore.query<Property>('property', null, {
        allowCache: true,
        where: [
          ['id', '==', shareID],
          // ['status', '==', 'active'],
          // * Shares are always created with public read permissions
          ['recipientID', 'array-contains-any', [globalStore.getCurrentUserID(), 'PUBLIC']],
        ],
      }),
      new Promise((r) => {
        resolve = r;
      }),
    ];

    await ref[0].load();

    const prop: Property | null = ref[0].first() || null;

    if (prop) {
      if (prop.status.value === 'active') {
        const share = new Share(prop);
        resolve(share);
        return share;
      }
    } else {
      console.warn(`Share ${shareID} was not found`);
      // raiseError(`Share ${shareID} was not found`);
    }

    resolve(null);
    return null;
  }

  async get(shareID: string[]): Promise<Share[]> {
    // TODO - optimize this query a bit better
    const shares = await Promise.all(shareID.map((id) => this.getShareById(id)));
    return shares.filter((s) => s?.status.value === 'active') as Share[];
  }
}
export const globalShareCache = new ShareCache();
