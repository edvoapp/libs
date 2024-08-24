// import { Entity, isReferenceable, Referenceable } from '../model/Entity';

// export const _diag = async (thing: Entity, load: boolean, tier = 0, postfix?: string): Promise<string> => {
//   // if (load) {
//   //   await thing.awaitLookup()
//   //   await thing._backrefs.awaitLoad()
//   // }
//   // return 'TODO: Recurse and build a simple diagnostic readout of the parts. Remember to shorten the IDs, and omit the whole object';

//   // should print to the console something like:
//   // root
//   //   ID04 (head,item)
//   //   B (item,prev(A),tail)

//   let ident = thing.prettyId();
//   let out = `${'\t'.repeat(tier)}${ident}${postfix ? ` [${postfix}] ` : ''}\n`;
//   const idLabelMap: Record<
//     string,
//     {
//       entity: Entity;
//       roles: Set<string>;
//     }
//   > = {};
//   if (isReferenceable(thing)) {
//     (await thing.backrefs.get()).map(async (backref) => {
//       const { target, role, status } = backref;
//       const awaitedTarget = await target.get();
//       const id = backref.id?.substr(0, 4);
//       if (target && awaitedTarget !== thing && status === 'active') {
//         const entityId = awaitedTarget.prettyId();
//         const joinedRoles = `(${id}:${(await role.get()).join(', ')})`;
//         if (!idLabelMap[entityId]) {
//           idLabelMap[entityId] = { entity: awaitedTarget, roles: new Set([joinedRoles]) };
//         } else {
//           idLabelMap[entityId].roles.add(joinedRoles);
//         }
//       }
//     });
//   }
//   let entity_diags = Object.values(idLabelMap).map(({ entity, roles }) =>
//     entity.diag(load, tier + 1, Array.from(roles).join(', ')),
//   );

//   return out + (await Promise.all(entity_diags)).join('\n');
// };
