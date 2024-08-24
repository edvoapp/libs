// import { MemoizeWeak } from './memoize-weak';
// import { EdvoObjShared } from './object';

// describe('MemoizeWeak', () => {
//   class TestObj extends EdvoObjShared {
//     constructor(public name: string) {
//       super();
//     }
//   }

//   class Test {
//
//     test() {
//       return new TestObj('');
//     }
//   }

//   it('should return an EdvoObjShared', () => {
//     const test = new Test();
//     const obj = test.test();

//     expect(obj).toBeInstanceOf(TestObj);
//   });

//   it('should return one instance of EdvoObjShared', () => {
//     const test = new Test();
//     const obj0 = test.test();
//     const obj1 = test.test();

//     expect(obj0).toBe(obj1);
//   });

//   it('should attach to instances', () => {
//     class Test {
//       constructor(public name: string) {}

//
//       test() {
//         return new TestObj(this.name);
//       }
//     }

//     const testA = new Test('a');
//     const testB = new Test('b');

//     const handle0 = testA.test();
//     const handle1 = testB.test();

//     expect(handle0.ref.name).toBe('a');
//     expect(handle1.ref.name).toBe('b');
//   });

//   it('should attach to properties', () => {
//     class Test {
//       constructor(public nameA: string, public nameB: string) {}

//
//       testA() {
//         return new TestObj(this.nameA);
//       }

//       testB() {
//         return new TestObj(this.nameB);
//       }
//     }

//     const test = new Test('a', 'b');

//     const handle0 = test.testA();
//     const handle1 = test.testB();

//     expect(handle0.ref.name).toBe('a');
//     expect(handle1.ref.name).toBe('b');
//   });
// });
