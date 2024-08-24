import { ChildNode, ChildNodeCA, Node } from './base';
import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import { Model, TrxRef } from '@edvoapp/common';
import { useNavigator } from '../service';
import { SearchPanelResults } from './search-panel-results';
import { TextField } from './text-field';
import { DEPTH_MASK_Z } from '../constants';
import { AppDesktop } from './app-desktop';

export interface SearchPanelCA extends ChildNodeCA<AppDesktop> {
  fitContentParent: Node | null;
  emptyText?: string;
}

export class SearchPanel extends ChildNode<AppDesktop> {
  // TextField params
  @OwnedProperty
  fitContentParent: Node | null;
  emptyText?: string;

  searchMode = this.parentNode.searchMode;
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  zIndexed = true;

  onSelect(vertex: Model.Vertex) {
    const nav = useNavigator();
    nav.openTopic(vertex, undefined, this.searchMode.value === 'share' ? { share: 'true' } : undefined);
  }

  constructor({ fitContentParent, emptyText, ...args }: SearchPanelCA) {
    super({ ...args });
    this.emptyText = emptyText;
    this.fitContentParent = fitContentParent;
  }

  static new(args: SearchPanelCA) {
    const me = new SearchPanel(args);
    me.init();
    return me;
  }

  init() {
    super.init();
    this.onCleanup(
      this.searchMode.subscribe((mode) => {
        if (mode === 'hidden') {
          this.clear();
        }
      }),
    );
    this.onCleanup(
      this.isFocused.subscribe((focus) => {
        if (!focus) {
          this.parentNode.setSearchMode('hidden');
        }
      }),
    );
  }

  get childProps(): (keyof this & string)[] {
    return ['textfield', 'topicSearchList'];
  }

  @OwnedProperty
  queryText = new Observable<string>('');

  @MemoizeOwned()
  get textfield() {
    const tf = TextField.singleString({
      label: 'search',
      parentNode: this,
      emptyText:
        this.searchMode.value === 'share' ? 'Search for a Space to share' : 'Search for, Create, or Jump to a Space',

      fitContentParent: this.fitContentParent,
      onChange: (val) => this.upgrade()?.queryText.upgrade()?.set(val),
      onSubmit: () => this.upgrade()?.queryText.upgrade()?.notify(undefined, { force: true }),
    });

    this.onCleanup(
      this.searchMode.subscribe((mode) => {
        tf.emptyText = mode === 'share' ? 'Search for a Space to share' : 'Search for, Create, or Jump to a Space';

        // HACK: forces Text.jsx to rebuild
        if (tf.isEmpty()) {
          tf.itemList.replaceAll([]);
        }
      }),
    );

    return tf;
  }

  @MemoizeOwned()
  get topicSearchList() {
    return SearchPanelResults.new({
      parentNode: this,
      onSelect: this.onSelect.bind(this),
      queryText: this.queryText,
    });
  }

  clear() {
    this.textfield.clearContent();
  }

  @MemoizeOwned()
  get visible() {
    return this.searchMode.mapObs((mode) => mode !== 'hidden');
  }
}
