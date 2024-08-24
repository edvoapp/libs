// TODO: verify we can delete
// import { Firebase, globalStore, Model, trxWrap } from '@edvoapp/common';
// import {
//   Observable,
//   useDestroyMemo,
//   useObserve,
//   useObserveValue,
// } from '@edvoapp/util';
// import cx from 'classnames';
// import { useEffect, useMemo } from 'preact/hooks';
// import {
//   BackpackIcon,
//   Tooltip,
//   TopicName,
//   useVertexBody,
//   VM,
// } from '../..';
// import { ViewportState } from '../../viewmodel';
// import './styles.scss';

// type Props = {
//   node: VM.Backpack;
// };

// const viewportState = new Observable<ViewportState>(
//   VM.DEFAULT_VIEWPORT_STATE,
// );

// export const Backpack = ({ node }: Props) => {
//   const userID = Firebase.getCurrentUserID();
//   const curUserBackpackVertex = useObserveValue(
//     () =>
//       globalStore
//         .query<Model.Vertex>('vertex', null, {
//           where: [
//             ['kind', '==', 'backpack'],
//             ['userID', '==', userID],
//           ],
//         })
//         .firstObs(),
//     [userID],
//   );

//   // null is returned if it is explicitly not found in the db
//   useEffect(() => {
//     if (curUserBackpackVertex === null) {
//       trxWrapSync((trx) => {
//         Model.Vertex.create({ trx, kind: 'backpack' });
//       });
//     }
//   }, [curUserBackpackVertex]);

//   // undefined is returned if it is not found in the database YET (but not explicity non-existent)
//   if (curUserBackpackVertex === undefined) return null;

//   // we need this here for TYPESCRIPT nonsense
//   if (curUserBackpackVertex === null) return null;

//   const { backpackNode } = useMemo(() => {
//     if (!curUserBackpackVertex) return {};
//     const context = new VM.ViewModelContext();
//     const backpackNode = VM.Backpack.new({
//       context,
//       vertex: curUserBackpackVertex,
//       parentNode: null,
//     });

//     return { backpackNode };
//   }, [curUserBackpackVertex]);

//   if (!backpackNode) return null;

//   const members = useObserveValue(() => backpackNode.members, [backpackNode]);

//   const items = members?.sort(
//     (a, b) =>
//       (a.backref.seq.value ?? -Infinity) - (b.backref.seq.value ?? Infinity),
//   );
//   const isExpanded = useObserve(() => new Observable(false), []);
//   const eventCollector = useDestroyMemo(
//     () => eventNav.getEventCollector(),
//     [eventNav],
//   );

//   return (
//     <div
//       className={'backpack-root'}
//       ref={(r: any) => {
//         eventCollector.safeBindEventContainer(r);
//         backpackNode.safeBindDomElement(r);
//       }}
//     >
//       <Tooltip
//         popperConfig={{ placement: 'left' }}
//         tooltipChildren={
//           <span>
//             Drag any item into your backpack and drop them into other spaces!
//           </span>
//         }
//       >
//         <div
//           className={'backpack-toggle'}
//           onClick={() => isExpanded.set(!isExpanded.value)}
//         >
//           <span className={'drop-text drag'}>Drag items here to add</span>
//           <span className={'drop-text drop'}>Drop items here to add</span>
//           <BackpackIcon />
//           {members.length > 0 && (
//             <div className={'member-count'}>{members.length}</div>
//           )}
//         </div>
//       </Tooltip>
//       {isExpanded.value && (
//         <div className={'backpack-members'}>
//           {items.map((memberNode) => {
//             return (
//               <BackpackMember
//                 key={memberNode.backref.target.id}
//                 {...{
//                   memberNode,
//                 }}
//               />
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// };

// type BackpackMemberProps = {
//   memberNode: VM.Member;
// };

// const BackpackMember = ({ memberNode }: BackpackMemberProps) => {
//   const { selected, focused, readonly, appearance, color, body, binding } =
//     useVertexBody({
//       memberNode,
//       viewportState,
//     });

//   const nameNode = memberNode.topicName;

//   return (
//     <div
//       className={cx(
//         'backpack-card draggable',
//         { focused, selected, readonly },
//         `appearance-${appearance?.type}`,
//       )}
//       data-cy="backpack-card"
//       /**  coding inline for ease of drag stuff */
//       style={{
//         width: 200,
//         height: 200,
//       }}
//       ref={(r: HTMLElement | null) => {
//         memberNode.safeBindDomElement(r);
//       }}
//     >
//       <div
//         className={cx('overlay', {
//           focused,
//           selected,
//         })}
//         data-cy="overlay"
//       />
//       <div className={'topic-header'}>
//         <TopicName node={nameNode} />
//       </div>
//       <div
//         id={`vertex_${memberNode.vertex.id}`}
//         className={cx('member', appearance?.type, {
//           focused,
//           selected,
//           readonly,
//         })}
//         data-cy="member"
//         style={{
//           color,
//         }}
//       >
//         {body}
//       </div>
//     </div>
//   );
// };
