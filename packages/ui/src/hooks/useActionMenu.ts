// import { VertexDataDB } from '@edvoapp/common';
// import { useCallback, useState } from 'preact/hooks'; // Approved

// export interface MenuItem {
//   id: string;
//   label: string;
//   tier: number;
//   handleSelect?: Function;
// }

// function wrapMenu(index: number, length: number, direction: -1 | 1): number {
//   if (direction === -1) {
//     return index <= 0 ? length - 1 : index - 1;
//   } else if (direction === 1) {
//     return index >= length - 1 ? 0 : index + 1;
//   }
//   throw new Error(`Invalid direction: ${direction}`);
// }

// export function useActionMenu(value: string, menuItems: MenuItem[]) {
//   const [focusIndex, setFocusIndex] = useState(-1); // Approved

//   const handleKeyDown = useCallback(
//     (event: KeyboardEvent) => {
//       if (value === '') {
//         switch (event.key) {
//           case 'ArrowUp':
//           case 'Up':
//             if (focusIndex > -1) {
//               event.preventDefault();
//               event.stopPropagation();
//               event.stopImmediatePropagation();
//               setFocusIndex((focus) => {
//                 let next = wrapMenu(focus, menuItems.length, -1);
//                 let nextItem = menuItems[next];
//                 while (!nextItem.handleSelect) {
//                   next = wrapMenu(next, menuItems.length, -1);
//                   nextItem = menuItems[next];
//                 }
//                 return next;
//               });
//             }
//             break;
//           case 'ArrowDown':
//           case 'Down':
//             if (focusIndex > -1) {
//               event.preventDefault();
//               event.stopPropagation();
//               event.stopImmediatePropagation();
//               setFocusIndex((focus) => {
//                 let next = wrapMenu(focus, menuItems.length, 1);
//                 let nextItem = menuItems[next];
//                 while (!nextItem.handleSelect) {
//                   next = wrapMenu(next, menuItems.length, 1);
//                   nextItem = menuItems[next];
//                 }
//                 return next;
//               });
//             }
//             break;
//           case 'Enter':
//             if (focusIndex > -1) {
//               if (focusIndex !== -1) {
//                 event.preventDefault();
//                 event.stopPropagation();
//                 event.stopImmediatePropagation();
//                 const item = menuItems[focusIndex];
//                 if (item.handleSelect) {
//                   item.handleSelect();
//                   setFocusIndex(-1);
//                 }
//               }
//             }
//             break;
//           case 'Backspace':
//             if (focusIndex > -1) {
//               event.preventDefault();
//               event.stopPropagation();
//               event.stopImmediatePropagation();
//             }
//             break;
//           case '/':
//             event.preventDefault();
//             event.stopPropagation();
//             event.stopImmediatePropagation();
//             // hard coding this for now -- ideally it'd be smart enough
//             let next = wrapMenu(0, menuItems.length, 1);
//             let nextItem = menuItems[next];
//             while (!nextItem.handleSelect) {
//               next = wrapMenu(next, menuItems.length, 1);
//               nextItem = menuItems[next];
//             }
//             setFocusIndex(next);
//             break;
//           case 'Escape':
//             event.preventDefault();
//             event.stopPropagation();
//             event.stopImmediatePropagation();
//             setFocusIndex(-1);
//             break;
//           default:
//             // NOTE: any key not handled here MUST be allowed to propagate to the evtnav, otherwise navigation doesn't work properly
//             break;
//         }
//       }
//     },
//     [value, focusIndex, menuItems],
//   );

//   return { handleKeyDown, focusIndex, setFocusIndex };
// }

// <div class={cx(['action-menu'], focusIndex > -1 && ['action-menu_open'])}>
// {actionMenuItems.map((menuItem, index) => {
//   return (
//     <div
//       className={cx('action-menu--item', {
//         focused: focusIndex === index,
//         clickable: !!menuItem.handleSelect,
//       })}
//       onMouseOver={() => {
//         if (menuItem.handleSelect) {
//           setFocusIndex(index);
//         }
//       }}
//       key={menuItem.id}
//       style={{
//         paddingLeft: 8 + menuItem.tier * 12,
//       }}
//       onClick={() => menuItem.handleSelect?.()}
//     >
//       {menuItem.label}
//     </div>
//   );
// })}
// </div>

// const actionMenuItems: MenuItem[] = [
//   {
//     id: 'addMentalModel',
//     label: 'Add Mental Model:',
//     tier: 0,
//   },
//   {
//     id: 'comprehension',
//     label: 'Comprehension',
//     tier: 1,
//     handleSelect: async () => {
//       const entity = await vertex.getEdgeTarget(['category-item']);
//       if (entity) {
//         await trxWrap(async (trx) => {
//           await vertex.departAndCleanupNeighbors(trx, 'category');
//           vertex.archive(trx);
//         });
//         let firstChildVertex: Model.Vertex | null = null;
//         await applyInjections({
//           entity,
//           renderMode: 'category',
//           afterCreate: (vertex: Model.Vertex) => {
//             if (!firstChildVertex) {
//               nodeBinding.renderCtx.evtNav.focusVertex(vertex);
//               firstChildVertex = vertex;
//             }
//           },
//           injections: [
//             {
//               vertex: Model.Vertex.getById({ id: 't4xXrTsWhI6Wv4vHv9dw' }),
//               // behaves like an item, but is a "template"
//               role: 'category-embed',
//             },
//           ],
//         });

//         track('inject_template', { template: 'mental_models' });
//       }
//     },
//   },
// ];
