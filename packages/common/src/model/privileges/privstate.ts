import { globalShareCache, Share } from './share';
import { InheritedPrivs, InheritedPrivsTuple } from '.';
import equal from 'fast-deep-equal';
import { uniq } from '../../utils';
import { globalStore } from '../../dataset';

export interface PrivRecordData {
  recipientID: string[];
  writeID: string[];
  adminID: string[];
  shareID: string[];
}

type CreateArgs = {
  recipientID: string[];
  writeID: string[];
  adminID: string[];
  shares: Share[];
};

type CA = {
  recipientID: string[];
  writeID: string[];
  adminID: string[];
  shareID: string[] | undefined;
  shares: Share[] | undefined;
};

export class PrivState {
  readonly recipientID: string[];
  readonly writeID: string[];
  readonly adminID: string[];
  private shareID?: string[];

  shares?: Share[];
  private constructor({ recipientID, writeID, adminID, shareID, shares }: CA) {
    this.recipientID = recipientID;
    this.writeID = writeID;
    this.adminID = adminID;
    this.shareID = shareID;
    this.shares = shares;

    void this.load();
  }

  static create(args: CreateArgs): PrivState {
    return new PrivState({ ...args, shareID: undefined });
  }
  get loaded() {
    return !!this.shares;
  }

  _loadPromise?: Promise<void>;
  async load() {
    if (this.shares) return;
    if (this._loadPromise) {
      await this._loadPromise;
      return;
    }

    let resolve: () => void;
    this._loadPromise = new Promise((r) => {
      resolve = r;
    });

    this.shares = await globalShareCache.get(this.shareID ?? []);

    resolve!();
  }

  merge(other: PrivState): PrivState {
    const { recipientID, writeID, adminID, shares } = this;
    return PrivState.create({
      recipientID: uniq([...recipientID, ...other.recipientID]),
      writeID: uniq([...writeID, ...other.writeID]),
      adminID: uniq([...adminID, ...other.adminID]),
      shares: uniq([...(shares ?? []), ...(other.shares ?? [])]),
    });
  }

  static default(userID: string = globalStore.getCurrentUserID()) {
    return new PrivState({
      recipientID: [userID], // Default to me
      writeID: [userID], // Default to me
      adminID: [userID], // Default to me
      shareID: undefined, //no share id,
      shares: [],
    });
  }
  static read(userID: string = globalStore.getCurrentUserID(), recipientIDs: string[]) {
    return new PrivState({
      recipientID: [userID, ...recipientIDs],
      writeID: [userID],
      adminID: [userID],
      shareID: undefined,
      shares: [],
    });
  }

  static defaultPublicReadonly() {
    const userID = globalStore.getCurrentUserID();
    return new PrivState({
      recipientID: ['PUBLIC'],
      writeID: [userID], // Default to me
      adminID: [userID], // Default to me
      shareID: undefined, //no share id,
      shares: [],
    });
  }

  static defaultPublicEdit() {
    const userID = globalStore.getCurrentUserID();
    return new PrivState({
      recipientID: ['PUBLIC'],
      writeID: ['PUBLIC'],
      adminID: [userID], // Default to me
      shareID: [], //no share id,
      shares: [],
    });
  }

  static fromData({ recipientID, writeID, adminID, shareID }: PrivRecordData): PrivState {
    return new PrivState({
      recipientID,
      writeID,
      adminID,
      shareID,
      shares: undefined, // not loaded yet
    });
  }

  static fromInherited(inh: InheritedPrivs): PrivState {
    const recipientID: Set<string> = new Set();
    const writeID: Set<string> = new Set();
    const adminID: Set<string> = new Set();
    const shares: Set<Share> = new Set();

    const { read, write, admin } = inh;

    const transform = (collection: InheritedPrivsTuple[]) => (targetSet: Set<string>) => {
      collection.forEach((el) => {
        targetSet.add(el.userID);
        shares.add(el.share);
      });
    };

    transform(read)(recipientID);
    transform(write)(writeID);
    transform(admin)(adminID);

    return PrivState.create({
      recipientID: [...recipientID, ...writeID, ...adminID],
      writeID: [...writeID, ...adminID],
      adminID: [...adminID],
      shares: [...shares],
    });
  }

  data(): PrivRecordData {
    return {
      recipientID: this.recipientID,
      writeID: this.writeID,
      adminID: this.adminID,
      shareID: this.shares?.map((s) => s.id) ?? this.shareID ?? [],
    };
  }

  equal(other: PrivState) {
    return equal(this.data(), other.data());
  }

  addUser(userID: string): PrivState {
    return new PrivState({
      recipientID: [...new Set([...this.recipientID, userID])],
      writeID: [...new Set([...this.writeID, userID])],
      adminID: [...new Set([...this.adminID, userID])],
      shareID: this.shareID,
      shares: this.shares,
    });
  }
}
