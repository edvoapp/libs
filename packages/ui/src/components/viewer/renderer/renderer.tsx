// import { Model, RoleBase } from '@edvoapp/common';
// import { EdvoObj, ObservableList } from '@edvoapp/util';
// import { ComponentChildren } from 'preact';
// import { EventNav } from '../../../service';
// import { Behavior } from '../../../behaviors';
// import { NodeBinding } from '../../..';

// export type RootType = 'quest' | 'vertex' | 'topic';
// export interface RenderContext {
//   evtNav: EventNav;
//   handlers: Behavior[];
//   renderTier: number;
//   extraClass: string[];
//   domRoot?: Document | DocumentFragment;
// }

// export abstract class Renderer extends EdvoObj {
//   protected relationClass: string;
//   constructor(
//     readonly roleBase: RoleBase,
//     protected recurse = true,
//     protected rootType: RootType,
//   ) {
//     super();
//     this.relationClass = `relation-${roleBase}`;
//   }
//   abstract getRenderChildren(
//     entity: Model.Vertex,
//   ): ObservableList<Model.Backref>;

//   abstract useRender(
//     entity: Model.Vertex,
//     renderChildren: ObservableList<Model.Backref> | null,
//     parentBinding: NodeBinding,
//     eventNav: EventNav,
//   ): ComponentChildren;
// }
