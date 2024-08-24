import { MemoizeOwned, Observable, ObservableList, OwnedProperty } from '@edvoapp/util';

import { ChildNode, ChildNodeCA, ListNode, Node } from '../base';
import { TopicListItem } from '../topic-space';
import { DragItem } from '../../behaviors';
import { globalStore, Model, TrxRef, trxWrapSync } from '@edvoapp/common';
import { ActionGroup, Behavior, DispatchStatus, EventNav } from '../../service';
import { Tab } from './browser-tab';
import { insertSeq } from '../../utils/seq';

interface CA extends ChildNodeCA<Node> {
  window: Model.BrowserContext;
  // tabsObs: ObservableList<Model.BrowserContext>;
}

export class BrowserWindow extends ChildNode {
  @OwnedProperty
  window: Model.BrowserContext;
  @OwnedProperty
  tabsObs: ObservableList<Model.BrowserContext>;

  constructor({
    window,
    // tabsObs,
    ...args
  }: CA) {
    super(args);
    this.window = window;
    // this.tabsObs = tabsObs;
    this.tabsObs = globalStore.query<Model.BrowserContext>('browser_context', null, {
      where: [
        ['userID', '==', globalStore.getCurrentUserID()],
        ['status', '==', 'active'],
        ['type', '==', 'tab'],
        ['parentContextId', '==', this.window.id],
      ],
      orderBy: ['seq', 'asc'],
      allowCache: false,
    });
  }
  static new(args: CA) {
    const me = new BrowserWindow(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['header', 'tabs'];
  }

  @OwnedProperty
  expanded = new Observable(true);

  toggleExpanded() {
    this.setExpanded(!this.expanded.value);
  }

  setExpanded(value: boolean) {
    this.expanded.set(value);
  }

  @MemoizeOwned()
  get header() {
    return WindowHeader.new({ parentNode: this });
  }

  @MemoizeOwned()
  get tabs(): ListNode<BrowserWindow, Tab> {
    const precursor = this.tabsObs.sortObs((a, b) => {
      const aSeq = a.seq.value ?? 0;
      const bSeq = b.seq.value ?? 0;
      // console.debug('A SEQ, B SEQ', a, b, aSeq, bSeq);
      return aSeq - bSeq;
    });
    return ListNode.new<BrowserWindow, Tab, Model.BrowserContext>({
      parentNode: this,
      label: 'tablist',
      precursor,
      factory: (tab, parentNode, offset) => {
        return Tab.new({ parentNode, tab });
      },
    });
  }

  droppable(items: Node[]): boolean {
    return items.every((x) => x instanceof TopicListItem || x instanceof Tab);
  }

  async handleDrop(
    dragItems: DragItem[],
    dropEvent: MouseEvent,
    trx: TrxRef,
    // this method doesn't care about trx because it is all handled by the browser
  ): Promise<Node[]> {
    if (!this.droppable(dragItems.map((x) => x.node))) return [];

    const point = {
      x: dropEvent.clientX,
      y: dropEvent.clientY,
    };

    // are we dropping on a Tab?
    const tab = this.getNodeAtScreenPoint(point, true, (n) => n instanceof Tab) as Tab | null;
    let insertBefore = false;
    if (tab?.clientRect) {
      const { top, height } = tab.clientRect;
      const midpoint = top + height / 2;
      insertBefore = dropEvent.clientY < midpoint;
    }

    let seq = (await tab?.tab.seq.get()) ?? 0;
    let highestIndex = 0;

    const items = await Promise.all(
      dragItems.map(async (item, index) => {
        const node = item.node as TopicListItem | Tab;

        const seq = insertSeq(tab?.prevSibling()?.seq ?? undefined, tab?.nextSibling()?.seq ?? undefined);

        highestIndex = Math.max(seq, highestIndex);
        if (node instanceof Tab) {
          node.move({ trx, parent: this.window, seq });
          return null;
        }
        // otherwise, we are dropping a TopicItem
        const bodyProperties = await node.vertex
          .filterProperties({
            role: ['body'],
            contentType: 'text/x-uri',
          })
          .toArray();

        let url = bodyProperties[0]?.text.value;
        console.log('uri!', url, node);
        if (!url) return null;
        Model.BrowserContext.create({
          trx,
          parent: this.window,
          seq,
          url,
          title: node.item.vertex.name.value ?? undefined,
          deviceContextId: this.window.deviceContextId,
          type: 'tab',
          originator: 'app',
        });
        return node;
      }),
    );
    return items.filter(Boolean) as Node[];
  }
}

type WindowHeaderCA = ChildNodeCA<BrowserWindow> & {};

class WindowHeader extends ChildNode<BrowserWindow> {
  allowHover = true;
  get cursor() {
    return 'pointer';
  }
  static new(args: WindowHeaderCA) {
    const me = new WindowHeader(args);
    me.init();
    return me;
  }
  getHeritableBehaviors(): Behavior[] {
    return [new WindowHeaderClick(), new WindowBehavior()];
  }
}

class WindowHeaderClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.closestInstance(WindowHeader);
    if (!node) return 'decline';
    node.parentNode.toggleExpanded();
    return 'stop';
  }
}

class WindowBehavior extends Behavior {
  getActions(n: Node): ActionGroup[] {
    const node = n.closestInstance(BrowserWindow);
    if (!node) return [];
    return [
      {
        label: 'Browser Window',
        actions: [
          {
            label: 'Archive this window',
            apply: () => {
              trxWrapSync((trx) => node.window.archive(trx));
            },
          },
        ],
      },
    ];
  }
}
