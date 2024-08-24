import { Model, TrxRef } from '@edvoapp/common';
import { MemoizeOwned, MemoizeWeak, Observable, OwnedProperty } from '@edvoapp/util';
import { TopicSearch } from './topic-search';
import { AttachedPanel, AttachedPanelCA } from './attached-panel';
import { SearchPanelResults } from './search-panel-results';
import { FocusContext } from '..';
import { Node } from './base';

interface CA extends AttachedPanelCA<TopicSearch> {
  showRecents?: boolean;
  onSelect: (vertex: Model.Vertex, trx: TrxRef) => undefined;
  queryText: Observable<string>;
}

export class TopicSearchList extends AttachedPanel<TopicSearch> {
  @OwnedProperty
  onSelect: (vertex: Model.Vertex, trx: TrxRef) => undefined;
  @OwnedProperty
  queryText: Observable<string>;

  showRecents?: boolean;
  constructor({ showRecents, onSelect, queryText, ...args }: CA) {
    super(args);
    this.onSelect = onSelect;
    this.showRecents = showRecents;
    this.queryText = queryText;
  }

  static new(args: CA) {
    const me = new TopicSearchList(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['searchResultsPanel'];
  }

  @MemoizeOwned()
  get searchResultsPanel() {
    return SearchPanelResults.new({
      parentNode: this,
      onSelect: this.onSelect.bind(this),
      showRecents: this.showRecents,
      queryText: this.queryText,
    });
  }

  @MemoizeWeak()
  get textfield() {
    return this.parentNode.textfield;
  }

  get searchVal() {
    return this.searchResultsPanel.queryTextDebounced;
  }

  get searchItems() {
    return this.searchResultsPanel.searchItems;
  }

  get recentItems() {
    return this.searchResultsPanel.recentItems;
  }

  get createNewTopicButton() {
    return this.searchResultsPanel.createNewTopicButton;
  }

  // async getDescendingFocusDelegate(
  //   ctx: FocusContext,
  // ): Promise<Node<Node<any> | null>> {
  //   return this.searchResultsPanel;
  // }

  // async getAscendingFocusDelegate(
  //   ctx: FocusContext,
  // ): Promise<Node<Node<any> | null>> {
  //   return this.textfield;
  // }
}
