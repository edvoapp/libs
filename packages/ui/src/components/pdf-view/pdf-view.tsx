import throttle from 'lodash/throttle';
import debounce from 'lodash/debounce';
import { Component, Ref } from 'preact';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy, PDFPageProxy, renderTextLayer, version } from 'pdfjs-dist';

import { Model } from '@edvoapp/common';
import { PdfDom } from './pdf-dom';
import { Annotator } from '../../service';
import { OutlineItem, PdfOutline } from './pdf-outline';
import { OutlineIcon } from '../../assets/icons';
import './pdf-view.scss';
import { forwardRef } from 'preact/compat';
import { Guard, tryJsonParse } from '@edvoapp/util';
import { BodyContent, Member } from '../../viewmodel';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { getResizeCorner } from '../../behaviors';

GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.js`;

type PdfViewProps = {
  node: BodyContent;
  vertex: Model.Vertex;
  pdfDom: PdfDom;
  highlighter: Annotator.Highlighter.Pdf;
  innerRef?: Ref<any>;
};

type PdfViewState = {
  edvoError: string | null;
  currentPage: number;
  renderDone: boolean;
  outlineOpened: Boolean;
  outlines: OutlineItem[];
};

type PageViewport = {
  viewBox: number[];
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  transform: number[];
  width: number;
  height: number;

  clone(): PageViewport;
  convertToViewportPoint(x: number, y: number): Object;
  convertToViewportRectangle(rect: any[]): any[];
  convertToPdfPoint(x: number, y: number): Object;
};

/**
 * Container for PDF.js document parsing PDF content.
 *
 * The structure of the HTML is part of this module's API, and is
 * built to be compatible with the PDF.js web API.
 *
 * - The container div for the PDF display has the ID `viewerContainer`.
 * - The div which holds the PDFViewer object has the ID `viewer`.
 * - Immediabely below `viewer` are 1 or more divs with the class `page`.
 * - Each `page` has a `data-page-number` property.
 * - Inside each `page` is a div with the class `textLayer`.
 */
export class PdfViewRenderer extends Component<PdfViewProps, PdfViewState> {
  private viewerEl: HTMLDivElement | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private pageViewports: PageViewport[] = [];
  private pdfBytes: Uint8Array | null = null;
  private pdfDoc: PDFDocumentProxy | null = null;
  private pdfCachedPages: Map<number, PDFPageProxy> = new Map();
  private resizeObserver: ResizeObserver;
  constructor(props: PdfViewProps) {
    super(props);
    this.state = {
      edvoError: null,
      currentPage: 1,
      renderDone: false,
      outlineOpened: false,
      outlines: [],
    };

    // HACK - all of this machinery should be on the VM Node itself
    props.node.pdfViewComponent = this;

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry || !entry.target || !this.state.renderDone) return;
      this.updateViewport();
    });
  }

  componentWillUnmount() {
    this.viewerEl?.parentElement?.removeEventListener('scroll', this.handleScroll);
    this.visibilityObserver?.disconnect();
    this.resizeObserver?.disconnect();
  }

  fatalError(reason: any) {
    const edvoError = String(reason);
    this.setState({
      edvoError,
    });
    return reason;
  }

  updateViewport = debounce(async () => {
    // TODO: clean this up
    const { highlighter } = this.props;
    if (!this.viewerEl || !highlighter.alive) return;
    await Guard.while(highlighter, async (highlighter) => {
      await this.computePDFSizes();

      const pageNodes = this.viewerEl?.querySelectorAll('.page');
      if (!pageNodes) return;

      highlighter?.removeAll();

      await Promise.all(
        Array.from(pageNodes).map((p) => {
          const index = p.getAttribute('data-page-number');
          if (!index) return;

          return this.renderPdfPage(+index, true);
        }),
      );
      this.scrollToPage(this.state.currentPage);
      highlighter?.update();
    });
  }, 500);

  async processOnce() {
    const { highlighter } = this.props;
    if (!highlighter.alive) return;
    await Guard.while(highlighter, async (highlighter) => {
      await this.fetchBytes();
      await this.parsePdfData();
      await this.fetchOutline();
      document.getElementsByTagName('embed')[0]?.remove();

      const scrollContainer = this.viewerEl?.parentElement;
      if (!this.viewerEl || !scrollContainer || !this.pdfDoc) throw new Error('not ready');

      await this.computePDFSizes();
      this.resizeObserver.observe(scrollContainer);

      const options = {
        root: scrollContainer,
        rootMargin: '0px',
        threshold: 0,
        trackVisibility: true,
        delay: 300,
      };

      this.visibilityObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
        entries.forEach(async (e: IntersectionObserverEntry) => {
          if (!highlighter.alive) return;
          await Guard.while(highlighter, async (highlighter) => {
            const target = e.target as HTMLDivElement;
            const pageNum = target.getAttribute('data-page-number');
            if (!pageNum) return;

            const visible = e.intersectionRatio > 0;
            target.setAttribute('data-page-visible', String(visible));

            if (visible) {
              await this.renderPdfPage(+pageNum);
              highlighter?.update();
              // try to load buffer pages, but don't await
              const prevPage = +pageNum - 1;
              const nextPage = +pageNum + 1;
              void this.renderPdfPage(prevPage);
              void this.renderPdfPage(nextPage);
            }
          });
        });
      }, options);

      scrollContainer.addEventListener('scroll', this.handleScroll);
      this.viewerEl.addEventListener('click', () => {
        if (this.state.outlineOpened) this.toggleOutline();
      });
      await this.renderPdfPage(this.state.currentPage);
      this.scrollToPage(this.state.currentPage);
      this.setState({ renderDone: true });
      highlighter.bindEvents(this.viewerEl);
      highlighter.setHighlightScrollHandler(async (page: number) => {
        const pageDiv = await this.renderPdfPage(page);
        if (!pageDiv) return;
        this.scrollToPage(pageDiv);
      });
    });
  }

  async fetchOutline() {
    const { pdfDoc } = this;
    if (!pdfDoc) return;

    const outline = await pdfDoc.getOutline();
    if (!outline) return;

    const getPageIndex = async (dest: string | any[] | null) => {
      if (typeof dest === 'string') {
        const ref = await pdfDoc.getDestination(dest);
        if (!ref) return -1;
        return pdfDoc.getPageIndex(ref[0]);
      }

      if (Array.isArray(dest)) {
        return pdfDoc.getPageIndex(dest[0]);
      }

      return -1;
    };

    const outlines = await Promise.all(
      outline.map(async (o) => {
        const pageIndex = await getPageIndex(o.dest);
        return {
          title: o.title,
          bold: o.bold,
          italic: o.italic,
          pageIndex: isNaN(+pageIndex) ? -1 : pageIndex + 1,
        };
      }),
    );
    this.setState({ outlines });
  }

  /**
   * @param pageNum
   * @returns {number}
   */
  getPageOffsetValue(pageNum = 1): number {
    return this.pageViewports.slice(0, pageNum).reduce((acc, v) => (acc += v.height), 0);
  }

  async getPageDoc(i: number): Promise<PDFPageProxy | null> {
    if (!i || !this.pdfDoc) return null;
    let pdfPage = this.pdfCachedPages.get(i);

    if (!pdfPage) {
      pdfPage = await this.pdfDoc.getPage(i);
      this.pdfCachedPages.set(i, pdfPage);
    }

    return pdfPage;
  }

  async getFullText() {
    if (!this.pdfDoc) return '';

    const texts = await Promise.all(
      Array.from({ length: this.pdfDoc.numPages }, (_, i) => this.getPageDoc(i + 1).then((p) => p?.getTextContent())),
    );

    return texts
      .flatMap((t) =>
        t?.items
          // check to see if i has the str property
          .map((i) => (i as TextItem).str),
      )
      .filter((str) => str !== undefined && str !== null && str !== '')
      .join('');
  }

  async computePDFSizes() {
    const fallback = {
      viewports: [],
      height: 0,
      width: 0,
    };
    if (!this.pdfDoc || !this.viewerEl) return fallback;

    let height = 0,
      width = 0;
    const viewports = [];

    for (let i = 0; i < this.pdfDoc.numPages; i++) {
      const pdfPage = await this.getPageDoc(i + 1);
      if (!pdfPage) return fallback;

      const unscaledViewport = pdfPage.getViewport({ scale: 1 });
      const { offsetWidth = unscaledViewport.width } = this.viewerEl.parentElement || {};
      const scale = offsetWidth / unscaledViewport.width;
      const viewport = pdfPage.getViewport({ scale });
      const { height: h, width: w } = viewport;
      viewports.push(viewport);
      height += h;
      if (w > width) width = w;
    }

    this.pageViewports = viewports;

    this.viewerEl.style.height = `${height}px`;
    this.viewerEl.style.width = `${width}px`;
  }

  // If we have a vertex, track down the property which has the
  // `body` element and retrieve the raw PDF binary content from the CAS.
  async fetchBytes() {
    const { vertex } = this.props;
    try {
      const [bodyPart] = await vertex.filterProperties({ role: ['body'] }).toArray();
      if (!bodyPart) return;
      this.pdfBytes = await bodyPart.fetchBytesFromCas();
    } catch (reason) {
      this.fatalError(reason);
    }
  }

  // Parse the PDF binary content.
  async parsePdfData() {
    if (!this.pdfBytes) throw new Error('no bytes found');
    const loadingTask = getDocument({ data: this.pdfBytes });
    try {
      this.pdfDoc = await loadingTask.promise;
    } catch (e) {
      // Handle parse errors.
      this.fatalError(`Failed to parse PDF: ${e}`);
    }
  }

  createPageNode(pageNum: number): HTMLDivElement {
    const pageDiv = document.createElement('div');
    pageDiv.classList.add('page');
    pageDiv.setAttribute('data-page-number', String(pageNum));

    return pageDiv;
  }

  isPageLoaded(arg: number | HTMLDivElement | null) {
    const pageDiv = typeof arg === 'number' ? this.props.pdfDom.getPageContainer(arg) : arg;
    if (!pageDiv) return false;

    const loaded = pageDiv.getAttribute('data-page-loaded');
    return loaded && tryJsonParse(loaded);
  }

  async renderPdfPage(pageNum: number, update = false) {
    const { highlighter } = this.props;
    if (!highlighter.alive) return;
    return await Guard.while(highlighter, async (highlighter) => {
      const viewport = this.pageViewports[pageNum - 1];

      if (!this.pdfDoc || !this.viewerEl || pageNum < 1 || pageNum > this.pdfDoc.numPages || !viewport) return;

      let pageDiv = this.props.pdfDom.getPageContainer(pageNum);
      const pdfPage = await this.getPageDoc(pageNum);

      if ((this.isPageLoaded(pageDiv) && !update) || !pdfPage) return pageDiv;

      if (!pageDiv) {
        if (this.viewerEl.children.length > 4) {
          const cleanupTarget = this.viewerEl.querySelector('div.page[data-page-visible="false"]');
          if (cleanupTarget) {
            this.visibilityObserver?.unobserve(cleanupTarget);
            this.viewerEl.removeChild(cleanupTarget);
          }
        }
        pageDiv = this.createPageNode(pageNum);
        this.viewerEl.appendChild(pageDiv);
      }

      // Render graphic layer.
      let canvas = pageDiv.querySelector('canvas');
      if (canvas) {
        canvas.parentElement?.removeChild(canvas);
      }

      canvas = document.createElement('canvas');
      pageDiv.appendChild(canvas);

      const { height, width } = viewport;
      const scale = highlighter.viewport?.planeScale ?? 1;
      const pixelRatio = Math.max(scale, window.devicePixelRatio, 3);

      canvas.height = Math.floor(height * pixelRatio);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const canvasContext = canvas.getContext('2d', { alpha: false });
      if (!canvasContext) throw 'Failed to allocate canvasContext';

      const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined;
      await pdfPage.render({ canvasContext, viewport, transform }).promise;

      // Render text layer.
      let textLayer = pageDiv.querySelector('.textLayer') as HTMLElement;
      if (textLayer) {
        textLayer.parentElement?.removeChild(textLayer);
      }

      textLayer = document.createElement('div');
      textLayer.classList.add('textLayer');
      textLayer.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      pageDiv.appendChild(textLayer);

      textLayer.style.height = `${height}px`;
      textLayer.style.width = `${width}px`;

      const textContent = await pdfPage.getTextContent({
        // @ts-ignore
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      await renderTextLayer({
        viewport,
        textContent,
        container: textLayer,
        enhanceTextSelection: true,
      }).promise;

      this.visibilityObserver?.observe(pageDiv);
      pageDiv.style.width = `${width}px`;
      pageDiv.style.height = `${height}px`;
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      pageDiv.style.top = this.getPageOffsetValue(pageNum - 1) + 'px';
      pageDiv.setAttribute('data-page-loaded', String(true));

      return pageDiv;
    });
  }

  scrollToPage(arg: number | HTMLDivElement) {
    const pageDiv = typeof arg === 'number' ? this.props.pdfDom.getPageContainer(arg) : arg;
    const scrollContainer = this.viewerEl?.parentElement;
    if (!pageDiv || !scrollContainer) return;

    const pageNum = pageDiv.getAttribute('data-page-number');
    if (!pageNum || isNaN(+pageNum)) return;
    scrollContainer.scrollTop = pageDiv.offsetTop;
    this.setState({ currentPage: +pageNum });
  }

  handleScroll = throttle(async (e) => {
    if (!e.target?.scrollTop) return;
    const { currentPage } = this.state;
    //consider new page if it got more than 75% appearance
    const scrollPage =
      this.pageViewports.findIndex((v, i) => v.height * (i + 1) - v.height * 0.25 >= e.target.scrollTop) + 1;
    if (currentPage === scrollPage) return;

    const pageDiv = await this.renderPdfPage(scrollPage);
    if (!pageDiv) return;
    this.setState({ currentPage: scrollPage });
  }, 200);

  renderPageSelector(numPages = 1, currentPage = 1) {
    const options: JSX.Element[] = [];
    for (let i = 0; i < numPages; i++) {
      options.push(
        <option value={i + 1} selected={i + 1 === currentPage}>
          {i + 1}/{numPages}
        </option>,
      );
    }
    return (
      <div className="page-selector">
        <select
          id="page-select"
          name="page-number"
          onChange={async (e: any) => {
            const goToPage = +e.target.value;
            const pageDiv = await this.renderPdfPage(goToPage);
            if (!pageDiv) return;
            this.scrollToPage(pageDiv);
          }}
        >
          {options}
        </select>
      </div>
    );
  }

  toggleOutline() {
    this.setState({ outlineOpened: !this.state.outlineOpened });
  }

  render() {
    const { renderDone, currentPage, outlineOpened, outlines } = this.state;
    const { numPages = 1 } = this.pdfDoc || {};
    const { innerRef } = this.props;
    const outlineWidth = (this.viewerEl?.offsetWidth || 0) / 3 || 300;
    return (
      <div className="pdf-viewer-scroller-hack">
        <div ref={innerRef} id="viewerContainer">
          {renderDone && (
            <div className="viewer-header">
              {!!outlines.length && <OutlineIcon className="outline-icon" onClick={() => this.toggleOutline()} />}
              {this.renderPageSelector(numPages, currentPage)}
            </div>
          )}
          <div className="scroller">
            <div
              className="pdf-outline-container"
              style={{
                transform: outlineOpened ? `translate3d(0, 0, 0)` : `translate3d(-${outlineWidth}px, 0, 0)`,
              }}
            >
              <PdfOutline
                outlines={outlines}
                size={{ width: outlineWidth }}
                currentPage={currentPage}
                outlineSelect={async (o: { title: string; pageIndex: number }) => {
                  const pageDiv = await this.renderPdfPage(o.pageIndex);
                  if (!pageDiv) return;
                  this.scrollToPage(pageDiv);
                  this.toggleOutline();
                }}
              />
            </div>
            <div
              className="page-viewer"
              ref={(r: HTMLDivElement | null) => {
                if (!this.viewerEl && r) {
                  this.viewerEl = r;
                  this.processOnce();
                }
              }}
            ></div>
          </div>
        </div>
      </div>
    );
  }
}

export const PdfView = forwardRef<PdfViewProps, any>((props, ref) => <PdfViewRenderer {...props} innerRef={ref} />);
