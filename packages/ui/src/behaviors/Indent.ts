import { Model, trxWrap } from '@edvoapp/common';

import { Action, ActionGroup, Behavior, DispatchStatus, EventNav, FocusContext } from '../service';
import { insertSeq } from '../utils/seq';
import * as VM from '../viewmodel';
import { Guard } from '@edvoapp/util';

type IndentArgs = {
  subject: VM.Node;
  oldParent: VM.Node;
  newParent: VM.Node;
  seq: number;
  focusContext: FocusContext;
};

export class Indent extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const node = originNode.findClosest((n) => n instanceof VM.OutlineItem && n);
    if (!node) return [];

    const actions: Action[] = [];

    const indent = this.indentOp(node, {});
    if (indent)
      actions.push({
        label: 'Indent bullet',
        apply: indent,
        cy: 'indent-bullet',
      });

    const unIndent = this.unIndentOp(node, {});
    if (unIndent)
      actions.push({
        label: 'Un-indent bullet',
        apply: unIndent,
        cy: 'unindent-bullet',
      });

    return [{ label: 'Outline Item', actions }];
  }

  async doIndent({ subject, oldParent, newParent, seq, focusContext }: IndentArgs): Promise<void> {
    if (
      !(subject instanceof VM.VertexNode) ||
      !(oldParent instanceof VM.VertexNode) ||
      !(newParent instanceof VM.VertexNode)
    ) {
      return;
    }
    const focusState = subject.context.focusState;
    let edges = await subject.vertex.filterEdges(['category-item'], oldParent.vertex.unifiedId).toArray();

    const newPrivs = newParent.projectedPrivileges();

    // * Focus needs to happen BEFORE creating an edge, since checkPendingFocus
    // * is run on the binding of a new element (i.e. with the creation of the
    // * following edge)

    // Cant use subject.vertex in the match function, because subject
    // will be destroyed on edge removal
    const subjectVertexId = subject.vertex.id;

    focusState.setPendingFocus({
      match: (node) =>
        node instanceof VM.TextField &&
        node.parentNode.parentNode instanceof VM.BodyContent &&
        node.parentNode.parentNode.vertex.id === subjectVertexId
          ? node
          : false,
      context: focusContext,
    });

    if (subject.vertex === newParent.vertex) return;

    await trxWrap(async (trx) => {
      // Have to guard the vertex, because we're removing edges from it
      // which will cause it to be removed from the parent
      Guard.while(subject.vertex, (vertex) => {
        edges.forEach((e) => e.archive(trx));
        vertex.createEdge({
          trx,
          target: newParent.vertex,
          role: ['category-item'],
          seq,
          privs: newPrivs,
          meta: {},
        });
      });
    });
  }

  // TODO: deduplicate this with BulletMutationHandler
  async doDelete(backrefs: Model.Backref[]) {
    if (backrefs.length === 0) return;

    await trxWrap(async (trx) => {
      backrefs.forEach((backref) => {
        backref.archive(trx);
      });
    });
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof VM.OutlineItem && n);
    if (!node) return 'decline';

    switch (e.key) {
      case 'Tab':
        if (parent) {
          if (e.shiftKey) {
            this.unIndentOp(node, node.focusContext)?.();
          } else {
            this.indentOp(node, node.focusContext)?.();
          }
          return 'stop';
        }
        break;
      default:
        return 'decline';
    }

    return 'decline';
  }
  indentOp(node: VM.Node, focusContext: FocusContext) {
    if (!(node instanceof VM.OutlineItem)) return;
    const oldParent = node.parentNode?.closest((x) => x instanceof VM.OutlineItem || x instanceof VM.Outline) as
      | VM.OutlineItem
      | VM.Outline
      | null;
    if (!oldParent) return;
    const prevSibling = node.prevSibling();
    if (!prevSibling) return;

    return () => {
      // (oldParent)
      // * A ( prevSibling is newParent )
      // ->  * B
      // * C
      const prevSiblingLastChild = prevSibling.items.lastChild();

      void this.doIndent({
        subject: node,
        oldParent,
        newParent: prevSibling,
        seq: (prevSiblingLastChild?.backref?.seq.value || 0) + 1, // End of the list
        focusContext,
      });
    };
  }
  unIndentOp(node: VM.Node, focusContext: FocusContext) {
    const oldParent = node.parentNode?.closest((x) => x instanceof VM.OutlineItem) as VM.OutlineItem | null;
    if (!oldParent) return;
    const grandParent = oldParent.parentNode?.closest((x) => x instanceof VM.OutlineItem || x instanceof VM.Outline) as
      | VM.OutlineItem
      | VM.Outline
      | null;
    if (!grandParent) return;

    return () => {
      // (grandParent is newParent)
      // * A ( oldParent )
      // <- * B
      // * C
      let parentNextSibling = oldParent.nextSibling();
      const prevSeq = oldParent.backref?.seq.value;
      const nextSeq = parentNextSibling?.backref?.seq.value;
      const seq = insertSeq(prevSeq, nextSeq); // slot in between the old parent and its next sibling

      void this.doIndent({
        subject: node,
        oldParent,
        newParent: grandParent,
        seq, // slot in between the old parent and its next sibling
        focusContext,
      });
    };
  }
}
