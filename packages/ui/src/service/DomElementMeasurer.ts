export {};
// TODO - split out measurement/on paint bindings from usePhantom and put them here

// import { Observable } from "@edvoapp/common";

// export type DomElementMeasureMent = {
//     // x,y, scrollX, scrollY, background-color...
// }

// export class DomElementMeasurer extends Observable<DomElementMeasureMent>{

//     measure() {
//         const left = horizontalLineDimensions.left - scroll.x - (centerOfGravity === 'left' ? divContainerRect.width : 0);
//         const top = horizontalLineDimensions.top - scroll.y;

//         return {
//             left,
//             top,
//             // transform: `translate3d(${x}px, ${y}px, 0)`,
//             width: horizontalLineDimensions.width + divContainerRect.width,
//         };
//     }
//     bind(ref: HTMLDivElement | null) { }
//     something() {
//         if (true) {
//             this.notify()
//         }
//     }
// }
