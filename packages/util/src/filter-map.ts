export function filterMap<T, U>(
  arr: T[],
  mapFn: (arg: T, idx: number) => U,
  filterFn: (arg: U, idx: number) => boolean,
): U[] {
  return arr.reduce<U[]>((acc, v, idx) => {
    const val = mapFn(v, idx);
    const filteredVal = filterFn(val, idx);
    if (filteredVal) {
      acc.push(val);
    }
    return acc;
  }, []);
}
