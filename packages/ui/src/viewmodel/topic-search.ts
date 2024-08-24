import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import { Model, TrxRef } from '@edvoapp/common';
import { TopicSearchList } from './topic-search-list';
import { ChildNode, Node, NodeAndContext } from './base';
import { FocusContext } from '../service';
import { TextField, TextFieldBaseCA } from './text-field';
import * as Bindings from '@edvoapp/wasm-bindings';

interface CA extends TextFieldBaseCA {
  readonly?: boolean;
  onSelect: (vertex: Model.Vertex, trx: TrxRef) => undefined;
  handleBlur?: (args: { prevFocusType: PrevFocusType; byTextEvent?: boolean }) => void;
  showRecents?: boolean;
  listMaxHeight?: number;
  limitMaxWidthToSearchBoxWidth?: boolean;
}

type PrevFocusType = 'leaf' | 'branch';

// displays members and an input for creating new tags
export class TopicSearch extends ChildNode<Node> {
  readonly = false;
  onSelect: (vertex: Model.Vertex, trx: TrxRef) => undefined;
  overflow = true; // for the topic search list
  handleBlurParent?: (args: { prevFocusType: PrevFocusType; byTextEvent?: boolean }) => void;
  listMaxHeight?: number;
  limitMaxWidthToSearchBoxWidth?: boolean;
  showRecents = true;

  // TextField params
  @OwnedProperty
  fitContentParent: Node | null;
  emptyText?: string;

  constructor({
    readonly = false,
    handleBlur,
    onSelect,
    showRecents,
    listMaxHeight,
    limitMaxWidthToSearchBoxWidth,
    fitContentParent,
    emptyText,
    ...args
  }: CA) {
    super(args);
    this.readonly = readonly;
    this.handleBlurParent = handleBlur;
    this.listMaxHeight = listMaxHeight;
    this.limitMaxWidthToSearchBoxWidth = limitMaxWidthToSearchBoxWidth;
    this.onSelect = (vertex: Model.Vertex, trx: TrxRef) => {
      // null will make the caret disappear altogether, which we don't want if we are adding multiple tags
      this.textfield.clearContent();
      onSelect(vertex, trx);
    };

    this.emptyText = emptyText;
    this.fitContentParent = fitContentParent;
  }

  static new(args: CA) {
    const me = new TopicSearch(args);
    me.init();
    return me;
  }

  @OwnedProperty
  queryText = new Observable<string>('');

  @MemoizeOwned()
  get textfield() {
    return TextField.singleString({
      parentNode: this,
      emptyText: this.emptyText,
      fitContentParent: this.fitContentParent,
      onChange: (val) => this.upgrade()?.queryText.upgrade()?.set(val),
      onSubmit: () => {
        this.upgrade()?.queryText.upgrade()?.notify(undefined, { force: true });
        // How do we cause the first result to be focused given that we might not be done loading said results?
        // Presumably we should do this by focusing the result panel, and then having the result panel (when focused) automatically refocus the first result.
        // this.context.focusState.setFocus()
      },
    });
  }

  // Action items:
  // [ ] fix font size of "no results found" text
  // [ ] show loading spinner while the search is loading rather than "no results found"

  @MemoizeOwned()
  get topicSearchList() {
    return TopicSearchList.new({
      parentNode: this,
      onSelect: this.onSelect.bind(this),
      queryText: this.queryText,
      showRecents: true,
      maxHeight: this.listMaxHeight,
    });
  }

  private displayTopicSearchList() {
    // todo: update observable at rootnode, onselect.set(this.onselect)
    const topicSearchList = this.topicSearchList;

    //this is an extension exclusive thing
    if (this.limitMaxWidthToSearchBoxWidth) {
      const maxWidth = (this.clientRect?.width ?? 400) - 40;
      topicSearchList.maxWidth = maxWidth;
    }
    if (topicSearchList.isVisible) return;
    topicSearchList.show();
  }

  hideTopicSearchList() {
    if (this.topicSearchList.isVisible) this.topicSearchList.hide();
  }

  // Note: it's not clear to me which of these we ought to use. onFocus alone doesn't work
  // because when the menu closes the text field is still focused,
  // and onFocus doesn't get called again if we try to focus a field that is already focused.
  onFocus() {
    this.whenFocus();
  }
  setFocus() {
    this.whenFocus();
  }

  handleFocus() {
    this.whenFocus();
  }

  whenFocus() {
    if (this.textfield.value.length || this.showRecents) {
      this.displayTopicSearchList();
    }
  }

  get childProps(): (keyof this & string)[] {
    return ['textfield', 'topicSearchList'];
  }

  handleBlur(prevFocusType: PrevFocusType): void {
    this.hideTopicSearchList();
    this.handleBlurParent?.({ prevFocusType });
    // TODO: fix this -- for some reason, when a child is focused, this node does not have branch focus
    // if (!this.isFocused.value) {
    // on blur, unset the search value, but this isn't quite working correctly
    // this.searchVal.set(null);
    // }
  }

  // Note -- this will not affect changing of the "selected tag" since that is not handled by KeyFocus, it's handled by the TagSearch behavior.
  leftwardNode(): NodeAndContext | null {
    return this.parentNode.leftwardNode();
  }

  downwardNode(): NodeAndContext | null {
    const topicSearchList = this.topicSearchList;
    if (topicSearchList.isVisible) {
      const hasSearchTerm = (topicSearchList.searchResultsPanel.queryTextDebounced.value?.length ?? 0) > 0;

      if (hasSearchTerm) {
        const node = topicSearchList.searchItems.firstChild() ?? topicSearchList.createNewTopicButton;
        return { node };
      }

      const node =
        topicSearchList.recentItems.firstChild() ??
        topicSearchList.searchItems.firstChild() ??
        topicSearchList.createNewTopicButton;
      return { node };
    }
    return super.downwardNode();
  }
}
