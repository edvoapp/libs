import { IteratorType, IteratorItemBase } from './DocumentIterator';

export class MergedIterator<
  T,
  TIterators extends Record<string, AsyncIterator<IteratorItemBase<any, T>, null>> = Record<
    string,
    AsyncIterator<IteratorItemBase<any, T>, null>
  >,
> {
  currentVal: string | null = null;
  /** give this a list of iterators, where each iterator is sorted by and has a common mergeVal */
  accumulator: {
    [Property in keyof TIterators]?: IteratorItemBase<IteratorType<TIterators[Property]>, T>[];
  } = {};

  constructor(private iterators: TIterators) {}

  [Symbol.asyncIterator](): AsyncIterator<{
    [Property in keyof TIterators]?: IteratorType<TIterators[Property]>['docData'][];
  }> {
    return this;
  }

  // returns an array of
  async next() {
    type Item = {
      [Property in keyof TIterators]?: IteratorType<TIterators[Property]>['docData'][];
    };
    // Execution plan
    // loop over all of the iterators and draw an item
    // take the MINIMUM mergeVal from those. That is the currentVal.
    // then place into the output all the records for all iterators with the identical mergeVal
    // if any items are drawn with a higher value than the currentVal, hold those for the next cycle, and draw from them first

    // Get the initial currentVal
    const currentVal = await getEntries(this.iterators).reduce<Promise<T | undefined>>(
      async (memo, [key, iterator]) => {
        // Get previous result
        const currentVal = await memo;

        // Populate the accumulator
        if (!this.accumulator[key]) {
          const { value } = await iterator.next();
          if (value) {
            this.accumulator[key] = [value];
          }
        }

        // Get first item
        const item = this.accumulator[key]?.[0];

        // Test mergeVal against currentVal
        const mergeVal = item?.mergeVal;
        if (mergeVal && (!currentVal || mergeVal < currentVal)) {
          return mergeVal;
        } else {
          return currentVal;
        }
      },
      Promise.resolve(undefined),
    );

    if (currentVal === undefined) {
      // This is the end of the line - no minimum means no iterators are returning values
      return DONE;
    }

    // now that we know the current val, we simply harvest until that's exhausted
    const out = await getEntries(this.iterators).reduce<Promise<Item>>(async (memo, [key, iterator]) => {
      // Get the previous result
      const result = await memo;

      const data = [];
      while (true) {
        let items;
        if (this.accumulator[key]) {
          items = this.accumulator[key];
        } else {
          const { value } = await iterator.next();
          if (value) {
            this.accumulator[key] = [value];
          }
        }
        const item = items?.[0];

        if (item?.mergeVal === currentVal) {
          data.push(item.docData);
          this.accumulator[key] = undefined;
        } else {
          // if it doesn't match, then break for this cycle
          break;
        }
        if (!items) {
          break;
        }
      }

      return {
        ...result,
        [key]: data,
      };
    }, Promise.resolve({}));
    return Promise.resolve<IteratorYieldResult<Item>>({
      done: false,
      value: out,
    });
  }
}

const DONE = Promise.resolve<IteratorReturnResult<null>>({
  done: true,
  value: null,
});

const getEntries: {
  <T extends Record<string, any>>(o: T): [keyof T, T[keyof T]][];
} = Object.entries as any;
