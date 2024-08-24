import { Node, NodeCA } from '../base';
import { MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { PropertyConfig, TextField } from '../text-field';
//import { UserNameInput } from './user-name-input';
import { ContentState } from '@edvoapp/wasm-bindings';
import { AppDesktop } from '../app-desktop';
import { MODAL_PANEL_Z } from '../../constants';
import { ConditionalPanel, ConditionalPanelCA } from '../conditional-panel';
import { Model } from '@edvoapp/common';
import { UserAvatar } from '../user-avatar';

interface CA extends NodeCA<ConditionalPanel<UserSettingsModal, AppDesktop>> {
  vertex: Model.Vertex;
}

export class UserSettingsModal extends Node<ConditionalPanel<UserSettingsModal, AppDesktop>> {
  hasDepthMask = true;
  _depthMaskZ = MODAL_PANEL_Z[0];
  @OwnedProperty
  vertex: Model.Vertex;

  constructor({ vertex, ...args }: CA) {
    super(args);
    this.vertex = vertex;
  }

  static new(args: CA) {
    const me = new UserSettingsModal(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['userNameInput', 'avatar'];
  }

  @MemoizeOwned()
  get fullName(): ObservableReader<string | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs((user) =>
      user
        ?.filterProperties({ role: ['full-name'] })
        .firstObs()
        .mapObs<string | undefined>((p) => p?.text),
    );
  }

  @MemoizeOwned()
  get userNameInput() {
    return TextField.singleString({
      propertyConfig: PropertyConfig.fromVertex({
        vertex: this.context.authService.currentUserVertexObs.value!,
        role: ['full-name'],
        visibleUserIDsForDescendants: this.visibleUserIDsForDescendants,
      }),
      parentNode: this,
      fitContentParent: this.parentNode,
      not_updatable: true,
    });
  }

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      size: 'medium',
    });
  }

  get focusable() {
    return true;
  }
}
