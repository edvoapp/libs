import canonical_json from 'canonicalize';

import { UnifiedId, UnifiedIdStruct } from './unified-id';
import { Vertex } from './vertex';
import { Edge, EdgeData, EdgeKind } from './edge';
import { DocumentReference, DocumentSnapshot, Query } from '../dataset/store/db';
import {
  currentSchemaVersion,
  Entity,
  EntityConstructorArgs,
  EntityCreateArgs,
  EntityHydrateArgs,
  GetArgs,
  RecipientData,
  TopicSpaceCardState,
} from './entity';
import { raiseError, Registry } from '../utils';
import { TrxRef } from '../transaction';
import { DB, globalStore, QueryArgs } from '../dataset';
import { Guarded, Observable, OwnedProperty, tryJsonParse } from '@edvoapp/util';
import { PrivState } from './privileges';

// What's actually stored in the DB
export interface BackrefData extends RecipientData {
  parentID: string;
  payload: string;
  role: string[];
  primaryRole: string;
  kind: EdgeKind;
  seq: number;
  meta?: TopicSpaceCardState | null; // What the database actually can look like. Not what we wish it looked like
  userID: string;
}

interface BackrefConstructorArgs extends EntityConstructorArgs<BackrefData> {
  parent: Vertex;
  target: Vertex;
  contextId?: UnifiedId;
  role: string[];
  kind: EdgeKind;
  edgeDocRef: DocumentReference<EdgeData>;
  seq: number;
  meta: TopicSpaceCardState;
  privs: PrivState;
  userID: string;
  subUserID?: string;
  createdAt: DB.Timestamp;
}

export interface BackrefCreateArgs extends EntityCreateArgs {
  role: string[];
  kind: EdgeKind;
  target: Vertex;
  contextId?: UnifiedId;
  parent: Vertex;
  edgeDocRef: DocumentReference<EdgeData>;
  docRef: DocumentReference<BackrefData>;
  seq?: number;
  meta: TopicSpaceCardState;
  privs: PrivState;
  subUserID?: string;
}

export interface BackrefHydrateArgs extends EntityHydrateArgs<BackrefData> {
  parent: Vertex;
}
export interface BackrefGetArgs extends GetArgs<BackrefData> {}

interface Payload extends UnifiedIdStruct {
  edgePath: string; // Added in schema v3
  contextId?: string;
}

export class Backref extends Entity<BackrefData> {
  readonly type = 'backref';
  @OwnedProperty
  readonly target: Vertex;
  @OwnedProperty
  readonly parent: Vertex;
  readonly edgeDocRef: DocumentReference<EdgeData>;
  readonly contextId?: UnifiedId;
  // TODO: maybe make this observable? I don't like it though...
  role: string[];
  readonly kind: EdgeKind;
  @OwnedProperty
  readonly seq: Observable<number>;
  @OwnedProperty
  readonly meta: Observable<TopicSpaceCardState>;
  @OwnedProperty
  privs: Observable<PrivState>;
  static readonly registry = new Registry<Backref>();
  userID: string;
  subUserID?: string;
  createdAt: DB.Timestamp;

  private constructor({
    parent,
    edgeDocRef,
    kind,
    role,
    target,
    seq,
    meta,
    privs,
    userID,
    createdAt,
    ...args
  }: BackrefConstructorArgs) {
    super(args);
    this.userID = userID;
    this.parent = parent;
    this.kind = kind;
    this.role = role;
    this.edgeDocRef = edgeDocRef;
    this.seq = new Observable(seq);
    this.meta = new Observable(meta);
    this.privs = new Observable(privs);
    this.target = target;
    this.createdAt = createdAt;

    Backref.registry.add_or_throw(this.id, this, 'constructor');
  }
  protected cleanup() {
    Backref.registry.remove(this.id);
    super.cleanup();
  }
  static create({
    trx,
    docRef,
    edgeDocRef,
    target,
    parent,
    role,
    kind,
    meta,
    privs,
    seq = 0,
    contextId,
    origin = 'USER',
    subUserID,
  }: BackrefCreateArgs): Backref {
    const userID = globalStore.getCurrentUserID();
    privs ??= PrivState.default(userID);

    const now = trx.now();
    const createdAt = now;
    const backref = new Backref({
      target,
      parent,
      role,
      kind,
      docRef,
      edgeDocRef,
      contextId,
      seq,
      meta,
      privs,
      createdAt,
      saved: false,
      editable: true,
      userID,
      subUserID,
      status: 'active',
    });
    // Register this with the parent object - only on create
    // The presumption is that rehydrate is being called by QueryObservable.mergeDocs or similar
    parent.backrefs.insert(backref, origin, { trx });
    // NOTE: The render cycle of the parent bullet has already been kicked off AND completed by this point <-

    let payload: Payload = {
      ...target.unifiedId.toStruct(),
      edgePath: edgeDocRef.path,
    };
    if (contextId) payload.contextId = contextId?.id;

    let data: BackrefData = {
      id: docRef.id,
      parentID: parent.id,
      status: 'active',
      keyID: '',
      cipher: '',
      userID,
      subUserID,
      meta,
      ...privs.data(),
      createdAt,
      updatedAt: createdAt,
      role,
      primaryRole: role[0],
      kind,
      // {"vertexID":"b9rXKswRrLSKneldfcSA","edgePath":"vertex/b9rXKswRrLSKneldfcSA/edge/gWyHLFjgjEHcUyfELFdz"}
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      payload: canonical_json(payload)!,
      seq,
      v: currentSchemaVersion(),
    };

    trx.insert(backref, data);

    return backref;
  }

  static hydrate({ snapshot, parent }: BackrefHydrateArgs): Backref {
    // NOTE: it is unlikely we will ever query backrefs by something other than ParentId
    // Because everything else will be opaque/encrypted. Such a query would be done via parts instead
    // Thus, hydration should be able to safely require the parent both here and for Edge

    const docRef = snapshot.ref;
    let backref = Backref.registry.get(docRef.id);
    if (backref) {
      backref.applySnapshot(snapshot);
      return backref;
    }

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Backref ' + docRef.id);

    const payload = tryJsonParse<Payload>(data.payload);
    const targetId = UnifiedId.fromStruct(payload);
    const contextId = payload.contextId ? new UnifiedId('vertex', payload.contextId) : undefined;
    if (!targetId) throw 'edge failed to parse unifiedId from payload';
    if (targetId.collectionName !== 'vertex') throw 'invalid unifiedId.collectionName';
    const {
      status,
      role,
      kind,
      seq,
      userID,
      subUserID,
      recipientID,
      writeID = [],
      adminID = [],
      shareID = [],
      createdAt,
    } = data;

    const meta = { ...(data.meta || {}) }; // meta can be null in legacy situations;

    // Added in schema v3 - and not necessarily covered by migration
    const edgeDocRef: DocumentReference<EdgeData> = globalStore.createDocumentFromPath(payload.edgePath);

    const target = Vertex.getById({ id: targetId.id });

    const writeIds = [...new Set([...writeID, ...adminID, userID])];
    const editable = writeIds.includes(globalStore.getCurrentUserID()) || writeIds.includes('PUBLIC');

    const privs = PrivState.fromData({
      recipientID,
      writeID,
      adminID,
      shareID,
    });

    return new Backref({
      docRef,
      parent,
      role,
      kind,
      target,
      edgeDocRef,
      contextId,
      seq,
      meta,
      status,
      privs,
      saved: true,
      editable,
      userID,
      subUserID,
      createdAt,
    });
  }

  static rawQuery({ where, orderBy, limit }: QueryArgs, parent?: Vertex) {
    let query: Query<BackrefData> = globalStore.createQuery('backref', parent?.docRef);

    where.forEach((section) => {
      if (section[2] === undefined) {
        // firebase is so silly -- if the third param to where is undefined, it'll throw up in a non-obvious way. Let's make it obvious
        throw new Error(`DB Query Error: [${section.join(',')}] is not a valid query`);
      }
      query = query.where(...section);
    });
    if (orderBy) {
      if (Array.isArray(orderBy[0])) {
        // Assume orderBy is an array of tuples
        (orderBy as Parameters<Query['orderBy']>[]).forEach((params) => {
          query = query.orderBy(...params);
        });
      } else {
        // Assume orderBy is a single tuple
        query = query.orderBy(...(orderBy as Parameters<Query['orderBy']>));
      }
    }
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }

  setMeta({ trx, meta }: { trx: TrxRef; meta: TopicSpaceCardState }) {
    trx.update(this, { meta });
    trx.setForRef(this.edgeDocRef, { meta }, true);
    this.meta.set(meta);
  }
  async setMetaMerge({ trx, meta: newMeta }: { trx: TrxRef; meta: Partial<TopicSpaceCardState> }) {
    const existingMeta = await this.meta.get();
    const meta = { ...existingMeta, ...newMeta };
    trx.update(this, { meta });
    trx.setForRef(this.edgeDocRef, { meta }, true);
    this.meta.set(meta);
  }

  setPrivs({ trx, privs }: { trx: TrxRef; privs: PrivState }) {
    if (!privs.loaded) {
      raiseError('Attempt to call setPrivs with non-loaded PrivState (Backref)');
      return;
    }

    if (!this.privs.value.equal(privs)) {
      trx.update(this, privs.data());
      trx.setForRef(this.edgeDocRef, privs.data(), true);
      this.privs.set(privs);
    }
  }

  /** Set the seq property */
  setSeq({
    trx,
    seq,
  }: {
    /** The Transaction */
    trx: TrxRef;
    /** The seq value */
    seq: number;
  }) {
    trx.update(this, { seq });
    trx.setForRef(this.edgeDocRef, { seq }, true);
    this.seq.set(seq);
  }

  get edgeID() {
    return this.edgeDocRef.id;
  }

  applySnapshot(snapshot: DocumentSnapshot<BackrefData>): void {
    super.applySnapshot(snapshot);
    const data = snapshot.data();
    if (data) {
      const { userID, recipientID, writeID = [], adminID = [], shareID = [], seq } = data;
      const meta = { ...(data.meta || {}) };
      this.meta.set(meta);
      this.seq.set(seq);

      const newPrivs = PrivState.fromData({
        recipientID,
        writeID,
        adminID,
        shareID,
      });

      if (!newPrivs.equal(this.privs.value)) {
        if (this.privs.value.loaded) void newPrivs.load();
        this.privs.set(newPrivs);
      }

      const writeIds = [...new Set([...writeID, ...adminID, userID])];

      this.editable.set(writeIds.includes(globalStore.getCurrentUserID()) || writeIds.includes('PUBLIC'));
    }
  }
  @Guarded
  archive(trx: TrxRef, propagate = true) {
    // TODO: consider accepting an origin argument here later
    globalStore.registerArchived(this.docRef);
    globalStore.registerArchived(this.edgeDocRef);

    this.parent.backrefs.remove(this, 'USER', { trx });
    super.archive(trx); // This does the database operation for this record

    if (propagate) {
      const ex = Edge.registry.get(this.edgeDocRef.id);
      if (ex) {
        ex.archive(trx, false);
      } else {
        // Archive our corresponding edge
        const now = trx.now();
        trx.setForRef(
          this.edgeDocRef,
          {
            status: 'archived',
            deletedBy: globalStore.getCurrentUserID(),
            deletedAt: now,
          },
          true,
        );
      }
    }
  }

  unarchive(trx: TrxRef, propagate = true) {
    // TODO: consider accepting an origin argument here later
    globalStore.registerUnarchived(this.docRef);
    globalStore.registerUnarchived(this.edgeDocRef);

    super.unarchive(trx); // This does the database operation for this record
    this.parent.backrefs.insert(this, 'USER', { trx });

    if (propagate) {
      const ex = Edge.registry.get(this.edgeDocRef.id);
      if (ex) {
        ex.unarchive(trx, false);
      } else {
        // Archive our corresponding edge
        trx.setForRef(
          this.edgeDocRef,
          {
            status: 'active',
            deletedBy: null,
            deletedAt: null,
          },
          true,
        );
      }
    }
  }
}
