import { ListNode, VertexNode, VertexNodeCA } from '../base';
import { Model, TrxRef, trxWrap } from '@edvoapp/common';
import { route } from 'preact-router';
import { MemoizeOwned, Observable, ObservableList, ObservableReader, OwnedProperty } from '@edvoapp/util';
import * as Behaviors from '../../behaviors';
import { useNavigator } from '../../service';
import { AppDesktop } from '../app-desktop';
import { UserAvatar } from '../user-avatar';
import { Button } from '../button';
import { TabsPanel } from '../toolbar';
import { TopicSpace } from '../topic-space';
import { TopicItem } from '../topic-space';
import { HomePageList } from '../home-page';

interface HomePageCA extends VertexNodeCA {}

export class HomePage extends VertexNode {
  zIndexed = true;
  constructor({ ...args }: HomePageCA) {
    super(args);
  }
  static new(args: HomePageCA) {
    const me = new HomePage(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return [
      'avatar',
      'searchButton',
      'createSpaceButton',
      'organizeTabsButton',
      'uploadFilesButton',
      'shareButton',
      'dummyButton',
      'homePageList',
      'recentsButton',
      'favoritesButton',
      'sharedButton',
    ];
  }

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      size: 'small-medium',
    });
  }

  @MemoizeOwned()
  get searchButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const root = this.context.rootNode as AppDesktop;
        if (!root.searchPanel.isFocused.value) {
          root.setSearchMode('standard');
        } else {
          if (root.searchMode.value !== 'standard') {
            root.setSearchMode('standard');
          } else {
            root.setSearchMode('hidden');
          }
        }
      },
    });
  }
  @MemoizeOwned()
  get createSpaceButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        void trxWrap(async (trx) => {
          return Model.Vertex.create({ name: 'Untitled', trx });
        }).then((vertex) => {
          const nav = useNavigator();
          this.context.focusState.setPendingFocus({
            match: (x) => x instanceof TopicSpace && x.vertex === vertex,
            context: {},
          });
          nav.openTopic(vertex);
        });
      },
    });
  }
  @MemoizeOwned()
  get organizeTabsButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const toolbar = (this.context.rootNode as AppDesktop)!.toolbar;
        void trxWrap(async (trx) => {
          return Model.Vertex.create({ name: 'Untitled', trx });
        }).then((vertex) => {
          const nav = useNavigator();
          nav.openTopic(vertex);
          toolbar.tabsPanel.open();
          toolbar.context.focusState.setPendingFocus({
            match: (x) => x instanceof TabsPanel,
            context: {},
          });
        });
      },
    });
  }
  @MemoizeOwned()
  get uploadFilesButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        // const toolbar = (this.context.rootNode as AppDesktop)!.toolbar;
        // void trxWrap(async (trx) => {
        //   const vertex = Model.Vertex.create({ name: 'Untitled', trx });
        //   const nav = useNavigator();
        //   this.context.focusState.setPendingFocus({
        //     match: (x) => x instanceof TopicSpace && x.vertex === vertex,
        //     context: {},
        //   });
        //   nav.openTopic(vertex);
        // });
      },
    });
  }
  @MemoizeOwned()
  get shareButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const root = this.context.rootNode as AppDesktop;
        if (!root.searchPanel.isFocused.value) {
          root.setSearchMode('share');
        } else {
          if (root.searchMode.value !== 'share') {
            root.setSearchMode('share');
          } else {
            root.setSearchMode('hidden');
          }
        }
      },
    });
  }
  @MemoizeOwned()
  get dummyButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {},
    });
  }
  @OwnedProperty
  _listMode = new Observable<'recents' | 'favorites' | 'shared'>('recents');

  get listMode(): ObservableReader<'recents' | 'favorites' | 'shared'> {
    return this._listMode;
  }

  setListMode(mode: 'recents' | 'favorites' | 'shared') {
    this._listMode.set(mode);
  }

  @MemoizeOwned()
  get homePageList() {
    return HomePageList.new({
      parentNode: this,
      listMode: this.listMode,
    });
  }
  @MemoizeOwned()
  get recentsButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.setListMode('recents');
      },
    });
  }
  @MemoizeOwned()
  get favoritesButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.setListMode('favorites');
      },
    });
  }
  @MemoizeOwned()
  get sharedButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.setListMode('shared');
      },
    });
  }

  get focusable() {
    return true;
  }
  getHeritableBehaviors() {
    return [new Behaviors.FileDrop()];
  }
}
