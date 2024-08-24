import { AwaitableValue, EdvoObj, LazyGetterAsync, NowValue, Observable, OwnedProperty } from '@edvoapp/util';
import { MatchEntity, TrxRef, trxWrap, Model } from '@edvoapp/common';

export type MatchStatus = 'pending' | 'matched' | 'failed';

export type SelectorType = 'legacy' | 'offsets' | 'xpath' | 'verbatim' | 'boxes' | 'page-range';

export abstract class SelectorModule {
  abstract apply(...args: any[]): Range | null;
}

export type SelectorDataLegacy = { selector: 'legacy'; payload: string };
export type SelectorDataOffsets = {
  selector: 'offsets';
  payload: { start: number; end: number };
};
export type SelectorDataXpath = {
  selector: 'xpath';
  payload: {
    start: { path: string; offset: number };
    end: { path: string; offset: number };
  };
};
export type SelectorDataVerbatim = { selector: 'verbatim'; payload: string };
export type SelectorDataBoxes = {
  selector: 'boxes';
  payload: { bound: Record<string, number>; boxes: Record<string, number>[] };
};
export type SelectorDataPageRange = {
  selector: 'page-range';
  payload: {
    // Index of the starting page of rhe range (zero-based).
    startPageIndex: number;
    // Offset from starting page, in 16-bit UTF-16 code units.
    startOffset: number;
    // Index of the ending page of rhe range (zero-based).
    endPageIndex: number;
    // Offset from top of ending page, in 16-bit UTF-16 code units.
    endOffset: number;
  };
};

export type SelectorData =
  | SelectorDataLegacy
  | SelectorDataOffsets
  | SelectorDataXpath
  | SelectorDataVerbatim
  | SelectorDataBoxes
  | SelectorDataPageRange;

export type SelectorConstructorArgs = {
  property?: Model.Property;
  data: SelectorData;
};
export class Selector extends EdvoObj {
  @OwnedProperty
  property: Model.Property | null;
  data: SelectorData;

  constructor(args: SelectorConstructorArgs) {
    super();
    this.data = args.data;
    this.property = args.property || null;
  }
  save(trx: TrxRef, vertex: Model.Vertex) {
    if (this.property) return;

    this.property = Model.Property.create({
      parent: vertex,
      trx,
      role: ['selector'],
      initialString: JSON.stringify(this.data),
      contentType: 'application/json;selector',
    });
  }
}

export class SelectorSet {
  set: Set<Selector> = new Set();
  save(trx: TrxRef, vertex: Model.Vertex) {
    this.set.forEach((selector) => {
      selector.save(trx, vertex);
    });
  }
  add(selector: Selector) {
    this.set.add(selector);
  }
  has(module: SelectorType) {
    let has = false;
    this.set.forEach((selector) => {
      if (selector.data.selector === module) {
        has = true;
      }
    });
    return has;
  }
  get(module: SelectorType): Selector | null {
    let out = null;
    this.set.forEach((selector) => {
      if (selector.data.selector === module) {
        out = selector;
      }
    });
    return out;
  }

  static async from(vertex: Model.Vertex): Promise<SelectorSet> {
    const selectorSet = new SelectorSet();
    const selectorProperties = await vertex.filterProperties({ role: ['selector'] }).toArray();
    await Promise.all(
      selectorProperties.map(async (property) => {
        const contentType = property.contentType;
        const d = await property.text.get();
        if (contentType === 'application/json;selector' && d) {
          try {
            const data = JSON.parse(d) as SelectorData;
            selectorSet.add(new Selector({ property: property, data }));
          } catch (e) {
            console.warn(e);
          }
        }
      }),
    );
    return selectorSet;
  }
}

export interface HighlightPositionInfo {
  boundingRect: DOMRectReadOnly;
  rects: DOMRectReadOnly[];
}

export interface HighlightPlain {
  key: string;
  body: string;
  selectors: SelectorData[];
  positionInfo: HighlightPositionInfo;
  range?: Range;
  status?: PAINT_STATUS;
  boxElements?: HTMLElement[];
}

export interface HighlightRenderContext {
  boxElements?: Element[];
  range?: Range;
}

// TODO - how do we handle image previews when no text is available?
// Eg: for the PDFHighlighter, text bodies will not always be available
export interface HighlightText {
  leading: string | null;
  body: string | null;
  trailing: string | null;
}

export interface HighlightConstructorArgs<RenderContext> {
  vertex: Model.Vertex;
  selectorSet: AwaitableValue<SelectorSet>;
  text: AwaitableValue<HighlightText>;
  positionInfo: Observable<HighlightPositionInfo | null>;
  renderContext: RenderContext;
  key?: string;
}

export interface HighlightDefineArgs<RenderContext> {
  selectorSet: SelectorSet;
  positionInfo?: HighlightPositionInfo;
  text: HighlightText;
  parentVertex: Model.Vertex;
  renderContext: RenderContext;
  key?: string;
}
export interface HighlightLoadArgs {
  vertex: Model.Vertex;
}

// TODO: Consider merging Highlight fully into MatchEntity - Arguably there is no meaningful difference
// between a page which is pending match with the database versus a highlight being created/rendered on the page
// They are all prospective s with position information, selectors, and match statuses
export class Highlight<RenderContext> extends MatchEntity.MatchEntityBase {
  @OwnedProperty
  readonly vertex: Model.Vertex;
  readonly selectorSet: AwaitableValue<SelectorSet>;
  readonly text: AwaitableValue<HighlightText>;
  @OwnedProperty
  readonly positionInfo: Observable<HighlightPositionInfo | null>;
  renderContext: RenderContext;
  @OwnedProperty
  readonly match = new Observable<MatchStatus>('pending');
  private _matchAttempts: number = 0;
  readonly tempKey?: string;

  private constructor(args: HighlightConstructorArgs<RenderContext>) {
    super();

    this.vertex = args.vertex;
    this.selectorSet = args.selectorSet;
    this.text = args.text;
    this.positionInfo = args.positionInfo;
    this.renderContext = args.renderContext;
    this.tempKey = args.key;
  }
  static define<RC>({ key, selectorSet, positionInfo, text, parentVertex, renderContext }: HighlightDefineArgs<RC>) {
    const { body, leading, trailing } = text;
    // TODO: RB verify if this changes at all?

    let vertex: Model.Vertex;

    void trxWrap(async (trx) => {
      const a = Model.Vertex.create({
        trx,
        parent: parentVertex,
        kind: 'highlight',
      });
      vertex = a;

      selectorSet.save(trx, a);

      // TODO - Derive seq from outlineBinding.lastChild, which needs to injected here
      // .toArray() is equivalent to just getting the array, and then destroying, without an observable subscription
      const seq =
        (await parentVertex.filterBackrefs({ role: ['category-item'] }).toArray()).reduce(
          (acc, it) => Math.max(acc, it.seq.value),
          0,
        ) + 1;

      // for within highlight context
      a.createEdge({
        trx,
        role: ['highlight-item'],
        target: parentVertex,
        meta: {},
      });

      // for within outline context
      a.createEdge({
        trx,
        role: ['category-item'],
        target: parentVertex,
        meta: {},
        seq,
      });

      // Appearance for when displayed alongside bullets
      a.createProperty({
        trx,
        role: ['appearance'],
        contentType: 'application/json',
        initialString: JSON.stringify({ type: 'highlight' }),
      });
      if (body)
        a.createProperty({
          trx,
          role: ['highlight_text', 'body'],
          initialString: body,
          contentType: 'text/plain',
        });
      if (leading)
        a.createProperty({
          trx,
          role: ['highlight_leading_text'],
          initialString: leading,
          contentType: 'text/plain',
        });
      if (trailing)
        a.createProperty({
          trx,
          role: ['highlight_trailing_text'],
          initialString: trailing,
          contentType: 'text/plain',
        });

      return a;
    });

    return new Highlight({
      key,
      vertex: vertex!,
      selectorSet: new NowValue(selectorSet),
      positionInfo: new Observable<HighlightPositionInfo | null>(positionInfo || null),
      text: new NowValue(text),
      renderContext: renderContext || {},
    });
  }
  static load({ vertex }: HighlightLoadArgs) {
    const selectorSet = new LazyGetterAsync(async () => {
      // const selectorParts = await .partObs(['selector']).firstObs()
      // const Attributes = (await .attributes.get()) as any
      // const legacySelector = Attributes?.highlightSelectorSet
      const s = await SelectorSet.from(vertex);

      // if (legacySelector && !s.has('legacy')) {
      //   const data = {
      //     selector: 'legacy',
      //     payload: legacySelector,
      //   } as SelectorDataLegacy
      //   const sel = new Selector({ data })
      //   s.add(sel)
      // }
      return s;
    });

    const text = new LazyGetterAsync(async () => {
      const properties = await vertex.properties.get();

      let leading: string | null = null;
      let body: string | null = null;
      let trailing: string | null = null;

      for (const part of properties) {
        const role = part.role;
        const payload = await part.text.get();
        if (role.includes('highlight_leading_text') && payload) {
          leading = payload;
        }
        if (role.includes('highlight_text') && payload) {
          body = payload;
        }
        if (role.includes('highlight_trailing_text') && payload) {
          trailing = payload;
        }
      }

      return {
        leading,
        body,
        trailing,
      };
    });

    return new Highlight({
      vertex,
      selectorSet,
      positionInfo: new Observable<HighlightPositionInfo | null>(null),
      text,
      renderContext: {},
    });
  }

  isSaved(): boolean {
    return true;
  }

  public setPositionInfo(ctx: HighlightPositionInfo) {
    this.positionInfo.set(ctx);
  }

  get id() {
    return this.tempKey || this.key;
  }

  get matchAttempts() {
    return this._matchAttempts;
  }

  incrementMatchAttempts() {
    this._matchAttempts += 1;
  }
}

export const HighlightAgentEvents = ['READY', 'PAINT_STATUS', 'ADD', 'FOCUS', 'BLUR', 'OPEN'];
export const HighlightAppEvents = ['PAINT', 'REMOVE', 'ENABLE', 'DISABLE', 'SCROLL_TO_HIGHLIGHT'];
export enum PAINT_STATUS {
  FAILED = 0,
  MATCHED = 1,
}

export interface HighlightMessagePayload {
  type: string;
  payload: HighlightPlain | null;
}

export interface Transport extends EdvoObj {
  type: string;
  send(type: string, payload?: any): void;
  subscribe(msgTypes: string[], fn: (res: HighlightMessagePayload) => void): () => void;
}

export class HighlightNode {
  static create(styles = {}) {
    const element = document.createElement('div');
    element.classList.add('highlight-color-box');
    element.style.position = 'absolute';
    element.style.cursor = 'pointer';
    element.style.backgroundColor = '#6e1fe947';
    Object.keys(styles).forEach((key: string) => {
      //@ts-ignore
      element.style[key] = styles[key];
    });
    return element;
  }
}
