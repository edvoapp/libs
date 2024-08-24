import { ChildNode, ChildNodeCA, ConditionalNode, Node } from '../base';
import { MemoizeOwned, Observable } from '@edvoapp/util';
import { AppDesktop } from '../app-desktop';
import { ConditionalPanel, TabsPanel, ToolbarButton } from '..';
import { FavoritesPanel } from './panels/favorites-panel';
import { DEPTH_MASK_Z } from '../../constants';

interface CA extends ChildNodeCA<AppDesktop> {}

export class Toolbar extends ChildNode<AppDesktop> {
  allowHover = true;
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  zIndexed = true;
  overflow = true;

  static new(args: CA) {
    const me = new Toolbar(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return [
      'addBrowserButton',
      'addPortalButton',
      'addNoteButton',
      'addStickyButton',
      'uploadButton',
      'tabsButton',
      'favoritesButton',
      'searchButton',
      'tabsPanel',
      'pinnedItems',
    ];
  }

  get isTiling() {
    return this.parentNode.tileContainer.visible;
  }
  @MemoizeOwned()
  get addBrowserButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'browser-button',
    });
  }
  @MemoizeOwned()
  get addPortalButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'portal-button',
    });
  }
  @MemoizeOwned()
  get addNoteButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'note-button',
    });
  }
  @MemoizeOwned()
  get addStickyButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'sticky-button',
    });
  }
  @MemoizeOwned()
  get uploadButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'upload-button',
    });
  }
  @MemoizeOwned()
  get tabsButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'tabs-button',
    });
  }
  @MemoizeOwned()
  get favoritesButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'pinned-button',
    });
  }
  @MemoizeOwned()
  get searchButton() {
    return ToolbarButton.new({
      parentNode: this,
      label: 'search-button',
    });
  }

  @MemoizeOwned()
  get uploadModalOpen() {
    return new Observable(false);
  }
  @MemoizeOwned()
  get favoritesOpen() {
    return new Observable(false);
  }
  @MemoizeOwned()
  get tabsOpen() {
    return new Observable(false);
  }

  @MemoizeOwned()
  get pinnedItems(): ConditionalPanel<FavoritesPanel, Toolbar> {
    return ConditionalPanel.new<FavoritesPanel, Toolbar>({
      parentNode: this,
      factory: (parentNode) =>
        FavoritesPanel.new({
          kind: 'pinned',
          context: this.context,
          parentNode,
        }),
    });
  }

  @MemoizeOwned()
  get tabsPanel(): ConditionalPanel<TabsPanel, Toolbar> {
    // TODO: consider having this observe this.context.location
    // since preact router does not erase the VM, the "initialOpenState" of this does not get re-evaluated if we use router.route()
    // however, then how do we determine whether the panel should be closed or open?
    // if the tabs panel is ALWAYS open when ?tabs=true, then we can't close it as long as the URL contains ?tabs=true
    const urlParams = new URLSearchParams(window.location.search);
    const initialOpenState = urlParams.has('tabs');
    return ConditionalPanel.new<TabsPanel, Toolbar>({
      parentNode: this,
      initialOpenState,
      factory: (parentNode) =>
        TabsPanel.new({
          kind: 'tabs',
          context: this.context,
          parentNode,
          observeResize: true,
        }),
    });
  }
}
