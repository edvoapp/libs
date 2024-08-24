import styled, { css } from 'styled-components';
import { CanvasSpaceIcon, TextButton, VM } from '../..';
import { useAwait, useObserveValue } from '@edvoapp/util';
import { TopicItem } from '../topic/member-body/topic-item';
import { NameTagField } from '../../pages/topic-space/name-tag-field';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'preact/hooks';
import { Model, globalStore } from '@edvoapp/common';

const hoverStyles = css`
  color: #4849f3;
  background: rgba(93, 52, 215, 0.05);
`;

const TopicItemSC = styled.div<{
  enableHover?: boolean;
}>`
  ${(props) => props.enableHover && hoverStyles}
  &:hover {
    ${hoverStyles}
  }
`;

const ListSection = styled.ul`
  width: 100%;
  font-size: 14px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  height: calc(100vh - 425px);
`;

export const HomePageList = ({ node }: { node: VM.HomePageList }) => {
  const listMode = useObserveValue(() => node.listMode, [node]);
  const recents = useObserveValue(() => node.recentItems, [node]);
  const favorites = useObserveValue(() => node.pinnedItems, [node]);
  const shared = useObserveValue(() => node.sharedItems, [node]);

  if (listMode === 'recents') {
    return (
      <ListSection ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        {recents.length ? (
          recents.map((node) => <ListItem node={node} key={node.key + 'recents'} />)
        ) : (
          <div className="w-full flex items-center py-6 px-3 relative">
            <span>No Recents</span>
          </div>
        )}
      </ListSection>
    );
  } else if (listMode === 'favorites') {
    return (
      <ListSection ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        {favorites.length ? (
          favorites.map((node) => <ListItem node={node} key={node.key + 'favorites'} />)
        ) : (
          <div className="w-full flex items-center py-6 px-3 relative">
            <span>No favorites</span>
          </div>
        )}
      </ListSection>
    );
  } else if (listMode === 'shared') {
    return (
      <ListSection ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        {shared.length ? (
          shared.map((node) => <ListItem node={node} key={node.key + 'shared'} />)
        ) : (
          <div className="w-full flex items-center py-6 px-3 relative">
            <span>No shared items</span>
          </div>
        )}
      </ListSection>
    );
  } else {
    return null;
  }
};

const ListItem = ({ node }: { node: VM.HomePageListItem }) => {
  const hover = useObserveValue(() => node.hover, [node]);
  const shareButton = useObserveValue(() => node.shareButton, [node]);
  const archiveButton = useObserveValue(() => node.archiveButton, [node]);

  const date = node.shareDate ? node.shareDate : useAwait(() => node.visitEvent(), [node]);

  const timeAgo = date
    ? formatDistanceToNow(globalStore.timestampToDate(date instanceof Model.TimelineEvent ? date.eventDate : date), {
        addSuffix: true,
      })
    : '';

  return (
    <li className="w-full border-b border-[#E4E4E7]" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <div className="w-full flex items-center py-6 px-3 relative">
        <div className="w-1/2 font-semibold flex items-start gap-3 pr-2">
          <div className="mt-0.5">
            <CanvasSpaceIcon />
          </div>

          <NameTagField node={node.nameTagField} singleLine={false} hover={false} />
        </div>
        <div className="w-1/2">{timeAgo}</div>
        {hover && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 ">
            <div className="flex gap-1 items-center justify-end">
              {shareButton && (
                <TextButton
                  node={shareButton}
                  backgroundColor="#FAFAFA"
                  borderColor="#E4E4E7"
                  fontColor="#18181B"
                  key={node.shareButton.key}
                  hover={true}
                >
                  Share
                </TextButton>
              )}
              {archiveButton && (
                <TextButton
                  node={archiveButton}
                  backgroundColor="#FAFAFA"
                  borderColor="#E4E4E7"
                  fontColor="#18181B"
                  key={node.archiveButton.key}
                  hover={true}
                >
                  Archive
                </TextButton>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
};
