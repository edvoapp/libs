// import { Computed } from './computed';
// import { Observable } from './observable';

// describe('Computed', () => {
//   it('should subscribe to ObservableBase values', () => {
//     const observableA = new Observable('a');
//     const observableB = new Observable('b');
//     const computed = new Computed(() => {
//       return observableA.read + observableB.read;
//     });
//     expect(computed.read).toBe('ab');
//     observableA.set('c');
//     expect(computed.read).toBe('cb');
//   });
// });
