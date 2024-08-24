import styled, { css } from 'styled-components';
import { AddIcon } from '../../assets';
import * as VM from '../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { useMemo } from 'preact/compat';
import { Tooltip } from '../tooltip';

interface Props {
  node: VM.AddTag;
}

const Root = styled.div<{ selected?: boolean; typing?: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 1px 6px 1px 1px;
  position: relative;

  /* Color/Brand/Purple/Main40
  Main Edvo Purple colour
  */
  border: 1px solid #7c42ce;
  border-radius: 3px;
  color: #7c42ce;
  white-space: nowrap;

  ${(props) =>
    props.selected &&
    css`
      background: #7c42ce;
      color: white;
    `}
`;

const Text = styled.span`
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 85%;
`;

export const AddTag = ({ node }: Props) => {
  const visible = useObserveValue(() => node.visible, [node]);
  const reverse = useMemo(() => node.reverse, [node]);
  const ttip = reverse ? 'Include other things under this' : 'Add this to another thing';
  if (!visible) return null;
  return (
    <Tooltip tooltipChildren={ttip} usePortal popperConfig={{ placement: 'bottom-end' }}>
      <Root
        ref={(r: HTMLElement | null) => {
          node.safeBindDomElement(r);
        }}
      >
        <AddIcon />
        <Text>{reverse ? 'Add this to...' : 'Add To...'}</Text>
      </Root>
    </Tooltip>
  );
};
