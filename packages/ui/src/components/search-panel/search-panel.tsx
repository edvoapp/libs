import { useObserveValue } from '@edvoapp/util';
import styled, { css } from 'styled-components';
import { CloseIcon, DownLeftArrowIcon, DragDropIcon, SearchIcon, UpDownArrows } from '../../assets';
import * as VM from '../../viewmodel';
import { TopicItem } from '../topic/member-body/topic-item';
import { Text } from '../topic/body-content/text';
import './search-panel.scss';
import { createPortal } from 'preact/compat';
import { MIN_MODAL_ZINDEX } from '../../utils';
import { DEPTH_MASK_Z } from '../../constants';

interface SearchPanelProps {
  node: VM.SearchPanel;
}

export function SearchPanel({ node }: SearchPanelProps) {
  const searchResults = useObserveValue(() => node.topicSearchList.searchItems, [node]);
  const searchTerm = useObserveValue(() => node.topicSearchList.queryTextDebounced, [node]);
  const textfieldFocused = useObserveValue(
    () => node.textfield.isFocused,
    // FIXME: this doesn't belong here; compute in VM
    [node, node.textfield, node.textfield.isFocused],
  );
  const visible = useObserveValue(() => node.visible, [node]);
  if (!visible) return null;

  return createPortal(
    <div
      className="panel-container top-[70px] left-1/2 -translate-x-1/2 fixed"
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      style={{ zIndex: 100_000 }}
    >
      <div className="bg-white/60 backdrop-blur p-3 w-[640px] max-h-[75vh] panel">
        <div className="flex flex-col gap-2 search-panel">
          <SearchBoxSC className={`${textfieldFocused ? 'search-outline' : 'search-default'}`}>
            <div className="flex items-center gap-2">
              <SearchIcon />
              <TagSearchCaret node={node} />
            </div>

            {/* TODO: change onClick to behavior for transparency */}
            <div className="flex items-center gap-3">
              {searchTerm && (
                <button
                  className="bg-transparent hover:bg-edvo-purple-hover rounded-full transition-all"
                  onClick={() => node.clear()}
                >
                  <CloseIcon />
                </button>
              )}
              <div className="h-[18px] w-[30px] px-1 py-0.5 bg-edvo-indigo text-sm font-semibold text-white flex items-center justify-center rounded-[1px]">
                <span>⌘K</span>
              </div>
            </div>
          </SearchBoxSC>

          {!searchTerm.length ? (
            <>
              <span>Recent</span>
              <ItemsList node={node.topicSearchList} label="Recents" type="space" show="recents" />
            </>
          ) : (
            <>
              <span>
                Search results for "{searchTerm}" ({searchResults.length})
              </span>
              <ItemsList node={node.topicSearchList} label="Search Results" type="space" show="search" />
            </>
          )}
        </div>
      </div>
      <div className="panel-footer bg-zinc-100/60 backdrop-blur">
        <div className="flex gap-1 items-center">
          <UpDownArrows width={12} height={12} fill={'#A1A1AA'} />
          <span>Select</span>
        </div>
        <div className="flex gap-1 items-center">
          <DownLeftArrowIcon width={12} height={12} fill={'#A1A1AA'} />
          <span>Open</span>
        </div>
        <div className="flex gap-1 items-center">
          <DragDropIcon width={12} height={12} fill={'#A1A1AA'} />
          <span>Drag and drop</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const hoverStyles = css`
  color: #4849f3;
  background: rgba(93, 52, 215, 0.05);
`;

export const TopicItemSC = styled.div<{
  enableHover?: boolean;
}>`
  ${(props) => props.enableHover && hoverStyles}
  &:hover {
    ${hoverStyles}
  }
`;

export const ItemsList = ({
  label,
  node,
  type,
  show,
}: {
  label: string;
  show: 'recents' | 'search';
  node: VM.SearchPanelResults;
  type: string;
}) => {
  const createNewTopicButton = useObserveValue(() => node.createNewTopicButton, [node]);
  const recents = useObserveValue(() => node.recentItems, [node]);
  const search = useObserveValue(() => node.searchItems, [node]);
  const items = show === 'recents' ? recents : search;
  return (
    <div className="flex flex-col gap-2" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <div className="flex flex-col bg-white toolbar-panel-list max-h-[60vh] overflow-auto">
        {items.length ? (
          items.map((node) => <TopicItem node={node} list={true} key={node.key + label} />)
        ) : (
          <span>No {label}</span>
        )}
      </div>
      {createNewTopicButton && (
        <div className="flex flex-col bg-white toolbar-panel-list">
          <CreateNewTopicButton node={createNewTopicButton} type={type} />
        </div>
      )}
    </div>
  );
};

const CaretRoot = styled.div<{ inline?: boolean }>`
  margin-left: -5px;
  margin-right: 2px;

  ${(props) =>
    props.inline &&
    css`
      display: inline-block;
      margin-left: 0;
      margin-right: 4px;
    `}
`;

function TagSearchCaret({ node, inline }: { node: VM.SearchPanel; inline?: boolean }) {
  //TODO: make a new node for TagSearchCaret rather than stealing from SearchPanel
  return (
    <CaretRoot /*ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}*/ inline={inline}>
      <Text node={node.textfield} noWrap caretHeight={18} />
    </CaretRoot>
  );
}

const SearchBoxSC = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 3px;
  padding: 8px;
  gap: 8px;
  background-color: #ffffff;
  color: #000000;
`;

export const CreateNewTopicButton = ({ node, type }: { node: VM.CreateNewTopicButton; type: string }) => {
  const focused = useObserveValue(() => node.isFocused, [node]);
  //const selected = useObserveValue(() => node.isSelected, [node]);
  //const hover = useObserveValue(() => node.hover, [node]);
  const text = useObserveValue(() => node.searchVal, [node]);

  if (!text) return null;
  return (
    <TopicItemSC
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      enableHover={!!focused}
      // {...{ focused, selected, hover }}
      className="topic-item-wrapper flex items-center justify-center"
    >
      <span>
        Create "{text}" {type === 'space' ? 'space' : 'relation'}
      </span>
    </TopicItemSC>
  );
};
