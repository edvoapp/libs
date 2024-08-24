import { MemoizeOwned, OwnedProperty } from '@edvoapp/util';
import { Node, ChildNodeCA, ChildNode } from '../base';
import { Model } from '@edvoapp/common';
import { ShareMenu, ShareButton, TopicSpace } from '.';
import { DropMenu } from '../component/dropmenu';
import { DEPTH_MASK_Z } from '../../constants';

interface CA extends ChildNodeCA<TopicSpace> {
  vertex: Model.Vertex;
}

export class ShareTray extends ChildNode<TopicSpace> {
  readonly label = 'share-tray';
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  zIndexed = true;
  overflow = true;
  @OwnedProperty
  vertex: Model.Vertex;

  constructor({ vertex, ...args }: CA) {
    super(args);
    this.vertex = vertex;
  }

  static new(args: CA) {
    const me = new ShareTray(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return [
      // 'presence',
      'shareDropmenu',
    ];
  }

  @MemoizeOwned()
  get shareDropmenu(): DropMenu {
    const urlParams = new URLSearchParams(window.location.search);
    const initialExpandState = urlParams.has('share', 'true');
    return DropMenu.new({
      parentNode: this,
      initialExpandState,
      menuFactory: (parentNode) =>
        ShareMenu.new({
          parentNode,
          vertex: this.vertex,
          context: this.context,
        }),
      buttonFactory: (parentNode) => ShareButton.new({ parentNode }),
    });
  }
}
