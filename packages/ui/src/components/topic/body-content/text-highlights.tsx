// DEPRECATED, will go away once text-field-ephemeral-temp goes away

import { useObserveValue } from '@edvoapp/util';
import styled from 'styled-components';
import * as VM from '../../../viewmodel';

type Props = {
  node: VM.TextCaretAndSelection;
};

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

export function TextHighlights({ node }: Props) {
  const screenCoords = useObserveValue(() => node.screenCoords, [node]);
  const parentRect = node.parentNode.parentNode.clientRect;
  if (!screenCoords || !parentRect) return null;

  const scale = node.findClosest((n) => n instanceof VM.Member && n)?.clientRectObs.value.innerScale ?? 1;

  const divs = screenCoords.boxes.map((rect) => {
    const { top: childTop, left: childLeft, width: childWidth, height } = rect;
    const { top: parentTop, left: parentLeft } = parentRect;
    const top = (childTop - parentTop) / scale;
    const left = (childLeft - parentLeft) / scale;
    const width = childWidth / scale;
    return <BoxDiv {...{ left, top, width, height }} />;
  });

  return <>{divs}</>;
}
