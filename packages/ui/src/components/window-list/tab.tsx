import styled, { css } from 'styled-components';
import * as VM from '../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { TagList } from '../tag-list';
import { CheckboxChecked, CheckboxUnchecked, NoFavicon, PinIcon } from '../../assets';
import { useEffect } from 'preact/hooks';
import { Archive } from '../../assets/icons/archive';
import { CloseIcon } from '../../assets/icons';
import { Tooltip } from '../tooltip';

const TabTitle = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  //min-width: 200px;
  //max-width: 400px; // this is actually just an arbitrary number; it seems to still work right with tags
  white-space: nowrap;
  flex: 1;
`;

const TabWrapper = styled.div<{
  vertex?: boolean;
  isPinned: boolean | null;
  hasUrl: boolean;
  indicated?: boolean;
}>`
  display: flex;
  gap: 12px;
  max-height: 40px;
  padding: 16px 12px;
  align-items: center;
  flex: 1;
  font-weight: 400;
  overflow: hidden;
  position: relative;
  font-size: 14px;
  ${(props) =>
    !props.hasUrl &&
    css`
      background-color: #ddd;
    `}
  ${(props) =>
    props.indicated &&
    css`
      color: #4849f3;
      background: rgba(93, 52, 215, 0.05);
    `}
  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
    //width: 5px; // this doesn't seem to actually work
  }
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */

  svg,
  img {
    width: 16px;
    height: 16px;
    align-self: center;
  }
`;

type Props = { node: VM.Tab };

const CheckboxLabel = styled.label<{ checked?: boolean }>``;

const Checkbox = styled.input<{ checked?: boolean }>`
  display: none;

  & ~ ${CheckboxLabel} {
    .checkbox-checked {
      display: none;
    }
    .checkbox-unchecked {
      display: flex;
    }
  }
  &:checked {
    & ~ ${CheckboxLabel} {
      .checkbox-checked {
        display: flex;
      }
      .checkbox-unchecked {
        display: none;
      }
    }
  }
`;

const ArchiveBtn = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a89fab;
  flex-basis: 20px;
  flex-shrink: 0;
  margin-right: 10px;
  transform: translateX(12px);
  border-radius: 999999px;
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;

  svg {
    margin: 0;
    height: 20px;
    width: 20px;
  }
  &:hover {
    background: rgba(93, 52, 215, 0.1);
    svg > path {
      stroke: #000000;
    }
  }
`;

export const Tab = ({ node }: Props) => {
  const favicon = useObserveValue(() => node.tab.faviconUrl, [node]);
  const title = useObserveValue(() => node.tab.title, [node]) ?? 'Untitled';
  const url = useObserveValue(() => node.tab.url, [node]);
  const isPinned = useObserveValue(() => node.tab.pinned, [node]);
  const dragging = useObserveValue(() => node.dragging, [node]);
  const vertex = useObserveValue(() => node.vertex, [node]);
  const tags = useObserveValue(() => node.tags, [node]);
  const archiveBtn = useObserveValue(() => node.archiveBtn, [node]);
  const isIndicated = useObserveValue(() => node.indicated, [node]);
  const isDisabled = !url;
  // if (dragging?.type === 'move' && !isPinned) return null;
  return (
    <TabWrapper
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      vertex={!!vertex}
      isPinned={isPinned}
      hasUrl={!!url}
      indicated={isIndicated.drag}
    >
      {/* {isPinned ? (
        <PinIcon width={20} height={20} />
      ) : (
        <div style={{ width: 36, height: 36, margin: '0 6px' }}></div>
      )} */}

      {favicon ? <img alt={title} src={favicon} /> : <NoFavicon />}

      <Tooltip
        tooltipChildren={title}
        usePortal
        triggerProps={{
          style: {
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }}
      >
        <TabTitle>{title}</TabTitle>
      </Tooltip>
      {tags && <TagList node={tags} />}
      {archiveBtn && (
        <Tooltip tooltipChildren={'Close Tab'} usePortal>
          <ArchiveBtn ref={(r: HTMLElement | null) => archiveBtn.safeBindDomElement(r)}>
            <CloseIcon />
          </ArchiveBtn>
        </Tooltip>
      )}
    </TabWrapper>
  );
};
