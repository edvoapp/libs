import { ListNode, Node, NodeCA } from '../../base';
import { MemoizeOwned, OwnedProperty } from '@edvoapp/util';
import { globalStore, Model } from '@edvoapp/common';
import { Toolbar } from '../toolbar';
import { BrowserWindow } from '../../extension';
import { ConditionalPanel } from '../../conditional-panel';
import { DEPTH_MASK_Z } from '../../../constants';

interface CA extends NodeCA<ConditionalPanel<TabsPanel, Toolbar>> {
  kind: 'tabs';
}

export class TabsPanel extends Node<ConditionalPanel<TabsPanel, Toolbar>> {
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  zIndexed = true;
  kind: 'tabs';

  constructor({ kind, ...args }: CA) {
    super({ ...args });
    this.kind = kind;
    this.zEnumerateRecurse(100_000);
  }

  static new(args: CA) {
    const me = new TabsPanel(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['windows'];
  }

  @OwnedProperty
  browserContexts = globalStore.query<Model.BrowserContext>('browser_context', null, {
    where: [
      ['userID', '==', globalStore.getCurrentUserID()],
      ['status', '==', 'active'],
    ],
  });

  @OwnedProperty
  windowsObs = globalStore.query<Model.BrowserContext>('browser_context', null, {
    where: [
      ['userID', '==', globalStore.getCurrentUserID()],
      ['type', '==', 'window'],
      ['status', '==', 'active'],
    ],
    // oldest on top
    orderBy: ['createdAt', 'asc'],
  });

  @OwnedProperty
  tabsObs = this.browserContexts.filterObs((ctx) => ctx.contextType === 'tab');

  @MemoizeOwned()
  get windows(): ListNode<TabsPanel, BrowserWindow, Model.BrowserContext> {
    return ListNode.new<TabsPanel, BrowserWindow, Model.BrowserContext>({
      parentNode: this,
      precursor: this.windowsObs,
      factory: (win, parentNode) =>
        BrowserWindow.new({
          parentNode,
          window: win,
        }),
    });
  }
}
