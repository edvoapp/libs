export {};
// import {
//   Vertex,
//   Entity,
//   getRolesFromRoleBase,
//   MainShadowOrBoth,
//   Referenceable,
//   RoleBase,
//   RolesMap,
//   ShadowIterator,
//   useObservable,
//   useObservableList,
// } from '@edvoapp/common'
// import cx from 'classnames'
// import { JSX } from 'preact'
// import { VertexComponent } from '..'
// import EventNav from '../../../service/EventNav'
// import { TemplateVertexComponent } from '../template-vertex-component'
// import { RenderContext, Renderer } from './renderer'

// export interface ShadowRenderContext extends RenderContext {
//   shadowParent: Referenceable | null
// }

// export function isShadowRenderContext(
//   o: RenderContext,
// ): o is ShadowRenderContext {
//   return 'shadowParent' in o
// }

// export class ShadowRenderer extends Renderer {
//   static childClass = 'outline'
//   baseContext(evtNav: EventNav): ShadowRenderContext {
//     return {
//       evtNav,
//       renderTier: 0,
//       extraClass: [],
//       shadowParent: null,
//     }
//   }

//   useRenderChildren(
//     entity: Entity,
//     renderContext: RenderContext,
//   ): JSX.Element | null {
//     // This flag stays the same for the life of the renderer
//     if (!this.recurse) return null

//     console.log('useRenderChildren 1')

//     const parts = entity.getParts()
//     useObservableList(parts) // call me back when the shadowRole part is loaded

//     let shadow: Referenceable | null = null
//     if (entity instanceof Vertex) {
//       shadow = entity.traverseByRole(1, [this.roles.shadowRole])
//       console.log('useRenderChildren2', shadow, this.roles.shadowRole)
//     }
//     const children = entity.getChildren(this.roles)
//     const shadowChildren = shadow?.getChildren(this.roles) ?? null
//     useObservable(children)
//     useObservable(shadowChildren)

//     // Make a new render context for this tier
//     let childRenderContext: ShadowRenderContext = {
//       ...renderContext,
//       shadowParent: shadow,
//       renderTier: (renderContext.renderTier += 1),
//       extraClass: shadow ? [] : ['unshadowed-template'],
//     }

//     const iter = new ShadowIterator(
//       this.roles,
//       children.iter(),
//       shadowChildren?.iter() ?? null,
//     )

//     let out = iter.map((item) =>
//       this._renderChild(entity, item, childRenderContext),
//     )
//     // console.log('useRenderChildren 2', children.isEmpty(), shadowChildren?.isEmpty())
//     if (out.length) {
//       // console.log('useRenderChildren 3')
//       return <div className={this.relationClass}>{out}</div>
//     } else {
//       return <></>
//     }
//   }

//   _renderChild(
//     parent: Referenceable,
//     child: MainShadowOrBoth,
//     renderContext: RenderContext,
//   ) {
//     console.log('renderChild', child)
//     if (child.main) {
//       return (
//         <>
//           <VertexComponent
//             key={child.main.key()}
//             vertex={child.main}
//             roles={this.roles}
//             renderer={this}
//             renderContext={renderContext}
//           />
//         </>
//       )
//     } else if (parent instanceof Vertex && child.shadow) {
//       // TODO - Can probably get rid of TemplateVertexComponent by implementing CowVertex
//       throw "unimplemented";

//       // const sow =new  ShadowOnWriteVertexchild.shadow()
//       // return (
//       //   <>
//       //     <VertexComponent
//       //       key={child.shadow.key()}
//       //       renderer={this}
//       //       renderContext={renderContext}
//       //       vertex={sow}
//       //       roles={this.roles}
//       //     />
//       //   </>
//       // )
//     }
//   }
// }
