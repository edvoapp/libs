import debounce from 'lodash/debounce';
import { EdvoObj, OwnedProperty } from '@edvoapp/util';
import { consolidateRects, relativeToAbsoluteClientRect, generateKey } from '@edvoapp/util';
import { SelectorXpath } from './selectors';
import { HighlightPlain, PAINT_STATUS, SelectorData, Selector, HighlightNode } from '../../highlight';
import { HighlightAgent } from '../../highlight-agent';

export class WebHighlighter extends EdvoObj {
  @OwnedProperty
  highlightAgent: HighlightAgent;

  constructor(highlightAgent: HighlightAgent) {
    super();
    this.highlightAgent = highlightAgent;
    this.onCleanup(this.bindEvents());
  }

  private bindEvents() {
    window.addEventListener('resize', this.update);
    this.highlightAgent.on('ENABLE', () => this.enableNewHighlights());
    this.highlightAgent.on('DISABLE', () => this.disableNewHighlights());
    this.highlightAgent.on('SCROLL_TO_HIGHLIGHT', (res: HighlightPlain) => this.scrollToHighlight(res));
    const observer = new MutationObserver(this.update);
    observer.observe(document.body, { subtree: true, attributes: true });

    const unsubscribe = this.highlightAgent.highlights.subscribe({
      ITEM_LISTENER: (highlight: HighlightPlain, op: string) => {
        if (op === 'ADD') {
          void this.drawBoxes(highlight);
        } else if (op === 'REMOVE') {
          console.log('Web:remove', highlight);
          this.removeBoxes(highlight);
        }
      },
    });

    return () => {
      this.disableNewHighlights();
      window.removeEventListener('resize', this.update);
      observer.disconnect();
      unsubscribe();
    };
  }

  private enableNewHighlights() {
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  private disableNewHighlights() {
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  private scrollToHighlight(payload: HighlightPlain) {
    const highlight = this.highlightAgent.getHighlightByProp('body', payload.body);

    if (!highlight || !highlight.boxElements?.length) return;
    const [box] = highlight.boxElements;
    const y = box.getBoundingClientRect().top + window.scrollY;
    window.scroll({
      top: y,
      behavior: 'smooth',
    });
  }

  private handleMouseUp = () => {
    const selection = document.getSelection();
    if (!selection) return;

    const { rangeCount, anchorOffset, focusOffset } = selection;
    const selectionEmpty = !rangeCount || anchorOffset === focusOffset;

    if (selectionEmpty || selection?.isCollapsed) return;

    this.newHighlight(selection?.getRangeAt(0));
  };

  private newHighlight(range?: Range): void {
    const body = range?.toString();
    if (!range || !body) return;

    const selectors = this.defineSelectors(range);
    const highlight = {
      body,
      selectors,
      range,
      key: generateKey(),
    } as HighlightPlain;
    this.drawBoxes(highlight);
    delete highlight.range;
    this.setHighlightBoundingRect(highlight);
    this.highlightAgent.newHighlight(highlight);
  }

  private defineSelectors(range: Range): SelectorData[] {
    return [new SelectorXpath(document).define(range).data];
  }

  private getRangePositions(range: Range) {
    const boundingRect = range.getBoundingClientRect();
    const rects = consolidateRects(Array.from(range.getClientRects()));

    return {
      boundingRect: boundingRect.toJSON(),
      rects: rects.map((r) => r.toJSON()),
    };
  }

  private drawBoxes(highlight: HighlightPlain) {
    if (highlight.boxElements?.length) return; //already drawn
    const container = this.setHighlightPosition(highlight);
    if (!container) return this.highlightAgent.reportPaintStatus(highlight.key, PAINT_STATUS.FAILED);
    const { rects = [] } = highlight.positionInfo || {};
    const fragment = document.createDocumentFragment();
    highlight.boxElements = rects
      .sort((a: DOMRect, b: DOMRect) => a.y - b.y)
      .map((rect: DOMRect) => {
        const r = relativeToAbsoluteClientRect(rect);
        const element = HighlightNode.create({
          top: `${r.top - 2}px`,
          left: `${r.left}px`,
          height: `${r.height + 4}px`,
          width: `${r.width}px`,
        });
        element.dataset.key = highlight.key;

        element.addEventListener('mouseup', (e) => {
          e.stopPropagation();
          const isIframe = window.self !== window.top;
          if (!isIframe) {
            return this.highlightAgent.openInNewTab(highlight);
          }
          this.setHighlightBoundingRect(highlight);
          this.highlightAgent.focusHighlight(highlight);
        });
        fragment.appendChild(element);

        return element;
      });
    container.appendChild(fragment);
    this.highlightAgent.reportPaintStatus(highlight.key, PAINT_STATUS.MATCHED);
  }

  private removeBoxes(highlight: any) {
    highlight.boxElements?.forEach((node: HTMLElement) => node.parentElement?.removeChild(node));
    highlight.boxElements = [];
  }

  private setHighlightPosition(highlight: any): HTMLElement | void {
    const { selectors = [], body = '' } = highlight;
    const range = highlight.range || this.applySelectors(selectors, body);
    if (!range) return;
    highlight.range = range;
    const positionInfo = this.getRangePositions(range);
    highlight.positionInfo = positionInfo;
    return document.body;
  }

  private applySelectors(selectors: SelectorData[] = [], body: string) {
    let range = null;

    for (let i = 0, l = selectors.length; i < l; i++) {
      const data = selectors[i];
      const selector = new Selector({ data });
      switch (data.selector) {
        case 'xpath': {
          range = new SelectorXpath(document).apply(selector, body);
          break;
        }
      }
      if (range) return range;
    }

    return range;
  }

  private setHighlightBoundingRect(highlight: HighlightPlain | null) {
    if (!highlight) return;
    const { boxElements = [], positionInfo } = highlight;
    if (!boxElements.length) return;
    positionInfo.boundingRect = boxElements[0].getBoundingClientRect();
  }

  update = debounce(() => {
    this.drawAll();
    this.highlightAgent.highlights.forEach((h: HighlightPlain) => {
      this.removeBoxes(h);
      this.drawBoxes(h);
    });
  }, 500);

  drawAll(replace = true) {
    this.highlightAgent.highlights.forEach((h: HighlightPlain) => {
      replace && this.removeBoxes(h);
      this.drawBoxes(h);
    });
  }

  removeAll() {
    this.highlightAgent.highlights.forEach((h: HighlightPlain) => this.removeBoxes(h));
  }

  cleanup(debugStack?: Error): void {
    this.removeAll();
    this.disableNewHighlights();
    super.cleanup();
  }
}
