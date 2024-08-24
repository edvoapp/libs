import { useCallback, useEffect, useState } from 'preact/hooks';
import { useWindowScroll } from 'react-use';

import { publishMessageToInner, useSubscribeOnMount } from './pubsub-outer';
import { ContentRegion, useMode, useSiteStyleModel } from '../providers';
import { getAbsoluteClientRect } from '../util/dom/utils';

function unwrap(wrapper: Node): void {
  // place childNodes in document fragment
  const docFrag = document.createDocumentFragment();
  while (wrapper.firstChild) {
    const child = wrapper.removeChild(wrapper.firstChild);
    docFrag.appendChild(child);
  }
  const parent = wrapper.parentNode;
  // replace wrapper with document fragment
  parent?.replaceChild(docFrag, wrapper);
  // flatten text nodes
  parent?.normalize();
}

function evaluateXPath(xpath: string) {
  // rare case when document.evaluate errors out, we don't want it to pause the rest of the app
  try {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  } catch (err) {
    console.error(err);
  }
}

function getCenterOfGravity(contentRect: DOMRectReadOnly | null, spanNode: HTMLSpanElement) {
  let rect: DOMRectReadOnly = new DOMRectReadOnly();
  if (!contentRect) return { rect };
  const rects = spanNode.getClientRects();
  rect = rects[rects.length - 1];
  const bodyRect = document.body.getBoundingClientRect();
  const { x, y, width, height } = rect;
  // I guess we just want to see which one is greater? Whichver has more whitespace will NOT be the center of gravity
  return new DOMRectReadOnly(x, y - bodyRect.top, width, height);
}

function getXPathForElement(el: Node | null, xml: Document = document): string {
  let xpath = '';
  let pos;
  let tempitem2;

  while (el !== xml.documentElement) {
    pos = 0;
    tempitem2 = el;
    while (tempitem2) {
      if (tempitem2.nodeType === 1 && tempitem2.nodeName === el?.nodeName) {
        // If it is ELEMENT_NODE of the same name
        pos += 1;
      }
      tempitem2 = tempitem2.previousSibling;
    }

    xpath = `*[name()='${el?.nodeName}'][${pos}]/${xpath}`;
    el = el?.parentNode || null;
  }
  xpath = `/*[name()='${xml.documentElement.nodeName}']/${xpath}`;
  xpath = xpath.replace(/\/$/, '');
  return xpath;
}

/**
 *
 * @param selectorSet: string - the $$ delineated string
 * @returns xpath: string
 */
export function generateXPath(selectorSet: string) {
  const [, tag, text] = selectorSet.split('$$');
  if (!text.includes(`'`) && !text.includes(`"`)) {
    // if no quotes, then just use a single quote
    return `//${tag}[text()[contains(., '${text}')]]`;
  }
  const path: string[] = [];
  let start = 0;
  for (let idx = 0; idx < text.length; idx++) {
    const curr = text[idx];
    if (curr === `'`) {
      path.push(`'${text.substring(start, idx)}'`, `"'"`);
      start = idx + 1;
    } else if (curr === `"`) {
      path.push(`'${text.substring(start, idx)}'`, `'"'`);
      start = idx + 1;
    }
  }
  const remaining = text.substring(start);
  if (remaining !== '') path.push(`'${text.substring(start)}'`);
  return `//${tag}[text()[contains(., concat(${path.join(', ')}))]]`;
}

function handleHighlightClick(e: Event, paintableRegions: ContentRegion[]) {
  const spanNode = e.target as HTMLElement;
  const id = spanNode.getAttribute('edvo-highlightID');
  const highlightIndex = spanNode.id.split('edvo__highlight_')[1];
  let contentAreaRect: null | DOMRectReadOnly = null;
  let contentAreaIndex: null | number = null;
  for (const region of paintableRegions) {
    if (region.contentAreaElt.contains(spanNode.parentElement)) {
      contentAreaRect = getAbsoluteClientRect(region.contentAreaElt);
      contentAreaIndex = region.contentAreaIndex;
      break;
    }
  }

  if (contentAreaRect) {
    const rect = getCenterOfGravity(contentAreaRect, spanNode);
    publishMessageToInner('HIGHLIGHT_CLICK', {
      id,
      rect,
      highlightIndex,
      contentAreaIndex,
    });
  }
}

export const useHighlights = () => {
  const scrollCoords = useWindowScroll();
  const { paintableRegions } = useSiteStyleModel();
  const [currentHighlightText, setCurrentHighlightText] = useState<string | null>(null);
  const { mode } = useMode();

  const [currentHighlightIndex, setCurrentHighlightIndex] = useState(1);
  const [spanNodes, setSpanNodes] = useState<HTMLSpanElement[]>([]);
  const insertSpanNode = useCallback((node: HTMLSpanElement) => {
    setSpanNodes((s) => [...s, node]);
  }, []);

  useEffect(() => {
    publishMessageToInner('SCROLL', scrollCoords);
  }, [scrollCoords]);

  const [selection, setSelection] = useState<Selection | null>(null);

  // useSubscribe('HIGHLIGHT_PAINT_REQUEST', (_, { selectorSet }: { selectorSet: string }) => {
  //   // need to apply the highlight
  //   if (!selectorSet) {
  //     console.warn('Selector set failed');
  //     return;
  //   }
  //   const [, xpath, text, highlightIndex, startOffset, endOffset] = selectorSet.split('$$');
  //   const toHighlight = evaluateXPath(xpath);
  // });

  useSubscribeOnMount('INNER_UNLOAD', () => {
    document.querySelectorAll('.edvo__highlighted').forEach(unwrap);
  });

  useEffect(() => {
    function click(e: Event) {
      handleHighlightClick(e, paintableRegions);
    }
    for (let idx = 0; idx < spanNodes.length; idx++) {
      const spanNode = spanNodes[idx];
      spanNode.addEventListener('click', click);
    }

    return () => {
      for (let idx = 0; idx < spanNodes.length; idx++) {
        const spanNode = spanNodes[idx];
        spanNode.removeEventListener('click', click);
      }
    };
  }, [paintableRegions, spanNodes]);

  const handleHighlightPaint = useCallback(
    (spanNode: HTMLSpanElement) => {
      const parentElement = spanNode.parentElement;
      const id = spanNode.getAttribute('edvo-highlightID');
      const index = spanNode.id.split('edvo__highlight_')[1];
      const int = parseInt(index, 10);
      let contentAreaRect: null | DOMRectReadOnly = null;
      let contentAreaIndex: null | number = null;
      for (const region of paintableRegions) {
        if (region.contentAreaElt.contains(parentElement)) {
          contentAreaRect = getAbsoluteClientRect(region.contentAreaElt);
          contentAreaIndex = region.contentAreaIndex;
          break;
        }
      }
      if (contentAreaRect) {
        const rect = getCenterOfGravity(contentAreaRect, spanNode);
        setTimeout(() => {
          const args = {
            id,
            rect,
            highlightIndex: int,
            contentAreaIndex,
          };
          publishMessageToInner('HIGHLIGHT_PAINT_SUCCESS', args);
        }, 600);
      }
    },
    [paintableRegions],
  );

  const handleMouseUp = useCallback<(e: MouseEvent) => void>(() => {
    if (mode === 'INACTIVE') return;
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (currentHighlightText) {
        const highlightIndex = `edvo__highlight_${currentHighlightIndex}`;
        const span = evaluateXPath(`//span[@id='${highlightIndex}']`);
        if (span) {
          unwrap(span);
        }
      }
      setCurrentHighlightText(null);
      publishMessageToInner('HIGHLIGHT_DESELECT', null);
      return;
    }
    const range = selection.getRangeAt(0);
    const { commonAncestorContainer: textNode, startOffset, endOffset, startContainer, endContainer } = range;
    // for now, just allow highlighting of a single element
    if (startContainer !== endContainer) return;
    const { parentElement, nodeValue } = textNode;
    if (!nodeValue || !parentElement) return;
    const actual = selection.toString();
    const leading = nodeValue.substring(0, startOffset);
    const trailing = nodeValue.substring(endOffset);

    const newTextNode1 = document.createTextNode(leading);
    parentElement.replaceChild(newTextNode1, textNode);

    // create a span node and add it to the parent immediately after the first text node
    const spanNode = document.createElement('span');
    spanNode.className = 'edvo__highlighted';
    const nextHighlightIndex = currentHighlightIndex + 1;
    const highlightIndex = `edvo__highlight_${currentHighlightIndex + 1}`;
    spanNode.id = highlightIndex;
    parentElement.insertBefore(spanNode, newTextNode1.nextSibling);

    // create a text node for the highlighted text and add it to the span node
    const newTextNode2 = document.createTextNode(actual);
    spanNode.appendChild(newTextNode2);

    // create a text node for the text after the highlight and add it after the span node
    const newTextNode3 = document.createTextNode(trailing);
    parentElement.insertBefore(newTextNode3, spanNode.nextSibling);

    // spanNode.addEventListener('click', handleHighlightClick);

    const { tagName } = parentElement;
    setCurrentHighlightIndex(nextHighlightIndex);
    let contentAreaRect: null | DOMRectReadOnly = null;
    let contentAreaIndex: null | number = null;
    for (const region of paintableRegions) {
      if (region.contentAreaElt.contains(parentElement)) {
        contentAreaRect = getAbsoluteClientRect(region.contentAreaElt);
        contentAreaIndex = region.contentAreaIndex;
        break;
      }
    }
    const rect = getCenterOfGravity(contentAreaRect, spanNode);

    // let's just serialize here: Namespace $$ xpath $$ highlighted text $$ highlight ID $$ startOffset $$ endOffset
    // const xpath = getXPathForElement(spanNode);
    // const highlightSelectorSet = `EdvoHighlight$$${xpath}$$${actual}$$${currentHighlightIndex}$$${startOffset}$$${endOffset}`;
    setCurrentHighlightText(actual);
    const args = {
      // highlightSelectorSet,
      rect,
      tagName,
      text: actual,
      leading,
      trailing,
      highlightIndex: nextHighlightIndex,
      contentAreaIndex,
    };
    insertSpanNode(spanNode);
    publishMessageToInner('HIGHLIGHT_CREATE', args);
  }, [mode, selection, currentHighlightIndex, insertSpanNode, currentHighlightText, paintableRegions]);

  const bindSpanNode = useCallback((spanNode: HTMLSpanElement, handleSizeUpdate: () => void) => {
    spanNode.addEventListener('transitionend', handleSizeUpdate);
    const resizeObserver = new window.ResizeObserver(([entry]) => {
      if (entry && entry.target) {
        handleSizeUpdate();
      }
    });

    const mutationObserver = new window.MutationObserver(([entry]) => {
      if (entry && entry.target) {
        handleSizeUpdate();
      }
    });

    resizeObserver.observe(spanNode);
    resizeObserver.observe(document.body);
    mutationObserver.observe(spanNode, { attributes: true });
    mutationObserver.observe(document.body, { attributes: true });

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const highlights = document.querySelectorAll('.edvo__highlighted');
    highlights.forEach((spanNode) => {
      handleHighlightPaint(spanNode as HTMLSpanElement);
    });
  }, [mode, handleHighlightPaint]);

  useSubscribeOnMount<{ selectorSet: string; id: string }>(
    'HIGHLIGHT_PAINT_REQUEST',
    ({ selectorSet, id }) => {
      const [, , text, index] = selectorSet.split('$$');
      const highlightIndex = `edvo__highlight_${index}`;
      if (document.getElementById(highlightIndex) !== null) return;
      const xpath = generateXPath(selectorSet);
      const parentElement = evaluateXPath(xpath) as HTMLElement | null;
      if (!parentElement || !parentElement.hasChildNodes()) return;
      const { childNodes } = parentElement;

      let textContent: null | string = null;
      let nodeIdx = -1;
      for (let idx = 0; idx < childNodes.length; idx++) {
        const childNode = childNodes[idx];
        if (childNode?.nodeType === 3) {
          // TEXT NODE
          if (childNode.textContent?.includes(text)) {
            textContent = childNode.textContent;
            nodeIdx = idx;
            break;
          }
        }
      }
      if (!textContent) {
        console.error(`An error occurred trying to apply the highlight ${id}`);
        return;
      }
      const [leading, trailing] = textContent.split(text) || [];
      const newTextNode1 = document.createTextNode(leading);
      parentElement.replaceChild(newTextNode1, childNodes[nodeIdx]);

      // create a span node and add it to the parent immediately after the first text node
      const spanNode = document.createElement('span');
      spanNode.className = 'edvo__highlighted';
      spanNode.id = highlightIndex;
      spanNode.setAttribute('edvo-highlightID', id);
      parentElement.insertBefore(spanNode, newTextNode1.nextSibling);

      // create a text node for the highlighted text and add it to the span node
      const newTextNode2 = document.createTextNode(text);
      spanNode.appendChild(newTextNode2);

      // create a text node for the text after the highlight and add it after the span node
      const newTextNode3 = document.createTextNode(trailing);
      parentElement.insertBefore(newTextNode3, spanNode.nextSibling);

      // spanNode.addEventListener('click', handleHighlightClick);
      console.log('paintableRegions!', paintableRegions);
      const int = parseInt(index, 10);
      setCurrentHighlightIndex(int > currentHighlightIndex ? int + 1 : currentHighlightIndex);

      function handleResize() {
        handleHighlightPaint(spanNode);
      }

      insertSpanNode(spanNode);
      bindSpanNode(spanNode, handleResize);
      handleResize();
    },
    [setCurrentHighlightIndex, currentHighlightIndex, insertSpanNode, handleHighlightClick, paintableRegions],
  );

  useSubscribeOnMount<{
    highlightAttributes: { highlightSelectorSet: string };
  }>(
    'HIGHLIGHT_SAVED_SUCCESS',
    () => {
      // maybe do other stuff with the highlight selector set
      setCurrentHighlightIndex((id) => id + 1);
    },
    [setCurrentHighlightIndex],
  );

  const handleSelection = useCallback(() => {
    const s = document.getSelection();
    if (!s || s.rangeCount === 0) return;
    setSelection(s);
  }, [setSelection]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [handleSelection]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);
};
