import styled, { css } from 'styled-components';
import { useMemo } from 'preact/hooks';
import * as VM from '../../viewmodel';
import { Tooltip, TopicName } from '../../components';
import { TagList } from '../../components/tag-list/tag-list';
import { Model, TrxRef } from '@edvoapp/common';
import { useObserveValue } from '@edvoapp/util';

type NameTagFieldProps = {
  node: VM.NameTagField;
  count?: number;
  showCount?: boolean;
  flexed?: boolean;
  singleLine?: boolean;
  onSelect?: ((vertex: Model.Vertex, trx: TrxRef) => void) | null;
  hover?: boolean | string;
};

export const NameTagFieldRoot = styled.div<{
  flexed?: boolean;
  singleLine?: boolean;
}>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: auto;
  gap: 8px;
  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
    //width: 5px; // this doesn't seem to actually work
  }
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */

  ${(props) =>
    props.flexed &&
    css`
      flex: 1;
      flex-wrap: wrap;
    `}
  ${(props) =>
    props.singleLine
      ? css`
          flex-direction: row;
          align-items: center;
          height: 24px;
          justify-content: flex-start;
        `
      : css`
          margin-top: 4px;
        `}
`;

const ItemsCount = styled.span`
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  font-size: 11px;
  line-height: 120%;
  color: #a89fab;
  margin: 0 8px;
`;

export function NameTagField({ node, count, showCount, flexed, singleLine, hover, onSelect }: NameTagFieldProps) {
  const isExtension = useMemo(() => node.context.rootNode instanceof VM.AppExtension, [node]);
  const memberList = useObserveValue(() => node.tagList.members, [node]);
  const header = node.findClosest((n) => n instanceof VM.MemberHeader && n);
  return (
    <NameTagFieldRoot
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      flexed={flexed}
      singleLine={singleLine || isExtension}
    >
      <div className={`topic-name ${hover && onSelect && 'underline'}`}>
        {node.showTooltip ? (
          <Tooltip
            tooltipChildren={'Name this to find it easily later'}
            usePortal
            popperConfig={{ placement: 'bottom-end' }}
          >
            <TopicName node={node.topicName} noWrap={!!header || node.isTiling.value || isExtension} />
          </Tooltip>
        ) : (
          <TopicName node={node.topicName} noWrap={!!header || node.isTiling.value || isExtension} />
        )}
      </div>
      {memberList.length && singleLine ? <div className="w-px h-6 bg-gray-300 mr-[5px]">&nbsp;</div> : <></>}

      <TagList node={node.tagList} />
    </NameTagFieldRoot>
  );
}
