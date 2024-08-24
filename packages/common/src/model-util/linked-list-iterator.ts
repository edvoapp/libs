// import { Vertex } from '../model/vertex';
// import { LinkedListObservable } from './LinkedListObservable';

// export class LinkedListIterator {
//   protected stack: Vertex[] = [];
//   constructor(protected list: LinkedListObservable) {
//     this.list = list;
//     this.stack = Array.from(list.getHeads());
//     doSort(this.stack);
//   }
//   isEmpty(): boolean {
//     return this.list.isEmpty();
//   }
//   next(): Vertex | null {
//     let item: Vertex | undefined = this.stack.pop();
//     // console.debug("Iterator.next", item || null, this.stack)

//     if (!(item instanceof Vertex)) {
//       return null;
//     }

//     let nexts = this.list.getNextParts(item.id);
//     if (nexts) {
//       const n = Array.from(nexts);
//       doSort(n); // yes we are mutating the lookup, but that's ok for sorting
//       // we want to be able to deterministically have the items occur in the same order, even if they are double-pointing "prev" for example.
//       this.stack.push(...n);
//     }
//     return item;
//   }

//   map<Ret>(f: (obj: Vertex, index: number) => Ret) {
//     let hopNumber = 0;
//     const res: Ret[] = [];
//     while (true) {
//       const next = this.next();
//       if (!next) break;
//       hopNumber += 1;
//       res.push(f.call(undefined, next, hopNumber));
//     }

//     return res;
//   }
//   collect(): Vertex[] {
//     const out: Vertex[] = [];
//     while (true) {
//       const next = this.next();
//       if (!next) break;
//       out.push(next);
//     }

//     return out;
//   }
// }

// function doSort(items: Vertex[]) {
//   items.sort((a, b) => {
//     // TODO - think about this order changing between unsaved vs saved vertexs
//     // maybe a good reason to preassign ids for unsaved stuffs

//     // Not that it really matters as long as its deterministic, but lets do a descending sort, because we're going to push/pop rather than shift/unshift
//     if (b.id > a.id) return -1;
//     if (b.id < a.id) return 1;
//     return 0;
//   });
// }
