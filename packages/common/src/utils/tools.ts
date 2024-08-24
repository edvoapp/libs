/**
 * Indicate whether all values of one array are present as values
 * in another array.
 */
export function isSubsetOf<T>(subset: T[], superset: T[]) {
  // every value of the subset is included in the superset
  return subset.every((value) => superset.includes(value));
}

/**
 * Return an array with all values common to all input arrays.
 *
 * The order of element in the returned intersection array is unspecified.
 */
export function intersection<T>(...arrs: T[][]): T[] {
  return arrs.reduce((a, b) => a.filter((c) => b.includes(c)));
}

export function arrayEquals<T>(arr1: T[], arr2: T[]) {
  const set1 = new Set<T>(arr1);
  const set2 = new Set<T>(arr2);
  if (set1.size !== set2.size) return false;
  for (const a of set1) if (!set2.has(a)) return false;
  return true;
}

/**
 * Return an array with all values that are unique to one array; i.e., no other array has
 */
export function symmetricDifference<T>(...arrs: T[][]) {
  const sets: Set<T>[] = [];
  const result: T[] = [];
  arrs.forEach((array) => {
    sets.push(new Set(array));
  });
  arrs.forEach((array) => {
    array.forEach((item, arrayIndex) => {
      let found = false;
      for (let setIndex = 0; setIndex < sets.length; setIndex++) {
        // skip the set from our own array
        if (setIndex !== arrayIndex) {
          if (sets[setIndex].has(item)) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        result.push(item);
      }
    });
  });
  return result;
}

/**
 * Indicate whether at least one common value is present in all
 * supplied arrays.
 */
export function intersects<T>(...arrs: T[][]): boolean {
  return intersection(...arrs).length > 0;
}

/**
 * Return an array containing all unique values present in the
 * supplied array.  The order of elements is unspecified.
 */
export function uniq<T>(vals: T[]): T[] {
  return Array.from(new Set<T>(vals));
}

type ValueIteratee<T> = (value: T) => unknown;

/**
 * Uniquify elements based on some characteristic, such as a property.
 * @param vals The elements to be uniquified.
 * @param iteratee function which extracts the characteristic from an element
 * @returns Array, order of elements is unspecified.
 */
export function uniqBy<T>(vals: T[], iteratee: ValueIteratee<T>): T[] {
  const s = new Set();
  const res = new Set<T>();
  for (let idx = 0; idx < vals.length; idx++) {
    const curr = vals[idx];
    const v = iteratee(curr);
    if (!s.has(v)) {
      s.add(v);
      res.add(curr);
    }
  }
  return Array.from(res);
}

/**
 * Sleep for at least `ms` milliseconds.
 *
 * Usage:
 *
 * ```sleep(500).then(() => doStuff())```
 *
 * @param ms Milliseconds, default of 1000
 * @returns a Promise
 */
export function sleep(ms = 1000, reject?: boolean): Promise<never> {
  return new Promise((resolve, rej) => {
    setTimeout(reject ? rej : resolve, ms);
  });
}

/**
 * Convert an arraybuffer to a hex string representation.
 *
 * The SubtleCrypto hashing functions from the Web Crypto API return
 * ArrayBuffers, and this function can be used to turn them into hex
 * digests.
 */
export function bufferToHex(buffer: ArrayBuffer) {
  const array = Array.from(new Uint8Array(buffer));
  return array.map((b) => b.toString(16).padStart(2, '0')).join('');
}
