import styled, { css } from 'styled-components';
import * as VM from '../../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { NameTagField } from '../../../pages/topic-space/name-tag-field';
import { Icon, IconSC } from '../body-content/icon';
import { FilledStarIcon } from '../../../assets/icons/filled-star';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { CartoonGhost, DownLeftArrowIcon, GrabHandleIcon, HyperLinkIcon, ShareThinIcon } from '../../../assets';
import { Download } from '../../../assets/icons/download';
import { Button } from '../../button';

const hoverStyles = css`
  color: #4849f3;
  background: rgba(93, 52, 215, 0.05);
`;

export const TopicListItemStyled = styled.div``;

export const TopicItemWrapper = styled.div<{
  hover?: boolean | string;
  singleLine?: boolean;
  isExtension?: boolean;
  enableHover?: boolean;
}>`
  padding: ${(props) => (props.isExtension ? '4px 12px' : '12px 16px')};
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  height: fit-content;

  & > .icon-name-tag {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  & > .actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  & > div > div > svg,
  & > div > div > img {
    width: 20px;
    height: 20px;
  }

  ${IconSC} {
    svg,
    img {
      width: 20px;
      height: 20px;
    }
  }

  ${(props) =>
    props.singleLine &&
    css`
      > .icon-name-tag {
        align-items: center;
      }
    `}
  ${(props) =>
    props.hover &&
    css`
      color: #4849f3;
      background: rgba(93, 52, 215, 0.05);
    `}
    ${(props) => props.enableHover && hoverStyles}
    &:hover {
    ${hoverStyles}
  }
`;

type TopicItemProps = {
  node: VM.TopicItem;
  list?: boolean;
  singleLine?: boolean;
};
export const TopicItem = ({ node, list, singleLine }: TopicItemProps) => {
  const isExtension = useMemo(() => node.context.rootNode instanceof VM.AppExtension, [node]);
  const hover = useObserveValue(() => node.hover, [node]);
  const visible = useObserveValue(() => node.visible, [node]);
  const pinProp = useObserveValue(() => node.pinProperty, [node]);
  const focused = useObserveValue(() => node.isFocused, [node]);
  const isDragging = useObserveValue(() => node.dragging, [node]);
  const indicated = useObserveValue(() => node.indicated, [node]);
  const actions = useObserveValue(() => node.actions, [node]);

  if (!visible) return null;

  return (
    <TopicItemWrapper
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      hover={indicated.drag && !node.isInsideOpaque}
      singleLine={node.singleLine || singleLine || isExtension}
      isExtension={isExtension}
      data-testid="topic-item"
      enableHover={!!focused}
    >
      <div className="icon-name-tag">
        {!isExtension && (
          <div style={{ position: 'relative' }}>
            {hover && !node.isInsideOpaque ? (
              <div className="flex items-center justify-center w-5">
                <GrabHandleIcon height={16} width={16} />
              </div>
            ) : pinProp ? (
              <FilledStarIcon height={16} width={16} fill="#FBBF24" />
            ) : (
              <Icon node={node.icon} />
            )}
          </div>
        )}
        <NameTagField node={node.nameTagField} singleLine={node.singleLine || singleLine} onSelect={node.onSelect} />
      </div>
      {actions && <TopicItemActions node={actions} />}
    </TopicItemWrapper>
  );
};

export const TopicItemActions = ({ node }: { node: VM.TopicItemActions }) => {
  const visible = useObserveValue(() => node.visible, [node]);
  const downloadButton = useObserveValue(() => node.downloadButton, [node]);
  const linkButton = useObserveValue(() => node.linkButton, [node]);
  const shareButton = useObserveValue(() => node.shareButton, [node]);
  if (!visible) return null;
  return (
    <div className="actions" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {downloadButton && (
        <Button
          node={downloadButton}
          toolTip="Download content"
          toolTipPlacement="bottom"
          backgroundColor="transparent"
        >
          <Download />
        </Button>
      )}
      {linkButton && (
        <Button node={linkButton} toolTip="Copy link" toolTipPlacement="bottom" backgroundColor="transparent">
          <HyperLinkIcon />
        </Button>
      )}
      {shareButton && (
        <Button node={shareButton} toolTip="Share this topic" toolTipPlacement="bottom" backgroundColor="transparent">
          <ShareThinIcon />
        </Button>
      )}
      <div className="h-4 w-px bg-[#D4D4D8]"></div>
      <DownLeftArrowIcon />
    </div>
  );
};

export const TopicItemSC = styled.div``;

export const TopicItemListWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-grow: 1;
  align-items: stretch;
  flex-direction: column;
  margin: 10px 20px 20px 20px;
  border: 1px solid #e5e5e5;
  border-radius: 3px;
  overflow-y: auto;
`;

const EmptyList = styled.div`
  height: 100%;
  padding: 16px 24px 32px 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 42px;
`;

type TopicItemListProps = { node: VM.MemberBody };

export const TopicItemList = ({ node }: TopicItemListProps) => {
  const items = useObserveValue(() => node.topicItems, [node]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void node.members.load().then(() => setLoading(false));
  }, [node]);

  return (
    <TopicItemListWrapper>
      {items.length === 0 ? (
        <EmptyList>
          <CartoonGhost />
          <div className="text-sm text-[#252422]" style={{ textAlign: 'center' }}>
            {loading ? (
              'Loading...'
            ) : (
              <>
                <p style={{ marginBottom: '4px' }}>Drag & drop things into here to group them.</p>
                <p>Then jump directly into it to view all your things!</p>
              </>
            )}
          </div>
          {/*This topic is not tagged to any members. Drag something here!*/}
        </EmptyList>
      ) : (
        items.map((node) => <TopicListItem key={node.key} node={node} />)
      )}
    </TopicItemListWrapper>
  );
};
type TopicListItemProps = { node: VM.TopicListItem };

export const TopicListItem = ({ node }: TopicListItemProps) => {
  const visible = useObserveValue(() => node.visible, [node]);
  // this is kinda silly but sometimes the topic has isTopic to true even w/o a name
  const parts = useObserveValue(() => node.item.nameTagField.topicName.textField.contentItems, [node]);
  const dragging = useObserveValue(() => node.dragging, [node]);

  if (!visible || !parts?.length || dragging?.type === 'move') return null;
  return (
    <TopicItemSC key={node.key} ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <TopicItem node={node.item} />
    </TopicItemSC>
  );
};
