import styled from 'styled-components';
import { Button, Chat, VM } from '../..';
import { ConversationLabel } from './chat-name';
import { useObserveValue } from '@edvoapp/util';
import { useEffect } from 'preact/hooks';

const ChatRoot = styled.div`
  border-radius: 3px;
  background: #fff;
  backdrop-filter: blur(64px);
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
  border: 1px #eee solid;
  position: fixed;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`;

const LeftColumn = styled.div`
  width: 200px;
  height: 100%;
  min-width: 100px;
  border-right: 1px solid #f0f0f0;
`;
const ConversationList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 7px;
`;
const ActiveChatContainer = styled.div`
  flex: 5;
  min-width: 300px;
  height: 100%;
  display: flex;
`;
const NoActiveChatSC = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  color: #ccc;
`;

export function ChatPanel({ node }: { node: VM.ChatPanel }) {
  const conversationList = useObserveValue(() => node.conversationList, [node]);
  const activeChat = useObserveValue(() => node.activeChat, [node]);
  const expanded = useObserveValue(() => node.expanded, [node]);

  useEffect(() => {
    return node.clientRectObs.subscribe((rect) => {
      let el = node.domElement;
      if (el) {
        el.style.top = `${rect.top}px`;
        el.style.left = `${rect.left}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
      }
    });
  }, [node]);
  useEffect(() => {
    return node.zIndex.subscribe((zIndex) => {
      node.domElement?.style.setProperty('z-index', zIndex.toString());
    }, true);
  }, [node]);

  if (!node.alive) return null;
  const zIndex = node.zIndex.value;

  if (!expanded) {
    return null;
  }
  // Updates are done directly on the DOM element
  const rect = node.clientRectObs.value;

  return (
    <ChatRoot
      ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex,
      }}
    >
      {conversationList.length > 1 ? (
        <LeftColumn>
          <ConversationList>
            {conversationList.map((item) => (
              <ConversationListItem node={item} key={item.key} />
            ))}
          </ConversationList>
          {/* <Button node={node.newSpaceChatButton} toolTip="New Space Chat">
            +
          </Button> */}
        </LeftColumn>
      ) : null}
      <ActiveChatContainer>
        {activeChat && <Chat node={activeChat} />}
        {!activeChat && <NoActiveChatSC>No active chat</NoActiveChatSC>}
      </ActiveChatContainer>
      {/*{groupChats.map((chat) => (*/}
      {/*  <Chat node={chat} key={chat.key} />*/}
      {/*))}*/}
    </ChatRoot>
  );
}

const ItemStyled = styled.div`
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
`;
export const ConversationListItem = ({ node }: { node: VM.ConversationListItem }) => {
  return (
    <ItemStyled ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <ConversationLabel node={node.conversationLabel} key={node.key} />
    </ItemStyled>
  );
};
