import { Behavior, Hotkey, keyMappings } from '../service';
import { EventNav } from '../service/EventNav';
import * as VM from '../viewmodel';
import { trxWrap } from '@edvoapp/common';

export class AddAction extends Behavior {
  openOverlay(targetNode: VM.OutlineItem) {
    const json = prompt('JSON payload');
    if (!json) return;

    try {
      // this is really a check to make sure it's valid JSON
      const parsed = JSON.parse(json);
      // just to make sure that this is in a proper JSON stringified format
      const content = JSON.stringify(parsed);
      void trxWrap(async (trx) => {
        const [existing, ...rest] = await targetNode.vertex
          .filterProperties({
            role: ['action'],
            contentType: 'application/json',
          })
          .toArray();
        rest.forEach((r) => r.archive(trx));
        if (existing) {
          existing.setContent(trx, content);
        } else {
          targetNode.vertex.createProperty({
            trx,
            role: ['action'],
            contentType: 'application/json',
            initialString: content,
          });
        }
      });
    } catch (err) {
      console.error(err);
      return;
    }
  }
}
