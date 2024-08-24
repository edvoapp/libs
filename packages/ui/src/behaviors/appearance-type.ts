import { Model, trxWrap } from '@edvoapp/common';

import { Action, ActionGroup, Behavior, EventNav } from '../service';

import { ChartConfig } from '../components/member/chart';
import * as VM from '../viewmodel';

export type MemberAppearanceType =
  | 'subspace'
  | 'stickynote'
  | 'normal'
  | 'clean'
  | 'browser'
  | 'list'
  | 'card-search'
  | 'file';

export interface MemberAppearance {
  type?: MemberAppearanceType;
  color?: string;
  textColor?: string;
  module?: string;
  chartConfig?: ChartConfig;
}

export class AppearanceType extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const node = originNode.findClosest((n) => (n instanceof VM.Member || n instanceof VM.DockItem) && n);

    if (!node) {
      return [];
    }

    const type = node.appearance.value?.type;

    const actions: Action[] = [];

    if (type !== 'stickynote' && type !== 'browser') {
      const subActions: Action[] = [
        {
          label: 'Spatial',
          apply: () => node.vertex.setJsonPropValues<MemberAppearance>('appearance', { type: 'subspace' }, null),
        },
        {
          label: 'Notes Only',
          apply: () => node.vertex.setJsonPropValues<MemberAppearance>('appearance', { type: 'normal' }, null),
        },
        {
          label: 'Clean',
          apply: () => node.vertex.setJsonPropValues<MemberAppearance>('appearance', { type: 'clean' }, null),
        },
        // {
        //   label: 'Browser',
        //   apply: () =>
        //     node.vertex.setJsonPropValues<MemberAppearance>('appearance', {
        //       type: 'browser',
        //     }),
        // },
        {
          label: 'List',
          apply: () => node.vertex.setJsonPropValues<MemberAppearance>('appearance', { type: 'list' }, null),
        },
        // {
        //   label: 'Stickynote',
        //   apply: () => node.vertex.setJsonPropValues<MemberAppearance>('appearance',{ type: 'stickynote' }),
        // },
      ];

      actions.push({
        label: 'Appearance',
        subActions: subActions.filter((x) => x.label?.toLowerCase() !== type),
      });
    }

    return [{ label: 'Card', actions }];
  }
}
