import * as VM from '../../viewmodel';
import styled from 'styled-components';
import { useObserveValue } from '@edvoapp/util';
import { CheckboxChecked, CheckboxUnchecked, InfoIcon, Spinner } from '../../assets';
import { useSharedBranchNode } from '../../hooks/useSharedState';
import { ToolCallViewer } from '../../viewmodel/tool-call-viewer';
import { Button } from '../button';
import { UserAvatar } from '../user-avatar';
import ReactJson from 'react-json-view';

export const ChatMessageRow = styled.div<{ isUser: boolean }>`
  display: flex;
  align-items: center;
  align-self: ${(props) => (props.isUser ? 'flex-end' : 'flex-start')};
  max-width: 400px;
`;

export const ChatMessageStyle = styled.div<{ isUser: boolean }>`
  background: ${(props) => (props.isUser ? '#2563EB' : '#E4E4E7')};
  color: ${(props) => (props.isUser ? 'white' : 'black')};
  padding: 6px;
  margin: 6px 0;
  border-radius: 3px;
  display: flex;
  align-items: center;
  // for share indicator
  position: relative;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;

  & > .checkbox-label {
    display: flex;
    align-items: center;
    width: 20px;
    height: 20px;
  }

  & > .checkbox {
    display: none;
    & ~ .checkbox-label {
      .checkbox-checked {
        display: none;
      }
      .checkbox-unchecked {
        display: flex;
      }
    }
    &:checked {
      & ~ .checkbox-label {
        .checkbox-checked {
          display: flex;
        }
        .checkbox-unchecked {
          display: none;
        }
      }
    }
  }
`;

export const Message = ({ node }: { node: VM.Message }) => {
  const messageData = useObserveValue(() => node.content, [node]);
  const taskStatus = useObserveValue(() => node.taskStatus, [node])?.status;
  const { sharedCx } = useSharedBranchNode(node);
  const isToolCall = useObserveValue(() => node.isToolCall, [node]);
  const isDebugLog = useObserveValue(() => node.isDebugLog, [node]);
  const userAvatar = useObserveValue(() => node.userAvatar, [node]);

  if (!messageData) return null;
  return (
    <ChatMessageRow isUser={node.currentUserIsAuthor} ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}>
      {userAvatar && <UserAvatar node={userAvatar} />}
      <ChatMessageStyle className={sharedCx} isUser={node.currentUserIsAuthor}>
        {taskStatus === 'running' ? <Spinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-600" /> : null}
        {/* TODO: create a VM Checkbox */}
        {taskStatus === 'completed' ? (
          <>
            <input
              type="checkbox"
              id={`checkbox-${node.vertex.id}`}
              className="checkbox"
              checked={taskStatus === 'completed'}
            />
            <label htmlFor={`checkbox-${node.vertex.id}`} className="checkbox-label">
              <CheckboxChecked width="20" height="20" className={'checkbox-checked'} />
              <CheckboxUnchecked width="20" height="20" className={'checkbox-unchecked'} />
            </label>
          </>
        ) : null}
        {messageData}

        {isToolCall && (
          <Button node={node.showToolCall} toolTip="Show tool call detail">
            <InfoIcon fill="#555" style={{ height: 15, width: 15 }} />
          </Button>
        )}

        {isDebugLog && (
          <Button node={node.showJson} toolTip="Show JSON detail">
            <InfoIcon fill="#555" style={{ height: 15, width: 15 }} />
          </Button>
        )}
      </ChatMessageStyle>
    </ChatMessageRow>
  );
};
