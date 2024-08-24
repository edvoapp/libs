import { Behavior, DEFAULT_WEBCARD_DIMS, DispatchStatus, EventNav, keyMappings } from '../service';
import * as VM from '../viewmodel';
import equals from 'fast-deep-equal';
import { Model, trxWrap } from '@edvoapp/common';
import { MemberAppearance } from './appearance-type';

export class NewBrowser extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const sortedDk = [...eventNav.downKeys].sort();
    if (!equals(keyMappings['meta-t'], sortedDk)) return 'decline';
    const closestSpace = originNode.closestInstance(VM.TopicSpace);
    if (!closestSpace) return 'decline';

    const clientRect = closestSpace.clientRect ?? closestSpace.clientRectObs.value;
    const x = clientRect.x + clientRect.width / 2;
    const y = clientRect.y + clientRect.height / 2;
    const center = closestSpace.clientCoordsToSpaceCoords({
      x,
      y,
    });
    const meta: Model.TopicSpaceCardState = {
      x_coordinate: center.x,
      y_coordinate: center.y,
      autoposition: true,
      ...DEFAULT_WEBCARD_DIMS,
    };

    void trxWrap(async (trx) => {
      const noteVertex = Model.Vertex.create({ trx });
      const role = ['member-of'];
      await noteVertex.setJsonPropValues<MemberAppearance>('appearance', { type: 'browser', color: '#fff' }, trx);

      // set pending focus before creating the edge
      eventNav.focusState.setPendingFocus({
        match: (node) => node instanceof VM.Member && node.vertex == noteVertex,
        context: { trigger: 'key' },
      });

      noteVertex.createEdge({
        trx,
        role,
        target: closestSpace.vertex,
        meta,
      });
    });

    return 'stop';
  }
}
