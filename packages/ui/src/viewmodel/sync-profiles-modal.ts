import { Model } from '@edvoapp/common';
import { Node, NodeCA } from './base';
import { ConditionalPanel } from './conditional-panel';
import { MODAL_PANEL_Z } from '../constants';
import { OwnedProperty } from '@edvoapp/util';
import { AppDesktop } from './app-desktop';

type CP = ConditionalPanel<SyncProfilesModal, AppDesktop>;

interface CA extends NodeCA<CP> {
  vertex: Model.Vertex;
}

export class SyncProfilesModal extends Node<CP> {
  hasDepthMask = true;
  _depthMaskZ = MODAL_PANEL_Z[0];

  @OwnedProperty
  vertex: Model.Vertex;

  constructor({ vertex, ...args }: CA) {
    super(args);
    this.vertex = vertex;
  }

  static new(args: CA) {
    const me = new SyncProfilesModal(args);
    me.init();
    return me;
  }
}
