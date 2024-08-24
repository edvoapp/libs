import { createElement } from 'preact';
import { Action, ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';
import { MemberAppearance } from './appearance-type';
import { getContrastColor } from '../lib/color';

export class CardColor extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const node = originNode.findClosest((n) => (n instanceof VM.Member || n instanceof VM.DockItem) && n);
    if (!node) return [];
    const vertex = node.vertex;

    const current = node.appearance.value;
    const color = current?.color;

    const colorSubActions: Action[] = [
      {
        icon: () =>
          createElement('div', {
            style: { background: '#fff' },
            className: 'color-indicator',
          }),
        label: 'White',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#fff',
              textColor: getContrastColor('#fff'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#6431E0' },
            className: 'color-indicator',
          }),
        label: 'Lilac',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#6431E0',
              textColor: '#FFFFFF',
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#3A2C5C' },
            className: 'color-indicator',
          }),
        label: 'Aubergine',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#3A2C5C',
              textColor: '#FFFFFF',
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#F3F1FA' },
            className: 'color-indicator',
          }),
        label: 'Lavender',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#F3F1FA',
              textColor: '#000000',
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#7EE9E2' },
            className: 'color-indicator',
          }),
        label: 'Aquatica',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#7EE9E2',
              textColor: '#000000',
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#D39FEA' },
            className: 'color-indicator',
          }),
        label: 'Wisteria',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#D39FEA',
              textColor: getContrastColor('#D39FEA'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#E0E31A' },
            className: 'color-indicator',
          }),
        label: 'Xanthic',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#E0E31A',
              textColor: getContrastColor('#E0E31A'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#F761B8' },
            className: 'color-indicator',
          }),
        label: 'Flamingo',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#F761B8',
              textColor: getContrastColor('#F761B8'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#F7BC48' },
            className: 'color-indicator',
          }),
        label: 'Tangerine',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#F7BC48',
              textColor: getContrastColor('#F7BC48'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#C0DE28' },
            className: 'color-indicator',
          }),
        label: 'Lima',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#C0DE28',
              textColor: getContrastColor('#C0DE28'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#66BCDF' },
            className: 'color-indicator',
          }),
        label: 'Caroline',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#66BCDF',
              textColor: getContrastColor('#66BCDF'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#2B7CBE' },
            className: 'color-indicator',
          }),
        label: 'Starlight',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#2B7CBE',
              textColor: getContrastColor('#2B7CBE'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#F9A72A' },
            className: 'color-indicator',
          }),
        label: 'International',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#F9A72A',
              textColor: getContrastColor('#F9A72A'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#ED2563' },
            className: 'color-indicator',
          }),
        label: 'Ginja',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#ED2563',
              textColor: getContrastColor('#ED2563'),
            },
            null,
          ),
      },
      {
        icon: () =>
          createElement('div', {
            style: { background: '#773686' },
            className: 'color-indicator',
          }),
        label: 'Concorde',
        apply: () =>
          vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              color: '#773686',
              textColor: getContrastColor('#773686'),
            },
            null,
          ),
      },
    ];
    //   .filter((x) => {
    //   const bg = x.icon.props.style.background;
    //   return bg !== color;
    // });

    return [
      {
        label: 'Card',
        actions: [
          {
            label: 'Change Color',
            subActions: colorSubActions,
          },
        ],
      },
    ];
  }
}
