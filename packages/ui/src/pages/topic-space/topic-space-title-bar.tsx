import styled from 'styled-components';
import { VM } from '../..';
import './topic-space-title-bar.scss';
import { useMemo } from 'preact/hooks';
import { useObserveValue } from '@edvoapp/util';
import { NameTagField } from './name-tag-field';
import { FilledStarIcon } from '../../assets/icons/filled-star';
import { Icon, IconSC } from '../../components/topic/body-content/icon';
import { ContextMenuButton } from '../../components/topic-space/context-menu-button';

interface TopicSpaceTitleBarProps {
  node: VM.TopicSpaceTitle;
}

const TopicSpaceTitleBarSC = styled.div`
  top: 12px;
  position: absolute;
  left: 12px;
  z-index: 999;
  // height: 60px;
  width: fit-content;
  background-color: #fff;
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.1);
  display: flex;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 5px;
  padding: 12px 16px;

  flex: 1;
  gap: 8px;
  font-size: 14px;

  align-items: center;

  & > div > svg,
  & > div > img {
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
`;

export const TopicSpaceTitleBar = ({ node }: TopicSpaceTitleBarProps) => {
  const isVisible = useObserveValue(() => node.visible, [node]);
  const isTiling = useObserveValue(() => node.isTiling, [node]);
  const isExtension = useMemo(() => node.context.rootNode instanceof VM.AppExtension, [node]);
  const pinProp = useObserveValue(() => node.pinProperty, [node]);
  const contextMenuButton = useObserveValue(() => node.contextMenuButton, [node]);

  if (!isVisible || isTiling) return null;

  return (
    <TopicSpaceTitleBarSC
      className={'topic-space-titlebar'}
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
    >
      {!isExtension && (
        <div style={{ position: 'relative' }}>
          {pinProp ? <FilledStarIcon height={16} width={16} fill="#FBBF24" /> : <Icon node={node.icon} />}
        </div>
      )}
      <NameTagField node={node.nameTagField} singleLine={true} />

      {contextMenuButton && <ContextMenuButtonStyled node={contextMenuButton} />}
    </TopicSpaceTitleBarSC>
  );
};

const ContextMenuButtonStyled = styled(ContextMenuButton)`
  //position: absolute;
  //right: 8px;
  flex-basis: 16px;
  flex-shrink: 0;
  background: linear-gradient(270deg, rgba(231, 231, 231, 0) 0%, rgba(255, 255, 255, 1) 13%);
`;
