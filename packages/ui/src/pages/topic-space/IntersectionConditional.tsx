// import { VM, uiParams } from '../..';
// import { Observable, useObserveValue } from '@edvoapp/util';

// type Props = {
//   subject: Observable<BoundingBox>;
//   context: Observable<BoundingBox>;
//   children: JSX.Element;
// };

// export const IntersectionConditional = ({
//   subject,
//   context,
//   children,
// }: Props) => {
//   const visible = useObserveValue(() => {
//     const obs = new Observable(false);
//     let timer: ReturnType<typeof setTimeout> | undefined;
//     const update = () => {
//       const intersects = positionIntersects(subject.value, context.value);
//       if (intersects) {
//         // Set it to visible
//         if (timer) {
//           clearTimeout(timer);
//           timer = undefined;
//         }
//         obs.set(true);
//       } else if (obs.value) {
//         // it was visible, but no longer intersects
//         if (!timer && typeof uiParams.memberCullTimeout !== 'undefined') {
//           // set to undefined to disable culling alltogether
//           // we want to cull
//           timer = setTimeout(() => {
//             obs.set(false);
//             timer = undefined;
//           }, uiParams.memberCullTimeout * 1000);
//         }
//       }
//     };
//     obs.managedSubscription(subject, () => update())
//     obs.managedSubscription(context, () => update())
//     update();
//     return obs;
//   }, [subject, context]);

//   if (!visible) return null;

//   return children;
// };
