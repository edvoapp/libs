import { useObserveValue } from '@edvoapp/util';
import { Tooltip } from '../../..';
import './topic-lozenge.scss';
import * as VM from '../../../viewmodel';
import styled, { css } from 'styled-components';
import { Model } from '@edvoapp/common';
import { useSharedBackref, useSharedEdge } from '../../../hooks/useSharedState';

export const LozengeStyle = styled.div<{
  selected?: boolean;
  focused?: boolean | string;
  current?: boolean;
  background?: string;
}>`
  outline: 0;
  cursor: pointer;
  display: inline-flex;
  color: #3d1c6c;
  ${(props) =>
    css`
      background: ${props.background ?? '#ede4f8'};
    `}
  align-items: center;
  border-radius: 3px;
  font-weight: 500;
  font-size: 12px;
  line-height: 130%;
  padding: 2px 4px;
  position: relative;
  user-select: none;
  max-width: 140px;
  border: solid 1px #ede4f8;
  overflow: hidden;
  vertical-align: middle;

  ${(props) =>
    props.current &&
    css`
      opacity: 0.5;
    `}
  input {
    font-size: 12px;
  }
`;

export const LozengeText = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CloseButton = styled.div`
  position: absolute;
  right: 2px;
  top: 6px;
  .close-icon {
    height: 12px;
    width: 12px;
    margin-left: 6px;
  }
`;

interface LozengeProps {
  node: VM.Lozenge<VM.EntRelation | undefined>;
  className?: string;
}

export const Lozenge = ({ node, className }: LozengeProps) => {
  const name = useObserveValue(() => node.name, [node]);
  const { sharedCx } =
    node.relation instanceof Model.Backref
      ? useSharedBackref(node.relation)
      : node.relation instanceof Model.Edge
      ? useSharedEdge(node.relation)
      : { sharedCx: '' };

  return (
    <Tooltip
      usePortal
      popperConfig={{ placement: 'top' }}
      tooltipChildren={<span>{name}</span>}
      triggerProps={{
        className,
        style: { display: 'inline' },
      }}
    >
      <LozengeStyle className={sharedCx} ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        <LozengeText>{name}</LozengeText>
      </LozengeStyle>
    </Tooltip>
  );
};
