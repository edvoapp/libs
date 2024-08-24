import { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export function useClickAway<E extends Event = Event>(
  ref: RefObject<HTMLElement | null>,
  onClickAway: (event: E) => void,
  events: string[] = ['mousedown', 'touchstart'],
) {
  const cb = useRef(onClickAway);

  useEffect(() => {
    // ensures that if onClickAway ever changes, we have the original one saved
    cb.current = onClickAway;
  }, [onClickAway]);

  useEffect(() => {
    function handler(evt: Event) {
      const elm = ref.current;
      const target = evt.target;
      if (elm && target instanceof Node && !elm.contains(target)) {
        cb.current(evt as E);
      }
    }

    for (const evt of events) {
      document.addEventListener(evt, handler);
    }
    return () => {
      for (const evt of events) {
        document.removeEventListener(evt, handler);
      }
    };
  }, [events, ref]);
}
