import { JsObservable } from '@edvoapp/wasm-bindings';
import { useEffect, useMemo, useRef } from 'preact/hooks'; // Approved
import { Destroy } from './destroy';
import { EdvoObj, Guard } from './observable';

type Deps = ReadonlyArray<unknown>;

interface Referent {
  registerReferent(referent: Object);

  deregisterReferent(obj: Object);
}

// TODO: Restore the type requirement
export const useEdvoObj = <S extends EdvoObj | null | undefined>(
  factory: () => S,
  deps: Deps = [],
  name = 'useEdvoObj()',
): S => {
  // Need a unique object reference for this component

  const ref = useMemo(() => ({}), []); // Approved
  const val = useMemo(factory, deps); // Approved

  useEffect(() => {
    let guard: Guard | undefined;

    const edvoObj = val?.upgrade();
    if (edvoObj) {
      guard = Guard.unsafe(edvoObj);
    }

    return () => {
      if (guard) {
        guard?.release();
      }
    };
  }, [val]);
  return val;
};

export const useDestroyMemo = <S extends Destroy | null | undefined | JsObservable>(
  factory: () => S,
  deps: Deps = [],
): S => {
  const val = useMemo(factory, deps); // Approved

  useEffect(() => {
    return () => val?.destroy(); // Approved
  }, [val]);

  return val;
};

export const useTrackChanges = (label: string, obj: Record<string, any>) => {
  Object.entries(obj)
    .sort(([a], [b]) => {
      if (a > b) return 1;
      if (a < b) return -1;
      return 0;
    })
    .forEach(([k, v]) => {
      let oldval = useRef(undefined);
      useEffect(() => {
        console.log(`(${label}) Change detected on ${k}: was`, oldval.current, `now `, v);
        oldval.current = v;
      }, [v]);
    });
};
