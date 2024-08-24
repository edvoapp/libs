import { trxWrap } from '@edvoapp/common';

import { Action, ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';
import { generateBrightColor } from '../utils';

export class AutoBox extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const memberNode = originNode.findClosest((n) => n instanceof VM.Member && n);

    if (!memberNode) return [];

    let subActions: Action[] = [];

    const meta = memberNode.meta.value;

    if (!meta.autoposition) {
      subActions.push({
        label: 'Position',
        apply: () => {
          const prev = memberNode.prevSibling();

          if (prev) {
            const [implicit1] = memberNode.implicitRelationships.value;
            const [implicit2] = prev.implicitRelationships.value;
            const col1 = implicit1?.meta.value.clusterColor;
            const col2 = implicit2?.meta.value.clusterColor;
            const clusterColor = col1 ?? col2 ?? generateBrightColor();

            void trxWrap(async (trx) => {
              if (prev) {
                memberNode.vertex.createEdge({
                  trx,
                  role: ['implicit'],
                  target: prev.vertex,
                  meta: {
                    clusterColor,
                  },
                });
              }

              await memberNode.updateMeta({
                trx,
                meta: { autoposition: true },
              });

              await prev.updateMeta({
                trx,
                meta: { autoposition: true },
              });

              // TODO: comment why these calls are necessary
              // memberNode.rustNode.unfix_all();
              // prev.rustNode.unfix_all();
            });
          }
        },
      });
    }

    if (subActions.length == 0) return [];

    return [
      {
        label: 'Card',
        actions: [
          {
            label: 'Auto...',
            subActions: subActions,
          },
        ],
      },
    ];
  }
}
