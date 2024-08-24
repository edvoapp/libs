// import { ComputedContext } from './computed-context';
// import { Observable } from './observable';

// export class Computed<T> extends Observable<T> {
//   context: ComputedContext = new ComputedContext();
//   protected inner: () => T;

//   constructor(inner: () => T) {
//     super();
//     this.inner = inner;
//   }

//   protected getValue(): T {
//     const { context, result } = ComputedContext.PushContext(this.inner);
//     context.observable = this;
//     return result;
//   }
// }
