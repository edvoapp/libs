// import { Model, trxWrap, Firebase } from '@edvoapp/common';
// import { EdvoObj, Observable } from '@edvoapp/util';

// import {
//   BranchNode,
//   BranchNodeInner,
//   VertexNode,
//
// } from '../viewmodel';

// import { Behavior } from './Behavior';

// interface NodeBindingParams {
//   viewNode: VertexNode | BranchNode;
//   backref?: Model.Backref;
//   parentBinding?: NodeBinding;
//   bindingRole: string;
//   behaviors?: Behavior[];
//   heritableBehaviors?: Behavior[];
// }

// // Each NodeBinding is created by + representative of ONE INSTANCE of a functional component which:
// // * refers to one vertex
// // * must have a render parent (except the singular root vertex being rendered per screen)
// // * must have a list of renderChildren even if empty
// // * factors away and potentially modularizes behaviors which are broadly applicable to all rendered vertices

// // Essentially is kind of like a mixin for a Class-based component (with the component in question being a functional component at present)
// // except that it's considered un-idiomatic to pass class-based component references to other components.

// // TODO: rename NodeBinding to NodeBinding
// // TODO: Change NodeBinding to be a base class to contain only the common functionality which ALL rendered vertexes needs
// // TODO: Create subclasses of NodeBinding to contain specific behaviors like debounced text body saving, etc.

// export class NodeBinding extends EdvoObj {
//   // TODO: this should be a handle
//   viewNode: VertexNode | BranchNode;
//   // backref?: BackrefNode;
//   parentBinding?: NodeBinding;
//   renderTier: number;

//   currentRecipientsList: string[] = [Firebase.getCurrentUserID()];
//   role: string;
//   readonly behaviors: Behavior[];
//   readonly heritableBehaviors: Behavior[];
//   constructor({
//     viewNode,
//     parentBinding,
//     bindingRole,
//     behaviors = [],
//     heritableBehaviors = [],
//   }: NodeBindingParams) {
//     super();

//     this.parentBinding = parentBinding;

//     this.renderTier = parentBinding ? parentBinding.renderTier + 1 : 0;

//     this.heritableBehaviors = parentBinding
//       ? [...parentBinding.heritableBehaviors, ...heritableBehaviors]
//       : [...heritableBehaviors];

//     this.behaviors = [...behaviors, ...this.heritableBehaviors];

//     this.role = bindingRole;
//     this.viewNode = viewNode;
//     // The backrefs which the bound component for this nodeBinding intends to render

//     this.trace(3, () => [
//       `role: ${this.role} renderTier: ${this.renderTier}, childOf: ${
//         parentBinding?.key ?? ''
//       }`,
//     ]);
//   }

//   get vertex() {
//     return this.viewNode.vertex;
//   }

//   get backref() {
//     return this.viewNode instanceof BranchNode ? this.viewNode.backref : null;
//   }

//   setSelected(selected: boolean) {
//     this.viewNode.isSelected.set(selected);
//     // Bubble selection state to parents
//     this.parentBinding?.setSelected(selected);
//   }
// }
