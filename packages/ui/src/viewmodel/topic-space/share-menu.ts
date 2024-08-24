import { VertexNode, VertexNodeCA } from '../base';
import { TopicSpace } from './topic-space';
import { MemoizeOwned } from '@edvoapp/util';
import { ShareList } from '../share-list';
import { Model, trxWrapSync } from '@edvoapp/common';
import { DropMenuBody, DropMenuButton, DropMenuButtonCA } from '../component';
import { Behavior } from '../../service';
import * as Behaviors from '../../behaviors';

// DropMenu ---
// ThingButton
// ThingMenu

export class ShareMenu extends VertexNode<DropMenuBody> {
  readonly label = 'share-menu';
  hasDepthMask = true;
  zIndexed = true;

  static new(args: VertexNodeCA<DropMenuBody>) {
    const me = new ShareMenu(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['list'];
  }

  getHeritableBehaviors(): Behavior[] {
    return [new Behaviors.NativePassthrough()];
  }

  @MemoizeOwned()
  get list() {
    // List of existing shares
    return ShareList.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
    });
  }

  private createAllowItem(targetUserID: string, shareCategory: Model.Priv.PermissionLevel) {
    const vertex = this.vertex;
    trxWrapSync((trx) => {
      Model.Priv.Share.create({
        trx,
        vertex: vertex,
        data: {
          targetUserID,
          shareCategory: shareCategory,
          shareType: 'allow',
        },
      });
    });
  }
}

export class ShareButton extends DropMenuButton {
  readonly label = 'share-button';
  allowHover = true;

  static new(args: DropMenuButtonCA) {
    const me = new ShareButton(args);
    me.init();
    return me;
  }

  init() {
    super.init();
    this.hover.subscribe((hover) => {
      if (hover) {
        document.body.classList.add('reveal-share-state');
      } else {
        document.body.classList.remove('reveal-share-state');
      }
    });
  }

  @MemoizeOwned()
  get viewport() {
    const ts = this.findClosest((n) => n instanceof TopicSpace && n);
    if (!ts) throw 'TopicSpace not found';
    return ts.viewportState;
  }

  get vertex() {
    const vn = this.findClosest((n) => n instanceof VertexNode && n);
    if (!vn) throw 'sanity error. vertex Node not found in parentage';
    return vn.vertex;
  }
}
