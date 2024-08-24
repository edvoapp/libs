import { trxWrap, trxWrapSync } from '@edvoapp/common';
import { Tab } from '../viewmodel';
import { generateBrightColor } from './color';
import { TrxRef } from '@edvoapp/wasm-bindings';

export function makeRelations(nodes: Tab[], trx: TrxRef) {
  for (let i = 0; i < nodes.length - 1; i++) {
    const current_node = nodes[i];
    const next_node = nodes[i + 1];

    const current_vert = current_node.vertex.value;
    const next_vert = next_node.vertex.value;

    const [rel1] = current_vert?.filterBackrefs({ role: ['implicit'] }).value ?? [];
    const [rel2] = next_vert?.filterBackrefs({ role: ['implicit'] }).value ?? [];

    const col1 = rel1?.meta.value.clusterColor;
    const col2 = rel2?.meta.value.clusterColor;
    const clusterColor = col1 ?? col2 ?? generateBrightColor();

    if (current_vert && next_vert) {
      current_vert.createEdge({
        trx,
        role: ['implicit'],
        target: next_vert,
        meta: {
          clusterColor,
        },
      });
    }
  }
}
