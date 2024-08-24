import { Model } from '@edvoapp/common';
// import { RenderContext, Renderer } from './renderer/renderer';

export interface HighlightMarginNoteSetProps {
  vertex: Model.Vertex;
  // renderer: Renderer;
  // renderContext: RenderContext;
  omitBody?: boolean;
  omitLeadingTrailing?: boolean;
}

export function MarginNoteSet({
  vertex,
  // renderer,
  // renderContext,
  omitBody,
  omitLeadingTrailing,
}: HighlightMarginNoteSetProps) {
  // let body;
  // if (!omitBody) {
  //   const parts = vertex.parts.value();
  //   if (parts) {
  //     body = parts.sort(compareProperties('contentType')).map((part) => {
  //       // don't render highlight leading text
  //       if (
  //         omitLeadingTrailing &&
  //         intersects(part.role.peek_or_throw('Part role should exist'), [
  //           'highlight_leading_text',
  //           'highlight_trailing_text',
  //         ])
  //       ) {
  //         return null;
  //       }
  //       return <PropertyComponent key={part.id} part={part} />;
  //     });
  //   }
  // }
  //   const children = renderer.useRenderChildren(vertex, renderContext);
  //   return (
  //     <div id={'vertex__' + vertex.key()} className="vertex-component">
  //       {body}
  //       {children}
  //     </div>
  //   );
}

// AUDIT ABOVE TO MAKE SURE IT DOES THE RIGHT THING
// {inline
//   ? parts.sort(compareProperties('contentType')).map((e) => {
//     const entityID = e.id
//     return (
//       <PropertyComponent
//         key={e.key()}
//         // vertex={entity as Vertex}
//         part={e}
//         path={[entity.id || '', entityID]}
//       />
//     )
//   })
//   : null}
