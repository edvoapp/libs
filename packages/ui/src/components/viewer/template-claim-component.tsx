// // TODO: check if we can safely delete this
// import { Model } from '@edvoapp/common';
// import { Observable, useObserve, useObserveValue } from '@edvoapp/util';
// import cx from 'classnames';
// import { Fragment } from 'preact';
// import { useMemo } from 'preact/hooks'; // Approved
// import { RenderContext, Renderer } from './renderer/renderer';
// import './viewer.scss';

// export interface VertexComponentProps {
//   vertex: Model.Vertex;
//   readonly?: boolean;
//   shadowParent?: Model.Vertex; // This needs a better name - it's both a flag to say "you're unshadowed" and also the parent of the parent user vertex
//   renderer: Renderer;
//   renderContext: RenderContext;
// }

// export type RenderedVertex = {
//   vertex: Model.Vertex;
//   shadowParent?: Model.Vertex;
// };

// export function TemplateVertexComponent({ vertex, renderer, renderContext }: VertexComponentProps) {
//   const isFocused = useObserve(() => new Observable(false), [vertex]) as Observable<boolean>;
//   const meta = useObserveValue(() => vertex.meta.want(), [vertex]);

//   const wrapperCx = useMemo(() => {
//     return cx(
//       'focusable',
//       `vertex-component`,
//       renderContext.extraClass,
//       meta?.customClass,
//       isFocused.value && 'is-active',
//       // `local-status__${vertex.localStatus}`,
//     );
//   }, [meta, isFocused.value]);

//   return (
//     <Fragment>
//       <div
//         id={'vertex__' + vertex.id}
//         className={wrapperCx}
//         ref={(r: any) => {
//           // renderContext.evtNav.bindComponent(r, {
//           //   entity: vertex,
//           //   renderCtx: renderContext,
//           //   isFocused,
//           // })
//         }}
//       >
//         <div className="main">
//           <div className="controls">
//             <div className="handle" />
//             {/* {vertex.id?.substr(0, 4)} */}
//           </div>
//           <div className="body">
//             {/*<BodyComponent vertex={vertex} rootType="quest" renderContext={renderContext} />*/}
//           </div>
//         </div>
//         {renderer.useRenderChildren(vertex, renderContext)}
//       </div>
//     </Fragment>
//   );
// }
