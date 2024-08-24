import { ChildNode, ChildNodeCA } from '../base';
import { AppDesktop } from '../app-desktop';
import { Toolbar } from './toolbar';
import { MemberType } from '../../behaviors/quick-add';
import { Behavior, Behaviors, DispatchStatus, EventNav, VM } from '../..';
import { isClosable } from '../conditional-panel';
import { MemoizeOwned, Observable, ObservableReader } from '@edvoapp/util';

interface CA extends ChildNodeCA<Toolbar> {}

export class ToolbarButton extends ChildNode<Toolbar> {
  allowHover = true;
  hasDepthMask = true;
  zIndexed = true;
  overflow = true;
  onClick: () => void;

  constructor({ ...args }: CA) {
    super(args);
    this.onClick = () => {
      this.handleClick();
    };
  }

  static new(args: CA) {
    const me = new ToolbarButton(args);
    me.init();
    return me;
  }

  get cursor() {
    return 'pointer';
  }

  getHeritableBehaviors() {
    return [new Behaviors.FileDrop()];
  }

  get memberType(): MemberType | null {
    switch (this.label) {
      case 'note-button':
        return 'normal';
      case 'sticky-button':
        return 'stickynote';
      // case 'browser-button':
      //   return 'browser';
      case 'portal-button':
        return 'list';
      default:
        return null;
    }
  }

  get mode() {
    switch (this.label) {
      case 'upload-button':
        return 'upload';
      case 'tabs-button':
        return 'tabs';
      case 'pinned-button':
        return 'pinned';
      case 'search-button':
        return 'search';
      default:
        return null;
    }
  }

  @MemoizeOwned()
  get isSearchOpen(): ObservableReader<'hidden' | 'share' | 'standard'> {
    const root = this.context.rootNode as AppDesktop;
    return root && root.searchMode;
  }

  closeAllPanels() {
    const rootNode = this.findClosest((n) => n instanceof AppDesktop && n);
    if (!rootNode) throw 'AppDesktop node not found. Sanity error';
    const openPanels = this.parentNode.findChild((n) => isClosable(n) && n.isOpen && n);
    rootNode.quickAdding.set(false);
    openPanels?.close();
  }

  handleClick() {
    const rootNode = this.findClosest((n) => n instanceof AppDesktop && n);
    if (!rootNode) throw 'AppDesktop node not found. Sanity error';
    const openPanels = this.parentNode.findChild((n) => isClosable(n) && n.isOpen && n);

    rootNode.quickAdding.set(false); // reset quickAdding state

    if (this.memberType) {
      openPanels?.close();
      this.parentNode.uploadModalOpen.set(false);
      rootNode.setSearchMode('hidden');

      rootNode.quickAdd.activateQuickAddMode(rootNode, this.memberType);
    } else if (this.mode === 'pinned') {
      if (this.parentNode.pinnedItems.value) {
        this.parentNode.pinnedItems.close();
      } else {
        openPanels?.close();
        this.parentNode.pinnedItems.open();
      }
    } else if (this.mode === 'tabs') {
      if (this.parentNode.tabsPanel.value) {
        this.parentNode.tabsPanel.close();
      } else {
        openPanels?.close();
        this.parentNode.tabsPanel.open();
      }
    } else if (this.mode === 'search') {
      const root = this.context.rootNode as AppDesktop;
      if (root.searchPanel.visible.value) {
        root.setSearchMode('hidden');
      } else {
        openPanels?.close();
        root.setSearchMode('standard');
      }
    }
  }
}
