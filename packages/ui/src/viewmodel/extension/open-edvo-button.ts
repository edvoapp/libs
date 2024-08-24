import { ExtensionPopup } from './extension-popup';
import { ChildNodeCA, ChildNode, Node } from '../base';
import { Behavior, DispatchStatus, EventNav, useNavigator } from '../../service';
import { trxWrapSync, Model, trxWrap } from '@edvoapp/common';

interface CA extends ChildNodeCA<ExtensionPopup> {}

export class OpenEdvoButton extends ChildNode<ExtensionPopup> {
  allowHover = true;
  get cursor(): string {
    return 'pointer';
  }

  static new(args: CA) {
    const me = new OpenEdvoButton(args);
    me.init();
    return me;
  }

  getLocalBehaviors(): Behavior[] {
    return [new OpenEdvoButtonClick()];
  }
}

class OpenEdvoButtonClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.closestInstance(OpenEdvoButton);
    if (!node) return 'decline';

    void trxWrap(
      (trx) => Promise.resolve(Model.Vertex.create({ name: 'Untitled', trx })),
      'Create new topic for bulk organization',
    ).then((v) => {
      const nav = useNavigator();
      void nav.openWebapp(false, `/topic/${v.id}?tabs=true`, true);
    });
    return 'stop';
  }
}
