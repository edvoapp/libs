import { Model, globalStore, trxWrap } from '@edvoapp/common';

import { ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';
import { StarIcon } from '../assets/icons/star';

export class PinTopic extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    let label: string;
    const topicItem = originNode.closestInstance(VM.TopicItem);
    const topicCard = originNode.closestInstance(VM.MemberBody);
    const member = originNode.closestInstance(VM.Member)?.body;
    const tsPage = originNode.closestInstance(VM.TSPage);
    const targetNode = originNode.findClosest((n) => n instanceof VM.VertexNode && n);
    if (
      // if the item we are interacting with has no name, then we can't pin it
      !targetNode?.name.value?.length
    ) {
      return [];
    }
    if (topicItem) label = 'Item';
    else if (topicCard || member) label = 'Card';
    else if (targetNode instanceof VM.TimelineEvent) label = 'Event';
    else if (tsPage) label = 'Page';
    else return [];

    const { vertex } = targetNode;

    const property = getPinProperty(vertex);

    return [
      {
        label,
        actions: [
          {
            icon: StarIcon,
            label: property ? 'Remove from favorites' : 'Add to favorites',
            apply: () => {
              void trxWrap(async (trx) => vertex.setFlagProperty('pin', !property, trx));
            },
          },
        ],
      },
    ];
  }
}

function getPinProperty(vertex: Model.Vertex) {
  const property = vertex
    .filterProperties({
      role: ['pin'],
      contentType: 'application/json',
      userID: [globalStore.getCurrentUserID()],
    })
    .filterObs((p) => p.status.value === 'active')
    .idx(0);
  return property;
}
