import { ChildNode, ChildNodeCA, Node, ConditionalNode, NodeAndContext } from './base';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { Model, TrxRef, subTrxWrap, trxWrap } from '@edvoapp/common';
import { SearchPanelResults } from './search-panel-results';
import { isClosable } from './conditional-panel';
import { WeakProperty } from '@edvoapp/util';

interface CA extends ChildNodeCA<ConditionalNode<CreateNewTopicButton, any, SearchPanelResults>> {
  onSelect: (vertex: Model.Vertex, trx: TrxRef) => void;
}

export class CreateNewTopicButton extends ChildNode<ConditionalNode<CreateNewTopicButton, string, SearchPanelResults>> {
  allowHover = true;

  onSelect: (vertex: Model.Vertex, trx: TrxRef) => void | Promise<void>;

  constructor({ onSelect, ...rest }: CA) {
    super(rest);
    this.onSelect = onSelect;
  }

  static new(args: CA) {
    const me = new CreateNewTopicButton(args);
    me.init();
    return me;
  }

  get focusable() {
    // TODO: this should be a subclass of a button class which is focusable: true
    // All buttons should be focusable
    return true;
  }

  get cursor() {
    return 'pointer';
  }

  getLocalBehaviors(): Behavior[] {
    return [new CreateNewTopicClick()];
  }

  upwardNode(): NodeAndContext | null {
    if (!this.isVisible) return super.upwardNode();
    const grantparent = this.parentNode.parentNode;
    const node = grantparent.searchItems.lastChild() ?? grantparent.recentItems.lastChild() ?? grantparent.parentNode;
    return { node };
  }

  downwardNode(): NodeAndContext | null {
    // return this.isVisible
    //   ? this.parentNode.searchItems.firstChild() ??
    //       this.parentNode.recentItems.firstChild()
    //   : super.downwardNode();
    return { node: this.parentNode.parentNode.parentNode.textfield };
  }

  @WeakProperty
  get searchVal() {
    return this.parentNode?.parentNode?.queryTextDebounced;
  }

  createTopicAndClosePanel(txr: TrxRef | null): Promise<Model.Vertex> | undefined {
    const self = this.upgrade();
    if (!self) return;
    const name = this.searchVal.value || undefined;
    if (!name) return;
    const closablePanel = self.findClosest((n) => isClosable(n) && n.closable && n.isOpen && n);
    return subTrxWrap(
      txr,
      async (trx) => {
        const vertex = Model.Vertex.create({ name, trx });
        await self.onSelect?.(vertex, trx);
        if (closablePanel) {
          closablePanel.close();
        }
        return vertex;
      },
      'CreateTopicAndClosePanel',
    );
  }
}

class CreateNewTopicClick extends Behavior {
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    return 'stop';
  }

  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof CreateNewTopicButton && n);
    if (!node) return 'decline';

    const promise = node.createTopicAndClosePanel(null);
    if (!promise) return 'decline';
    return 'stop';
  }

  //TODO: work with the new search panel results
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: Node): DispatchStatus {
    if (e.key !== 'Enter') return 'decline';

    if (!(originNode instanceof CreateNewTopicButton)) return 'decline';
    const promise = originNode.createTopicAndClosePanel(null);
    if (!promise) return 'decline';
    return 'stop';
  }
}
