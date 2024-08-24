// import { Model, trxWrap } from '@edvoapp/common';
// import {
//   useObserveValue,
//   useObserve,
//   Observable,
//   ObservableList,
//   useObserveList,
// } from '@edvoapp/util';
// import { ComponentChildren } from 'preact';
// import { useCallback, useEffect, useState, useMemo } from 'preact/hooks'; // Approved
// import { VertexComponent } from '../component/bullet-component';
// import { FormTextarea } from '../..';
// import { EventNav, useDebounce, useNavigator, NodeBinding } from '../../..';
// import { Behavior } from '../../../behaviors';
// import { RenderContext, Renderer } from './renderer';
// import cx from 'classnames';

// export class StandardRenderer extends Renderer {
//   entityRole = 'bullet';

//   // This, AND the logic to query backrefs based on dependent roles has to move to VertexNode
//   // getRenderChildren(entity: Model.Vertex): ObservableList<Model.Backref> {
//   //   // This flag stays the same for the life of the renderer
//   //   const itemRole = [`${this.roleBase}-item`];
//   //   return entity.filterBackrefs(itemRole);
//   // }

//   useRender(
//     entity: Model.Vertex,
//     renderChildren: ObservableList<Model.Backref> | null,
//     parentBinding: NodeBinding,
//     eventNav: EventNav,
//   ): ComponentChildren {
//     if (!this.recurse) return <></>;

//     const items = renderChildren?.value.sort(
//       (a, b) => (a.seq.value || Infinity) - (b.seq.value || Infinity),
//     );
//     const itemRole = [`${this.roleBase}-item`];

//     const reify = useCallback(
//       (v: string) => {
//         if (v.length > 0) {
//           void trxWrap(async (trx) => {
//             const firstVertex = Model.Vertex.create({ trx });
//             firstVertex.createProperty({
//               trx,
//               role: ['body'],
//               contentType: 'text/plain',
//               content: v,
//             });
//             firstVertex.createEdge({
//               trx,
//               target: entity,
//               role: itemRole,
//               seq: 1,
//               meta: {},
//             });
//             eventNav.focusVertex(firstVertex, 1);
//           });
//         }
//       },
//       [entity],
//     );

//     let out = items?.map((child, i) => (
//       <VertexComponent
//         key={`${child.target.id}_${i}`}
//         eventNav={eventNav}
//         renderer={this}
//         parentBinding={parentBinding}
//         vertex={child.target}
//         backref={child}
//       />
//     ));

//     if (out?.length) {
//       return <div className={this.relationClass}>{out}</div>;
//     } else if (parentBinding.role === 'topic-outline') {
//       // TODO - create EmptyVertex class that does this
//       return (
//         <div className={cx(this.relationClass, 'blank')}>
//           <div className="vertex-component is-active">
//             <div className="main">
//               <div className="controls">
//                 <div className="handle" />
//               </div>
//               <div className="body">
//                 <div className="textarea-component-wrapper">
//                   <FormTextarea
//                     textareaCx="textarea-component focus-target"
//                     value=""
//                     style={{
//                       border: 'none',
//                       background: 'none',
//                       fontSize: 14,
//                       lineHeight: '17px',
//                       letterSpacing: '0.02em',
//                       color: '#151515',
//                       padding: 0,
//                       fontFamily: 'inherit',
//                       resize: 'none',
//                       outline: 'none',
//                       width: '100%',
//                     }}
//                     onInput={(e) => reify(e.currentTarget.value)}
//                     onSubmit={(e) => e.preventDefault()}
//                     placeholder="Start typing or press /"
//                   />
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       );
//     }
//     return null;
//   }
// }
