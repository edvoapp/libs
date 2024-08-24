// This will NOT import runnable code, just the types.
import * as Bindings from '@edvoapp/wasm-bindings';
// type WasmBindings = typeof Bindings;
import { DB, Search } from '..';
import {
  Observable,
  ItemEventOrigin,
  getWasmBindings,
  MemoizeOwned,
  OwnedProperty,
  Guarded,
  ObservableReader,
  tryJsonParseOrNull,
  generateSHA256Hash,
  normalizeUrl,
} from '@edvoapp/util';

import forge from 'node-forge';
import { bufferToHex, config, raiseError, Registry } from '../utils';
import { DocumentReference, DocumentSnapshot, Timestamp, Query } from '../dataset/store/db';
import {
  EntityConstructorArgs,
  currentSchemaVersion,
  Entity,
  EntityCreateArgs,
  EntityHydrateArgs,
  RecipientData,
} from './entity';
import { Vertex } from './vertex';
import { TrxRef } from '../transaction';
import { globalStore, QueryArgs } from '../dataset';
import { PrivState } from './privileges';
import equal from 'fast-deep-equal';
import * as Analytics from '../lytics';
import { TimelineEvent } from './timeline-event';

// Method of addressing for content-addressable-store.
const SHA512_CAS_METHOD = '$sha512';

// Edvo content-addressable-store Cloud Storage bucket.
const CAS_BUCKET = config.casBucket;

export interface PropertyData extends RecipientData {
  keywords?: string[];
  parentID: string;
  role: string[];
  primaryRole: string;
  contentType: string;
  payload?: string;
  matchKey?: string;
  updateArray?: DB.Blob[];
  contentId?: string; // any time that an Property has a contentId it's stored in CAS.
  size?: number | string;
}

interface ConstructorArgs extends EntityConstructorArgs<PropertyData> {
  parent: Vertex;
  role: string[];
  contentType: string;
  contentId?: string;
  contentUrl?: string;
  userID: string;
  keywords?: string[];
  privs: PrivState;
  id: string;
  updatedAt: DB.Timestamp;
  size?: number | string;
  initRustProperty: (prop: Property, rustContentType: string) => Bindings.Property;
}

export interface CreateArgs extends EntityCreateArgs {
  parent: Vertex;
  role: string[];
  contentType: string;
  initialString?: string;
  size?: number | string;
  contentId?: string;
  contentUrl?: string; // for matching
  origin?: ItemEventOrigin; // TODO change this to Omit<ItemEventOrigin,"DATABASE">
  // TODO: consider changing privs to be required
  privs?: PrivState;
  suppressTopicCreateEvent?: boolean;
}

interface CreateAsyncArgs extends CreateArgs {
  sha?: string;
  contentUrl?: string;
  contentHandle?: File;
  contentArrayBuffer?: ArrayBuffer;
  contentBufferArray?: ArrayBuffer[];
  uploadTaskRef?: (uploadTask: DB.UploadTask) => void;
}

export interface UpsertArgs extends CreateArgs {}

interface HydrateArgs extends EntityHydrateArgs<PropertyData> {
  //parent: Vertex;
}

export class Property extends Entity<PropertyData> implements Bindings.IJsProperty {
  type = 'property';
  role: string[];
  contentType: string;
  @OwnedProperty
  parent: Vertex;
  size?: number | string;
  contentId: string | null;
  userID: string;
  @OwnedProperty
  privs: Observable<PrivState>;
  private static registry = new Registry<Property>();
  updatedAt: Timestamp;
  hydratedKeywords?: string[]; // hack

  // Migration strategy: Gradually move Property functionality into property.rs
  // until we can eventually delete this file
  @OwnedProperty
  rustProperty: Bindings.Property;
  private constructor({
    role,
    contentType,
    contentId,
    userID,
    privs,
    keywords,
    updatedAt,
    initRustProperty,
    size,
    ...args
  }: ConstructorArgs) {
    super(args);

    this.parent = args.parent;
    this.size = size;
    this.role = role;
    this.contentType = contentType;
    this.contentId = contentId || null;
    this.userID = userID;
    this.privs = new Observable(privs);
    this.updatedAt = updatedAt;
    this.hydratedKeywords = keywords;

    // you can't use Bindings to instantiate stuff
    // * If you do this, it will crash because the wasm file has to be loaded async
    // and you can't use getWasmBindings to declare types
    // * you can do this because you can't use a function output as a type

    // Why do we have property.ts AND property.rs?
    // * Because we only implemented text/plain so far in rust
    // * Because we haven't yet implemented the FireStore/Entity base behaviors in rust yet
    //
    // What is rustProperty?
    // RustProperty is the part of the Property data model object code that we have ported to rust thus far
    // Eventually, we will move the rest of the code from TS into Rust
    // So: We are always trying to instantiate the rustProperty on TS property object instantion
    // And the rustProperty fn new will return Option<Self> depending on whether it's able to handle this content type or not.

    // HACK - Need to discuss how to handle content-mode flags. Probably should be a different content-type
    // and/or we could just accept that some text/plain properties will use YRS unnecessarily.
    const rustContentType = equal(role, ['content-mode']) ? 'bogus/ignore' : contentType;

    this.rustProperty = initRustProperty(this, rustContentType);

    // EITHER WAY: We are not sending anything to the database. That is the responsibility of the "create"
    // method itself. Not the JS constructor. If this were fully in rust, we should have two fully different
    // constructors. But JS forces us to have one real constructor, and two static methods as fake constructors

    Property.registry.add_or_throw(this.id, this, 'Property.constructor');
  }

  protected cleanup() {
    Property.registry.remove(this.id);
    super.cleanup();
  }

  // Legacy API for property content which is not implemented by the property.rs backend.
  // We will incrementally switch other content types to be supported by property.rs, at which time you should switch to .contentState

  /**
   * @deprecated use Property.contentState
   */
  @MemoizeOwned()
  get content(): ObservableReader<string | null> {
    if (this.contentType !== 'text/plain') {
      return this.text;
    }
    debugger; // Leave this debugger
    throw `Please use Property.contentState for ${this.contentType} properties`;
  }

  /**
   * ContentState is the new API for getting the current state of property content
   * As of this writing, it only supports text/plain chunks via CRDT,
   * but we plan to expand it to support other CRDT AND non-CRDT data types
   * like images, pdfs, etc.
   */
  @MemoizeOwned()
  get contentState(): ObservableReader<Bindings.ContentState> {
    const rustContentObs = this.rustProperty.content;

    // Wrap the rust observable in a JS observable so we have the .map* methods

    // make a wrapper observable with an initial value that is the
    // rustContentObs current value
    // That way we don't have to make this Observable<T|null> but just Observable<T>
    const outObs: Observable<Bindings.ContentState> = new Observable(rustContentObs.value);

    // Then subscribe to updates and relay them to the new observable
    outObs.onCleanup(rustContentObs.subscribe(() => outObs.set(rustContentObs.value)) as () => void);

    return outObs;
  }

  @MemoizeOwned()
  get text(): ObservableReader<string> {
    return this.contentState.mapObs<string>((cs) => cs.to_lossy_string());
  }

  // trivial edit
  @MemoizeOwned()
  get json(): ObservableReader<{} | null> | null {
    // TODO: figure out a better way to detemine if we're expecting json.
    // It sucks to just YOLO it and try to JSON.parse everything
    if (!['application/json', 'application/x-share'].includes(this.contentType)) return null;
    return this.text.mapObs((v) => tryJsonParseOrNull(v));
  }
  @Guarded
  archive(trx: TrxRef, origin?: ItemEventOrigin) {
    this.parent.properties.remove(this, origin, { trx });
    super.archive(trx);
  }

  /**
   * If a `content` argument is supplied, it will be stored inline.
   *
   * If a `contentUrl` argument is supplied as, an attempt will be made to download
   * the resource and store it in the CAS.
   */
  static create({
    trx,
    parent,
    role,
    contentType,
    initialString,
    contentId,
    contentUrl,
    privs,
    meta,
    origin = 'USER',
    subUserID,
    size,
    suppressTopicCreateEvent,
  }: CreateArgs): Property {
    const docRef: DocumentReference<PropertyData> = globalStore.createChildDocument(parent.docRef, 'property');

    const userID = globalStore.getCurrentUserID();
    privs ??= PrivState.default(userID);

    // Because JS is dumb and you can't have multiple constructors, we have to put
    // some branching logic in the constructor, and the rest into static methods
    // which are KIND OF like constructors
    const now = trx.now();
    const keywords = contentType === 'text/plain' ? Search.stringToTokens(initialString) : [];
    // Make the local Property "struct" how we want it
    contentUrl =
      contentId ?? contentUrl ?? ['text/x-uri', 'text/x-embed-uri'].includes(contentType) ? initialString : undefined;
    const property = new Property({
      parent,
      role,
      contentType,
      contentUrl,
      docRef: docRef,
      contentId,
      userID,
      subUserID,
      privs,
      size,
      keywords,
      saved: false,
      editable: true,
      id: docRef.id,
      status: 'active',
      updatedAt: now,
      initRustProperty: (prop, rustContentType: string) => {
        return getWasmBindings().Property.create(prop, rustContentType, initialString);
      },
    });

    // Just creating the Property JS "struct" doesn't save anything to the datbase
    // We ONLY want to do that in create, not hydrate. Thus we don't do it in the JS constructor.

    // Formulate the database insert statement
    // This POJO is NOT stored in the property object at any point
    // It's only for the DB insert statement, then we throw it away
    let insertData: PropertyData = {
      id: docRef.id,
      parentID: parent.id,
      status: 'active',
      keyID: '',
      cipher: '',
      keywords,
      size,
      ...privs.data(),
      userID,
      subUserID,
      createdAt: now,
      updatedAt: now,
      role,
      primaryRole: role[0],
      contentType,
      v: currentSchemaVersion(),
    };

    // HACK: inserts the initial updateArray into insertData
    property.rustProperty.pushContent(UpdateContext.init(insertData));

    if (contentId) insertData.contentId = contentId;
    if (contentUrl) {
      const url = ['text/x-uri', 'text/x-embed-uri'].includes(contentType) ? normalizeUrl(contentUrl) : contentUrl;
      if (url) insertData.matchKey = generateSHA256Hash(url);
      else {
        console.error(`Malformed URL:`, contentUrl);
      }
    }

    // insert the object into the parent collection after we have updated the rustProperty
    // If we do it before we update the rustProperty, we might have a rendering blink, because this is going
    // to synchronously trigger a React component render sometimes
    parent.properties.insert(property, origin, { trx });

    // Do the actual database insert and then discard insertData
    trx.insert(property, insertData);

    // HACK - Vertex creation with inline name property does the timeline event creation
    // but cloning doesn't use that. So we have to do it here or we get no created event.
    if (role.includes('name') && !suppressTopicCreateEvent) TimelineEvent.create({ trx, parent, eventType: 'created' });

    Analytics.event('property-creation', {
      role,
      contentType,
    });

    return property;
  }

  static async createAsync({
    contentHandle,
    contentArrayBuffer,
    contentUrl,
    contentType,
    uploadTaskRef,
    sha,
    ...rest
  }: CreateAsyncArgs) {
    let contentId: string;
    let size: number | string;
    if (contentArrayBuffer) {
      const x = await Property.upsertArrayBuffer(contentArrayBuffer, contentType, uploadTaskRef, sha);
      contentId = x.contentId;
      size = x.size;
    } else if (contentHandle) {
      const x = await Property.upsertLocalFile(contentHandle, contentType, uploadTaskRef, sha);
      contentId = x.contentId;
      size = x.size;
    } else if (contentUrl) {
      const data = await globalStore.callServerFunction('upsertPublicFileWithSize', {
        url: contentUrl,
      });

      contentId = data.casId;
      size = data.size ?? 0;
    } else {
      throw 'must provide contentArrayBuffer, contentHandle, or contentUrl';
    }

    return Property.create({
      contentId,
      contentType,
      size,
      contentUrl,
      ...rest,
    });
  }

  static rawQuery({ where, orderBy, limit }: QueryArgs, parent?: Vertex) {
    let query: Query<PropertyData> = globalStore.createQuery('property', parent?.docRef);

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

  static hydrate({ snapshot }: HydrateArgs): Property {
    // NOTE: it is unlikely we will ever query backrefs by something other than ParentId
    // Because everything else will be opaque/encrypted. Such a query would be done via properties instead
    // Thus, hydration should be able to safely require the parent both here and for Edge

    const docRef = snapshot.ref;

    let property = Property.registry.get(docRef.id);
    if (property) {
      property.applySnapshot(snapshot);
      return property;
    }

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Property ' + docRef.id);

    const {
      status,
      role,
      payload,
      contentId,
      userID,
      subUserID,
      recipientID,
      writeID = [],
      keywords,
      adminID = [],
      size,
      shareID = [],
      parentID,
      id,
      updateArray,
      updatedAt,
    } = data;

    let contentType = data.contentType;

    // Workaround for incorrectly recorded meta content type
    if (contentType === 'text/plain' && role.includes('meta')) {
      contentType = 'application/json';
    }

    const writeIds = [...new Set([...writeID, ...adminID, userID])];
    const editable = writeIds.includes(globalStore.getCurrentUserID()) || writeIds.includes('PUBLIC');

    const privs = PrivState.fromData({
      recipientID,
      writeID,
      adminID,
      shareID,
    });

    property = new Property({
      docRef,
      parent: Vertex.getById({ id: parentID }),
      role,
      contentType,
      contentId,
      userID,
      subUserID,
      privs,
      keywords,
      saved: true,
      size,
      editable,
      id,
      status,
      updatedAt,
      initRustProperty: (prop, rustContentType) => {
        if (updateArray) {
          const [updates, updateLengths] = globalStore.mergeBlobArray(updateArray);
          const rustProperty = getWasmBindings().Property.hydrate(prop, rustContentType, updates, updateLengths);
          return rustProperty;
        }

        const rustProperty = getWasmBindings().Property.hydrate_legacy(prop, rustContentType, payload ?? '');
        return rustProperty;
      },
    });

    return property;
  }

  static async upsert({
    trx,
    parent,
    initialString: content,
    role,
    contentType,
    ...rest
  }: UpsertArgs): Promise<Property> {
    let query = globalStore
      .createQuery<PropertyData>('property', parent.docRef)
      .where('role', 'array-contains-any', role)
      .where('contentType', '==', contentType);

    const snapshot = (await query.get()).docs[0];
    if (snapshot) {
      const data = snapshot.data();
      if (!data) throw new Error('Property doc has no data');
      const property = Property.hydrate({ snapshot });
      if (typeof content !== 'undefined') {
        property.setContent(trx, content);
      }
      return property;
    }
    return Property.create({
      trx,
      parent,
      initialString: content,
      role,
      contentType,
      ...rest,
    });
  }

  setPrivs({ trx, privs }: { trx: TrxRef; privs: PrivState }) {
    if (!privs.loaded) {
      raiseError('Attempt to call setPrivs with non-loaded PrivState (Property)');
      return;
    }
    if (!this.privs.value.equal(privs)) {
      trx.update(this, privs.data());
      this.privs.set(privs);
    }
  }

  lastUpdateArrayLen = 0;
  applySnapshot(snapshot: DocumentSnapshot<PropertyData>) {
    super.applySnapshot(snapshot);

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Property ' + snapshot.ref.id);

    const {
      payload,
      userID,
      recipientID,
      updateArray,
      updatedAt,
      keywords,
      writeID = [],
      adminID = [],
      shareID = [],
    } = data;

    this.updatedAt = updatedAt;
    this.hydratedKeywords = keywords;

    // No compat for applySnapshot because we don't want to risk stomping on a more recent value from the local user
    // And we don't need to support active interop between nightly/prod, just switching wholesale.

    if (updateArray) {
      this.applyUpdates(updateArray);
    } else if (payload) {
      this.rustProperty.replace_content(payload);
    }

    const newPrivs = PrivState.fromData({
      recipientID,
      writeID,
      adminID,
      shareID,
    });

    // TODO (daniel) - Revise UpdatablesSet to listen to privs and remove+re-add the updatable until
    //                 privs.value (PrivState) is done loading.
    if (!this.privs.value.equal(newPrivs)) {
      if (this.privs.value.loaded) {
        // Kind of a hack - There should be a better way to handle this
        void newPrivs.load().then(() => {
          // Note that this could run into timing problems if several privstate updates happen in quick succession
          // there is no guarantee that the last (actually correct) PrivState object is the one that gets .set() last
          this.privs.set(newPrivs);
        });
      } else {
        this.privs.set(newPrivs);
      }
    }

    const writeIds = [...new Set([...writeID, ...adminID, userID])];
    this.editable.set(writeIds.includes(globalStore.getCurrentUserID()) || writeIds.includes('PUBLIC'));
  }

  applyUpdates(updateArray: DB.Blob[], legacyContent?: string) {
    if (!this.rustProperty) return;

    this.trace(3, () => [
      'applyUpdates 1',
      {
        updateArray,
        legacyContent,
        lastUpdateArrayLen: this.lastUpdateArrayLen,
      },
    ]);

    const start = this.lastUpdateArrayLen ?? 0;
    if (updateArray.length > this.lastUpdateArrayLen) {
      this.trace(3, () => ['applyUpdates 2']);
      let [updates, updateLengths] = globalStore.mergeBlobArray(updateArray.slice(start));
      try {
        this.rustProperty.apply_updates_from_db(updates, updateLengths);
        this.trace(3, () => ['applyUpdates 3']);
      } catch (err) {
        this.trace(3, () => ['applyUpdates error', err]);
      }
      this.lastUpdateArrayLen = updateArray.length;
    }
  }

  async contentUrl(): Promise<string | undefined> {
    const content = this.rustProperty?.content.get() || this.content.value;
    if (content && typeof content === 'string') {
      return `data:${this.contentType},` + btoa(content);
    }

    let contentId = this.contentId;
    if (contentId) {
      const idParts = contentId.split(':');
      let casMethod = idParts[0];
      if (casMethod === SHA512_CAS_METHOD) {
        // Retrieve content from storage.
        const sha = idParts[1];
        return await globalStore.getDownloadUrl(CAS_BUCKET, sha);
      }
    }

    return undefined;
  }

  /**
   * Fetch document content from CAS.
   *
   * If the Property does not (yet) have a CAS ID, returns null.
   */
  async fetchBytesFromCas(): Promise<Uint8Array | null> {
    if (!this.contentId) {
      return null;
    }
    try {
      const idParts = this.contentId.split(':');
      let casMethod = idParts[0];
      if (casMethod === SHA512_CAS_METHOD) {
        // Retrieve content from storage.
        const sha = idParts[1];
        const downloadUrl = await globalStore.getDownloadUrl(CAS_BUCKET, sha);
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw `Failed to load ${response.url}`;
        }
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        return new Uint8Array(buffer);
      } else {
        throw "Unrecognized CAS method: '" + casMethod + "'";
      }
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      return Promise.reject('Failed to fetch doc from CAS: ' + e);
    }
  }

  private static async upsertLocalFile(
    inputFile: File,
    contentType: string,
    uploadTaskRef?: (uploadTask: DB.UploadTask) => void,
    sha?: string,
  ) {
    const wholeFileBuf = await inputFile.arrayBuffer();
    return Property.upsertArrayBuffer(wholeFileBuf, contentType, uploadTaskRef, sha);
  }

  /**
   * Take a document represented as a `File` object, calculate its CAS ID,
   * store the document and return the CAS ID.
   */
  private static async upsertArrayBuffer(
    arrayBuffer: ArrayBuffer,
    contentType: string,
    uploadTaskRef?: (uploadTask: DB.UploadTask) => void,
    sha?: string,
  ): Promise<{ contentId: string; size: number }> {
    // Create a SHA512 hex digest which we'll use as the CAS filename.
    // TODO: Unfortunately the Web Crypto API doesn't support streams, so
    // we have to load the whole file into memory.  Solve this by using
    // a different hashing approach.
    sha = sha || (await Property.createArrayBufferHash(arrayBuffer));

    if (!sha) return { contentId: '', size: 0 };

    // This *should* work — it is the documented way of accessing a different
    // bucket from the Firebase Web SDK.  But it is broken at least right now.
    //
    //    const  casStorage = firebase.app().storage('gs://' + CAS_BUCKET);
    //
    // So instead our workaround is to set the CAS_BUCKET as the default bucket
    // on the `[DEFAULT]` firebase app.  That's OK so long as the *only*
    // // thing we ever use Firebase Storage for is the CAS.
    const uploadTask = globalStore.createUploadTaskFromArrayBuffer(sha, contentType, arrayBuffer);

    uploadTaskRef && uploadTaskRef(uploadTask);
    const size = await globalStore.getFileSizeFromMetadata(uploadTask);
    const contentId = SHA512_CAS_METHOD + ':' + sha;
    return { contentId, size };
  }

  public static async createArrayBufferHash(arrayBuffer: ArrayBuffer) {
    let sha;
    if ('crypto' in window && 'subtle' in window.crypto) {
      let hashBuffer = await crypto.subtle.digest('SHA-512', arrayBuffer);
      sha = bufferToHex(hashBuffer);
    } else {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      const md = forge.md.sha512.create();
      md.update(text);
      sha = md.digest().toHex();
    }
    return sha;
  }

  // Is this needed for anything?
  // static urlFromContentId(contentId: string) {
  //   const offset = contentId.search(':');
  //   if (offset === -1) {
  //     throw "Malformed contentId, can't extract URL";
  //   }
  //   const sha = contentId.substring(offset);
  //   return 'gs://' + CAS_BUCKET + '/' + sha;
  // }

  setContent(trx: TrxRef, text: string) {
    const rp = this.rustProperty;
    rp.replace_content(text);
    rp.save(trx);
  }

  // This only works for text/plain
  // TODO: Should beforeSaveHooks be moved to Entity?
  private beforeSaveHooks: ((trx: TrxRef) => void)[] = [];
  addBeforeSaveHook(hook: (trx: TrxRef) => void) {
    this.beforeSaveHooks.push(hook);
  }
  applyBeforeSaveHooks(trx: TrxRef) {
    if (this.beforeSaveHooks.length) {
      const hooks = this.beforeSaveHooks;
      this.beforeSaveHooks = [];
      for (const hook of hooks) {
        hook(trx);
      }
    }
  }

  private postSaveHooks: (() => void)[] = [];
  addPostSaveHook(hook: () => void) {
    this.postSaveHooks.push(hook);
  }
  async triggerChange(hook: () => void | Promise<void>) {
    const prom = new Promise<void>((resolve) => this.upgrade()?.addPostSaveHook(() => resolve()));
    await hook();
    await prom;
  }
  awaitTillSaved(): Promise<void> {
    return new Promise((resolve) => {
      this.upgrade()?.addPostSaveHook(() => resolve());
    });
  }
  applyPostSaveHooks() {
    if (this.postSaveHooks.length) {
      const hooks = this.postSaveHooks;
      this.postSaveHooks = [];
      for (const hook of hooks) {
        hook();
      }
    }
  }
}

export class UpdateContext implements Bindings.IJsUpdateContext {
  private constructor(readonly data: Record<string, any>) {}
  /**
   * Create UpdateContext from an object you'd like to augment (which you are about to call whatever.update with)
   */
  static init(data?: Record<string, any>): UpdateContext {
    return new UpdateContext(data ?? {});
  }

  setField(field: string, value: any) {
    this.data[field] = value;
  }

  // rename?
  pushToArray(field: string, value: Uint8Array) {
    this.data[field] = globalStore.pushToDbArray(value);
  }

  //setArrayFieldFromU8Array(field: string, value: Uint8Array) {
  //  this.data[field] = [Firebase.firebase.firestore.Blob.fromUint8Array(value)];
  //}
}
