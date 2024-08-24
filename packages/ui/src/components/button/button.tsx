import { Tooltip, VM } from '../..';
import { ReactNode } from '../../react';

import { Placement } from '@popperjs/core';
import styled from 'styled-components';

type ButtonProps = {
  node: VM.Button<any> | VM.ContextMenuButton;
  children: ReactNode;
  toolTip: string;
  toolTipPlacement?: Placement;
  height?: number;
  width?: number;
  backgroundColor?: string;
};

const ButtonDiv = styled.div<{ backgroundColor?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;

  padding: 0.25rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background 0.2s;

  height: ${({ height }) => (height ? `${height}px` : 'auto')};
  width: ${({ width }) => (width ? `${width}px` : 'auto')};

  background: ${({ backgroundColor }) => backgroundColor || 'white'};

  &:hover {
    background: rgba(93, 52, 215, 0.1);
  }

  &.button-active {
    background: rgba(93, 52, 215, 0.2);
  }
`;

export const Button: React.FC<ButtonProps> = ({
  node,
  toolTip,
  children,
  toolTipPlacement = 'right',
  height,
  width,
  backgroundColor,
}) => {
  // TODO - consider using popperjs directly
  return (
    <Tooltip tooltipChildren={toolTip} usePortal popperConfig={{ placement: toolTipPlacement }}>
      <ButtonDiv
        ref={(r: any) => node.safeBindDomElement(r)}
        height={height}
        width={width}
        backgroundColor={backgroundColor}
      >
        {children}
      </ButtonDiv>
    </Tooltip>
  );
};

export default Button;
