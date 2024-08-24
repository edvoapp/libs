import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../../viewmodel';
import { useEffect, useRef } from 'preact/hooks';
import styled, { keyframes } from 'styled-components';

const blink = keyframes`
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }

  70% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

const CaretDiv = styled.div<{ x: number; y: number; height: number }>`
  position: absolute;
  left: ${(p) => p.x}px;
  top: ${(p) => p.y}px;
  height: ${(p) => p.height}px;
  width: 2px;
  background-color: currentColor;
  pointer-events: none;
  animation: ${blink} 1s steps(1) infinite;
`;
//height: ${(p) => p.screenCoords.caret.height}px;

const BoxDiv = styled.div<{
  left: number;
  top: number;
  width: number;
  height: number;
}>`
  position: absolute;
  left: ${(p) => p.left}px;
  top: ${(p) => p.top}px;
  width: ${(p) => p.width}px;
  height: 1em;
  background: rgba(67.8, 84.7, 90.2, 0.3);
  pointer-events: none;
`;

type Props = {
  node: VM.TextCaretAndSelection;
  caretHeight?: number | string;
};

export function CaretAndTextHighlights({ node, caretHeight }: Props) {
  const screenCoords = useObserveValue(() => node.screenCoords, [node]);

  const caretRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = caretRef.current;
    if (el && 'scrollIntoViewIfNeeded' in el) {
      // @ts-expect-error not widely supported?
      el.scrollIntoViewIfNeeded(false);
      // the argument is centerIfNeeded, and its default is true. we dont want that
    }
  }, [screenCoords]);

  if (!screenCoords) return null;

  const boxes = screenCoords.boxes.map((rect) => {
    const { top, left, width, height } = rect;
    return <BoxDiv {...{ left, top, width, height }} />;
  });

  return (
    <>
      <CaretDiv
        className={'text_caret'}
        {...screenCoords.caret}
        ref={(el: HTMLDivElement | null) => {
          // // (p)react calls this ref closure a lot, and at weird times
          // // including AFTER the component is actually rendered. Thanks Preact >_>
          // node.safeBindDomElement(el);
          caretRef.current = el;
        }}
      />
      {boxes}
    </>
  );
}
