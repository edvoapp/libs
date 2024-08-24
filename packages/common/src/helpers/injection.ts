// import { Vertex } from "../model";
// import { LinkedListMutation } from "../model-util";
// import { TrxRef, trxWrap } from "../transaction";
// import { getRolesFromRoleBase, RoleBase, RolesMap } from "../utils/roles";

// export type Injection = {
//   vertex: Vertex;
//   role: string;
// };

// export type ApplyBehaviorsArgs = {
//   entity: Vertex;
//   renderMode: RoleBase;
//   injections?: Injection[];
//   afterCreate?: (vertex: Vertex) => void;
// };

// export async function applyInjections({
//   entity,
//   injections,
//   renderMode,
//   afterCreate,
// }: ApplyBehaviorsArgs): Promise<void> {
//   const roles = getRolesFromRoleBase(renderMode);
//   const childVertexs = entity.children(roles);
//   await childVertexs.awaitLoad();

//   let backrefs = await entity.backrefs.get();
//   let vertex_id_set = new Set<string>();
//   await backrefs.awaitLoad();

//   backrefs.forEach((backref) => {
//     const targetIdValue = backref.targetId.toString();
//     vertex_id_set.add(targetIdValue);
//   });

//   await trxWrap(
//     async (trx) => {
//       if (injections) {
//         for (const injection of injections) {
//           if (!vertex_id_set.has(injection.vertex.id)) {
//             // await recurseMaterializeTemplate(trx, entity, injection.vertex, null, roles);
//             const template = injection.vertex;
//             const templateChildren = template.children(roles);
//             const iter = await templateChildren.getIter();
//             let myPrev: Vertex | null = null;
//             while (true) {
//               const next = iter.next();
//               if (!next) break;
//               myPrev = await recurseMaterializeTemplate(trx, entity, next, myPrev, roles, afterCreate);
//             }
//           }
//         }
//       }
//     },
//     [],
//     'Template',
//   );
// }

// const recurseMaterializeTemplate = async (
//   trx: TrxRef,
//   attachTo: Vertex,
//   template: Vertex,
//   _prev: Vertex | null,
//   roles: RolesMap,
//   afterCreate?: (vertex: Vertex) => void,
// ): Promise<Vertex> => {
//   const templateChildren = template.children(roles);
//   const iter = await templateChildren.getIter();

//   // console.log(`recurseMaterializeTemplate(${template.id})`);
//   let body_ = (await template.getEdge(['body']))?.target;
//   // console.log('got body ', body_?.id, (body_ as  | null)?.parts.value().isLoaded);

//   // Instantiate the template into a userspace vertex, and attach that as normal!
//   const meta = (await template.meta.get()) || undefined;
//   const materializedVertex = Vertex.create({ trx, meta });

//   // if this vertex has no children, then attempt to focus it
//   if (templateChildren.isEmpty()) {
//     afterCreate?.(materializedVertex);
//   }
//   if (body_) {
//     materializedVertex.createEdge({ trx, target: body_, role: ['body'] });
//   }
//   await LinkedListMutation.attachMemberOf(trx, materializedVertex, attachTo, 'category');
//   // Record the fact that we done did it by adding an embed relationship directly to the template
//   // This combined with the .has above will prevent us from doing this a second time

//   // Remember from whence you came
//   materializedVertex.createEdge({ trx, target: template, role: ['category-shadow'] });

//   let myPrev: Vertex | null = null;
//   while (true) {
//     const next = iter.next();
//     if (!next) break;
//     myPrev = await recurseMaterializeTemplate(trx, materializedVertex, next, myPrev, roles, afterCreate);
//   }

//   return materializedVertex;
// };
