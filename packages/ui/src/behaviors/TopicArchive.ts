import { globalStore } from '@edvoapp/common';

import { ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';
import { route } from 'preact-router';
import { BoxArchive } from '../assets';

export class TopicArchive extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const userID = globalStore.getCurrentUserID();
    const space = originNode.findClosest(
      (n) =>
        n instanceof VM.TSPage &&
        // do not allow archival of My Universe
        n.vertex.id !== userID &&
        n,
    );
    const member = originNode.findClosest((n) => n instanceof VM.Member && n);

    const targetNode = member ?? space;
    if (!targetNode || targetNode?.vertex.userID.value !== userID) return [];

    const isMember = targetNode instanceof VM.Member;
    const isSpace = targetNode instanceof VM.TSPage;

    const label = isMember ? 'Card' : isSpace ? 'Page' : null;

    const vertex = targetNode.vertex;

    let ag: ActionGroup[] = [];

    if (label && vertex.status.value === 'active') {
      ag.push({
        label,
        actions: [
          {
            icon: BoxArchive,
            label: 'Archive',
            apply: () => this.archive(targetNode),
          },
        ],
      });
    }
    return ag;
  }

  archive(targetNode: VM.VertexNode) {
    const isSpace = targetNode instanceof VM.TSPage;
    void targetNode.archive(
      () => {
        if (isSpace) route(`/`);
      },
      () => {
        if (isSpace) route(`/topic/${targetNode.vertex.id}`);
      },
    );
  }
}
