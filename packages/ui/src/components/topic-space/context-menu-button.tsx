import styled from 'styled-components';
import * as VM from '../../viewmodel';
import { MoreVerticalIcon } from '../../assets';
import { Tooltip } from '../tooltip';
import { useObserveValue } from '@edvoapp/util';

const ContextMenuButtonSC = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  & svg {
    width: 16px !important;
    height: 16px !important;
  }
`;

type Props = {
  node: VM.ContextMenuButton;
  className?: string;
};

export const ContextMenuButton = ({ node, className }: Props) => {
  const contextMenuOpen = useObserveValue(() => (node.root as VM.AppDesktop).contextMenu.menuState, [node]);
  let inner;
  if (contextMenuOpen) inner = <MoreVerticalIcon width={16} height={16} />;
  else
    inner = (
      <Tooltip tooltipChildren="Open Menu" usePortal>
        <MoreVerticalIcon width={16} height={16} />
      </Tooltip>
    );

  return (
    <ContextMenuButtonSC ref={(r: HTMLElement | null) => node.safeBindDomElement(r)} {...{ className }}>
      {inner}
    </ContextMenuButtonSC>
  );
};
