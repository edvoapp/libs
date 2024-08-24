import { Action, ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';
import { OutlineItemAppearance } from '../viewmodel';

export class OutlineItemAppearanceType extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const node = originNode.findClosest((n) => n instanceof VM.OutlineItem && n);
    if (!node) return [];

    const { type } = node.appearance.value || {};

    const actions: Action[] = [];

    actions.push({
      label: 'Item Type',
      subActions: [
        {
          label: 'Checkbox',
          apply: () => node.vertex.setJsonPropValues<OutlineItemAppearance>('appearance', { type: 'checkbox' }, null),
        },
        {
          label: 'Bullet',
          apply: () => node.vertex.setJsonPropValues<OutlineItemAppearance>('appearance', { type: 'bullet' }, null),
        },
        {
          label: 'Plain',
          apply: () => node.vertex.setJsonPropValues<OutlineItemAppearance>('appearance', { type: 'plain' }, null),
        },
      ].filter((x) => x.label.toLowerCase() !== type),
    });

    return [{ label: 'Outline Item', actions }];
  }
}
