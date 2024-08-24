import {
  EdvoObj,
  getWasmBindings,
  Guarded,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  WeakProperty,
} from '@edvoapp/util';
import {
  ChildNode,
  ChildNodeCA,
  ConditionalNode,
  ListNode,
  Node as VMNode,
  NodeAndContext,
  ObservableNode,
} from './base';
import { getNodeOffset, TextCaretAndSelection } from './text-caret-and-selection';
import autosize from 'autosize';
import { Model, subTrxWrapSync, TrxRef, trxWrapSync } from '@edvoapp/common';
import { CloneContext, FocusContext, SearchPanel, VM } from '..';
import { UpdatablesSet } from './base/updatables';
import { isSized } from './sized';
import { Lozenge } from './lozenge';

// Namespaced to Bindings so you don't accidentally try to instantiate it (because it will crash)
import * as Bindings from '@edvoapp/wasm-bindings';
import { TextChunk } from './text-chunk';
import { TopicSearch } from './topic-search';
import { UserSelectionBox } from './user-selection-box';
import { TextItem, UserItem } from './user-lozenge';
import { Name } from './name';
import { SearchPanelResults } from './search-panel-results';

type TextContentType = 'text/plain';

export interface TextFieldBaseCA extends ChildNodeCA<VMNode> {
  fitContentParent: VMNode | null;
  emptyText?: string;
}

export interface NoVertexTextFieldCA extends TextFieldBaseCA {
  onChange?: (value: Bindings.ContentState) => void;
  not_updatable?: boolean;
}

export interface TextFieldCA extends NoVertexTextFieldCA {
  propertyConfig?: PropertyConfig;
  fitContentParent: VMNode | null;
  emptyText?: string;
  onChangeTimeout?: number;
  onChange?: (value: Bindings.ContentState) => void;
  readonly?: ObservableReader<boolean>;
  not_updatable?: boolean;
  yieldIneffectiveKeys?: boolean;
}

interface PropertyInfoBaseCA {
  autosave?: boolean; // true by default
  onBeforeSave?: (trx: TrxRef, value: Bindings.ContentState) => void;
  onBeforeSaveString?: (trx: TrxRef, value: string) => void;
}

interface PropertyInfoCA extends PropertyInfoBaseCA {
  obs: ObservableReader<Model.Property | null | undefined>;
  createProperty: (trx: TrxRef) => Model.Property;
}

interface RawPropertyConfigCA extends PropertyInfoBaseCA {
  property: Model.Property;
}

interface VertexPropertyInfoCA extends PropertyInfoBaseCA {
  vertex: Model.Vertex;
  contentType?: TextContentType;
  role: string[];
  visibleUserIDsForDescendants: ObservableReader<string[] | undefined>;
}

interface UnlinkedPropertyInfoCA extends PropertyInfoBaseCA {
  createProperty: (trx: TrxRef) => Model.Property;
}

export class PropertyConfig extends EdvoObj {
  @OwnedProperty
  obs: ObservableReader<Model.Property | null | undefined>;
  private createProperty: (trx: TrxRef) => Model.Property;
  autosave: boolean;
  onBeforeSave?: (trx: TrxRef, value: Bindings.ContentState) => void;

  protected constructor({ obs, createProperty, autosave, onBeforeSave, onBeforeSaveString }: PropertyInfoCA) {
    super();
    this.autosave = autosave ?? true;
    this.onBeforeSave = !onBeforeSaveString
      ? onBeforeSave
      : (trx: TrxRef, value: Bindings.ContentState) => {
          onBeforeSave?.(trx, value);
          onBeforeSaveString(trx, value.to_lossy_string());
        };
    this.obs = obs;
    this.createProperty = (trx: TrxRef) => {
      const prop = createProperty(trx);
      if (obs.value !== prop) {
        debugger; // leave this debugger
        throw new Error('Created property is not the expected one');
      }
      return prop;
    };
  }

  static fromProperty({ property, ...args }: RawPropertyConfigCA): PropertyConfig {
    return new PropertyConfig({
      obs: new Observable<Model.Property | undefined | null>(property),
      createProperty: (_trx) => {
        throw new Error('Unreachable');
      },
      ...args,
    });
  }

  static fromVertex({
    vertex,
    contentType: _contentType,
    role,
    visibleUserIDsForDescendants,
    ...args
  }: VertexPropertyInfoCA): PropertyConfig {
    const contentType = _contentType ?? 'text/plain';

    // this is kinda silly, but for some reason filterProperties is considered loaded even if visibleUserIDsForDescendents is not
    const obs = Observable.calculated(({ property }) => property, {
      property: vertex
        .filterProperties({
          role: role,
          userID: visibleUserIDsForDescendants,
          contentType,
        })
        .firstObs(),
      visibleUserIDsForDescendants,
    });

    return new PropertyConfig({
      obs,
      createProperty: (trx: TrxRef) =>
        vertex.createProperty({
          role,
          contentType,
          trx,
        }),
      ...args,
    });
  }

  static unlinked({ createProperty }: UnlinkedPropertyInfoCA): PropertyConfig {
    const obs = new Observable<Model.Property | null | undefined>(null);
    return new PropertyConfig({
      obs,
      createProperty: (trx: TrxRef) => {
        const property = createProperty(trx);
        obs.set(property);
        return property;
      },
    });
  }

  get currentProperty(): Model.Property | undefined | null {
    return this.obs.value;
  }

  private scheduled: boolean = false;

  // Must be used only before editing textfield content
  @Guarded
  loadProperty() {
    const property = this.currentProperty ?? trxWrapSync((trx) => this.createProperty(trx));
    const onBeforeSave = this.onBeforeSave;
    if (onBeforeSave && !this.scheduled) {
      const fn = (trx: TrxRef) => {
        const prop = property.upgrade();
        if (prop) {
          onBeforeSave(trx, prop.contentState.value);
        }
        this.scheduled = false;
      };
      property.addBeforeSaveHook(fn);
      this.scheduled = true;
    }
    return property;
  }

  addOnBeforeSaveHook(fn: (trx: TrxRef, value: Bindings.ContentState) => void) {
    const prop = this.currentProperty;
    if (prop) {
      prop.addBeforeSaveHook((trx) => fn(trx, prop.contentState.value));
    }
  }

  @MemoizeOwned()
  get embededEdges() {
    // TODO: somehow this observable is loaded, but vertex.edges (and thus v.filterEdges(['embed']) are not.
    // need to fix this holistically
    const obs = this.obs.mapObs((p) =>
      p
        ? p.parent.filterEdges(['embed']).reduceObs(
            (acc, e) => {
              acc[e.id] = e;
              return acc;
            },
            () => ({} as Record<string, Model.Edge | null>),
          )
        : p,
    );
    return obs;
  }
}

interface InnerTextFieldCA extends TextFieldCA {
  allowLozenges?: boolean;
  onEnter?: () => void;
}

type Checker<T, R extends T> = R;

export type VMChunk = Checker<Bindings.TSChunk, TextChunk | TextEmbed>;

export class TextField extends ChildNode<VMNode> {
  fontSize = 14;

  //myCaretRange: TextRange;
  // TODO: remove onChange and replace with contentState subscriptions
  onChange?: (value: Bindings.ContentState) => void;

  @OwnedProperty
  itemList = new ObservableList<Bindings.TextFieldItem>();

  @OwnedProperty
  lip = new Observable<number | null>(null);

  @OwnedProperty
  readonly?: ObservableReader<boolean>;
  @OwnedProperty
  readonly propertyConfig?: PropertyConfig;
  @OwnedProperty
  editable: Observable<boolean> = new Observable(false);
  emptyText: string;
  @WeakProperty
  fitContentParent: VMNode | null;
  overflow = true;
  not_updatable?: boolean;
  yieldIneffectiveKeys: boolean;
  onEnter?: () => void;

  @OwnedProperty
  /* private */
  _rustTextField: Bindings.VM_TextField;

  protected constructor({
    propertyConfig,
    emptyText,
    onChange,
    fitContentParent,
    // override editability based on situational usage, not based on data permissions
    readonly,
    not_updatable,
    onChangeTimeout,
    allowLozenges,
    yieldIneffectiveKeys,
    onEnter,
    ...rest
  }: InnerTextFieldCA) {
    super(rest);
    this.onChange = onChange;
    this.onEnter = onEnter;
    this.emptyText = emptyText ?? '';
    this.fitContentParent = fitContentParent;
    this.not_updatable = not_updatable;
    this.readonly = readonly;
    this.yieldIneffectiveKeys = yieldIneffectiveKeys ?? false;

    const propConfig = propertyConfig;
    this.propertyConfig = propConfig;

    const createRustTextField = (prop: Bindings.Property | undefined) => {
      if (prop) {
        return getWasmBindings().VM_TextField.new_with_property(
          prop,
          allowLozenges ?? true,
          this.propertyConfig?.autosave ?? true,
        );
      } else {
        return getWasmBindings().VM_TextField.ephemeral(allowLozenges ?? !!propConfig);
      }
    };

    const rtf = createRustTextField(propConfig?.currentProperty?.rustProperty);
    this._rustTextField = rtf;
    this._calcItemList();
    this.onCleanup(rtf.on_items_updated(() => this.calcItemList(), false));

    if (propConfig) {
      this.managedSubscription(propConfig.embededEdges, (edges) => {
        if (!edges) return;
        for (const child of this.contentItems.value) {
          if (child instanceof TextEmbed && !child.value) child.reevaluate();
        }
      });
      // force rustTextField when property is loaded
      this.managedSubscription(propConfig.obs, (prop) => {
        if (prop?.rustProperty) {
          rtf.set_content_poperty_info(prop.rustProperty, propConfig.autosave);
        }
      });
    }

    const calcEditable = () => {
      const ro = readonly?.value ?? false;
      const ed = propConfig?.currentProperty?.editable ?? true;

      this.editable.set(ed && !ro);
    };

    calcEditable();

    propConfig && this.editable.managedSubscription(propConfig.obs, calcEditable);
    if (readonly) {
      this.editable.managedSubscription(readonly, calcEditable);
    }
    if (this.fitContentParent) {
      // We have to redo the layout if:
      // 1. the parent node changes size
      if (isSized(this.fitContentParent)) {
        this.onCleanup(
          this.fitContentParent.sizeObs.subscribe(() => {
            this.doLayout();
          }),
        );
      }

      // 2. the parent node decides it wants the content to fit or not
      this.onCleanup(
        this.fitContentParent.fitContentObs.subscribe(() => {
          this.doLayout();
        }),
      );
    }

    // this.coalescedPrivileges.subscribe((p) => {
    //   console.log('PRIV TextField coalescedPrivileges changed', p);
    // }, true);
    this.onCleanup(
      this.isSelected.subscribe((selected) => {
        if (selected) {
          this.unsetOffsets();
        }
      }),
    );
  }

  static new(args: TextFieldCA) {
    const me = new TextField(args);
    me.init();
    return me;
  }

  static singleString({
    onSubmit,
    onChange,
    ...args
  }: Omit<TextFieldCA, 'onChange'> & {
    onSubmit?: () => void;
    onChange?: (value: string) => void;
  }) {
    const me = new TextField({
      ...args,
      allowLozenges: false,
      onEnter: onSubmit,
      onChange: onChange ? (value) => onChange(value.to_lossy_string()) : undefined,
    });
    me.init();
    return me;
  }

  async awaitRustTextFieldInitialized() {
    await this.propertyConfig?.obs.awaitHasValue();
  }

  isEmpty(): boolean {
    // Without this line, crashes in the React render cycle b/c it's not wrapped
    // in a useEffect... but we can't memoize or useMemo because the value can change
    // independently of the node
    // https://edvo.atlassian.net/browse/PLM-2263
    if (!this.alive) return true;
    // when _rustTextField is freed, then return true to
    // print the emptyText when rustTextField is not initialized
    return this._rustTextField?.upgrade()?.is_empty ?? true;
  }

  get focusable() {
    // I still want to be able to make text selections of a readonly text field
    // Do we need a different flag for this? Are we using TextField anywhere that we want to disallow text selection
    // return this.editable.value;
    return true;
  }

  get childProps(): (keyof this & string)[] {
    return ['contentItems', 'topicSearch', 'myTextRange'];
  }

  get cursor() {
    return this._cursorFromParent ?? (this.allowHover ? 'pointer' : 'text');
  }

  get allowedLozenges(): boolean {
    return this._rustTextField?.allowed_lozenges ?? true;
  }

  setLozengeCaret() {
    this.update((rtf) => rtf.set_lozenge_caret());
  }

  removeLozengeCaret() {
    this._rustTextField?.remove_lozenge_caret();
  }

  tryLozengeCaretToOffsets() {
    this._rustTextField?.try_lozenge_caret_to_offsets();
  }

  private calcItemList = this.debounce(() => {
    this._calcItemList();
    this.doLayout();
  }, 0);
  private _calcItemList = () => {
    const items = this._rustTextField.items;
    this.itemList.replaceAll(items);
    this.lip.set(this._rustTextField.lip ?? null);
  };

  @MemoizeOwned()
  get contentItems(): ListNode<TextField, VMChunk, Bindings.TextFieldItem> {
    return ListNode.new<TextField, VMChunk, Bindings.TextFieldItem>({
      parentNode: this,
      precursor: this.itemList,
      iterateChildrenForwards: true,
      factory: (item, parentNode) => {
        switch (item.kind) {
          case 'text':
            return TextChunk.new({
              text: item.value,
              parentNode,
              cursor: this.cursor,
            });
          case 'eid':
            const edges = this.propertyConfig?.embededEdges;
            return TextEmbed.new({
              parentNode,
              factory: (parentNode) => {
                const edge = edges?.value?.[item.value];
                if (!edge) return null;
                return Lozenge.new({
                  context: parentNode.context,
                  parentNode,
                  relation: edge,
                  relationshipType: 'tag',
                });
              },
            });
          case 'unknown':
          default:
            return TextEmbed.new({ parentNode });
        }
      },
    });
  }

  @MemoizeOwned()
  get topicSearch() {
    const precursor = this.lip.mapObs((lip) => lip !== null, true);
    return ConditionalNode.new<TopicSearch, any, TextField>({
      parentNode: this,
      precursor,
      factory: (hasTopicSearch, parentNode) => {
        if (!hasTopicSearch) return;
        const topicSearch = TopicSearch.new({
          parentNode,
          fitContentParent: null,
          emptyText: 'Search topic',
          allowHover: true,
          handleBlur: (_prevFocusType) => {
            this.removeLozengeCaret();

            this.context.focusState.setFocus(this, {});
          },
          onSelect: (targetVertex, trx) => {
            this.removeLozengeCaret();
            const edge = this.createEdge(targetVertex, trx);

            this.defer(() => {
              this.insertEmbeddedEdge(edge.id);
              this.context.focusState.setFocus(this, {});
            });
          },
        });
        parentNode.context.focusState.setPendingFocus({
          //match: (node) => node instanceof TopicSearch,
          match: (node) => node === topicSearch.textfield,
          context: {},
        });
        return topicSearch;
      },
    });
  }

  createEdge(targetVertex: Model.Vertex, trx: TrxRef | null): Model.Edge {
    if (this.readonly?.value) {
      throw 'Unreachable: textfield should not be readonly';
    }
    const vertex = this.propertyConfig?.currentProperty?.parent;
    if (!vertex) {
      throw 'Unreachable: vertex should exists';
    }
    const edge = subTrxWrapSync(
      trx ?? null,
      (trx) =>
        vertex.createEdge({
          trx,
          role: ['embed'],
          target: targetVertex,
          meta: {},
        }),
      'textfield-createEdge',
    );
    return edge;
  }

  @MemoizeOwned()
  get myTextRange(): ConditionalNode<TextCaretAndSelection, boolean, TextField> {
    return ConditionalNode.new<TextCaretAndSelection, boolean, TextField>({
      parentNode: this,
      precursor: this.isFocused.mapObs((f) => f === 'leaf'),
      factory: (precursor, parentNode) => {
        return precursor ? TextCaretAndSelection.new({ parentNode, context: this.context }) : null;
      },
    });
  }

  clearTextSelection() {
    this._rustTextField?.clear_offsets();
  }

  /** update the current user caret and selection */
  setTextSelection(start: number, end: number) {
    this._rustTextField?.set_offsets(start, end);
  }

  get textRangeOffsets() {
    return this._rustTextField?.offsets;
  }

  get selectionStart() {
    return this.textRangeOffsets?.start ?? 0;
  }

  get selectionEnd() {
    return this.textRangeOffsets?.end ?? 0;
  }

  get value(): Bindings.ContentState {
    return this._rustTextField?.content_state ?? getWasmBindings().ContentState.from_string('');
  }

  onFocus(context: FocusContext) {
    const rtf = this._rustTextField;

    if (!this.editable.value) {
      const range = rtf?.offsets;
      const selectionStart = range?.start ?? this.value.length;
      const selectionEnd = range?.end ?? selectionStart;
      super.onFocus({
        selectionStart,
        selectionEnd,
        trigger: context.trigger,
        edge: context.edge,
      });
    } else {
      super.onFocus(context);
    }
  }

  get focusCoords() {
    const el = this.domElement;

    if (!el) return null;

    const { start = 0, end = 0 } = this.textRangeOffsets ?? {};
    const markFromRange = document.createRange();

    const items = this.contentItems.value;
    const [startChunkNode, startOffset] = getNodeOffset(items[0], start);
    const [endChunkNode, endOffset] = getNodeOffset(items[0], end);
    const startDomChunk =
      startChunkNode.chunk_length() == startOffset
        ? startChunkNode.contentForwardNode
        : startChunkNode.contentBackwardNode;
    const endDomChunk =
      endChunkNode.chunk_length() == endOffset ? endChunkNode.contentForwardNode : endChunkNode.contentBackwardNode;

    markFromRange.setStart(startDomChunk, startOffset);
    markFromRange.setEnd(endDomChunk, endOffset);
    const { x, y } = markFromRange.getBoundingClientRect();
    return { x, y };
  }

  getNextLineOffset(): null | number {
    const el = this.domElement;
    if (!el) return null;

    const Wasm = getWasmBindings();
    const range = document.createRange();

    const items = this.contentItems.value;
    let [chunkNode, offset] = getNodeOffset(items[0], this.selectionEnd);
    const domChunkNode = chunkNode.contentForwardNode;

    range.setStart(domChunkNode, offset);
    range.setEnd(domChunkNode, offset);
    const { x, y } = range.getBoundingClientRect();

    let node: VMChunk = chunkNode;
    let isNextLine = false;
    while (true) {
      const nextResult = moveOneToRight(node, offset);
      if (nextResult === undefined) {
        if (isNextLine) {
          return Wasm.get_vm_node_global_offset(node, offset).offset;
        } else {
          return null;
        }
      }
      [node, offset] = nextResult;
      const domChunkNode = node.contentForwardNode;
      range.setStart(domChunkNode, offset);
      range.setEnd(domChunkNode, offset);
      const { x: sx, y: sy } = range.getBoundingClientRect();
      // added 5 because lozeges have a padding
      if (sy > y + 5) {
        isNextLine = true;
        if (sx > x - 5) {
          return Wasm.get_vm_node_global_offset(node, offset).offset;
        }
      }
    }
  }

  /**
   *
   * @param fn
   * If the closure returns a true, it means the content state
   * was updated.
   */
  @Guarded
  private update(fn: (rtf: Bindings.VM_TextField) => boolean): boolean {
    if (this.readonly?.value) return false;
    this.propertyConfig?.loadProperty();
    const rtf = this._rustTextField;
    const updated = fn(rtf);
    if (updated) this.onChange?.(rtf.content_state);
    return updated;
  }

  // Remove all characters in the textRange if its expanded, otherwise remove one character to the left
  removeCharacter() {
    if (this.value.length === 0) return false;
    return this.update((rtf) => {
      const offsets = rtf.offsets;
      if (!offsets) return false;

      const end = offsets.max;
      const min = offsets.min;
      const selected = end !== min;

      if (selected) {
        this.archiveLozengesInRange(min, end);
        return rtf.remove_characters();
      }

      const gr = this.value.nth_grapheme(end - 1);
      const width = gr ? getWasmBindings().len_utf16_gr(gr) : 1;
      const start = Math.max(end - width, 0);
      const len = start === 0 && !gr ? 0 : width;

      this.archiveLozengesInRange(start, end);

      return rtf.remove_range(start, len);
    });
  }

  // Removes a range despite the fact the textfield is not focused
  // Try to avoid this method. Prefer this.removeCharacter
  removeRange(start: number, length: number) {
    this.update((rtf) => {
      this.archiveLozengesInRange(start, start + length);
      return rtf.remove_range(start, length);
    });
  }

  private archiveLozengesInRange(start: number, end: number) {
    const edges: (Model.Backref | Model.Edge)[] = [];
    if (end > start) {
      let offset = 0;
      for (const vm of this.contentItems.value) {
        if (offset >= start && vm instanceof TextEmbed) {
          if (vm.value instanceof VM.Lozenge) {
            if (vm.value.relation && vm.value.relation instanceof Model.Edge) edges.push(vm.value.relation);
          }
        }
        offset += vm.chunk_length() ?? 0;
        if (offset >= end) {
          break;
        }
      }
    }
    edges.length &&
      this.propertyConfig?.addOnBeforeSaveHook((trx) => {
        for (const boe of edges) {
          boe.archive(trx);
        }
      });
  }

  unsetOffsets() {
    this.setTextSelection(0, 0);
  }

  /** Insert a string at the current caret, and update the caret to be after the inserted string */
  insertString(s: string) {
    this.update((rtf) => {
      rtf.insert_string(s);
      return true;
    });
  }

  clearContent() {
    this.update((rtf) => rtf.clear_content());
  }

  replaceContent(s: string) {
    this.update((rtf) => {
      const hasOffset = !!rtf.offsets;
      rtf.set_offsets(0, rtf.content_state.length);
      rtf.insert_string(s);
      if (!hasOffset) rtf.clear_offsets();
      return true;
    });
  }

  insertEmbeddedEdge(eid: string) {
    this.update((rtf) => {
      rtf.insert_edge(eid);
      return true;
    });
  }

  doLayout() {
    const el = this.domElement;
    const parentEl = el?.parentElement;
    if (!el || !parentEl) return;
    this._doLayout(el, parentEl);
  }

  private _doLayout = this.debounce((el: HTMLElement, parentEl: HTMLElement) => {
    el.classList.add('measuring_text');

    if (this.fitContentParent?.fitContentObs.value) {
      el.style.width = '100%';
      while (this.fontSize <= 200 && parentEl.clientHeight >= el.scrollHeight && el.scrollHeight !== 0) {
        this.fontSize += 8;
        el.style.fontSize = `${this.fontSize}px`;
        if (el.scrollHeight > parentEl.clientHeight) {
          // If content height exceeds parent height, break
          this.fontSize -= 8; // Revert the last increment
          el.style.fontSize = `${this.fontSize}px`;
          break;
        }
      }
      // Decrease font size until scroll height matches the parent's client height
      while (this.fontSize >= 6 && el.scrollHeight > parentEl.clientHeight) {
        this.fontSize -= 1;
        el.style.fontSize = `${this.fontSize}px`;
      }

      el.style.opacity = '1.0';

      el.classList.remove('measuring_text');
    } else {
      autosize(el);
    }

    // The field size and or font has changed
    this.myTextRange.value?.recalculate();
  }, 0);

  get focusContext(): FocusContext {
    return {
      selectionStart: this.selectionStart,
      selectionEnd: this.selectionEnd,
      // x and y are acceptable to return here
      // and could help transition smoothly between things of different type (Eg text and pdf or image)
      // OR just between text fields which are misaligned, and thus their selectionStart/end are not transferrable
    };
  }

  getFocusContextForEvent(e: MouseEvent): FocusContext {
    const offset = this.offsetFromPoint(e.clientX, e.clientY);

    return {
      selectionStart: offset ?? 0,
      selectionEnd: offset ?? 0,
    };
  }

  getPreviousLineOffset(): null | number {
    const el = this.domElement;
    if (!el) return null;

    const Wasm = getWasmBindings();
    const range = document.createRange();

    const items = this.contentItems.value;
    let [chunkNode, offset] = getNodeOffset(items[0], this.selectionEnd);
    const domChunkNode = chunkNode.contentBackwardNode;
    if (domChunkNode === null) return null;
    range.setStart(domChunkNode, offset);
    range.setEnd(domChunkNode, offset);

    const { x, y } = range.getBoundingClientRect();

    let node: VMChunk = chunkNode;
    let isPrevLine = false;
    while (true) {
      const prevResult = moveOneToLeft(node, offset);
      if (prevResult === undefined) {
        if (isPrevLine) {
          return Wasm.get_vm_node_global_offset(node, offset).offset;
        } else {
          return null;
        }
      }
      [node, offset] = prevResult;
      const domChunkNode = node.contentBackwardNode;
      if (domChunkNode === null) return null;
      range.setStart(domChunkNode, offset);
      range.setEnd(domChunkNode, offset);
      const { x: sx, y: sy } = range.getBoundingClientRect();
      // Substrated 5 beacuse lozenges have a padding
      if (sy < y - 5) {
        isPrevLine = true;
        if (sx <= x + 5) {
          return Wasm.get_vm_node_global_offset(node, offset).offset;
        }
      }
    }
  }

  focusPreviousCharacter(): boolean {
    return true;
  }

  focusNextCharacter(): boolean {
    return true;
  }

  applyFocusContext(context: FocusContext): void {
    const el = this.domElement;
    if (!el) return;

    let { selectionStart, selectionEnd, x, y, edge, selecting } = context;

    let offsets: Bindings.ContentRangeOffsets | undefined;
    if (selecting) {
      this.clearTextSelection();
    } else if (selectionStart !== undefined) {
      // let start = Math.min(selectionStart, selectionEnd ?? 0);
      // let end = Math.max(selectionStart, selectionEnd ?? 0);
      offsets = getWasmBindings().ContentRangeOffsets.new(
        selectionStart === 'end' ? this.value.length : selectionStart,
        (selectionEnd === 'end' ? this.value.length : selectionEnd) ?? 0,
      );
    } else if (x && y) {
      let offset = this.offsetFromPoint(x, y);
      offsets = getWasmBindings().ContentRangeOffsets.collapsed(offset ?? 0);
    } else if (x && edge) {
      const box = this.clientRect;
      if (!box) return;

      let edgeY;
      if (edge === 'top') {
        edgeY = box.y + 5;
      } else {
        edgeY = box.y + box.height - 5;
      }
      let offset = this.offsetFromPoint(x, edgeY);

      offsets = getWasmBindings().ContentRangeOffsets.collapsed(offset ?? 0);
    } else {
      // If all else fails, focus the end
      offsets = this._rustTextField?.offsets ?? getWasmBindings().ContentRangeOffsets.collapsed(this.value.length);
    }

    if (offsets) {
      this.setTextSelection(offsets.start, offsets.end);
    }
  }

  // positionFromPoint(x:number, y:number) : Bindings.TextPosition | null{
  //   let offset = this.offsetFromPoint(x,y);
  //   let position = this.property.value?.rustProperty.getPositionFromOffset(offset);
  //   return position;
  // }

  /** Use the (Browser native DOM for right now) text layout system to determine
   * what TextField offset is under this x/y position
   */
  offsetFromPoint(x: number, y: number): number | null {
    if (this.value.length === 0) return 0;

    const nodeAndPosition = getDomElementByPosition(x, y);
    if (nodeAndPosition == null) return 0;
    const [initialDomNode, domNodeOffset] = nodeAndPosition;

    let domNode = initialDomNode;

    const textEl = this.domElement;
    if (!textEl) return null; // TextField isn't rendered
    if (!textEl.contains(domNode)) return null; // x/y coordinate is outside of the text field
    if (textEl == domNode) return 0; // x/y coordinate is inside the text field, but not on any text

    // We know we're somehwere inside the textfield, but it could be anywhere
    // Lets find the immediate child of the textfield so we can walk properly
    while (true) {
      let pe = domNode.parentElement;

      // Stop as soon as this domNode is the immediate child of the textEl
      if (pe == textEl) break;

      // Otherwise look upward in the ancestry
      if (pe) {
        domNode = pe;
      } else {
        break; // somehow we've gotten to the root??
      }
    }

    // the[dog]jumped[far]above
    const Wasm = getWasmBindings();
    // Now we have to walk backwards from there and count up all the offsets of all the nodes
    // INCLUDING the portion of the node we started from.
    // let textFieldOffset = 0;
    const walkResponse = Wasm.get_dom_node_global_offset(domNode, domNodeOffset);
    return walkResponse.offset;
  }

  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    const config = this.propertyConfig;
    if (this.not_updatable || !config) return new UpdatablesSet([]);
    return new UpdatablesSet([config.obs]);
  }

  upwardNode(): NodeAndContext | null {
    // TODO: pretty fiddly... i'm not fond of it, but let's fix this once we actually
    //       have the base XwardNode methods working properly.
    const hasSearchPanelResults = this.parentNode.children.some((n) => n instanceof SearchPanelResults);

    if (this.parentNode instanceof UserSelectionBox || hasSearchPanelResults) {
      return { node: this };
    }

    const node = this.findPrecedingNode((n) => findNonTextfieldDecendant(n, this));
    if (!node) return null;
    return { node };
  }

  downwardNode(): NodeAndContext | null {
    const parent = this.parentNode;
    const parentIsUserSelectionBox = parent instanceof UserSelectionBox;

    if (parentIsUserSelectionBox) {
      const searchList = parent.searchResults;
      const list = searchList?.results.value;
      if (list.length === 0) return { node: this };

      const node = this.findSucceedingNode((n) => (n instanceof UserItem || n instanceof TextItem) && n);
      return node ? { node } : null;
    }

    const node = this.findSucceedingNode((n) => findNonTextfieldDecendant(n, this));
    const findOutline = (n: VMNode) => n instanceof VM.Outline && n;
    const outlineAscendent = this.findClosest(findOutline);

    if (outlineAscendent) {
      if (node && node.findClosest(findOutline) !== outlineAscendent) {
        return {
          node: this,
          ctx: {
            selectionStart: 'end',
            selectionEnd: 'end',
          },
        };
      }
    }
    if (!node) return null;
    return { node };
  }

  leftwardNode(): NodeAndContext | null {
    return this.upwardNode();
  }

  rightwardNode(): NodeAndContext | null {
    return this.downwardNode();
  }

  // avoids to search in descendant nodes (TextChunk, TextEmbed, TopicSearch)
  findChild<T>(_matchFn: (n: VMNode<VMNode<any> | null>) => false | T | undefined): T | null {
    return null;
  }

  /**
   * overwriting ObservableNode.shallowClone because we want to ensure we clone the property and edges. We DO want to traverse this item's tree.
   */
  @Guarded
  async shallowClone(_targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    const property = await this.propertyConfig?.obs.get();
    if (!property) return null;
    const targetParentVertex = cloneContext.cloneVertex(property.parent);
    const clonedProperty = cloneContext.cloneProperty(targetParentVertex, property);

    const allEdges = await property.parent.edges.forceLoad();

    // TODO: intentionally NOT using propertyConfig.embeddedEdges because loading it does not guarantee that the upstream vertex.edges are loaded, which means this could be missing data
    const embeddedEdges = (await property.parent.filterEdges(['embed']).toArray()) ?? [];
    if (embeddedEdges.length === 0) {
      return null;
    }

    // clone all edges first...
    for (const edge of embeddedEdges) {
      // Not making any assumptions about what has already been cloned -- if it has been cloned, then this will no-op
      // otherwise, we clone it
      const targetVertex = cloneContext.cloneVertex(edge.target);
      cloneContext.cloneEdge(targetVertex, targetParentVertex, edge);
    }

    const items = this._rustTextField.items;
    const rustprop = clonedProperty.rustProperty;
    const rtf = getWasmBindings().VM_TextField.new_with_property(rustprop, true, false);

    rtf.clear_content();

    for (const item of items) {
      const { kind, value } = item;
      switch (kind) {
        case 'text': {
          rtf.insert_string(value);
          break;
        }
        case 'eid': {
          const clonedEdge = cloneContext.clonedEdgeMapping[value];
          if (!clonedEdge) {
            throw new Error('sanity check');
          }
          rtf.insert_edge(clonedEdge.id);
          break;
        }
        case 'unknown': {
          // To don't break search words
          rtf.insert_string(' ');
          break;
        }
      }
    }
    Name.updateKeyword(targetParentVertex, clonedProperty.text.value, cloneContext.trx);
    rustprop.save(cloneContext.trx);
    // not returning null -- we want to clone lozenges too, if we haven't already cloned their name properties
    return targetParentVertex;
  }
}

function findNonTextfieldDecendant(n: VMNode, originNode: TextField): VMNode | undefined | false {
  return n.isVisible && n.focusable && !n.findClosest((n) => n instanceof TextEmbed) && n !== originNode && n;
}

// TODO: refactor using walking nodes in Rust to handle all cases
function moveOneToRight(currentNode: VMChunk, currentLocalOffset: number): [VMChunk, number] | undefined {
  const len = currentNode.chunk_length();

  if (currentLocalOffset < len) {
    return [currentNode, currentLocalOffset + 1];
  }
  const nextNode = currentNode.nextSiblingAny() as VMChunk | undefined;
  if (nextNode === undefined || nextNode.chunk_length() == 0) return undefined;
  if (nextNode instanceof VM.TopicSearch) {
    debugger;
    throw Error("Unreachable: There shouldn't be a TopicSearch during keyboard navigation");
  }
  return [nextNode, 1];
}

// TODO: refactor using walking nodes in Rust to handle all cases
function moveOneToLeft(currentNode: VMChunk, currentLocalOffset: number): [VMChunk, number] | undefined {
  if (currentLocalOffset > 1) {
    return [currentNode, currentLocalOffset - 1];
  }
  const prevNode = currentNode.prevSiblingAny() as VMChunk | undefined;
  if (prevNode === undefined || prevNode.chunk_length() == 0) {
    if (currentLocalOffset === 0) return undefined;
    return [currentNode, 0];
  }
  const prevLen = prevNode.chunk_length();
  return [prevNode, prevLen - 1];
}

type TextEmbedParent = ListNode<TextField, VMChunk, Bindings.TextFieldItem>;

export type TextEmbeddedNode = Checker<VMNode, VM.Lozenge<Model.Edge>>;

interface TextEmbedCA<Child extends TextEmbeddedNode> extends ChildNodeCA<TextEmbedParent> {
  factory?: (parentNode: TextEmbed<Child>) => Child | null;
  length?: number;
}

export class TextEmbed<Child extends TextEmbeddedNode = TextEmbeddedNode>
  extends ObservableNode<Child | null, TextEmbedParent>
  implements Bindings.TSChunk
{
  protected length: number;
  reevaluate: () => boolean;

  private constructor({ factory, length, ...args }: TextEmbedCA<Child>) {
    const childObs = new Observable<Child | null>(null);
    super({
      ...args,
      childObs,
    });
    this.length = length ?? 1;
    factory && childObs.set(factory(this) ?? null);

    this.reevaluate = () => {
      if (!factory) return false;
      const self = this.upgrade() as TextEmbed<Child>;
      if (!self) return false;

      const value = factory(self);
      if (typeof value === 'undefined') return false;

      const prev = self.value;
      if (!prev && !value) return false;
      if (prev && value && prev.equals(value)) return false;
      childObs.set(value);
      return true;
    };
  }

  static new<Child extends TextEmbeddedNode>(args: TextEmbedCA<Child>) {
    const me = new TextEmbed<Child>(args);
    me.init();
    return me;
  }

  // Returns the div element of the lozenge itself (not the text node under it)
  get contentForwardNode(): Node {
    // HACK: selects the &nbsp; to be able to navigate with left and right keys
    return this.domElement!.lastChild!;
  }

  get contentBackwardNode(): Node {
    // HACK: selects the &nbsp; to be able to navigate with left and right keys
    return this.domElement!.firstChild!;
  }

  // Signies that the WHOLE element should be selected, not some offset within it
  get contentDivisible(): boolean {
    return false;
  }

  chunk_length(): number {
    return this.length;
  }

  get child() {
    return this.value;
  }
}

function getDomElementByPosition(x: number, y: number): [Node, number] | null {
  // Different browsers have different ways of doing this.
  // either way we get a DOM node and an offset into that node
  // @ts-ignore
  if (document.caretPositionFromPoint) {
    interface CaretPosition {
      offsetNode: Node;
      offset: number;
    }

    // Using the browser's native DOM/CSS layout system to measure where this xy coordinate is in tree
    // @ts-ignore
    let position = document.caretPositionFromPoint(x, y) as CaretPosition;
    return [position.offsetNode, position.offset];
  } else {
    // Using the browser's layout system to measure where this xy coordinate is in tree
    let range = document.caretRangeFromPoint(x, y);
    if (!range) return null;

    return [range.startContainer, range.startOffset];
  }
}
