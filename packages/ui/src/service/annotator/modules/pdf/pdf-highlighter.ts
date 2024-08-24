import {
  relativeToAbsoluteClientRect,
  consolidateRects,
  relativeToRect,
  EdvoObj,
  generateKey,
  Observable,
  OwnedProperty,
} from '@edvoapp/util';
import { config } from '@edvoapp/common';
import { SelectorPageRange } from './selectors/selector-page-range';
import { PdfDom } from '../../../../components/pdf-view/pdf-dom';
import {
  HighlightPositionInfo,
  HighlightPlain,
  Selector,
  SelectorDataPageRange,
  SelectorData,
  PAINT_STATUS,
  HighlightNode,
} from '../../highlight';
import { HighlightAgent } from '../../highlight-agent';
import { ViewportState } from '../../../../viewmodel';

interface ConstructorArgs {
  viewport?: ViewportState;
  highlightAgent: HighlightAgent;
  pdfDom: PdfDom;
}

export class PdfHighlighter extends EdvoObj {
  @OwnedProperty
  pdfDom: PdfDom;
  @OwnedProperty
  highlightAgent: HighlightAgent;
  readonly viewport?: ViewportState;

  constructor({ highlightAgent, pdfDom, viewport }: ConstructorArgs) {
    super();
    this.highlightAgent = highlightAgent;

    this.pdfDom = pdfDom;
    // pdfDom.assign;

    this.viewport = viewport;
  }

  update = this.debounce(() => {
    this.highlightAgent.highlights.forEach((h: HighlightPlain) => {
      this.removeBoxes(h);
      void this.drawBoxes(h);
    });
  }, 500);

  removeAll() {
    this.highlightAgent.highlights.forEach((h: HighlightPlain) => this.removeBoxes(h));
  }

  bindEvents(container: HTMLElement) {
    if (!container) return;
    container.addEventListener('mouseup', this.handleMouseUp);
    const unsubscribe = this.highlightAgent.highlights.subscribe({
      ITEM_LISTENER: async (highlight: HighlightPlain, op: string) => {
        if (op === 'ADD') {
          void this.drawBoxes(highlight);
        } else if (op === 'REMOVE') {
          this.removeBoxes(highlight);
        }
      },
    });
    this.highlightAgent.sendReady();

    this.onCleanup(() => {
      container.removeEventListener('mouseup', this.handleMouseUp);
      unsubscribe();
    });
  }

  private handleMouseUp = (e: MouseEvent) => {
    // Only add a Highlight if the selection is both non-empty and wholly
    // contained inside the text layer.
    const selection = document.getSelection();
    const pdfContainer = e.target as HTMLElement;
    const { anchorNode, focusNode } = selection || {
      anchorNode: null,
      focusNode: null,
    };
    // I believe there is a bug in Firefox's implementation of isCollapsed -- according to
    // the w3 standard (https://www.w3.org/TR/selection-api/#dom-selection-iscollapsed)
    // isCollapsed must only be true if the anchor and focus nodes are equal
    // for some reason, in the context of the ShadowDom, isCollapsed is returning true
    // evfen though the anchor and focus nodes are not equal.
    const selectionEmpty = !selection?.rangeCount || selection?.anchorOffset === selection?.focusOffset;
    const containsAnchor = !pdfContainer.contains(anchorNode as Node);
    const containsFocus = !pdfContainer.contains(focusNode as Node);
    if (
      !selection ||
      selectionEmpty ||
      containsAnchor ||
      containsFocus ||
      pdfContainer === selection.anchorNode ||
      pdfContainer === selection.focusNode
    ) {
      return;
    }

    this.newHighlight(selection.getRangeAt(0));
  };

  setHighlightScrollHandler(cb: (page: number) => Promise<void>) {
    this.highlightAgent.on('SCROLL_TO_HIGHLIGHT', async (payload: HighlightPlain) => {
      const highlight = this.highlightAgent.getHighlightByProp('body', payload.body);
      if (!highlight) return;
      const selector = this.getHighlightPageSelector(highlight);
      if (!selector) return null;
      const { startPageIndex } = selector.payload;
      cb(startPageIndex + 1);
    });
  }

  private newHighlight(range?: Range) {
    const body = range?.toString();
    if (!range || !body) return;

    const root = this.pdfDom.outerContainer();
    if (!root) return;
    const selectors = this.defineSelectors(range, root);
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

  private defineSelectors(range: Range, root: HTMLElement): SelectorData[] {
    return [new SelectorPageRange(root).define(range).data];
  }

  private setHighlightBoundingRect(highlight: HighlightPlain | null) {
    if (!highlight) return;
    const { boxElements = [], positionInfo } = highlight;
    if (!boxElements.length) return;
    positionInfo.boundingRect = boxElements[0].getBoundingClientRect();
  }

  protected cleanup() {
    this.removeAll();
    super.cleanup();
  }

  private getRangePositions(container: HTMLDivElement, range: Range): HighlightPositionInfo | null {
    if (!range || !container) {
      return null;
    }

    const containerClientRect = container.getBoundingClientRect();

    const rectsOrig = Array.from(range.getClientRects()).map((rect) => {
      const _rect = rect as DOMRectReadOnly;
      return relativeToRect(_rect, containerClientRect);
    });

    if (!rectsOrig.length) return null;

    const { planeScale: scale } = this.viewport || { planeScale: 1 };
    const rects = consolidateRects(rectsOrig).map((r: DOMRect) => {
      const { x, y, width: w, height: h } = r;
      const args = [x, y, w, h].map((i) => i / scale);
      return new DOMRectReadOnly(...args);
    });

    const { x, y, width, height } = rects[0];

    const boundingRect = new DOMRectReadOnly(x, y + container.offsetTop, width, height);

    return {
      boundingRect,
      rects,
    };
  }

  private setHighlightPosition(highlight: HighlightPlain): HTMLDivElement | void {
    const { selectors = [], body = '' } = highlight;
    const selector = this.getHighlightPageSelector(highlight);
    if (!selector) return;
    const range = this.applySelectors(selectors, body);
    if (!range) return;

    highlight.range = range;
    const { startPageIndex, endPageIndex } = selector.payload;
    const pageContainer =
      this.pdfDom.getPageContainer(startPageIndex + 1) ||
      (this.pdfDom.getPageContainer(endPageIndex + 1) as HTMLDivElement);
    if (!pageContainer) return;

    const positionInfo = this.getRangePositions(pageContainer, range);
    if (!positionInfo) return;
    highlight.positionInfo = positionInfo;
    return pageContainer;
  }

  private getHighlightPageSelector(highlight: HighlightPlain): SelectorDataPageRange | null {
    const { selectors = [] } = highlight;
    const selector = selectors.find((s) => s.selector === 'page-range') as SelectorDataPageRange;
    if (!selector) return null;

    return selector;
  }

  async drawBoxes(highlight: HighlightPlain) {
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

        fragment.appendChild(element);

        element.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!config.testWebApp(window.location.href)) {
            return this.highlightAgent.openInNewTab(highlight);
          }
          this.focusHighlight(highlight);
        });

        return element;
      });
    container.appendChild(fragment);

    this.highlightAgent.reportPaintStatus(highlight.key, PAINT_STATUS.MATCHED);
  }

  focusHighlight(highlight: HighlightPlain | null) {
    this.setHighlightBoundingRect(highlight);
    this.highlightAgent.focusHighlight(highlight);
  }

  removeBoxes(highlight: HighlightPlain) {
    highlight.boxElements?.forEach((node: HTMLElement) => node.parentElement?.removeChild(node));
    highlight.boxElements = [];
  }

  private applySelectors(selectors: SelectorData[] = [], body: string): Range | null {
    let range = null;
    const root = this.pdfDom.outerContainer() || document;

    for (let i = 0, l = selectors.length; i < l; i++) {
      const data = selectors[i];
      const selector = new Selector({ data });
      switch (data.selector) {
        case 'page-range': {
          range = new SelectorPageRange(root).apply(selector, body);
          break;
        }
      }
      if (range) return range;
    }

    return range;
  }
}
