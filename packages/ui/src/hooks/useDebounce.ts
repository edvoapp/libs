import { useEffect } from 'preact/hooks';
import { useTimeoutFn } from './useTimeoutFn';

export type UseDebounceReturn = [() => boolean | null, () => void];

export function useDebounce(fn: Function, ms = 0, deps: ReadonlyArray<unknown> = []): UseDebounceReturn {
  const [isReady, cancel, reset] = useTimeoutFn(fn, ms);
  useEffect(reset, deps);
  return [isReady, cancel];
}
