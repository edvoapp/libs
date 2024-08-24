import { ChildNode, ChildNodeCA, ListNode, Node, NodeCA } from './base';
import {
  capitalize,
  debugLog,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
} from '@edvoapp/util';
import { AppDesktop } from './app-desktop';
import { ConditionalPanel } from './conditional-panel';
import { Clickable } from '../behaviors';
import { MODAL_PANEL_Z } from '../constants';
import { Button } from './button';
import { TextField } from './text-field';
import { Model, trxWrap, trxWrapSync } from '@edvoapp/common';
import { POSITION, TYPE, createToast } from '../service';

interface CA extends NodeCA<ConditionalPanel<ReportBugsModal, AppDesktop>> {}

export class ReportBugsModal extends Node<ConditionalPanel<ReportBugsModal, AppDesktop>> {
  hasDepthMask = true;
  _depthMaskZ = MODAL_PANEL_Z[0];

  constructor({ ...args }: CA) {
    super(args);
  }

  static new(args: CA) {
    const me = new ReportBugsModal(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['closeButton', 'sendReportButton', 'textfield'];
  }

  @MemoizeOwned()
  get closeButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.parentNode.toggle();
      },
    });
  }

  @MemoizeOwned()
  get sendReportButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        trxWrap(async (trx) => {
          createToast('Bug report submitted. Thank you for your feedback!', {
            type: TYPE.INFO,
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            draggable: false,
            position: POSITION.TOP_CENTER,
          });
          const traces = debugLog.contents;

          const message = Model.Vertex.create({ trx });

          const vertex = Model.Vertex.getById({ id: '1LLkFicclaxF8lxRQxSH' }); // Bug reports space
          // const vertex = Model.Vertex.getById({ id: '4vr60inFXmee9dBPaUnf' }); // Dev bug reports space

          const privs = await vertex.basicPrivsForRelatedItems();

          message.createEdge({
            trx,
            target: vertex,
            role: ['message'],
            meta: { messageRole: 'user' },
            seq: Date.now(),
          });

          message.createBodyTextProperty({
            trx,
            initialText: this.pendingMessage.value,
            privs: privs,
          });

          message.createProperty({
            trx,
            contentType: 'application/json',
            role: ['debug_logs'],
            initialString: JSON.stringify(traces),
            privs: privs,
          });

          this.parentNode.close();
        });
      },
    });
  }

  @OwnedProperty
  pendingMessage = new Observable('');

  @MemoizeOwned()
  get textfield() {
    const tf = TextField.singleString({
      parentNode: this,
      fitContentParent: this,
      onChange: (s) => this.pendingMessage.set(s),
      emptyText: 'Type here',
    });
    return tf;
  }
}
