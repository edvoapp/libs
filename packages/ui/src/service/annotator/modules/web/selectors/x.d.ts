declare module 'xpath-range' {
  export declare function fromRange(
    range: Range,
    el: HTMLElement | Document,
  ): { start: string; startOffset: number; end: string; endOffset: number };
  export declare function toRange(
    start: string,
    startOffset: number,
    end: string,
    endOffset: number,
    el: HTMLElement | Document,
  ): Range;
}
