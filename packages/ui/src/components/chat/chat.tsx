import { useAwait, useEdvoObj, useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';
import { Message } from './message';
import { Text } from '../topic/body-content/text';
import styled from 'styled-components';
import { useEffect, useMemo, useRef } from 'preact/compat';
import { SpeakButton } from './speak-button';
import { TextField } from '../../viewmodel';
import { UserAvatar } from '../user-avatar';
import { useSharedBranchNode } from '../../hooks/useSharedState';
import { ConversationLabel } from './chat-name';
import { ToggleAgentButton } from './toggle-agent-button';

const ChatDiv = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px;
  align-items: stretch;
  flex: 1;
`;
const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #ccc;
`;

const ChatHeader = styled.div`
  display: flex;
  align-items: baseline;
  padding-bottom: 10px;
  margin-bottom: 10px;
  flex-direction: column;
`;

const ChatBody = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
    //width: 5px; // this doesn't seem to actually work
  }
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
`;

const TextInput = styled.div`
  border-radius: 3px;
  border: 1px solid #e4e4e7;
  background: #fff;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
const SubLabelSC = styled.div`
  font-size: 0.8rem;
  color: #999;
  margin-left: 10px;
  align-self: baesline;
`;
const TextWrapperSC = styled.div`
  flex: 1;
`;

export const Chat = ({ node }: { node: VM.Chat }) => {
  const messages = useObserveValue(() => node.messages, [node]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // const activeAgents = useObserveValue(() => node.activeAgents, [node]);
  const typing = useEdvoObj(() => node.typingIndicator, [node]);
  const participants = useEdvoObj(() => node.participants, [node]);
  const isSpaceChat = useMemo(() => node.isSpaceChat, [node]);

  const toggleAgentButton = useObserveValue(() => node.toggleAgentButton, [node]);

  // const { sharedCx } = useSharedBranchNode(node);

  // Scroll to the bottom upon initial load
  useAwait(async () => {
    await node.walkTree();
    messagesEndRef.current?.scrollIntoView();
  }, [node]);

  // Scroll to the bottom any time a new message comes in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length, typing]);

  return (
    <ChatDiv
      // className={sharedCx}
      ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}
    >
      <ChatHeader>
        <ConversationLabel node={participants} />
        {isSpaceChat && <SubLabelSC>Everyone with access to this space can see</SubLabelSC>}
      </ChatHeader>
      <ChatBody>
        {messages.length === 0 ? (
          <EmptyStateContainer />
        ) : (
          messages.map((message) => <Message node={message} key={message.key} />)
        )}
        <TypingIndicator node={typing} />
        <div ref={messagesEndRef} />
      </ChatBody>
      <TextInput>
        <TextWrapperSC>
          <Text node={node.textfield} />
        </TextWrapperSC>
        <SpeakButton node={node.speakButton} />
        {toggleAgentButton && <ToggleAgentButton node={toggleAgentButton} />}
      </TextInput>
    </ChatDiv>
  );
};

const TypingIndicatorContainer = styled.div`
  background: '#E4E4E7';
  color: 'black';
  padding: 6px;
  margin: 6px 0;
  align-self: 'flex-start';
  max-width: 80%;
  border-radius: 3px;
  display: flex;
  align-items: center;
  // for share indicator
  position: relative;
  border-radius: 9999px;
  padding: 1rem;
`;

const DotContainer = styled.div`
  display: flex;
  align-items: center; // Add this line to vertically align the dots in the middle
  .dot {
    border-radius: 9999px;
    height: 0.5rem;
    width: 0.5rem;
    background: rgba(148 163 184 / 1);
    animation: wave 1s infinite;
    margin: 0 2px;
  }

  .dot:nth-child(1) {
    animation-delay: 0.3333s;
  }
  .dot:nth-child(2) {
    animation-delay: 0.6666s;
  }
  .dot:nth-child(3) {
    animation-delay: 0.9999s;
  }

  @keyframes wave {
    0% {
        transform: translateY(0px);
        background: rgba(148 163 184 / 0);
    }
    50% {
        transform: translateY(-0.5rem);
        background: rgba(148 163 184 / 0.8);
    }
    100% {
        transform: translateY(0px);
        background: rgba(148 163 184 / 0);
    }
  }
}
`;

const TypingIndicator = ({ node }: { node: VM.TypingIndicator }) => {
  const avatars = useObserveValue(() => node.avatars, [node]);
  if (avatars.length === 0) return null;
  return (
    <TypingIndicatorContainer ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}>
      {avatars.map((node) => (
        <UserAvatar node={node} key={node.key} />
      ))}

      <DotContainer>
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </DotContainer>
    </TypingIndicatorContainer>
  );
};

// const TypingIndicator = ({ node }: { node: VM.TypingIndicator }) => {
//   const avatars = useObserveValue(() => node.avatars, [node]);
//   return (
//     <ChatMessageStyle
//       isUser={false}
//       ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}
//     >
//       {avatars.map((node) => (
//         <UserAvatar node={node} key={node.key} />
//       ))}
//       <div class="dot"></div>
//       <div class="dot"></div>
//       <div class="dot"></div>
//     </ChatMessageStyle>
//   );
// };
