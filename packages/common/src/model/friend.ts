import { globalStore, QueryArgs } from '../dataset';
import { DocumentReference, Query, Timestamp } from '../dataset/store/db';
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
import * as Analytics from '../lytics';

// What's actually stored in the DB
export interface FriendDataDB extends BaseData {
  targetUserID: string;
  lastSelectedTime: Timestamp;
  nickname: string;
  keywords: string[];
}

interface FriendConstructorArgs extends Omit<EntityConstructorArgs<FriendDataDB>, 'editable'> {
  docRef: DocumentReference<FriendDataDB>; // Base considers this optional
  data?: FriendDataDB;
  targetUserID: string;
}

export interface FriendCreateArgs extends EntityCreateArgs {
  targetUserID: string;
  nickname: string;
}

export interface FriendHydrateArgs extends EntityHydrateArgs<FriendDataDB> {
  //targetUserID: string;
  //lastSelectedTime: Timestamp;
  //nickname: string;
}

export class Friend extends Entity<FriendDataDB> {
  readonly type = 'friend';
  private static registry = new Registry<Friend>();
  targetUserID: string;

  private constructor(args: FriendConstructorArgs) {
    super({ ...args, editable: false });
    this.targetUserID = args.targetUserID;
    Friend.registry.add_or_throw(args.docRef.id, this, 'Attempt to register duplicate Friend');
  }

  // TODO: we technically don't need the nickname because we should be able to query it from the
  // target user ID, but that would make this function async, and I don't know if we want that.

  /**
   * Creates a new Friend record in the database.
   *
   * @param trx: TrxRef
   * @param targetUserID: string
   * @param nickname: string
   */
  static create({ trx, targetUserID, nickname, subUserID }: FriendCreateArgs): Friend {
    const docRef = globalStore.createDocRef<FriendDataDB>('friend');

    const friend = new Friend({
      docRef: docRef,
      saved: false,
      targetUserID,
      status: 'active',
      subUserID,
    });

    const now = trx.now();

    const userID = globalStore.getCurrentUserID();
    const data: FriendDataDB = {
      id: docRef.id,
      status: 'active',
      userID,
      subUserID,
      createdAt: now,
      updatedAt: now,
      v: currentSchemaVersion(),
      targetUserID,
      lastSelectedTime: now,
      nickname,
      keywords: nickname.toLowerCase().split(' '),
    };
    // Save it to the DB
    trx.insert(friend, data);
    Analytics.event('friend-creation', {});
    return friend;
  }

  static hydrate({ snapshot }: FriendHydrateArgs): Friend {
    const docRef = snapshot.ref;
    let friend = Friend.registry.get(docRef.id);
    if (friend) {
      friend.applySnapshot(snapshot);
      return friend;
    }

    const data = snapshot.data();
    if (!data) throw new Error('Error deserializing friend ' + docRef.id);

    return new Friend({
      docRef: docRef,
      saved: true,
      targetUserID: data.targetUserID,
      status: data.status,
      subUserID: data.subUserID,
    });
  }

  /**
   * Call whenever someone clicks on their friend to create a new share record.
   * @param trx
   */
  accessTouch(trx: TrxRef) {
    const now = trx.now();
    trx.update(this, { lastAccessedAt: now });
  }

  static rawQuery({ where, orderBy, limit }: QueryArgs): Query<FriendDataDB> {
    let query: Query<FriendDataDB> = globalStore.createQuery('friend');

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

  static async findFriendByTargetUserID({ userID }: { userID: string }): Promise<Friend | null> {
    const query = Friend.rawQuery({ where: [['targetUserID', '==', userID]] });
    const qsnapshot = await query.get();
    if (qsnapshot.empty) return null;
    const snapshot = qsnapshot.docs[0];
    return Friend.hydrate({ snapshot });
  }

  static async searchFriendsByNickname({ nickname }: { nickname: string }): Promise<Friend[]> {
    // TODO: handle non-english characters
    // ü -> u
    // á -> a
    const search = nickname.toLowerCase().split(' ');
    const query = Friend.rawQuery({
      where: [
        ['keywords', 'array-contains-any', search],
        //['nickname', '<=', nickname + '\uf8ff'],
      ],
      //orderBy: ['nickname'],
      limit: 5,
    });
    const qsnapshot = await query.get();
    return qsnapshot.docs.map((snapshot) => Friend.hydrate({ snapshot }));
  }
}
