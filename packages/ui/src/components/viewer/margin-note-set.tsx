// import { getRolesFromRoleBase, Referenceable } from '@edvoapp/common';

// import { useObservable } from '@edvoapp/util';
// import './annotation.scss';
// import { MarginNote } from './margin-note';

// export interface MarginNoteSetProps {
//   entity: Referenceable;
// }

// export function MarginNoteSet({ entity }: MarginNoteSetProps) {
//   const roles = getRolesFromRoleBase('response-topic');
//   const children = entity.children(roles);
//   useObservable(children);

//   const marginNotes = children.map((vertex) => {
//     return <MarginNote key={vertex.key()} vertex={vertex}></MarginNote>;
//   });

//   return (
//     <div id={'margin-note-set__' + entity.key()} className="margin-note-set">
//       {marginNotes}
//     </div>
//   );
// }

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
