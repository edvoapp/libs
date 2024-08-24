import { EdvoObj, Observable } from '@edvoapp/util';

/**
 * Represent the DOM elements for a PDF parsed and rendered by PDF.js.
 *
 * TODO: lazy loading.
 * TODO: Additional events.
 * TODO: page(pageNum) returns div
 * TODO: textLayer(pageNum) returns div
 */
export class PdfDom extends EdvoObj {
  private _outerContainer: HTMLDivElement | undefined;

  protected cleanup() {
    // delete this._outerContainer;
    super.cleanup();
  }
  /**
   * Get the div element for the outermost container.
   *
   * It is invalid to call this function before it has been initialized.
   */
  outerContainer(): HTMLDivElement | null {
    if (!this._outerContainer) return null;
    return this._outerContainer;
  }

  /**
   * Set the outermost container div for PDF DOM.
   *
   * It must have `position: absolute` and an ID of `viewerContainer`.
   *
   * Once this function is called with a given `container`, it can be called
   * again with the same value, but if a different value is supplied it will
   * `throw`.
   */
  establishOuterContainer(container: HTMLDivElement) {
    if (this._outerContainer === container) return;
    if (this._outerContainer) throw "outerCountainer can't be established twice";

    this._outerContainer = container;
  }

  getPageContainer(pageNum: number): HTMLDivElement | null {
    const pdfViewerDiv = this._outerContainer?.querySelector('.page-viewer');
    if (pdfViewerDiv === null || !pdfViewerDiv?.hasChildNodes()) return null;

    const pageElem: HTMLDivElement | null = pdfViewerDiv.querySelector(`div.page[data-page-number="${pageNum}"]`);
    if (!pageElem) return null;

    return pageElem;
  }
}
