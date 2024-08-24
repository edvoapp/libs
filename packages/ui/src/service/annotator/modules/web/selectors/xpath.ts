import { Selector, SelectorModule, SelectorDataXpath } from '../../../highlight';
import { fromRange, toRange } from 'xpath-range';

export class SelectorXpath extends SelectorModule {
  constructor(private root: HTMLElement | Document = document) {
    super();
  }

  define(range: Range): Selector {
    const { start, startOffset, end, endOffset } = fromRange(range, this.root);

    return new Selector({
      data: {
        selector: 'xpath',
        payload: {
          start: { path: start, offset: startOffset },
          end: { path: end, offset: endOffset },
        },
      },
    });
  }

  apply(selector: Selector, text: string): Range | null {
    const data = selector.data as SelectorDataXpath;
    const payload = data.payload;
    const {
      start: { path: startPath, offset: startOffset },
      end: { path: endPath, offset: endOffset },
    } = payload;
    try {
      const range: Range = toRange(startPath, startOffset, endPath, endOffset, this.root);
      if (range.toString() === text) {
        return range;
      }
      console.log('SelectorXPath: range failed to apply due to text mismatch');
    } catch (e) {
      console.log('WebHighlighter: xpath selector did not apply', e);
    }
    return null;
  }
}
