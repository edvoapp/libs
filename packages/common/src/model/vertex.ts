import {
  FilteredObservableList,
  Observable,
  ObservableList,
  tryJsonParse,
  OwnedProperty,
  Guarded,
  MemoizeWeak,
  ObservableReader,
  rejectUndefined,
  generateSHA256Hash,
  Guard,
} from '@edvoapp/util';
import { globalStore, QueryObservable, QueryArgs } from '../dataset';
import { DocumentReference, DocumentSnapshot, Query } from '../dataset/store/db';
import { subTrxWrap, TrxRef } from '../transaction';
import { intersects, Registry } from '../utils';
import { Backref } from './backref';
import { Edge, EdgeCreateArgs } from './edge';
import { Share } from './privileges/share';
import { Analytics, Model, Search } from '..';

import {
  BaseData,
  currentSchemaVersion,
  Entity,
  EntityConstructorArgs,
  EntityCreateArgs,
  EntityHydrateArgs,
  GetArgs,
  GetByIdArgs,
  TopicSpaceCardState,
} from './entity';
import { CreateArgs as PropertyCreateArgs, Property, UpsertArgs as PropertyUpsertArgs } from './property';
import { TimelineEvent } from './timeline-event';
import { UnifiedId } from './unified-id';
import { PrivState } from './privileges';

export type VertexKind =
  | 'vertex'
  | 'resource'
  | 'agent'
  | 'text'
  | 'highlight'
  | 'user'
  | 'media'
  | 'dock'
  | 'backpack'
  | 'user-profile';

export interface VertexAttributes {
  url: string;
  url_hash?: string;
}

export interface VertexData extends BaseData {
  /**
   * @deprecated
   */
  keywords: string[];
  isTopic: boolean;
  parentVertexID: string | null;
  attributes?: VertexAttributes;
  kind: VertexKind;
  email?: string;
  inviteCode?: string;
}

export interface VertexConstructorArgs extends EntityConstructorArgs<VertexData> {
  // docRef is mandatory for Vertex construction
  docRef: DocumentReference<VertexData>;
  meta?: TopicSpaceCardState;
  name?: string;
  /**
   * @deprecated
   */
  keywords?: string[];
  attributes?: VertexAttributes;
  kind?: VertexKind;
  userID?: string;
}

export interface VertexCreateArgs extends EntityCreateArgs {
  name?: string;
  kind?: VertexKind;
  parent?: Vertex | null;
  attributes?: VertexAttributes;
  id?: string;
  privs?: PrivState;
  email?: string;
  inviteCode?: string;
}

export interface VertexUpsertArgs extends EntityCreateArgs {
  parent: Vertex | null;
  userId?: string;
  kind: VertexKind;
  attributes?: VertexAttributes;
  onCreate?: (trx: TrxRef, vertex: Vertex) => void;
  name?: string;
  namespace?: string;
}

export interface VertexUpsertByIDArgs extends VertexUpsertArgs {
  id: string;
}

export interface CreateEdgeArgs {
  trx: TrxRef;
  role: string[];
  target: Vertex;
  contextId?: UnifiedId;
  weak?: boolean;
  seq?: number;
  meta: TopicSpaceCardState;
  quiet?: boolean;
  recipientID?: string[];
  writeID?: string[];
  adminID?: string[];
  shareID?: string[];
}

export interface BodyObj {
  contentType: string;
  content: string;
}

export type NameChangeSuccess = {
  succeeded: true;
};

export type NameCollisionError = {
  succeeded: false;
  error: 'collision';
  existing_topic: Vertex;
};

export type NameChangeResult = NameChangeSuccess | NameCollisionError;

export interface BackrefAndTarget {
  backref: Backref;
  target: Vertex;
}

export class Vertex extends Entity<VertexData> {
  readonly type = 'vertex';
  @OwnedProperty
  userID: Observable<string | undefined>;
  /**
   * @deprecated
   */
  hydratedKeywords?: string[]; // hack

  static readonly registry = new Registry<Vertex>();

  constructor(args: VertexConstructorArgs) {
    super(args);
    Vertex.registry.add_or_throw(args.docRef.id, this, `Attempt to register duplicate vertex: ${args.docRef.id}`);

    // TODO Might need to do a thing like this for status ( and if so, these should be unified so we don't docRef.get twice )
    this.userID = new Observable<string | undefined>(args.userID ?? undefined, async () => {
      if (this.userID.value) return;
      const snapshot = await globalStore.getSnapshot<Model.VertexData>(this.docRef);
      const data = snapshot.data();
      if (!data) {
        // TODO: turn this into a toast.warn with an action item to repair the vertex
        console.warn('No data found for vertex', this.docRef.id);
      }
      this.userID.set(data?.userID ?? globalStore.getCurrentUserID(), 'DATABASE');
    });
  }

  protected cleanup() {
    Vertex.registry.remove(this.id);
    super.cleanup();
  }

  @MemoizeWeak()
  get properties(): QueryObservable<Property> {
    return globalStore.query('property', this, {
      where: [
        // Only try to fetch the properties we have access to ( otherwise it'll give us an access denied error )
        ['recipientID', 'array-contains-any', [globalStore.getCurrentUserID(), 'PUBLIC']],

        // Only retrieve properties that haven't been removed
        ['status', '==', 'active'],
      ],
    });
  }

  @MemoizeWeak()
  get edges(): QueryObservable<Edge> {
    return globalStore.query('edge', this, {
      where: [
        ['recipientID', 'array-contains-any', [globalStore.getCurrentUserID(), 'PUBLIC']],
        ['status', '==', 'active'],
      ],
    });
  }

  @MemoizeWeak()
  get backrefs(): QueryObservable<Backref> {
    return globalStore.query('backref', this, {
      where: [
        ['recipientID', 'array-contains-any', [globalStore.getCurrentUserID(), 'PUBLIC']],
        ['status', '==', 'active'],
      ],
    });
  }

  @MemoizeWeak()
  get events(): QueryObservable<TimelineEvent> {
    return globalStore.query('event', this, {
      where: [
        ['recipientID', 'array-contains-any', [globalStore.getCurrentUserID(), 'PUBLIC']],
        ['status', '==', 'active'],
      ],
      orderBy: ['eventDate', 'desc'],
    });
  }

  @MemoizeWeak()
  get shares(): ObservableList<Share> {
    return this.filterProperties({
      role: ['share'],
      contentType: 'application/x-share',
    }).mapObs<Share>((p) => new Share(p));
  }

  @MemoizeWeak()
  get name(): ObservableReader<string | null | undefined> {
    return this.properties
      .filterObs((p) => p.role.includes('name'))
      .firstObs()
      .mapObs<string | null | undefined>((p) => (p ? p.text : p));
  }

  @MemoizeWeak()
  get meta(): ObservableReader<TopicSpaceCardState> {
    return this.properties
      .filterObs((p) => p.role.includes('meta'))
      .firstObs()
      .mapObs<TopicSpaceCardState>((p) => (p ? p.content.mapObs((c) => tryJsonParse<TopicSpaceCardState>(c)) : {}));
  }

  static create({
    trx,
    name,
    kind = 'vertex',
    meta,
    parent,
    attributes,
    id,
    privs,
    origin = 'USER',
    email,
    inviteCode,
  }: VertexCreateArgs): Vertex {
    const docRef = globalStore.createDocRef<VertexData>('vertex', id);
    const keywords = Search.stringToTokens(name);
    const userID = globalStore.getCurrentUserID();
    // when creating an agent, it needs a subUserID
    const subUserID = kind === 'agent' ? docRef.id : undefined;
    const now = trx.now();
    const visitedAt = now;

    const data: VertexData = rejectUndefined({
      id: docRef.id,
      parentVertexID: parent?.id || null,
      kind,
      userID,
      subUserID,
      email,
      inviteCode,
      createdAt: now,
      updatedAt: now,
      visitedAt,
      status: 'active',
      keywords,
      isTopic: false,
      v: currentSchemaVersion(),
    });

    if (attributes) {
      for (const [key, val] of Object.entries(attributes)) {
        attributes[`${key}_hash`] = generateSHA256Hash(val);
      }
      data.attributes = attributes;
    }

    const vertex = new Vertex({
      docRef: docRef,
      name,
      saved: true,
      editable: true,
      status: 'active',
      userID,
      subUserID,
    });

    // This is kinda hokey but I forgot how to do it correctly -- I don't think it's appropriate to put it in the constructor args
    vertex.visitedAt = visitedAt;

    if (name) {
      // data.name = name;
      Property.create({
        trx,
        parent: vertex,
        role: ['name'],
        contentType: 'text/plain',
        initialString: name,
        privs,
        suppressTopicCreateEvent: true,
      });
      data.isTopic = true;
    }

    if (meta) {
      Property.create({
        trx,
        parent: vertex,
        role: ['meta'],
        contentType: 'application/json',
        initialString: JSON.stringify(meta),
        privs,
      });
    }

    if (data.isTopic) TimelineEvent.create({ trx, parent: vertex, eventType: 'created' });
    // vertex.backrefs.value().setLoaded(); // They're not executed, but they are "Loaded" because we just created the vertex
    vertex.edges.setLoaded(); // it's not possible for them to be missing records
    vertex.events.setLoaded(); // it's not possible for them to be missing records
    vertex.properties.setLoaded(); // it's not possible for them to be missing records

    trx.insert(vertex, data);

    Analytics.event('vertex-creation', {
      isTopic: data.isTopic,
      kind,
    });

    // Save it locally - this is redundant to the onSnapshot return, but this is necessary to avoid deadlocks in trx.update
    return vertex;
  }

  applySnapshot(snapshot: DocumentSnapshot<VertexData>) {
    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Vertex ' + this.id);
    const { status, keywords } = data;
    this.hydratedKeywords = keywords;
    this.status.set(status);
    super.applySnapshot(snapshot);
  }

  static hydrate({ snapshot }: EntityHydrateArgs<VertexData>): Vertex {
    const docRef = snapshot.ref;
    let vertex = Vertex.registry.get(docRef.id);

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Vertex ' + docRef.id);
    const { attributes, userID, subUserID, status, keywords, visitedAt = null } = data;
    if (vertex) {
      vertex.hydratedKeywords = keywords;
      vertex.visitedAt = visitedAt;
      vertex.status.set(status);
      // vertex.attributes = attributes;
      return vertex;
    }

    // const meta = data.meta || undefined

    vertex = new Vertex({
      docRef,
      attributes,
      saved: true,
      status,
      editable: userID === globalStore.getCurrentUserID(),
      userID,
      subUserID,
    });
    vertex.hydratedKeywords = keywords;
    vertex.visitedAt = visitedAt;

    return vertex;
  }

  static get({ docRef }: GetArgs<VertexData>): Vertex {
    let vertex = Vertex.registry.get(docRef.id);
    if (vertex) return vertex;

    // Vertex has no state that we need to read back. Only writes
    vertex = new Vertex({
      docRef,
      saved: true,
      editable: true,
      status: 'active',
    });
    return vertex;
  }

  static getById(args: GetByIdArgs): Vertex {
    const docRef = Vertex.getRefById(args);
    return Vertex.get({ docRef });
  }

  static getRefById(args: GetByIdArgs): DocumentReference<VertexData> {
    return globalStore.createDocRef('vertex', args.id);
  }

  // Primarily, this is useful for user IDs -- given an ID, we may or may not have a user vertex
  // So, we can upsertByID
  static async upsertByID(args: VertexUpsertByIDArgs) {
    const snapshot = await globalStore.getSnapshot<Model.VertexData>(Vertex.getRefById(args));
    if (snapshot.exists) return Vertex.hydrate({ snapshot });
    console.log('snapshot not exist');
    const vertex = Vertex.create(args);
    args.onCreate?.(args.trx, vertex);
    return vertex;
  }

  // static async fetchByIdPrefix(prefix: string): Promise<Vertex | null> {
  //   // construct a query to fetch the vertex by id prefix

  //   const firestore = firebase.firestore();
  //   const prefixEnd = prefix + '\uf8ff';

  //   // Construct the query
  //   const query = firestore
  //     .collection('vertex')
  //     .where('status', '==', 'active')
  //     .orderBy(firebase.firestore.FieldPath.documentId())
  //     .startAt(prefix)
  //     .endAt(prefixEnd) as Query<VertexData>;

  //   let result = await query.get();

  //   // if there are no results, return null
  //   if (result.empty) {
  //     return null;
  //   }
  //   // otherwise check to see if the first result matches the prefix
  //   const snapshot = result.docs[0];
  //   const data = snapshot.data();
  //   if (!data) throw new Error('Error deserializing Vertex ' + this.id);
  //   const { id } = data;
  //   if (id.startsWith(prefix)) {
  //     return Vertex.hydrate({ snapshot });
  //   }
  //   // otherwise return null
  //   return null;
  // }

  async getLastVisitEvent(): Promise<Model.TimelineEvent | null> {
    const userId = globalStore.getCurrentUserID();
    if (!userId) return null;

    const visits = await globalStore.get<Model.TimelineEvent>('event', this, {
      limit: 1,
      where: [
        ['eventType', '==', 'visited'],
        ['userID', '==', userId],
        ['status', '==', 'active'],
      ],
      orderBy: ['eventDate', 'desc'],
    });

    return visits[0] ?? null;
  }

  static async searchUserBy({ id, email }: { id?: string; email?: string }): Promise<Vertex[]> {
    let query = globalStore
      .createBasicQuery<VertexData>('vertex')
      .where('status', '==', 'active')
      .where('kind', '==', 'user')
      .where('parentVertexID', '==', null) as Query<VertexData>;

    if (id) {
      query = query.where('id', '==', id).where('userID', '==', id);
    }

    if (email) {
      query = query.where('email', '==', email);
    }

    query = query.limit(5);

    const qsnapshot = await query.get();
    return qsnapshot.docs.map((snapshot) => Vertex.hydrate({ snapshot }));
  }

  static async findVertexByAttributes({
    parent,
    kind,
    attributes,
  }: {
    parent: Vertex | null;
    kind: string;
    attributes?: VertexAttributes;
  }): Promise<Vertex | null> {
    let query = globalStore
      .createQuery<VertexData>('vertex')
      .where('kind', '==', kind)
      .where('parentVertexID', '==', parent?.docRef.id || null);

    if (kind === 'user') {
      const userID = globalStore.getCurrentUserID();
      query = query.where('id', '==', userID);
    }

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value.length > 200) {
          console.warn('Value for key', key, 'exceeds 200 chars, using a hash. Value was', value);
          query = query.where(`attributes.${key}_hash`, '==', generateSHA256Hash(value));
        } else {
          query = query.where(`attributes.${key}`, '==', value);
        }
      });
    }

    const qsnapshot = await query.get();
    if (qsnapshot.size === 0) return null;
    if (qsnapshot.size > 1) {
      console.warn(
        `Got multiple results from the query, this may not have been expected. Used attributes:`,
        attributes,
      );
    }

    if (qsnapshot.size > 0) {
      const snapshot = qsnapshot.docs[0];
      return Vertex.hydrate({ snapshot });
    }
    return null;
  }

  //@SubTrxWrap()
  //@SubTrxWrap('Property.upsert')
  static async upsert({ trx, parent, kind, attributes, onCreate, name, meta }: VertexUpsertArgs): Promise<Vertex> {
    const v = await Vertex.findVertexByAttributes({
      parent,
      kind,
      attributes,
    });
    if (v) return v;
    const vertex = Vertex.create({
      trx,
      name,
      kind,
      meta,
      parent,
      attributes,
    });
    // Note -- I'm not convinced onCreate really buys us much -- why can't we just do stuff with the vertex
    // after upsert returns? IE:
    // const vertex = await Vertex.upsert(...);
    // vertex.createProperty(...)
    // if it's a concern about whether or not the vertex already exists (ie do not create new properties if Vertex already existed)
    // then we could just return a flag from upsert, something like { vertex: Vertex; created: boolean }
    onCreate?.(trx, vertex);
    return vertex;
  }

  static rawQuery({ where, orderBy, limit }: QueryArgs) {
    let query: Query<VertexData> = globalStore.createQuery('vertex');

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

  createProperty(args: Omit<PropertyCreateArgs, 'parent'>) {
    return Property.create({ ...args, parent: this });
  }

  async upsertProperty(args: Omit<PropertyUpsertArgs, 'parent'>): Promise<Property> {
    return Property.upsert({ parent: this, ...args });
  }

  createEdge(args: Omit<EdgeCreateArgs, 'parent'>, kind?: 'ref') {
    return Edge.create({ ...args, kind, parent: this });
  }

  visit(trx: TrxRef) {
    TimelineEvent.create({
      trx,
      parent: this,
      eventType: 'visited',
    });
  }

  touch(trx: TrxRef) {
    TimelineEvent.create({
      trx,
      parent: this,
      eventType: 'touched',
    });
  }

  archive(trx: TrxRef, cascade = true) {
    super.archive(trx);

    TimelineEvent.create({
      trx,
      parent: this,
      eventType: 'archived',
    });
  }

  @Guarded
  // Assume that meta is shared (readable) until otherwise
  setMeta({ trx, meta }: { trx: TrxRef; meta: TopicSpaceCardState }) {
    trx.addOp(this, async (trx) => {
      const [currentMetaProperty] = await this.filterProperties({
        role: ['meta'],
      }).toArray();

      const content = JSON.stringify(meta);
      if (currentMetaProperty) {
        // TODO if(currentMetaProperty  && currentMetaProperty.editable)
        if (!currentMetaProperty.editable) return; // HACK

        currentMetaProperty.setContent(trx, content);
      } else {
        this.createProperty({
          trx,
          role: ['meta'],
          contentType: 'application/json',
          initialString: content,
        });
      }
    });
  }

  @Guarded
  async setMetaMerge({ trx, meta }: { trx: TrxRef; meta: Partial<TopicSpaceCardState> }) {
    const [currentMetaProperty] = await this.filterProperties({
      role: ['meta'],
    }).toArray();
    if (currentMetaProperty) {
      const existingMeta = tryJsonParse(await currentMetaProperty.content.get());
      const content = JSON.stringify({ ...existingMeta, ...meta });
      currentMetaProperty.setContent(trx, content);
    } else {
      const content = JSON.stringify(meta);
      this.createProperty({
        trx,
        role: ['meta'],
        contentType: 'application/json',
        initialString: content,
      });
    }
  }

  filterEdges(role: string[], toId?: UnifiedId, contextId?: UnifiedId): FilteredObservableList<Edge> {
    // console.log(`${this.prettyId()}.getPartsByRoles(${role.join(', ')})`)
    return this.edges.filterObs((edge) => {
      if (edge.status.value === 'archived') {
        // This should not happen, but it does
        console.warn(`filtered out archived Edge from ${this.prettyId()}.edges (${edge.prettyId()})`);
        return false;
      }

      if (toId && edge.target.id !== toId.id) return false;
      if (contextId && edge.contextId && edge.contextId.id !== contextId.id) {
        return false;
      }

      const edgeRole = edge.role;
      // Not loaded = not included. We probably won't ever hit this, given that this.edges is hydrating
      if (!edgeRole) return false;

      if (edgeRole instanceof Array) {
        return intersects(edgeRole, role);
      } else {
        console.error('edge ', edge.prettyId(), 'has a non-array role:', edge.role, '(vertex:', edge.parent.id, ')');
        return role.length === 1 && role[0] === edgeRole;
      }
    });
  }

  filterBackrefs({
    role,
    toId,
    contextId,
    userID,
  }: {
    role: string[];
    toId?: UnifiedId;
    contextId?: UnifiedId;
    userID?: ObservableReader<string[] | undefined>;
  }): FilteredObservableList<Backref> {
    const list = this.backrefs.filterObs((backref) => {
      if (backref.status.value === 'archived') {
        // This should not happen, but it does
        console.warn(`filtered out archived Backref from ${this.prettyId()}.backrefs (${backref.prettyId()})`);
        return false;
      }

      if (toId && backref.target.id !== toId.id) return false;
      if (contextId && backref.contextId && backref.contextId.id !== contextId.id) {
        return false;
      }

      // Do not render if the backref.userID is not in the writeIDs or is my ID
      if (userID?.value && !userID.value.includes(backref.userID)) {
        return false;
      }

      return intersects(backref.role, role);
    });

    if (userID) {
      void userID.load();
      // TODO: figure out how to get this to NOT notify on the initial change
      list.managedSubscription(userID, (value, origin, ctx) => {
        // NOTE: it's a little bit weird that we are passing along the origin from the userID Observable, but I think it's technically correct
        // that the downstream result is changing because of it
        list.reevaluate(origin, ctx);
      });
    }

    return list;
  }

  filterProperties({
    role,
    contentType,
    userID,
  }: {
    role: string[];
    contentType?: string;
    userID?: string[] | ObservableReader<string[] | undefined>;
  }): FilteredObservableList<Property> {
    // TODO: this isn't quite doing the right thing. It is considered loaded even if userID is not loaded
    const list = this.properties.filterObs(
      (property) => {
        const userIds = userID instanceof ObservableReader ? userID.value : userID;
        if (!intersects(role, property.role)) return false;
        if (contentType && contentType !== property.contentType) return false;

        if (userIds && !userIds.includes(property.userID)) return false;
        return true;
      },
      'properties',
      async () => {
        if (userID instanceof ObservableReader) await userID.load();
      },
    );

    if (userID instanceof ObservableReader) {
      void userID.load();
      list.managedSubscription(userID, (_, origin, ctx) => list.reevaluate(origin, ctx), false);
    }

    return list;
  }

  @Guarded
  async getProperty({
    role,
    contentType,
    userID,
  }: {
    role: string[];
    contentType?: string;
    userID?: string[] | Observable<string[] | undefined>;
  }): Promise<Property | null> {
    const properties = await this.filterProperties({
      role,
      contentType,
    }).toArray();
    return properties[0] ?? null;
  }

  // TODO - move this to a BodyText trait impl
  createBodyTextProperty({
    initialText,
    ...args
  }: Omit<PropertyCreateArgs, 'initialString' | 'parent' | 'role' | 'contentType'> & { initialText: string }) {
    return Property.create({
      parent: this,
      role: ['body'],
      contentType: 'text/plain',
      initialString: initialText,
      ...args,
    });
  }

  @Guarded
  setFlagProperty(role: string, present: boolean | Record<string, any>, trx: TrxRef | null) {
    return subTrxWrap(trx, async (trx) => {
      const property = await this.getFlagProperty(role);

      if (property && !present) {
        property.archive(trx);
      } else if (!property) {
        let extra: Record<string, any> | undefined;
        if (present instanceof Object) extra = present;
        this.createFlagProperty(role, trx, extra);
      }
    });
  }

  @Guarded
  async getFlagProperty(role: string) {
    return await this.getFlagPropertyObs(role).get();
  }

  @Guarded
  getFlagPropertyObs(role: string): ObservableReader<Property | null | undefined> {
    return this.filterProperties({
      role: [role],
      contentType: 'application/json',
      userID: [globalStore.getCurrentUserID()],
    })
      .filterObs((p: Property) => p.status.value === 'active')
      .firstObs();
  }

  @Guarded
  toggleFlagProperty(role: string, trx: TrxRef | null) {
    return subTrxWrap(trx, async (trx) => {
      const property = await this.getFlagProperty(role);

      if (property) {
        property.archive(trx);
      } else {
        this.createFlagProperty(role, trx);
      }
    });
  }

  @Guarded
  createFlagProperty(role: string, trx: TrxRef, extra?: Record<string, any>) {
    return this.createProperty({
      trx,
      role: [role],
      contentType: 'application/json',
      initialString: JSON.stringify(extra ?? {}),
    });
  }

  @Guarded
  getPlainTextPropValueObs(role: string, fallback: string | null = null): ObservableReader<string | null | undefined> {
    return this.filterProperties({
      role: [role],
      contentType: 'text/plain',
    })
      .firstObs()
      .mapObs<string | null | undefined>((p) => p?.text.mapObs((c) => c || fallback));
  }

  @Guarded
  async getPlainTextPropValue(role: string, fallback: string | null = null) {
    return await this.getPlainTextPropValueObs(role, fallback).get();
  }

  @Guarded
  // eslint-disable-next-line @typescript-eslint/ban-types
  getJsonPropValuesObs<T extends {}>(role: string, fallback: T | null = null): ObservableReader<T | null | undefined> {
    return this.filterProperties({
      role: [role],
      contentType: 'application/json',
    })
      .firstObs()
      .mapObs<T | null | undefined>((p) =>
        p
          ? p.text.mapObs((str) => {
              return str ? tryJsonParse<T>(str) : fallback;
            })
          : p,
      );
  }

  @Guarded
  async getJsonPropValues<T extends {}>(role: string) {
    return await this.getJsonPropValuesObs(role).get();
  }

  @Guarded
  // eslint-disable-next-line @typescript-eslint/ban-types
  setJsonPropValues<T extends {}>(role: string, newValues: Partial<T>, trx: TrxRef | null) {
    return subTrxWrap(trx, async (trx) => {
      const [current, ...rest] = await this.filterProperties({
        role: [role],
        contentType: 'application/json',
      }).toArray();
      rest.forEach((p) => p.archive(trx));

      const currentValues = tryJsonParse<T>(current?.content?.value);

      const content = JSON.stringify({
        ...currentValues,
        ...newValues,
      });
      if (current) {
        current.setContent(trx, content);
      } else {
        this.createProperty({
          trx,
          role: [role],
          contentType: 'application/json',
          initialString: content,
        });
      }
    });
  }

  /** This returns a non-hierarchial priv state based on share instructions only on this vertex */
  async basicPrivsForRelatedItems() {
    const shareState = new Model.Priv.VertexShareState(this);
    await shareState.load();

    // We're not doing hierarchial coalescence in this case. Just give the inherited priv state.
    // Then return the actual priv state.
    const inh = shareState.performCoalescence(undefined);
    return Model.Priv.PrivState.fromInherited(inh);
  }
}
