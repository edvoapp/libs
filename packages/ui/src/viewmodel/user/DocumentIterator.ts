import { Model, DB } from '@edvoapp/common';

/** Get the Doc Iterator Type */
export type IteratorType<TIterator> = TIterator extends AsyncIterator<infer TType, any> ? TType : never;

export interface IteratorItemBase<TBaseDataDB, T> {
  mergeVal: T;
  docData: TBaseDataDB;
}

/** A wrapper for mergeable iterator items */
export interface IteratorItem<TBaseDataDB, TKey extends keyof TBaseDataDB>
  extends IteratorItemBase<TBaseDataDB, TBaseDataDB[TKey]> {
  mergeVal: TBaseDataDB[TKey];
  docData: TBaseDataDB;
}

/** An implementation of IteratorItem for DocumentIterator */
export class DocIteratorItem<TBaseDataDB extends Model.data.BaseData, TKey extends keyof TBaseDataDB>
  implements IteratorItem<TBaseDataDB, TKey>
{
  mergeVal: TBaseDataDB[TKey];
  docData: TBaseDataDB;

  constructor(doc: DB.DocumentSnapshot<TBaseDataDB>, mergeKey: TKey) {
    const data = doc.data();
    if (!data) {
      throw 'Does not exist';
    }
    this.mergeVal = data[mergeKey];
    this.docData = data;
  }
}

/** Iterates over Documents by returning IteratorItem objects */
export class DocumentIterator<TBaseDataDB extends Model.data.BaseData, TKey extends keyof TBaseDataDB> {
  currentSnapshot: DB.DocumentSnapshot<TBaseDataDB>[] | null = null;
  currentIndex = 0;
  lastDoc: DB.DocumentSnapshot<TBaseDataDB> | null = null;

  constructor(private query: DB.Query<TBaseDataDB>, private mergeKey: TKey) {}

  [Symbol.asyncIterator](): AsyncIterator<DocIteratorItem<TBaseDataDB, TKey>, null> {
    return this;
  }

  async next() {
    if (!this.currentSnapshot) {
      // Get the first page of Documents
      this.currentSnapshot = (await this.query.get()).docs;
    }
    if (this.currentSnapshot && this.currentSnapshot.length) {
      // There is a page of Documents to iterate
      const doc = this.currentSnapshot[this.currentIndex];
      if (!doc) {
        // There are no Documents left in the page
        // Try getting another page
        this.currentSnapshot = (await this.query.startAfter(this.lastDoc).get()).docs;
        this.currentIndex = 0;
      }
      // Get the current Document
      this.lastDoc = this.currentSnapshot[this.currentIndex];
      if (!this.lastDoc) {
        // There are no Documents to iterate
        return DONE;
      } else {
        this.currentIndex++;
        // Return the current Document
        return Promise.resolve<IteratorYieldResult<IteratorItem<TBaseDataDB, TKey>>>({
          done: false,
          value: new DocIteratorItem(this.lastDoc, this.mergeKey),
        });
      }
    } else {
      return DONE;
    }
  }
}

const DONE = Promise.resolve<IteratorReturnResult<null>>({
  done: true,
  value: null,
});
