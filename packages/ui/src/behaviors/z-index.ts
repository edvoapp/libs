import { trxWrapSync } from '@edvoapp/common';

import { Action, ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';

export class ZIndex extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const node = originNode.findClosest((n) => n instanceof VM.Member && n);
    if (!node) return [];
    const subActions: Action[] = [];

    const cr = node.clientRect;
    if (!cr) return [];

    if (this.getNext(node, (m) => m.clientRect?.intersects(cr) ?? false)) {
      subActions.push({
        label: 'Bring Forward',
        apply: () => this.bringForward(node),
      });
    }

    if (this.getPrev(node, (m) => m.clientRect?.intersects(cr) ?? false)) {
      subActions.push({
        label: 'Send Backward',
        apply: () => this.sendBackward(node),
      });
    }

    // if (this.getNext(node)) {
    //   subActions.push({
    //     label: 'Bring to Front',
    //     apply: () => this.bringToFront(node),
    //   });
    // }
    // if (this.getPrev(node)) {
    //   subActions.push({
    //     label: 'Send to Back',
    //     apply: () => this.sendToBack(node),
    //   });
    // }

    if (subActions.length) {
      return [
        {
          label: 'Card',
          actions: [
            {
              label: 'Order',
              subActions,
            },
          ],
        },
      ];
    }
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPrev(node: VM.Member, filter = (member: VM.Member) => true) {
    // Find the maximum seq which is less than that of node
    const prev = node.parentNode.value.reduce(
      (acc, m) =>
        // Candidate is different from this node
        m !== node &&
        // and it passes the given filter
        filter(m) &&
        // and its seq is le node.seq
        m.seq <= node.seq &&
        // and take the maximum
        m.seq > (acc?.seq ?? -Infinity)
          ? m
          : acc,
      null as VM.Member | null,
    );
    return prev;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getNext(node: VM.Member, filter = (member: VM.Member) => true) {
    // Find the minimum seq which is greater than that of node
    const next = node.parentNode.value.reduce(
      (acc, m) =>
        // Candidate is different from this node
        m !== node &&
        // and it passes the given filter
        filter(m) &&
        // and its seq is ge node.seq
        m.seq >= node.seq &&
        // and take the minimum
        m.seq < (acc?.seq ?? Infinity)
          ? m
          : acc,
      null as VM.Member | null,
    );
    return next;
  }
  bringToFront(node: VM.Member) {
    // Member nodes are NOT guaranteed to be sorted
    const maxMember = node.parentNode.value.reduce((acc, m) => (m.seq > acc.seq ? m : acc), node);

    if (maxMember == node) return;

    trxWrapSync((trx) => {
      node.backref.setSeq({ trx, seq: maxMember.seq + 1 });
    });
  }

  sendToBack(node: VM.Member) {
    // Member nodes are NOT guaranteed to be sorted
    const minMember = node.parentNode.value.reduce((acc, m) => (m.seq < acc.seq ? m : acc), node);

    if (minMember == node) return;

    trxWrapSync((trx) => {
      node.backref.setSeq({ trx, seq: minMember.seq - 1 });
    });
  }

  /**
   *
   * @param node Bring this node forward relative to overlapping member(s)
   * @returns
   */
  bringForward(node: VM.Member) {
    const cr = node.clientRect;
    if (cr === null) return;

    // get the next member that overlaps this one
    const next1 = this.getNext(node, (m) => m.clientRect?.intersects(cr) ?? false);
    if (next1 === null) return;

    // Get the member after that, regardless of overlap
    const next2 = this.getNext(next1);

    let seq: number;
    if (next2 === null) {
      seq = next1.seq + 1;
    } else {
      seq = (next1.seq + next2.seq) / 2;
    }

    trxWrapSync((trx) => {
      node.backref.setSeq({ trx, seq });
    });
  }
  /**
   *
   * @param node Send this node backwards relative to overlapping member(s)
   * @returns
   */
  sendBackward(node: VM.Member) {
    const cr = node.clientRect;
    if (cr === null) return;

    // get the next member that overlaps this one
    const prev1 = this.getPrev(node, (m) => m.clientRect?.intersects(cr) ?? false);
    if (prev1 === null) return;

    // Get the member after that, regardless of overlap
    const prev2 = this.getPrev(prev1);

    let seq: number;
    if (prev2 === null) {
      seq = prev1.seq - 1;
    } else {
      seq = (prev1.seq + prev2.seq) / 2;
    }

    trxWrapSync((trx) => {
      node.backref.setSeq({ trx, seq });
    });
  }
}
