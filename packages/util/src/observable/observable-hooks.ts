import { Component, ComponentChildren, ComponentType, Fragment, h } from 'preact';
import { useEffect, useMemo, useReducer } from 'preact/hooks';

import { useEdvoObj } from '../hooks';
import { IObservable, Observable } from './observable';
import { EdvoObj } from './object';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useObserve<T, U extends IObservable<T> = any>(
  factory: () => U & EdvoObj,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: ReadonlyArray<any>,
  name = 'useObserve()',
): U {
  // Tell react to re-render the component
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  // Call the factory
  let obs = useEdvoObj(() => factory(), deps, name);

  // use useMemo to ensure that we are subscribing NOW. Not at the end of the render cycle
  const unsub = useMemo(() => obs.upgrade()?.subscribe(() => forceUpdate(null)), [obs]); // Approved
  useEffect(() => {
    void obs.upgrade()?.load();
    return () => unsub?.();
  }, [obs, unsub]);

  return obs;
}

/** @deprecated use useObserve instead */
export const useObserveList = useObserve;

export function useObserveValue<T>(
  factory: () => EdvoObj & IObservable<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: ReadonlyArray<any>,
  name = 'useObserveValue()',
): T {
  const obs = useObserve(factory, deps, name);

  return obs.value;
}

export function useObserveValueMaybe<T>(
  factory: () => (EdvoObj & IObservable<T>) | undefined | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: ReadonlyArray<any>,
): T | undefined | null {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Call the factory
  let obs = useEdvoObj(() => factory(), deps);

  // use useMemo to ensure that we are subscribing NOW. Not at the end of the render cycle
  const unsub = useMemo(() => obs?.subscribe(() => forceUpdate(null)), [obs]); // Approved
  void obs?.load();

  // Call the unsubscriber on component cleanup
  useEffect(() => () => unsub?.(), [unsub]);

  return obs?.value;
}

export const ObserveValue = ({
  factory,
  deps = [],
}: {
  factory: () => Observable<ComponentChildren>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: ReadonlyArray<any>;
}) => {
  const v = useObserveValue(factory, deps);
  return h(Fragment, null, v);
};

interface ObserverHOCProps<T> {
  observable: Observable<T>;
}

interface ObserverHOCState {
  counter: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bindObservable<P extends ObserverHOCProps<any>>(Comp: ComponentType<P>) {
  return class extends Component<P, ObserverHOCState> {
    unsub = () => {};
    state = { counter: 0 };

    componentDidMount() {
      this.unsub = this.props.observable.subscribe(() => this.setState(({ counter }) => ({ counter: counter + 1 })));
    }

    componentWillUnmount() {
      this.unsub();
    }

    render(props: P) {
      return h(Comp, props);
    }
  };
}
