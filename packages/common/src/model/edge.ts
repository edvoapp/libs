import canonical_json from 'canonicalize';
import { Guarded, Observable, OwnedProperty, WeakProperty, tryJsonParse } from '@edvoapp/util';

import { UnifiedIdStruct, UnifiedId } from './unified-id';
import { raiseError, Registry } from '../utils';
import { DocumentReference, DocumentSnapshot, Query } from '../dataset/store/db';
import { TrxRef } from '../transaction';
import {
  EntityConstructorArgs,
  EntityCreateArgs,
  EntityHydrateArgs,
  RecipientData,
  Entity,
  currentSchemaVersion,
  TopicSpaceCardState,
} from './entity';
import { Vertex } from './vertex';
import { Backref, BackrefData } from './backref';
import { globalStore, QueryArgs } from '../dataset';
import { PrivState } from './privileges';
import * as Analytics from '../lytics';

export type EdgeKind = 'ref' | 'weakRef';

// What's actually stored in the DB
export interface EdgeData extends RecipientData {
  parentID: string;
  role: string[];
  primaryRole: string;
  kind: EdgeKind;
  payload: string;
  seq: number;
  meta?: TopicSpaceCardState | null; // What the database actually can look like. Not what we wish it looked like
}

export interface Payload extends UnifiedIdStruct {
  backrefPath: string;
  contextId?: string;
}

interface EdgeConstructorArgs extends EntityConstructorArgs<EdgeData> {
  parent: Vertex;
  target: Vertex;
  contextId?: UnifiedId;
  role: string[];
  kind: EdgeKind;
  backrefDocRef: DocumentReference<BackrefData>;
  privs: PrivState;
  seq: number;
  userID: string;
}

export interface EdgeCreateArgs extends EntityCreateArgs {
  parent: Vertex;
  target: Vertex;
  contextId?: UnifiedId;
  role: string[];
  kind?: EdgeKind;
  seq?: number;
  meta: TopicSpaceCardState;
  privs?: PrivState;
}
export interface CreateRawArgs extends EntityCreateArgs {
  parentId: UnifiedId;
  targetId: UnifiedId;
  contextId?: UnifiedId;
  role: string[];
  kind: EdgeKind;
  seq?: number;
  meta: TopicSpaceCardState;
}

export interface EdgeHydrateArgs extends EntityHydrateArgs<EdgeData> {
  parent: Vertex;
}

// And edge MUST be hydrated or created.
export class Edge extends Entity<EdgeData> {
  readonly type = 'edge';
  readonly role: string[];
  readonly kind: EdgeKind;
  @OwnedProperty
  readonly parent: Vertex;
  readonly backrefDocRef: DocumentReference<BackrefData>;
  readonly contextId?: UnifiedId;
  @OwnedProperty
  readonly target: Vertex;
  @OwnedProperty
  readonly seq: Observable<number>;
  @OwnedProperty
  readonly meta: Observable<TopicSpaceCardState>;
  @OwnedProperty
  privs: Observable<PrivState>;
  userID: string;
  static readonly registry = new Registry<Edge>();

  private constructor({
    kind,
    backrefDocRef,
    parent,
    target,
    contextId,
    role,
    seq,
    meta,
    privs,
    userID,
    ...args
  }: EdgeConstructorArgs) {
    super(args);

    this.parent = parent;
    this.kind = kind;
    this.role = role;
    this.backrefDocRef = backrefDocRef;
    this.target = target;
    this.contextId = contextId;
    this.userID = userID;
    this.meta = new Observable(meta || {});
    this.privs = new Observable(privs);
    this.seq = new Observable(seq);

    Edge.registry.add_or_throw(args.docRef.id, this, 'Attempt to register duplicate Edge');
  }
  protected cleanup() {
    Edge.registry.remove(this.id);
    super.cleanup();
  }
  static create({
    trx,
    parent,
    target,
    role,
    kind = 'ref',
    seq = 0,
    meta,
    privs,
    contextId,
    origin = 'USER',
    subUserID,
  }: EdgeCreateArgs): Edge {
    if (target.id === parent.id) {
      raiseError(`Cannot attach a vertex to itself (${parent.id})`);
      throw `Cannot attach a vertex to itself (${parent.id})`;
    }

    // Edge and backref are joined at the hip
    const docRef: DocumentReference<EdgeData> = globalStore.createChildDocument(parent.docRef, 'edge');
    const backrefDocRef: DocumentReference<BackrefData> = globalStore.createChildDocument(target.docRef, 'backref');

    const userID = globalStore.getCurrentUserID();
    privs ??= PrivState.default(userID);

    const edge = new Edge({
      docRef,
      backrefDocRef,
      parent,
      target,
      contextId,
      role,
      kind,
      seq,
      meta,
      privs,
      userID,
      subUserID,
      saved: false,
      editable: true,
      status: 'active',
    });

    // Register this with the parent object - only on create
    // The presumption is that rehydrate is being called by QueryObservable.mergeDocs or similar
    // Attach the part to our parent.parts so they don't have to wait to hear it from the server
    // No need to force them to load for this, so use value() rather than get
    parent.edges.insert(edge, origin, { trx });

    let payload: Payload = {
      ...target.unifiedId.toStruct(),
      backrefPath: backrefDocRef.path,
    };
    if (contextId) payload.contextId = contextId.id;

    const now = trx.now();
    const data: EdgeData = {
      id: docRef.id,
      parentID: parent.id,
      status: 'active',
      keyID: '',
      cipher: '',
      userID,
      subUserID,
      ...privs.data(),
      meta,
      createdAt: now,
      updatedAt: now,
      role,
      primaryRole: role[0],
      kind,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      payload: canonical_json(payload)!,
      seq: seq,
      v: currentSchemaVersion(),
    };

    // Save it to the DB
    trx.insert(edge, data);

    // We're intentionally not keeping a copy
    Backref.create({
      trx,
      docRef: backrefDocRef,
      edgeDocRef: docRef,
      role,
      kind,
      meta,
      seq,
      target: parent,
      parent: target,
      privs,
      contextId,
      origin,
      subUserID,
    });
    //                                                                                          ^ backref is inverse ^

    Analytics.event('edge-creation', {
      kind,
      role,
    });

    return edge;
  }

  static hydrate({ snapshot, parent }: EdgeHydrateArgs): Edge {
    let docRef = snapshot.ref;
    let edge = Edge.registry.get(docRef.id);

    if (edge) {
      edge.applySnapshot(snapshot); // Just in case
      return edge;
    }

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Edge ' + docRef.id);

    const payload = tryJsonParse<Payload>(data.payload);
    const targetId = UnifiedId.fromStruct(payload);
    const contextId = payload.contextId ? new UnifiedId('vertex', payload.contextId) : undefined;
    if (!targetId) throw 'edge failed to parse unifiedId from payload';
    if (targetId.collectionName !== 'vertex') throw 'invalid unifiedId.collectionName';
    const { status, role, kind, seq, userID, recipientID, writeID = [], adminID = [], shareID = [], subUserID } = data;

    const meta = data.meta || {};

    // We might not have backrefDocRef for legacy records
    const backrefDocRef = globalStore.createDocumentFromPath<BackrefData>(payload.backrefPath);

    const target = Vertex.getById({ id: targetId.id });

    const writeIds = [...new Set([...writeID, ...adminID, userID])];
    const editable = writeIds.includes(globalStore.getCurrentUserID()) || writeIds.includes('PUBLIC');

    const privs = PrivState.fromData({
      recipientID,
      writeID,
      adminID,
      shareID,
    });

    return new Edge({
      docRef,
      parent,
      target,
      role,
      kind,
      status,
      backrefDocRef,
      contextId,
      meta,
      privs,
      seq,
      userID,
      subUserID,
      saved: true,
      editable,
    });
  }
  static rawQuery({ where, orderBy, limit }: QueryArgs, parent?: Vertex) {
    let query: Query<EdgeData> = globalStore.createQuery('edge', parent?.docRef);

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
    trx.setForRef(this.backrefDocRef, { seq }, true);
    this.seq.set(seq);
  }

  setMeta({ trx, meta }: { trx: TrxRef; meta: TopicSpaceCardState }) {
    trx.update(this, { meta });
    trx.setForRef(this.backrefDocRef, { meta }, true);
    this.meta.set(meta);
  }
  async setMetaMerge({ trx, meta: newMeta }: { trx: TrxRef; meta: Partial<TopicSpaceCardState> }) {
    const existingMeta = await this.meta.get();
    const meta = { ...existingMeta, ...newMeta };
    trx.update(this, { meta });
    trx.setForRef(this.backrefDocRef, { meta }, true);
    this.meta.set(meta);
  }
  setPrivs({ trx, privs }: { trx: TrxRef; privs: PrivState }) {
    if (!privs.loaded) {
      raiseError('Attempt to call setPrivs with non-loaded PrivState (Edge)');
      return;
    }
    if (!this.privs.value.equal(privs)) {
      const privs_data = privs.data();
      trx.update(this, privs_data);
      trx.setForRef(this.backrefDocRef, privs_data, true);
      this.privs.set(privs);
    }
  }

  get backrefID() {
    return this.backrefDocRef.path.split('/').reverse()[0];
  }

  applySnapshot(snapshot: DocumentSnapshot<EdgeData>): void {
    super.applySnapshot(snapshot);
    const data = snapshot.data();
    if (data) {
      const { userID, recipientID, writeID = [], adminID = [], shareID = [] } = data;
      const meta = data.meta || {};

      this.meta.set(meta);

      const newPrivs = PrivState.fromData({
        recipientID,
        writeID,
        adminID,
        shareID,
      });

      if (!this.privs.value.equal(newPrivs)) {
        if (this.privs.value.loaded) void newPrivs.load();
        this.privs.set(newPrivs);
      }

      const writeIds = [...new Set([...writeID, ...adminID, userID])];
      this.editable.set(writeIds.includes(globalStore.getCurrentUserID()) || writeIds.includes('PUBLIC'));
    }
  }
  @Guarded
  archive(trx: TrxRef, propagate = true) {
    globalStore.registerArchived(this.docRef);
    globalStore.registerArchived(this.backrefDocRef);

    this.parent.edges.remove(this, 'USER', { trx });
    super.archive(trx); // This does the database operation for this record

    if (propagate) {
      const ex = Backref.registry.get(this.backrefDocRef.id);
      if (ex) {
        ex.archive(trx, false);
      } else {
        // Archive our corresponding backref
        const now = trx.now();
        trx.setForRef(
          this.backrefDocRef,
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
    globalStore.registerUnarchived(this.docRef);
    globalStore.registerUnarchived(this.backrefDocRef);

    super.unarchive(trx); // This does the database operation for this record
    this.parent.edges.insert(this, 'USER', { trx });

    if (propagate) {
      const ex = Backref.registry.get(this.backrefDocRef.id);
      if (ex) {
        ex.unarchive(trx, false);
      } else {
        // Archive our corresponding backref
        trx.setForRef(
          this.backrefDocRef,
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
