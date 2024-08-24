/**
 * Sleep for at least `ms` milliseconds.
 *
 * Usage:
 *
 * ```sleep(500).then(() => doStuff())```
 * ```sleep(500, true).catch(() => doStuff())```
 *
 * @param ms Milliseconds, default of 1000
 * @param reject Boolean, default false. If set to true, the promise will reject after the specified time.
 * @returns a Promise
 */
export function sleep(ms = 1000, reject?: boolean): Promise<never> {
  return new Promise((resolve, rej) => {
    setTimeout(reject ? () => rej(`Timeout of ${ms}ms exceeded`) : resolve, ms);
  });
}

export function sleepWithCancel(
  ms = 1_000,
  reject?: boolean,
  errMessage?: string,
): { promise: Promise<never>; cancel: () => void } {
  let timerId: number;
  const promise = new Promise<never>((resolve, rej) => {
    timerId = setTimeout(reject ? () => rej(errMessage ?? `Timeout of ${ms}ms exceeded`) : resolve, ms);
  });

  return { promise, cancel: () => clearTimeout(timerId) };
}

export async function race<T>(prom: Promise<T>, ms = 1000, reject?: boolean): Promise<T | never> {
  const { promise: timeoutPromise, cancel } = sleepWithCancel(ms, reject);
  let r = await Promise.race([prom, timeoutPromise]);
  cancel();
  return r;
}

export async function raceOrFail<T>(prom: Promise<T>, errMessage: string, ms = 1000) {
  const { promise: timeoutPromise, cancel } = sleepWithCancel(ms, true, errMessage);
  let r = await Promise.race([prom, timeoutPromise]);
  cancel();
  return r;
}
