import { Model, globalStore, QueryObservable, Analytics, DB } from '@edvoapp/common';
import { ObservableList, EdvoObj, Observable, OwnedProperty, WeakProperty } from '@edvoapp/util';
import {
  Selector,
  Highlight,
  SelectorSet,
  SelectorData,
  HighlightPositionInfo,
  HighlightRenderContext,
  PAINT_STATUS,
  Transport,
  HighlightMessagePayload,
  HighlightAgentEvents,
} from './highlight';

import { activeConversationObs } from '../../components/conversation-modal/conversation-modal';
import * as VM from '../../viewmodel';

import { useNavigator } from '..';

interface ConstructorArgs {
  entity: Observable<Model.Vertex | null>;
  node?: VM.Node;
}

export class HighlightManager extends EdvoObj {
  @OwnedProperty
  readonly highlights = new ObservableList<Highlight<HighlightRenderContext>>();
  @OwnedProperty
  highlightVertices: QueryObservable<Model.Vertex> | null = null;
  @OwnedProperty
  entity: Observable<Model.Vertex | null>;
  @OwnedProperty
  transport: Transport | null = null;
  @OwnedProperty
  node?: VM.Node;
  @WeakProperty
  memberNode: VM.Member | null;
  @OwnedProperty
  vertex: Model.Vertex | null = null;

  constructor({ entity, node }: ConstructorArgs) {
    super();
    this.entity = entity;
    this.node = node;
    this.memberNode = node?.findClosest((n) => n instanceof VM.Member && n) || null;
  }

  bindTransport(transport: Transport) {
    this.transport?.deregisterReferent(this, 'transport');
    this.transport = transport;
    this.onCleanup(this.transport.subscribe(HighlightAgentEvents, (r) => this.onMessage(r)));
  }

  private toggleHighlightMode(enabled: boolean) {
    if (enabled) this.transport?.send('ENABLE');
    else this.transport?.send('DISABLE');
  }

  private load() {
    this.entity.subscribe(() => {
      const { value: vertex } = this.entity;
      if (!vertex) return;

      this.vertex = vertex;
      const { id } = vertex;

      const where: Parameters<DB.Query['where']>[] = [
        ['userID', '==', globalStore.getCurrentUserID()],
        ['kind', '==', 'highlight'],
        ['parentVertexID', '==', id],
      ];

      this.highlightVertices = globalStore.query<Model.Vertex>('vertex', null, {
        where,
      });
      this.highlightVertices.clear();
      this.highlightVertices.injectQuery(
        Model.Vertex.rawQuery({
          where: [
            ['parentVertexID', '==', id],
            ['kind', '==', 'highlight'],
          ],
        }),
      );
      this.highlightVertices.execute();

      this.onCleanup(
        this.highlightVertices.subscribe({
          ITEM_LISTENER: async (vertex: Model.Vertex, op: string) => {
            const { id } = vertex;

            if (op === 'ADD') {
              // Ignore vertices that already have highlights in the set
              // Newly defined Highlights which are saved will show up as
              // an ADD when they come back from the database, which we want
              // to ignore.
              const vertices = this.highlights.map((h: Highlight<HighlightRenderContext>) => h.vertex);
              const has = !!vertices.find((v: Model.Vertex) => v?.id === id);
              if (!has) {
                let highlight = Highlight.load({ vertex });
                this.highlights.insert(highlight);
              }
            } else if (op === 'REMOVE') {
              this.highlights.removeWhere((h: Highlight<HighlightRenderContext>) => h.vertex.id === id);
            }
          },
        }),
      );
    }, true);
  }

  private onMessage = (e: HighlightMessagePayload) => {
    const { type, payload } = e;

    switch (type) {
      //do all subscriptions ONLY when the agent is ready to communicate to the manager
      //otherwise, the manager will fire events into the void
      case 'READY': {
        const highlightModeObs = this.memberNode?.highlightMode;
        if (highlightModeObs) {
          this.toggleHighlightMode(highlightModeObs.value);
          this.onCleanup(highlightModeObs.subscribe(() => this.toggleHighlightMode(highlightModeObs.value)));
        }
        this.load();
        this.highlights.subscribe({
          ITEM_LISTENER: (highlight: Highlight<HighlightRenderContext>, op: string) => {
            if (op === 'ADD') {
              void this.paint(highlight);
            } else if (op === 'REMOVE') {
              this.unpaint(highlight);
            }
          },
        });
        return;
      }
      case 'ADD': {
        if (!payload || !this.vertex) return;
        const { positionInfo, selectors = [], body, key, boxElements = [] } = payload;
        this.applyPositionScale(positionInfo);
        const highlight = this.newHighlight({
          key,
          body,
          selectors,
          parentVertex: this.vertex,
          positionInfo,
          boxElements,
        });
        navigator.clipboard.writeText(body);
        if (!highlight) return;
        this.focusHighlight(highlight);
        return;
      }
      case 'FOCUS': {
        if (!payload || !this.vertex) return;
        const { key, positionInfo } = payload;
        const highlight = this.findHighlightByKey(key);
        this.applyPositionScale(positionInfo);
        highlight?.setPositionInfo(positionInfo);
        this.focusHighlight(highlight);
        return;
      }
      case 'OPEN': {
        if (!payload || !this.vertex) return;
        const { key } = payload;
        const highlight = this.findHighlightByKey(key);
        if (!highlight) return;
        const { vertex } = highlight;
        const nav = useNavigator();
        nav.openTopic(this.vertex, vertex);
        return;
      }
      case 'PAINT_STATUS': {
        if (!payload) return;
        const { key, status } = payload;
        const highlight = this.findHighlightByKey(key);
        if (!highlight) return;
        if (status === PAINT_STATUS.MATCHED) return highlight.match.set('matched');

        highlight.match.set('failed');
        if (highlight.matchAttempts >= 5) return;

        highlight.incrementMatchAttempts();

        setTimeout(() => {
          this.paint(highlight);
        }, 500);
        return;
      }
    }
  };

  private applyPositionScale(positionInfo: HighlightPositionInfo) {
    if (!positionInfo || !this.transport) return;
    const { boundingRect } = positionInfo;
    let rect: DOMRectReadOnly = boundingRect;
    const { width, height, x, bottom } = boundingRect;
    const topicSpace = this.node?.findClosest((n: VM.Node) => n instanceof VM.TopicSpace && n);
    const firstMember = topicSpace?.members.firstChild();
    const scale = firstMember?.viewport?.value.innerScale || 1;
    switch (this.transport.type) {
      case 'webview':
      case 'iframe': {
        const containerRect = this.node?.domElement?.getBoundingClientRect();
        if (!containerRect) return;
        const top = containerRect.top + bottom * scale;
        const left = containerRect.left + (x / 2) * scale;
        rect = new DOMRectReadOnly(left, top, width, height);
        break;
      }
      case 'dom': {
        const top = bottom;
        const left = x - (width / 2) * scale;
        rect = new DOMRectReadOnly(left, top, width, height);
        break;
      }
    }

    positionInfo.boundingRect = rect;
  }

  private newHighlight(args: {
    key?: string;
    selectors: any[];
    body: string;
    positionInfo: HighlightPositionInfo;
    parentVertex: Model.Vertex;
    boxElements: HTMLElement[];
  }) {
    const { selectors, parentVertex: parentVertex, positionInfo, body, key, boxElements = [] } = args;

    if (!positionInfo) return;

    const leading = '';
    const trailing = '';
    const selectorSet = new SelectorSet();

    selectors.forEach((data) => selectorSet.add(new Selector({ data })));

    const highlight = Highlight.define({
      key,
      selectorSet,
      text: {
        body,
        leading,
        trailing,
      },
      positionInfo,
      parentVertex,
      renderContext: { boxElements },
    });
    Analytics.event('annotate', { action: 'New Highlight' });
    return highlight;
  }

  private async paint(highlight: Highlight<HighlightRenderContext>) {
    const selectors = await this.getSelectorsPayload(highlight);

    if (!selectors || !this.transport) return;

    const { body } = await highlight.text.get();

    this.transport.send('PAINT', {
      key: highlight.id,
      body,
      selectors,
    });
  }

  private unpaint(highlight: Highlight<HighlightRenderContext>) {
    this.transport?.send('REMOVE', { key: highlight.id });
  }

  private async getSelectorsPayload(highlight: Highlight<HighlightRenderContext>): Promise<SelectorData[] | void> {
    const selectors = await highlight.selectorSet.get();

    if (!selectors) return highlight.match.set('failed');

    const payload = [];

    for (const selector of selectors.set) {
      payload.push(selector.data);
    }
    return payload;
  }

  private findHighlightByKey(key: string): Highlight<HighlightRenderContext> | null {
    return this.highlights.find((h: Highlight<HighlightRenderContext>) => h.id === key) || null;
  }

  focusHighlight(highlight: Highlight<HighlightRenderContext> | null) {
    let active = activeConversationObs.value?.highlight;
    const changed = active?.key !== highlight?.key;

    // Remove unsaved highlights on blur
    if (changed && active && !active.isSaved()) {
      this.highlights.remove(active);
    }

    if (
      highlight &&
      // ensure we only ever have one highlight by key
      !this.highlights.containsBy((h: Highlight<HighlightRenderContext>) => h.key === highlight.key)
    ) {
      this.highlights.insert(highlight);
    }

    if (!highlight) {
      activeConversationObs.set(null);
    } else if (changed) {
      activeConversationObs.set({ highlight, highlightManager: this });
    }
  }

  async scrollToHighlight(highlight: Highlight<HighlightRenderContext>) {
    const selectors = await this.getSelectorsPayload(highlight);

    if (!selectors || !this.transport) return;

    const { body } = await highlight.text.get();

    this.transport.send('SCROLL_TO_HIGHLIGHT', {
      key: highlight.id,
      body,
      selectors,
    });
  }

  protected cleanup() {
    this.highlights.forEach((highlight: Highlight<HighlightRenderContext>) => {
      this.unpaint(highlight);
    });
    super.cleanup();
  }
}
