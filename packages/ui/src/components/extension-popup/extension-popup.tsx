import styled from 'styled-components';
import * as VM from '../../viewmodel';
import { useDestroyMemo, useObserveValue, useSessionManager } from '@edvoapp/util';
import { TopicCardRoot } from '../topic-space/card';
import { TagList, TagSearchCaret } from '../tag-list/tag-list';
import { OpenInNewIcon, SearchIcon } from '../../assets';
import { useObserve as useObserveRs } from 'observable-rs';

type Props = {
  node: VM.ExtensionPopup;
};

const ExtensionPopupSC = styled.div`
  // display: flex;
  // flex-direction: column;
  // align-items: stretch;
  // overflow: auto;
  height: 100%;
  width: 100%;
  padding: 16px;
  position: relative;

  ${TopicCardRoot} {
    background: white;
    display: flex;
    flex-direction: column;
    box-shadow: 2px 3px 7px 2px rgba(0, 0, 0, 0.26);
    overflow: auto;
    margin-right: 8px;
    min-width: 350px;
    max-width: 350px;
    width: 350px;
  }
`;

const TextInput = styled.div`
  display: flex;
  align-items: center;
  margin: 8px 0;
  height: 28px;
  padding-left: 3px;
  padding-top: 3px;

  background: rgba(255, 255, 255, 0.8);
  /* Color/Brand/Neutral/90 */

  border: 1px solid #d4cfd5;
  border-radius: 8px;
  position: relative;

  svg {
    //position: absolute;
    //left: 0;
    //top: 2px;
    margin-right: 2px;
    color: #a89fab;
  }
`;

const CardListRoot = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;
//
// const CardsWrapper = styled.div`
//   display: flex;
//   flex: 1;
//   overflow: auto;
//
//   /* Hide scrollbar for Chrome, Safari and Opera */
//   &::-webkit-scrollbar {
//     display: none;
//     //width: 5px; // this doesn't seem to actually work
//   }
//   -ms-overflow-style: none; /* IE and Edge */
//   scrollbar-width: none; /* Firefox */
// `;

const Button = styled.button<{ hover?: string | boolean }>`
  background: #fff;
  outline: none;
  border: none;

  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.hover ? '#783DF6' : '#655b68')};
  cursor: unset;

  svg {
    margin-left: 8px;
    color: #655b68;
  }
`;

const StatusIndicator = styled.div`
  position: absolute;
  top: 1px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const ExtensionPopup = ({ node }: Props) => {
  const tagList = useObserveValue(() => node.tagList, [node]);
  const openEdvoButton = node.openEdvoButton;
  const openEdvoButtonHover = useObserveValue(() => openEdvoButton.hover, [openEdvoButton]);

  const sessionManager = useSessionManager();

  // TODO streamline this like useObserveValue
  let sessionStatusObs = useDestroyMemo(() => {
    return sessionManager.status();
  }, [sessionManager]);

  useObserveRs(sessionStatusObs);
  const status: 'clean' | 'dirty' | 'init' = sessionStatusObs.get();

  return (
    <ExtensionPopupSC ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <CardListRoot>
        <TextInput>
          <SearchIcon />
          {/* div for positioning the caret */}
          <div style={{ flex: 1 }}>
            <TagSearchCaret node={node.topicSearch} />
          </div>
        </TextInput>
        {tagList && <TagList node={tagList} />}
        <Button hover={openEdvoButtonHover} ref={(r: HTMLElement | null) => openEdvoButton.safeBindDomElement(r)}>
          Bulk-organize Tabs in Edvo
          <OpenInNewIcon />
        </Button>
      </CardListRoot>
      <StatusIndicator>
        {status === 'dirty' ? '⚠️ Saving...' : status === 'clean' ? '✅ Changes saved' : null}
      </StatusIndicator>
    </ExtensionPopupSC>
  );
};
