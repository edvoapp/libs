// import { Edge, Vertex } from "../model";
// import { getReverseEdgeTarget } from "./traversal";
// import { getRolesFromRoleBase, RoleBase } from "../utils/roles";
// import { Transaction } from "../transaction";
// import { UnifiedId } from "../model/unified-id";
// import { first } from "lodash";

// export class LinkedListMutation {
//     // attaches THIS vertex as a member of the target vertex/entity. Target could potentially be the root vertex
//     static async attachMemberOf(trx: TrxRef, newMember: Vertex, listParent: Vertex, roleBase: RoleBase) {
//         let { tailRole, headRole, itemRole, prevRole } = getRolesFromRoleBase(roleBase);

//         let oldTailBackrefs = await listParent.getBackrefs([tailRole]);

//         // But we're definitely an item, and we're definitely the tail
//         newMember.createEdge({ trx, target: listParent, role: [itemRole] });
//         newMember.createEdge({ trx, target: listParent, role: [tailRole] });

//         // Detach the old listParent tail, and add a prev edge from newMember to each one
//         if (oldTailBackrefs.length > 0) {
//             oldTailBackrefs.forEach((backref) => {
//                 const prevTailMemberId = backref.targetId;

//                 backref.archive(trx); // detach the old tail
//                 if (prevTailMemberId.id === newMember.id) return; // in case we're already the tail of listParent. Don't be prev of yourself (that'd be bad)
//                 newMember.createEdge({ trx, targetId: prevTailMemberId, role: [prevRole] });
//             });
//         } else {
//             // No tail means we are ALSO the head
//             newMember.createEdge({ trx, target: listParent, role: [headRole] });
//         }
//     }

//     // attaches THIS vertex as the "next" for the target vertex (in other words, makes the target vertex point to this one in a previous capacity)
//     static async attachNextOf(trx: TrxRef, subject: Vertex, precedent: Vertex, parentId: UnifiedId, roleBase: RoleBase) {
//         let { tailRole, itemRole, prevRole } = getRolesFromRoleBase(roleBase);
//         // you cant be the next of a category that has no head
//         // so we're definitely NOT a head
//         // If the precedent had a tail relationship, remove it. This SHOULD be mutually exclusive with
//         // nextLinks, but it could happen due to concurrency

//         // First, we know we are an item of the new parent and the next of our precedent.
//         const foo = subject.createEdge({ trx, targetId: parentId, role: [itemRole] });
//         console.warn('created item backref', foo.backrefDocRef.id);

//         subject.createEdge({ trx, targetId: precedent.unifiedId, role: [prevRole], contextId: parentId });

//         // lop off the precedent's tail link, if any
//         (await precedent.getEdges([tailRole], parentId)).forEach((tailEdge) => {
//             console.warn('archiving tailEdge', tailEdge.prettyId(), tailEdge.role, tailEdge.targetId.toString())
//             tailEdge.archive(trx)
//         })

//         let nextLinks = await precedent.getBackrefs([prevRole], undefined, parentId);

//         let gotNext = false;

//         nextLinks.forEach((nextLink) => {
//             if (nextLink.targetId.id === subject.id) return; // Don't retire the link we just created

//             gotNext = true;

//             console.warn('archiving nextLink', nextLink.prettyId(), nextLink.role, nextLink.targetId.toString())
//             // cut the edges from the subsequent to the precedent and re-link the subsequent to the subject
//             nextLink.archive(trx)

//             //     break-\
//             // precedent  b>  subsequent
//             //              \___________
//             //     insert-\             \
//             // precendent  <e  subject  <e subsequent

//             // create an edge from the next Vertex to the subject vertex
//             Edge.createRaw({ trx, parentId: nextLink.targetId, targetId: subject.unifiedId, role: [prevRole], kind: "ref", contextId: parentId })
//         });
//         if (!gotNext) {
//             // I am the tail
//             subject.createEdge({ trx, targetId: parentId, role: [tailRole] });
//         }
//     }

//     static async indent({ trx, subject, oldParentId, newParent, roleBase }: { trx: TrxRef, subject: Vertex, oldParentId: UnifiedId, newParent: Vertex, roleBase: RoleBase }) {
//         let { headRole, tailRole, itemRole, prevRole } = getRolesFromRoleBase(roleBase);

//         // We are transforming this:
//         //     Root
//         // (h,i)      (i)      (i,t)   (edges from root to A,B,C: head, item, tail)
//         //  A   <prev  B  <prev  C

//         // Into this:
//         //    / - Root -\
//         // (h,i)      (i,t)
//         //   A   <prev  C
//         //(h,i,t)
//         //   B

//         let parentLinks = await subject.getEdges([headRole, itemRole, tailRole], oldParentId);
//         let prevLinks = await subject.getEdges([prevRole], undefined, oldParentId); // If we wanted to require the precedentId we could filter by that, but it should be fine.
//         let nextLinks = await subject.getBackrefs([prevRole], undefined, oldParentId);
//         const oldPrecedentId = prevLinks[0]?.targetId;

//         // {"backrefPath":"vertex/TjwdmysE1SGBs51YDW0J/backref/yPieyvBUm0S7QTCZEGnd","contextId":"lhmP3mrUNLATHWy9Ljyn","vertexID":"TjwdmysE1SGBs51YDW0J"}
//         console.warn(`prevLinks: `, prevLinks.map((l) => l.role.join(',') + ' ' + l.targetId.toString()))
//         console.warn(`nextLinks: `, nextLinks.map((l) => l.role.join(',') + ' ' + l.targetId.toString()))

//         // Leave the parent - archive all head,item,tail links
//         parentLinks.forEach((l) => l.archive(trx))

//         // sever prev edges (from the subject to the precedent)
//         prevLinks.forEach((prevLink) => {
//             console.warn('archiving prevLink', prevLink.prettyId(), prevLink.role, prevLink.targetId.toString())
//             prevLink.archive(trx)
//         });
//         // sever the next edges (from the subsequent TO the subject) and relink each of them to our precedent OR as the new head to the parent
//         nextLinks.forEach((n) => {
//             n.archive(trx);
//             if (oldPrecedentId) {
//                 // We have an old precedent, therefore our old subsequent should be re-linked to that
//                 Edge.createRaw({ trx, parentId: n.targetId, targetId: oldPrecedentId, role: [prevRole], kind: "ref", contextId: oldParentId })
//             } else {
//                 // No old precedent, thefore our old subsequent is the new head of oldParentId
//                 Edge.createRaw({ trx, parentId: n.targetId, targetId: oldParentId, role: [headRole], kind: "ref" })
//             }
//         });

//         await LinkedListMutation.attachMemberOf(trx, subject, newParent, roleBase)
//     }

//     // attaches target vertex as the "next" for THIS vertex (in other words, makes this vertex point to the target vertex as a "prev" role)
//     static async attachPrevOf(subject: Vertex, trx: TrxRef, newNext: Vertex, roleBase: RoleBase) {
//         throw "Unimplemented"
//         // const { prevRole, itemRole, headRole } = getRolesFromRoleBase(roleBase);
//         // // we're definitely NOT a tail
//         // let newParent = await newNext.getEdgeTarget([itemRole]);
//         // if (!newParent) {
//         //     return;
//         // }
//         // const newPrev = await newNext.getEdgeTarget([prevRole]);
//         // if (newPrev instanceof Vertex && newPrev !== subject) {
//         //     // I'm NOT the head
//         //     // So it should be sufficient to just attachNextOf the previous vertex
//         //     await attachNextOf(subject, trx, newPrev, roleBase);
//         // } else {
//         //     // If there is no newPrev, then we are the head of this
//         //     // first, remove the HEAD relationship from the newNext
//         //     await newNext.removeEdgesByRole(trx, [headRole]);
//         //     // then, attach this vertex as the HEAD of the parent
//         //     subject.createEdge({ trx, target: newParent, role: [headRole, itemRole] });
//         //     // and then attach the newNext
//         //     await attachNextOf(newNext, trx, subject, roleBase);
//         // }
//     }
//     static async departAndCleanupNeighbors(subject: Vertex, trx: TrxRef, roleBase: RoleBase) {
//         throw "Unimplemented"
//         // let { headRole, itemRole, tailRole, prevRole, allRoles } = getRolesFromRoleBase(roleBase);

//         // // should not be null if the vertex already exists. If it's a newly created vertex, then we just want to no-op.
//         // let formerParent = await subject.getEdgeTarget([itemRole]);

//         // if (!formerParent) {
//         //     return;
//         // }
//         // // emptyVertex
//         // // Should be null if we're the head
//         // let formerPrev = await subject.getEdgeTarget([prevRole]);
//         // // Should be null if we're the last
//         // let formerNext = await getReverseEdgeTarget(subject, [prevRole]);
//         // if (formerPrev && formerNext) {
//         //     // I was between two other items. Lets hook them up
//         //     await formerNext.removeEdgesByRole(trx, [prevRole]);
//         //     formerNext.createEdge({ trx, target: formerPrev, role: [prevRole] });
//         // } else if (formerNext) {
//         //     // If there's a next but not a previous, we need to promote it to head
//         //     await formerNext.removeEdgesByRole(trx, [prevRole]);
//         //     formerNext.createEdge({ trx, target: formerParent, role: [headRole] });
//         // } else if (formerPrev) {
//         //     // No next, so promote the prev to tail
//         //     formerPrev.createEdge({ trx, target: formerParent, role: [tailRole] });
//         // }
//         // await subject.removeEdgesByRole(trx, allRoles);
//     }
// }
