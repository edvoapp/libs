import { globalStore, QueryArgs } from '../dataset';
import { DocumentReference, Timestamp, Query } from '../dataset/store/db';
import { Registry } from '../utils';
import {
  BaseMeta,
  EntityConstructorArgs,
  currentSchemaVersion,
  Entity,
  EntityCreateArgs,
  EntityHydrateArgs,
  RecipientData,
} from './entity';
import { Vertex } from './vertex';
import { Guarded, ObservableList, OwnedProperty } from '@edvoapp/util';
import { TrxRef } from '../transaction';

export type TimelineEventType =
  | 'created'
  | 'created-first-topic'
  | 'created-topic-from-jump-search'
  | 'extension-installed'
  | 'add-member-to-space'
  | 'visited'
  | 'touched'
  | 'archived'
  | 'renamed'
  | 'sign-up'
  | 'sign-in'
  | 'member-added'
  | 'member-removed';

export interface TimelineEventMeta extends BaseMeta {
  oldName?: string;
  newName?: string;
}

// What's actually stored in the DB
export interface TimelineEventDataDB extends RecipientData {
  eventDate: Timestamp;
  eventType: TimelineEventType;
  meta?: TimelineEventMeta;
  isAnonymous?: boolean;
}

interface TimelineEventConstructorArgs extends EntityConstructorArgs<TimelineEventDataDB> {
  docRef: DocumentReference<TimelineEventDataDB>; // Base considers this optional
  data?: TimelineEventDataDB;
  parent: Vertex;
  eventDate: Timestamp;
  eventType: TimelineEventType;
  backrefPath?: string;
}

export interface TimelineEventCreateArgs extends EntityCreateArgs {
  parent: Vertex;
  eventType: TimelineEventType;
  meta?: TimelineEventMeta;
}

export interface TimelineEventHydrateArgs extends EntityHydrateArgs<TimelineEventDataDB> {}

export class TimelineEvent extends Entity<TimelineEventDataDB> {
  readonly type = 'event';
  @OwnedProperty
  readonly parent: Vertex;
  readonly eventType: TimelineEventType;
  readonly eventDate: Timestamp;
  private static registry = new Registry<TimelineEvent>();

  private constructor(args: TimelineEventConstructorArgs) {
    super(args);
    TimelineEvent.registry.add_or_throw(args.docRef.id, this, 'Attempt to register duplicate TimelineEvent');

    this.parent = args.parent;
    this.eventType = args.eventType;
    this.eventDate = args.eventDate;
  }

  static create({ trx, parent, eventType, meta, origin = 'USER' }: TimelineEventCreateArgs): TimelineEvent {
    const docRef: DocumentReference<TimelineEventDataDB> = globalStore.createChildDocument(parent.docRef, 'event');

    const now = trx.now();
    const event = new TimelineEvent({
      docRef: docRef,
      parent,
      eventType,
      eventDate: now,
      saved: false,
      editable: true,
      status: 'active',
    });

    // Register this with the parent object - only on create
    // The presumption is that rehydrate is being called by QueryObservable.mergeDocs or similar
    // Attach the part to our parent.parts so they don't have to wait to hear it from the server
    // No need to force them to load for this, so use value() rather than get

    const user = globalStore.getCurrentUser();
    const userID = globalStore.getCurrentUserID();
    const data: TimelineEventDataDB = {
      id: docRef.id,
      status: 'active',
      keyID: '',
      cipher: '',
      userID,
      meta,
      isAnonymous: user?.isAnonymous,
      // TODO: Are TimelineEvents only ever visible to the user, and NOT shared?
      recipientID: [userID],
      writeID: [userID],
      adminID: [userID],
      shareID: [],
      createdAt: now,
      updatedAt: now,
      eventDate: now,
      eventType,
      v: currentSchemaVersion(),
    };
    // Save it to the DB
    trx.insert(event, data);

    return event;
  }

  static hydrate({ snapshot }: TimelineEventHydrateArgs): TimelineEvent {
    const docRef = snapshot.ref;
    let event = TimelineEvent.registry.get(docRef.id);
    if (event) {
      event.applySnapshot(snapshot);
      return event;
    }

    let parent = Vertex.get({
      // @ts-ignore
      docRef: snapshot.ref.parent.parent!,
    });

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing Timeline event ' + docRef.id);

    const { eventDate, eventType, userID, meta } = data;
    return new TimelineEvent({
      docRef: docRef,
      parent,
      eventDate,
      eventType,
      meta,
      saved: true,
      editable: userID === globalStore.getCurrentUserID(),
      status: data.status,
    });
  }
  static rawQuery({ where, orderBy, limit }: QueryArgs, parent?: Vertex) {
    let query: Query<TimelineEventDataDB> = globalStore.createQuery('event', parent?.docRef);

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

  @Guarded
  archive(trx: TrxRef) {
    globalStore.registerArchived(this.docRef);
    this.parent.events.remove(this, 'USER', { trx });
    super.archive(trx); // This does the database operation for this record
  }
  unarchive(trx: TrxRef) {
    globalStore.registerUnarchived(this.docRef);
    super.unarchive(trx); // This does the database operation for this record
    this.parent.events.insert(this, 'USER', { trx });
  }

  // @MemoizeOwned()
  static recents() {
    const userID = globalStore.getCurrentUserID();
    return globalStore
      .query<TimelineEvent>('event', null, {
        limit: 50,
        where: [
          ['eventType', 'in', ['visited']],
          ['userID', '==', userID],
          ['status', '==', 'active'],
        ],
        orderBy: ['eventDate', 'desc'],
      })
      .sortObs((a, b) => globalStore.compareTimestamps(b.eventDate, a.eventDate))
      .want();
  }

  // @MemoizeOwned()
  static dedupedEventVertices() {
    return TimelineEvent.recents()
      .reduceObs<Record<string, Vertex>>(
        (acc, val) => {
          const vertex = val.parent;
          const vertexId = vertex.id;
          acc[vertexId] = vertex;
          return acc;
        },
        () => ({}),
      )
      .mapObs((e) => Object.values(e));
  }

  // @MemoizeOwned()
  static dedupedEventVerticesListObs() {
    const v = TimelineEvent.dedupedEventVertices();
    const value = () => v.value;
    const obs = new ObservableList<Vertex>(value());
    const calc = () => obs.replaceAll(value());
    obs.managedSubscription(v, calc);
    return obs;
  }
}
