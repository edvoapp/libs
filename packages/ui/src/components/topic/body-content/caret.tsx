// DEPRECATED, will go away once text-field-ephemeral-temp goes away

import { useObserveValue } from '@edvoapp/util';
import styled, { keyframes } from 'styled-components';
import * as VM from '../../../viewmodel';
import { useEffect, useRef } from 'preact/hooks';

type Props = {
  node: VM.TextCaretAndSelection;
  caretHeight?: number | string;
};

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

const TextCaret = styled.div<{
  screenCoords: VM.ScreenCoords;
  caretHeight?: number | string;
}>`
  position: absolute;
  width: 1px;
  background-color: currentColor;
  pointer-events: none;
  left: ${(p) => p.screenCoords.caret.x}px;
  top: ${(p) => p.screenCoords.caret.y}px;
  height: ${(props) => props.caretHeight ?? '1em'};
  animation: ${blink} 1s steps(1) infinite;
`;

export function Caret({ node, caretHeight }: Props) {
  const screenCoords = useObserveValue(() => node.screenCoords, [node]);
  if (!screenCoords) return null;
  const caretRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = caretRef.current;
    if ('scrollIntoViewIfNeeded' in el!) {
      // @ts-expect-error not widely supported?
      el.scrollIntoViewIfNeeded(false);
      // the argument is centerIfNeeded, and its default is true. we dont want that
    }
  }, [screenCoords]);

  return (
    // DO NOT add textContent to this div, as we are relying on it being empty in text-range.ts
    <TextCaret
      ref={(r: HTMLDivElement | null) => (caretRef.current = r)}
      className="text_caret"
      screenCoords={screenCoords}
      caretHeight={caretHeight}
      style={{
        height: caretHeight ?? '1em',
      }}
    />
  );
}
