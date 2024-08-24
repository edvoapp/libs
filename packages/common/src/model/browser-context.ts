import { Observable, OwnedProperty, rejectUndefined } from '@edvoapp/util';
import { QueryArgs, globalStore } from '../dataset';
import { DocumentReference, DocumentSnapshot, Query } from '../dataset/store/db';
import { Registry } from '../utils';
import {
  BaseData,
  currentSchemaVersion,
  Entity,
  EntityConstructorArgs,
  EntityCreateArgs,
  EntityHydrateArgs,
} from './entity';
import { TrxRef } from '../transaction';

type BrowserContextType = 'tab' | 'group' | 'window';
type BrowserContextOriginator = 'app' | 'ext' | 'unk';

// What's actually stored in the DB
export interface BrowserContextDataDB extends BaseData {
  type: BrowserContextType;
  deviceContextId: string;
  // sessionId?: string;
  // windowId?: number;
  // tabId?: number;
  seq?: number; // windows do not have a seq
  // scope this to the browser instance
  url?: string;
  faviconUrl?: string;
  parentContextId?: string;
  pinned?: boolean;
  title?: string;
  originator?: BrowserContextOriginator;

  // for future E2EE
  keyID: string;
  cipher: string;
}

interface BrowserContextConstructorArgs extends EntityConstructorArgs<BrowserContextDataDB> {
  docRef: DocumentReference<BrowserContextDataDB>; // Base considers this optional
  data?: BrowserContextDataDB;
  parent?: BrowserContext | null;
  type: BrowserContextType;
  seq?: number; // windows do not have a seq
  pinned?: boolean;
  title?: string;
  // scope this to the browser instance
  deviceContextId: string;
  sessionId?: string;
  url?: string;
  faviconUrl?: string;
  windowId?: number;
  tabId?: number;
  groupId?: number;
  originator: BrowserContextOriginator;
  attached: boolean;
  onClose?: () => void;
}

export interface BrowserContextCreateArgs extends EntityCreateArgs {
  type: BrowserContextType;
  seq?: number; // windows do not have a seq
  // scope this to the browser instance
  deviceContextId: string;
  sessionId?: string;
  originator: BrowserContextOriginator;
  url?: string;
  faviconUrl?: string;
  windowId?: number;
  tabId?: number;
  groupId?: number;
  parent?: BrowserContext | null;
  pinned?: boolean;
  title?: string;
  onClose?: () => void;
}

export interface BrowserContextUpdateArgs extends EntityCreateArgs {
  seq?: number;
  url?: string;
  faviconUrl?: string;
  windowId?: number;
  tabId?: number;
  groupId?: number;
  parent?: BrowserContext | null;
  pinned?: boolean;
  title?: string;
}

export interface BrowserContextHydrateArgs extends EntityHydrateArgs<BrowserContextDataDB> {
  parent?: BrowserContext;
}

export class BrowserContext extends Entity<BrowserContextDataDB> {
  readonly type = 'browser-context';
  private static registry = new Registry<BrowserContext>();
  @OwnedProperty
  parent?: BrowserContext | null;
  contextType: BrowserContextType;
  // scope this to the browser instance
  deviceContextId: string;
  windowId?: number;
  tabId?: number;
  groupId?: number;
  @OwnedProperty
  seq = new Observable<number | null>(null); // windows do not have a seq
  @OwnedProperty
  url = new Observable<string | null>(null);
  @OwnedProperty
  faviconUrl = new Observable<string | null>(null);
  @OwnedProperty
  pinned = new Observable<boolean | null>(null);
  @OwnedProperty
  title = new Observable<string | null>(null);
  sessionId: string | null;
  originator: BrowserContextOriginator;
  onClose?: () => void;
  private attached: boolean;

  private constructor({
    parent,
    type: contextType,
    seq,
    deviceContextId,
    sessionId,
    originator,
    url,
    faviconUrl,
    windowId,
    tabId,
    groupId,
    pinned,
    title,
    onClose,
    attached,
    ...args
  }: BrowserContextConstructorArgs) {
    super(args);
    BrowserContext.registry.add_or_throw(args.docRef.id, this, 'Attempt to register duplicate BrowserContext');

    this.parent = parent;
    this.contextType = contextType;
    this.deviceContextId = deviceContextId;
    this.windowId = windowId;
    this.tabId = tabId;
    this.groupId = groupId;
    this.sessionId = sessionId ?? null;
    this.originator = originator;
    this.onClose = onClose;
    this.attached = attached;

    if (seq !== undefined) this.seq.set(seq);
    if (url) this.url.set(url);
    if (faviconUrl) this.faviconUrl.set(faviconUrl);
    if (pinned !== undefined) this.pinned.set(pinned);
    if (title) this.title.set(title);
  }

  static create({
    trx,
    parent,
    type,
    seq,
    url,
    faviconUrl,
    deviceContextId,
    sessionId,
    originator,
    windowId,
    tabId,
    groupId,
    pinned,
    title,
    onClose,
    subUserID,
  }: BrowserContextCreateArgs): BrowserContext {
    let attached = false;

    if (sessionId) {
      if (!onClose) throw 'onClose is required for attached create';

      if (type === 'tab') {
        if (!parent) throw 'parent is required for tab';
        if (!tabId) throw 'tabId is required for tab';
      }

      if (type === 'window' && !windowId) throw 'windowId is required for attached create';

      attached = true;
    }

    if (['tab', 'group'].includes(type) && !parent) {
      throw new Error("Browser contexts with type of 'tab' must have a parent");
    }

    const docRef = globalStore.createDocRef<BrowserContextDataDB>('browser_context');

    console.log('Creating BrowserContext', docRef.id);

    const context = new BrowserContext({
      docRef,
      parent,
      saved: false,
      editable: true,
      status: 'active',
      type,
      seq,
      url,
      faviconUrl,
      deviceContextId,
      sessionId,
      windowId,
      tabId,
      groupId,
      title,
      pinned,
      originator,
      onClose,
      attached,
      subUserID,
    });

    parent?.attachChild(context);

    // Register this with the parent object - only on create
    // The presumption is that rehydrate is being called by QueryObservable.mergeDocs or similar
    // Attach the part to our parent.parts so they don't have to wait to hear it from the server
    // No need to force them to load for this, so use value() rather than get

    const userID = globalStore.getCurrentUserID();
    if (!userID) throw new Error('wut');
    const parentContextId = parent?.docRef.id;
    const now = trx.now();
    const data: BrowserContextDataDB = rejectUndefined({
      id: docRef.id,
      status: 'active',
      type,
      keyID: '',
      cipher: '',
      userID,
      seq,
      url,
      faviconUrl,
      deviceContextId,
      originator,
      parentContextId,
      title,
      pinned,
      subUserID,
      // sessionId,
      // tabId,
      // windowId,
      createdAt: now,
      updatedAt: now,
      v: currentSchemaVersion(),
    }) as BrowserContextDataDB;
    // Save it to the DB
    trx.insert(context, data);

    return context;
  }

  update({ trx, seq, url, faviconUrl, parent, title, pinned }: BrowserContextUpdateArgs) {
    const parentContextId = parent?.docRef.id;
    const data: Partial<BrowserContextDataDB> = rejectUndefined({
      seq,
      url,
      faviconUrl,
      parentContextId,
      title,
      pinned,
    });
    console.log('Updating BrowserContext', this.id, parent);

    if (parent) {
      if (this.parent != parent) {
        this.parent?.detachChild(this);
        this.parent = parent;
        parent.attachChild(this);
      }
    }

    if (this.status.value != 'active') {
      data.status = 'active';
      this.status.set('active');
    }
    if (seq !== undefined) this.seq.set(seq);
    if (url) this.url.set(url);
    if (faviconUrl) this.faviconUrl.set(faviconUrl);
    if (pinned !== undefined) this.pinned.set(pinned);
    if (title) this.title.set(title);
    if (Object.values(data).length > 0) trx.update(this, data);
  }
  attach({
    windowId,
    tabId,
    sessionId,
    onClose,
    trx,
  }: {
    windowId?: number;
    tabId?: number;
    sessionId: string;
    onClose: () => void;
    trx: TrxRef;
  }) {
    console.log('attaching BrowserContext', this.id);
    if (this.contextType === 'tab' && !tabId) throw 'tabId is required';
    if (this.contextType === 'window' && !windowId) throw 'windowId is required';

    // This is the part that is required to find these records later
    this.tabId = tabId;
    this.windowId = windowId;
    this.onClose = onClose;
    this.sessionId = sessionId;
    // A little housekeepking
    this.attached = true;

    // This part is maybe not that important. It will only be useful IF: we want to match existing records on startup
    // trx.getTrx().update(this, rejectUndefined({ sessionId, tabId, windowId }));
  }

  applySnapshot(snapshot: DocumentSnapshot<BrowserContextDataDB>) {
    this.setSaved();
    const data = snapshot.data();
    if (data) {
      const {
        status,
        visitedAt,
        parentContextId,
        type: contextType,
        seq,
        url,
        pinned,
        title,
        faviconUrl,
        deviceContextId,
      } = data;
      if (status) this.status.set(status);
      if (visitedAt) this.visitedAt = visitedAt;
      if (parentContextId) {
        // presumably if we're moving tabs to new windows, we already have created the Model
        const parent = BrowserContext.registry.get(parentContextId);
        if (parent) {
          if (this.parent != parent) {
            this.parent?.detachChild(this);
            this.parent = parent;
            parent.attachChild(this);
          }
        } else {
          console.warn('Parent with ID', parentContextId, 'does not exist in the BrowserContext registry');
        }
      }
      this.contextType = contextType;
      this.deviceContextId = deviceContextId;

      if (seq !== undefined) this.seq.set(seq);
      if (url) this.url.set(url);
      if (faviconUrl) this.faviconUrl.set(faviconUrl);
      if (pinned !== undefined) this.pinned.set(pinned);
      if (title) this.title.set(title);
    }
  }

  // static get({ docRef }: GetArgs<BrowserContextDataDB>): BrowserContext {
  //   let context = BrowserContext.registry.get(docRef.id);
  //   if (context) return context;
  //
  //   context = new BrowserContext({
  //     docRef,
  //     saved: true,
  //     editable: true,
  //     status: 'active',
  //   });
  //   return context;
  // }

  static hydrate({ snapshot }: BrowserContextHydrateArgs): BrowserContext {
    const docRef = snapshot.ref;
    let context = BrowserContext.registry.get(docRef.id);
    if (context) {
      context.applySnapshot(snapshot);
      return context;
    }

    // parent = parent
    // ||BrowserContext.get({
    //   docRef: snapshot.ref.parent.parent as DocumentReference<BrowserContextData>,
    // });

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Browser Context ' + docRef.id);

    const {
      userID,
      status,
      type,
      seq,
      url,
      faviconUrl,
      deviceContextId,
      // sessionId,
      originator,
      parentContextId,
      pinned,
      title,
      subUserID,
    } = data;

    const parent = parentContextId ? BrowserContext.registry.get(parentContextId) : null;

    let bc = new BrowserContext({
      docRef,
      parent,
      saved: true,
      editable: userID === globalStore.getCurrentUserID(),
      status,
      type,
      seq,
      url,
      faviconUrl,
      deviceContextId,
      subUserID,
      // sessionId,
      originator: originator ?? 'unk',
      pinned,
      title,
      attached: false,
    });

    parent?.attachChild(bc);

    return bc;
  }
  static rawQuery({ where, orderBy, limit }: QueryArgs, parent?: BrowserContext) {
    let query: Query<BrowserContextDataDB> = globalStore.createQuery('browser_context', parent?.docRef);

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

  challenge(trx: TrxRef) {
    this.parent?.detachChild(this);
    trx.update(this, { status: 'challenged' });
  }

  delete(trx: TrxRef) {
    this.parent?.detachChild(this);
    trx.delete(this);
  }

  /**
   * Cause the browser tab/window to be closed and clean up the record. This is called exclusively in response to the remote archival of the record
   */
  close(trx: TrxRef) {
    if (!this.attached) throw 'close is intended to be used by the extension, not the remote end';

    //Detach from my parent
    this.parent?.detachChild(this);

    let ch = this.children;

    // Inert child detachment from us
    this.children = [];

    ch.forEach((child) => child.close(trx));
    trx.delete(this);

    this.onClose?.();
    this.attached = false;
    this.onClose = undefined;
    this.parent = undefined;
  }

  children: BrowserContext[] = [];
  attachChild(child: BrowserContext) {
    this.children.push(child);
  }
  detachChild(child: BrowserContext) {
    this.children = this.children.filter((c) => c != child);
  }
}
