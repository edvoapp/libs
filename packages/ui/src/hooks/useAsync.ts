import { useEffect } from 'preact/hooks';
import { useAsyncFn } from './useAsyncFn';
import { FunctionReturningPromise } from './types';

export type { AsyncState, AsyncFnReturn } from './useAsyncFn';

export function useAsync<T extends FunctionReturningPromise>(fn: T, deps: any[] = []) {
  const [state, callback] = useAsyncFn(fn, deps, {
    loading: true,
  });

  useEffect(() => {
    callback();
  }, [callback]);

  return state;
}
