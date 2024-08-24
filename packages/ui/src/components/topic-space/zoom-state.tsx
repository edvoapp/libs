import styled from 'styled-components';
import { Button, MinusIcon, PlusIcon, VM } from '../..';
import { useObserveValue } from '@edvoapp/util';

export const ZoomStateSC = styled.div`
  position: fixed;
  bottom: 12px;
  right: 64px;
  z-index: 100000;
  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
  background: white;

  display: flex;
  justify-content: center;
  align-items: center;
`;

export const CurrentPercentage = styled.div`
  font-size: 14px;
`;

export function ZoomState({ node }: { node: VM.ZoomState }) {
  const zoomPct = useObserveValue(() => node.zoomPct, [node]);
  return (
    <ZoomStateSC ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <Button node={node.zoomOut} toolTip="Zoom out ⌘-" toolTipPlacement="top" width={40} height={40}>
        <MinusIcon height={20} width={20} />
      </Button>
      <Button node={node.resetZoom} toolTip="Reset zoom ⌘0" toolTipPlacement="top" width={40} height={40}>
        <CurrentPercentage>{zoomPct}</CurrentPercentage>
      </Button>
      <Button node={node.zoomIn} toolTip="Zoom in ⌘+" toolTipPlacement="top" width={40} height={40}>
        <PlusIcon height={20} width={20} />
      </Button>
    </ZoomStateSC>
  );
}
