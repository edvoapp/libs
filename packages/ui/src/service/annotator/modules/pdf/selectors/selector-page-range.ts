import { findParentNode } from '@edvoapp/util';
import { Selector, SelectorModule, SelectorDataPageRange } from '../../../highlight';

/**
 * Highlight Selector which specifies a range between two
 * page-index/code-unit-offset pairs in a PDF this.domRoot.
 */
export class SelectorPageRange extends SelectorModule {
  constructor(private root: HTMLElement | Document = document) {
    super();
  }

  define(range: Range): Selector {
    const { endOffset, startOffset, endContainer, startContainer } = range;

    const startPlace = this.toPagePlace(startContainer, startOffset);
    const endPlace = this.toPagePlace(endContainer, endOffset);

    const startPageIndex = startPlace.pageIndex;
    const endPageIndex = endPlace.pageIndex;

    return new Selector({
      data: {
        selector: 'page-range',
        payload: {
          startPageIndex,
          startOffset: startPlace.offset,
          endPageIndex,
          endOffset: endPlace.offset,
        },
      },
    });
  }

  apply(selector: Selector, key: string): Range | null {
    const data = selector.data as SelectorDataPageRange;
    let start = this.fromPagePlace(data.payload.startPageIndex, data.payload.startOffset);
    let end = this.fromPagePlace(data.payload.endPageIndex, data.payload.endOffset);
    if (!start || !end) return null;
    const range = new Range();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  }

  // Turn a page-number/code-unit-offset pair into a text node and an offset
  // in a PDF.js text layer.
  //
  // TODO: This function makes a number of perhaps-fragile assumptions about
  // DOM node structure.  It should be hardened against changes by using
  // traditional APIs.
  // TODO: This function will fail if the rendering of the PDF.js textLayer
  // is incomplete.
  private fromPagePlace(pageIndex: number, offset: number) {
    const pdfContainer = this.root.querySelector('.page-viewer');
    const pageElem = pdfContainer?.querySelector(`.page[data-page-number="${pageIndex + 1}"]`);
    if (!pageElem || !pageElem.hasChildNodes()) {
      return null;
    }

    const textLayer = pageElem.querySelector('.textLayer');
    if (!textLayer) {
      return null;
    }

    let nodeIter = document.createNodeIterator(textLayer, NodeFilter.SHOW_TEXT);
    let textNode: Node | null;
    while ((textNode = nodeIter.nextNode())) {
      let len = textNode.textContent?.length || 0;
      if (len >= offset) {
        return {
          node: textNode,
          offset: offset,
        };
      }
      offset -= len;
    }
    return null;
  }

  private toPagePlace(node: Node, offset: number) {
    const pagePlace = { pageIndex: 0, offset: 0 };

    const pdfContainer = this.root.querySelector('.page-viewer');
    if (!pdfContainer) throw new Error('.page-viewer is not defined');

    if (!pdfContainer.contains(node) || node === pdfContainer) {
      throw 'Expected node to be inside text container';
    }

    // Find the page-level container by traversing the graph upwards.
    const ancestor: Node | null = findParentNode(pdfContainer, node, (elem: HTMLElement) => {
      return elem.hasAttribute('data-page-number');
    });

    if (!ancestor) {
      throw 'failed to find PDF Page element';
    }
    let pageElem = ancestor as HTMLElement;
    let textLayer = pageElem.querySelector('.textLayer');
    if (!textLayer) {
      throw 'failed to PDF textLayer element';
    }
    pagePlace.pageIndex = Number(pageElem.getAttribute('data-page-number')) - 1;

    // Traverse all the text nodes inside the page, accumulating offset, until
    // we arrive at the target node.
    let nodeIter = document.createNodeIterator(textLayer);
    let child: Node | null;
    while ((child = nodeIter.nextNode())) {
      if (child == node) {
        pagePlace.offset += offset;
        return pagePlace;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        pagePlace.offset += child.textContent?.length || 0;
      }
    }
    throw 'unexpected failure to find node during iteration';
  }
}
