import { EdvoObj, Observable, ItemEventOrigin, OwnedProperty } from '@edvoapp/util';
import { CollectionName, UnifiedId, UnifiedIdStruct } from './unified-id';
import { TrxRef } from '../transaction';
import * as Bindings from '@edvoapp/wasm-bindings';
import { globalStore } from '..';
import { DocumentReference, DocumentSnapshot, Timestamp } from '../dataset/store/db';

export const currentSchemaVersion = () => '5';

export interface MetaContainer {
  editable: Observable<boolean>;
  meta: Observable<TopicSpaceCardState>;
  setMeta: (a: { trx: TrxRef; meta: TopicSpaceCardState }) => void;
  setMetaMerge: (a: { trx: TrxRef; meta: Partial<TopicSpaceCardState> }) => Promise<void>;
}

export interface BaseData {
  id: string;
  status: 'active' | 'archived' | 'challenged';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  visitedAt?: Timestamp;
  deletedBy?: string | null;
  deletedAt?: Timestamp | null;
  userID: string;
  subUserID?: string;
  v: string;
}
export interface RecipientData extends BaseData {
  recipientID: string[];
  writeID?: string[];
  adminID?: string[];
  shareID?: string[];
  keyID: string;
  cipher: string;
}

export interface GetArgs<DataDb> {
  docRef: DocumentReference<DataDb>;
}
export interface EntityHydrateArgs<DataDb> {
  snapshot: DocumentSnapshot<DataDb>;
}
export interface GetByIdArgs {
  id: string;
}
export interface EntityCreateArgs {
  trx: TrxRef;
  meta?: BaseMeta;
  origin?: ItemEventOrigin;
  subUserID?: string;
}

export interface ArchiveDocRefArgs<DataDb> {
  trx: TrxRef;
  docRef: DocumentReference<DataDb>;
}

export interface EntityConstructorArgs<Data> {
  docRef: DocumentReference<Data>;
  // data?: Data;
  meta?: BaseMeta;
  status: 'active' | 'archived' | 'challenged';
  saved: boolean;
  editable: boolean;
  visitedAt?: Timestamp;
  subUserID?: string;
}

export interface TopicSpaceCardState extends BaseMeta {
  x_coordinate?: number | null; // TODO - rename meta field of backref/edge to attributes.memberCardState, and save this for vertex as role: content
  y_coordinate?: number | null;
  width?: number | null;
  height?: number | null;
  dockCoordinate?: number;
  dockExpanded?: boolean;
  ratio?: number;
  gridSize?: number; // TODO - move this into role: topic-space-settings property of the vertex
  clusterColor?: number[];
  autoposition?: boolean;
  autosize?: boolean;
  left_align?: boolean;
  reason?: string;
  expanded?: boolean;
  messageRole?: 'user' | 'assistant' | 'tool';
}

export interface SizedState {
  width?: number;
  height?: number;
  ratio?: number;
}

export interface BaseMeta {
  customClass?: string; // Only used by test suite
  mode?: 'readonly'; // Consider removing
  showOutline?: boolean; // This is used by the topic space. Consider moving to user-differentiated property
  outlineWidth?: number; // This is used by the topic space. Consider moving to user-differentiated property
  placeholderText?: string; // only used by test suite
  testId?: string; // only used by test suite
  testSeq?: number; // only used by test suite
}

export type EntityData<T> = T extends Entity<infer X> ? X : never;
export abstract class Entity<DataDb extends BaseData> extends EdvoObj implements Bindings.IJsEntity {
  _datatype?: DataDb;
  abstract type: string;
  readonly docRef: DocumentReference<DataDb>;
  // readonly data: AwaitableValue<DataDb>;
  // readonly meta: AwaitableValueObservable<MetaDb | null | undefined>;
  @OwnedProperty
  status: Observable<'active' | 'archived' | 'challenged'>;
  readonly saved: Promise<void>;
  readonly setSaved: () => void;
  @OwnedProperty
  editable: Observable<boolean>;
  unsub?: () => void;
  visitedAt: null | Timestamp = null;
  updatedAt: null | Timestamp = null;
  subUserID?: string;

  constructor({ visitedAt, subUserID, ...args }: EntityConstructorArgs<DataDb>) {
    super();
    let setSaved: () => void;
    this.editable = new Observable(args.editable);
    this.subUserID = subUserID;
    if (visitedAt) this.visitedAt = visitedAt;
    if (args.saved) {
      this.saved = Promise.resolve();
      this.setSaved = () => {};
    } else {
      this.saved = new Promise((resolver) => {
        setSaved = resolver;
      });
      this.setSaved = setSaved!;
    }

    this.docRef = args.docRef;
    this.status = new Observable<'active' | 'archived' | 'challenged'>(args.status);
  }

  isEditable(): boolean {
    return this.editable.value;
  }

  // Only call this if your record was not loaded via a QueryObservable
  // TODO: Have the store manage this distinction in the background rather than making the caller do it
  subscribeDoc() {
    if (this.unsub) return;
    this.unsub = globalStore.subscribeToDocument<DataDb>(
      this.docRef,
      (snapshot) => this.applySnapshot(snapshot),
      (err) => {
        console.error(`${this.prettyId()}.onSnapshot failed`, err);
      },
    );
  }

  get id(): string {
    return this.docRef.id;
  }
  prettyId() {
    return `${this.type}:${this.id.substr(0, 4)}`;
  }
  path(): string {
    return this.docRef.path;
  }

  get unifiedId(): UnifiedId {
    return new UnifiedId(this.type as CollectionName, this.docRef.id);
  }
  get unifiedIdStruct(): UnifiedIdStruct {
    return this.unifiedId.toStruct();
  }

  get active() {
    return this.status.value === 'active';
  }
  archive(trx: TrxRef) {
    this.validate();
    this.status.set('archived');
    const now = trx.now();
    trx.update(this, {
      status: 'archived',
      deletedBy: globalStore.getCurrentUserID() || 'UNKNOWN',
      deletedAt: now,
      updatedAt: now,
    });
    globalStore.getCurrentUserID();
  }

  // TODO: determine if we want to cascade makeActive the same way we may cascade Vertex.archive
  unarchive(trx: TrxRef) {
    this.status.set('active');
    const now = trx.now();
    this.updatedAt = now;

    trx.update(this, {
      status: 'active',
      deletedBy: null,
      deletedAt: null,
      updatedAt: now,
    });
  }

  /**
   * @deprecated use Entity.unarchive
   */
  makeActive(trx: TrxRef) {
    this.status.set('active');
    const now = trx.now();
    this.updatedAt = now;

    trx.update(this, {
      status: 'active',
      deletedBy: null,
      deletedAt: null,
      updatedAt: now,
    });
  }

  accessTouch(trx: TrxRef) {
    // TODO - migrate visitedAt to lookedAt or similar to indicate that this entity has been viewed recently in the quickpalette
    const now = trx.now();
    this.visitedAt = now;
    trx.update(this, { visitedAt: now });
  }

  // setMeta({ trx, meta }: { trx: TrxRef; meta: MetaDb }) {
  //   trx.update(this, { meta });
  //   this.meta.set(meta);
  // }

  // applySnapshotData is called ONLY when onSnapshot fires, and should be used to update ONLY the data which is
  // legal to update from the DB. All other data should be set as discrete properties at the time of construction
  applySnapshot(snapshot: DocumentSnapshot<DataDb>) {
    this.setSaved();
    const data = snapshot.data();
    if (data) {
      const { status, visitedAt, updatedAt } = data;
      if (status) this.status.set(status);
      if (visitedAt) this.visitedAt = visitedAt;
      if (updatedAt) this.updatedAt = updatedAt;
    }
  }
  protected cleanup() {
    this.unsub?.();
    super.cleanup();
  }
}
