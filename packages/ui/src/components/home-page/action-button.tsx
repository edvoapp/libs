import styled from 'styled-components';
import { UpArrowFromLine, VM } from '../..';
import { ReactNode } from '../../react';

type ActionButtonProps = {
  node: VM.Button<any>;
  children: ReactNode;
  width?: string;
  height?: string;
};

export const ActionButton: React.FC<ActionButtonProps> = ({ node, children, width, height }) => {
  return (
    <StyledActionButton width={width} height={height} ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {children}
    </StyledActionButton>
  );
};

export const UploadActionButton: React.FC<{
  node: VM.Button<any>;
  width?: string;
  height?: string;
}> = ({ node, width, height }) => {
  return (
    <StyledActionButton
      width={width}
      height={height}
      id={`fileUploadButton_${node.key}`}
      // dont bind the node twice
      // ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
    >
      <label htmlFor="fileUploadButton" className="flex flex-col gap-4 cursor-pointer">
        <UpArrowFromLine height={24} width={24} fill={'#18181B'} />{' '}
        <div className="flex justify-between items-center w-full">
          <span>Upload Files</span>{' '}
          <div className="p-0.5 bg-[#18181B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
            <span>⌘U</span>
          </div>
        </div>
      </label>
      <input
        id="fileUploadButton"
        type="file"
        multiple
        style={{ display: 'none' }}
        ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      ></input>
    </StyledActionButton>
  );
};

const StyledActionButton = styled.div<{
  width?: string;
  height?: string;
}>`
  display: flex;
  flex-direction: column;
  border-radius: 3px;
  border: 1px solid #18181b1a;
  background: #fafafa;
  color: #18181b;
  padding: 12px;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  flex: 1 0 0;
  gap: 16px;
  width: ${(props) => props.width || 'auto'};
  height: ${(props) => props.height || 'auto'};

  &:hover {
    background: rgba(93, 52, 215, 0.1);
  }

  &.button-active {
    background: rgba(93, 52, 215, 0.2);
  }
`;
