// * Useful for filtering in an async env
export async function asyncFilter<T>(arr: T[], predicate: (e: T, arrI: number) => Promise<boolean>) {
  const results: boolean[] = await Promise.all(arr.map((el, i) => predicate(el, i)));
  return arr.filter((_, index: number) => results[index]);
}
