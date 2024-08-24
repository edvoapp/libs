import { Observable } from '@edvoapp/util';

type UIParams = {
  memberCullTimeout?: number;
  revealShares: Observable<boolean>;
  revealNodes: boolean;
  searchDiag: boolean;
  animateForceDirection: boolean;
};

let uip: UIParams = {
  memberCullTimeout: 60,
  revealShares: new Observable(true).leak(),
  revealNodes: false,
  searchDiag: false,
  animateForceDirection: false,
};

export const uiParams = ((window as unknown as { uiParams: UIParams }).uiParams = uip);

export * from './assets';
export * from './components';
export * as Renderers from './components';
export * from './utils';
export * from './hooks';
export * from './service';
export * from './lib/color';
export * as Styled from './lib/styled-components';
export * as Behaviors from './behaviors';
export * as VM from './viewmodel';
export * from './pages';
export * from './providers';
export * from './tests';
export * from './constants';
export * from './types';

import * as self from '.';
window.edvoui = self;

import { config } from '@edvoapp/common';
export const discardWgpuContext =
  config.env === 'development'
    ? () => {
        const canvas = document.querySelector('.wgpu-surface') as HTMLCanvasElement;
        const gl = canvas.getContext('webgl2');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }
    : undefined;
