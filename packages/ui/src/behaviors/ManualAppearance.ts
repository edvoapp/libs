import { Behavior, Hotkey, keyMappings } from '../service';
import { EventNav } from '../service/EventNav';
import * as VM from '../viewmodel';
import { trxWrap } from '@edvoapp/common';

export class ManualAppearance extends Behavior {
  openOverlay(node: VM.Node) {
    if (!(node instanceof VM.Member)) return;
    const json = prompt('JSON payload');
    if (!json) return;

    try {
      // this is really a check to make sure it's valid JSON
      const parsed = JSON.parse(json);
      // just to make sure that this is in a proper JSON stringified format
      const content = JSON.stringify(parsed);
      void trxWrap(async (trx) => {
        const [existing, ...rest] = await node.vertex
          .filterProperties({
            role: ['appearance'],
            contentType: 'application/json',
          })
          .toArray();
        rest.forEach((r) => r.archive(trx));
        if (existing) {
          existing.setContent(trx, content);
        } else {
          node.vertex.createProperty({
            trx,
            role: ['appearance'],
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
