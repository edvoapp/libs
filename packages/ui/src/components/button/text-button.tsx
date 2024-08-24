import styled from 'styled-components';
import { VM } from '../..';
import { ReactNode } from '../../react';

const TextButtonSC = styled.button<{
  backgroundColor?: string;
  fontColor?: string;
  fontSize?: string;
  fontWeight?: string;
  borderColor?: string;
  disableButton?: boolean;
  hover?: boolean | string;
  fullWidth?: boolean;
}>`
  padding: 8px 12px;
  // margin: 0 16px;
  width: ${(props) => (props.fullWidth ? '100%' : 'fit-content')};
  border-radius: 3px;
  background: ${(props) => props.backgroundColor || '#5d34d7'};
  color: ${(props) => props.fontColor || 'white'};
  font-size: ${(props) => props.fontSize || '14px'};
  font-style: normal;
  font-weight: ${(props) => props.fontWeight || '600'};
  line-height: normal;
  border: 1px solid ${(props) => props.borderColor || '#e4e4e7'};
  opacity: ${(props) => (props.disableButton ? 0.5 : 1)};
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;

  svg {
    fill: currentColor;
  }

  &:hover {
    ${(props) => props.hover && 'background: rgba(93, 52, 215, 0.1)'};
  }

  &.button-active {
    ${(props) => props.hover && 'background: rgba(93, 52, 215, 0.2)'};
  }
`;

export const TextButton = ({
  node,
  backgroundColor,
  fontColor,
  borderColor,
  fontSize,
  fontWeight,
  children,
  hover,
  disableButton,
  fullWidth,
}: {
  node: VM.ExitTileModeButton | VM.Button<any>;
  backgroundColor?: string;
  fontColor?: string;
  borderColor?: string;
  fontSize?: string;
  fontWeight?: string;
  children: ReactNode;
  hover?: boolean;
  disableButton?: boolean;
  fullWidth?: boolean;
}) => {
  return (
    <TextButtonSC
      ref={(r: any) => node.safeBindDomElement(r)}
      backgroundColor={backgroundColor}
      fontColor={fontColor}
      borderColor={borderColor}
      fontSize={fontSize}
      fontWeight={fontWeight}
      hover={hover}
      disableButton={disableButton}
      fullWidth={fullWidth}
    >
      <div className="flex justify-center items-center gap-2">{children}</div>
    </TextButtonSC>
  );
};
