// import { useEffect, useReducer } from 'preact/hooks';

// import { useDestroyMemo } from '../hooks';

// import { Computed } from './computed';

// export function useComputed<T>(inner: () => T, deps: any[]) {
//   const [, forceUpdate] = useReducer((x) => x + 1, 0);

//   const computed = useDestroyMemo(() => {
//     return new Computed(inner);
//   }, [inner, ...deps]);

//   useEffect(() => {
//     const unsubscribe = computed.subscribe(() => forceUpdate(null));
//     return () => {
//       unsubscribe();
//     };
//   }, [computed]);

//   return computed.read;
// }
