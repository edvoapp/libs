import { globalStore, Model, Search, TrxRef } from '@edvoapp/common';
import { ChildNode, ChildNodeCA, ConditionalNode, ListNode, NodeAndContext } from './base';
import { MemoizeOwned, Observable, ObservableList, OwnedProperty } from '@edvoapp/util';
import { TopicItem } from './topic-space';
import { SearchPanel } from './search-panel';
import { CreateNewTopicButton } from './create-new-topic-button';
import { TopicSearchList } from './topic-search-list';

interface CA extends ChildNodeCA<SearchPanel | TopicSearchList> {
  showRecents?: boolean;
  onSelect: (vertex: Model.Vertex, trx: TrxRef) => void;
  queryText: Observable<string>;
}

const edvoSpaceRegexp = new RegExp(/(?:.*[plm|app].*\.edvo\.com|localhost:4000)\/topic\/(\w*)/i);

export class SearchPanelResults extends ChildNode<SearchPanel | TopicSearchList> {
  @OwnedProperty
  queryText: Observable<string>;
  @OwnedProperty
  loadingResults = new Observable(false);

  clear_timer: null | (() => void) = null;
  // route this from search panel instead of here
  onSelect: (vertex: Model.Vertex, trx: TrxRef) => void;
  showRecents?: boolean;
  zIndexed = true;

  constructor({ showRecents, onSelect, queryText, ...args }: CA) {
    super({ ...args });
    this.showRecents = showRecents;
    this.queryText = queryText;
    this.onSelect = onSelect;
  }
  static new(args: CA) {
    const me = new SearchPanelResults(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['searchItems', 'recentItems', 'createNewTopicButton'];
  }

  init() {
    super.init();
    this.managedSubscription(this.queryTextDebounced, (text) => {
      this.doSearch(text);
    });
  }

  @MemoizeOwned()
  get queryTextDebounced() {
    return this.queryText.debounced(500);
  }

  @MemoizeOwned()
  get dedupedVertices(): ObservableList<Model.Vertex> {
    return Model.TimelineEvent.dedupedEventVerticesListObs();
  }

  @MemoizeOwned()
  get recentItems(): ListNode<SearchPanelResults, TopicItem, Model.Vertex> {
    const precursor = this.dedupedVertices;

    return ListNode.new<SearchPanelResults, TopicItem, Model.Vertex>({
      parentNode: this,
      precursor,
      label: 'Recent Items',
      factory: (vertex, parentNode): TopicItem => {
        return TopicItem.new({
          draggable: true,
          nameReadonly: true,
          parentNode,
          vertex: vertex,
          context: parentNode.context,
          onSelect: this.onSelect.bind(this),
          disableAddTag: true,
          tagsReadonly: true,
          showQuickActions: true,
          label: 'recent',
        });
      },
    });
  }

  @OwnedProperty
  results = new ObservableList<Search.TopicSearchResult>([]);
  @MemoizeOwned()
  get searchItems(): ListNode<SearchPanelResults, TopicItem, Search.TopicSearchResult> {
    return ListNode.new<SearchPanelResults, TopicItem, Search.TopicSearchResult>({
      parentNode: this,
      precursor: this.results,
      factory: (result, parentNode) => {
        return TopicItem.new({
          draggable: true,
          nameReadonly: true,
          parentNode,
          vertex: result.vertex,
          context: parentNode.context,
          onSelect: this.onSelect,
          disableAddTag: true,
          tagsReadonly: true,
          showQuickActions: true,
          label: 'search',
        });
      },
    });
  }

  @OwnedProperty
  status = new Observable<'querying' | 'idle'>('idle');
  _activeSearch: Promise<Search.TopicSearchResult[]> | null = null;
  doSearch(query: string) {
    if (!this.alive) return;

    this.status.set('querying');
    // Cancel the previous search if it's still pending
    const searchPromise = Search.searchTopicsByName(query, 20);
    this._activeSearch = searchPromise;

    searchPromise
      .then((res) => {
        if (!this.alive) return;
        // Check if the current promise is still the active one
        if (this._activeSearch === searchPromise) {
          this.results.replaceAll(res);
          this.status.set('idle');
          this._activeSearch = null;
        }
      })
      .catch((error) => {
        console.error('Search failed:', error);
        // Optionally handle a failed search or a canceled promise
      });
  }
  //     if (!query.length) {
  //       this.loadingResults.set(false);
  //       return [];
  //     }
  //     const edvoLink = edvoSpaceRegexp.exec(val);
  //     const menuItems: Search.TopicSearchResult[] = [];

  //     if (edvoLink) {
  //       const vertexID = edvoLink[1];
  //       const vertex = Model.Vertex.getById({ id: vertexID });
  //       const name = vertex.name.value;
  //       menuItems.push(new Search.TopicSearchResult(vertex, [], name ? `Jump to ${name}` : 'Invalid space'));
  //     }
  //     this.loadingResults.upgrade()?.set(false);
  //     menuItems.push(...res);
  //     return menuItems;
  // }

  @MemoizeOwned()
  get events() {
    return globalStore
      .query<Model.TimelineEvent>('event', null, {
        limit: 200,
        where: [
          ['eventType', 'in', ['visited', 'created']],
          ['userID', '==', globalStore.getCurrentUserID()],
          ['status', '==', 'active'],
        ],
        orderBy: ['eventDate', 'desc'],
      })
      .sortObs((a, b) => globalStore.compareTimestamps(b.eventDate, a.eventDate));
  }

  @MemoizeOwned()
  get dedupedEventVertices() {
    return this.events
      .reduceObs<Record<string, Model.Vertex>>(
        (acc, val) => {
          const vertex = val.parent;
          const vertexId = vertex.id;
          acc[vertexId] = vertex;
          return acc;
          // Don't use deepEq here
        },
        () => ({}),
      )
      .mapObs((e) => Object.values(e));
  }

  //TODO: Integrate create topic button into topic-item search results list
  @MemoizeOwned()
  get createNewTopicButton() {
    return ConditionalNode.new<CreateNewTopicButton, string, SearchPanelResults>({
      parentNode: this,
      precursor: this.queryTextDebounced,
      factory: (val, parentNode) => {
        if (!val) return;
        return (
          parentNode.value ??
          CreateNewTopicButton.new({
            parentNode,
            onSelect: this.onSelect.bind(this),
          })
        );
      },
    });
  }

  upwardNode(): NodeAndContext | null {
    return { node: this.parentNode.textfield };
  }

  // async getDescendingFocusDelegate(_ctx: FocusContext): Promise<Node> {
  //   const searchResults = await this.searchItems.get();
  //   if (searchResults.length !== 0) {
  //     return searchResults[_ctx.edge == 'top' ? 0 : searchResults.length - 1];
  //   }

  //   const recentItems = await this.recentItems.get();
  //   if (recentItems.length !== 0) {
  //     return recentItems[_ctx.edge == 'top' ? 0 : recentItems.length - 1];
  //   }
  //   return this.createNewTopicButton;
  // }
}
