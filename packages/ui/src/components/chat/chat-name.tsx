import { useObserveValue } from '@edvoapp/util';
import { VM } from '../..';
import { Text } from '../topic/body-content/text';
import styled from 'styled-components';
import { useMemo } from 'preact/hooks';

const LabelDiv = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  self-align: baseline;
`;

const NameSC = styled.span`
  font-weight: bold;
`;
const ParticipantsListSC = styled.div`
  font-size: 0.8rem;
  display: flex;
`;

export const ConversationLabel = ({ node }: { node: VM.ConversationLabel }) => {
  const name = useObserveValue(() => node.name, [node]);
  const participants = useObserveValue(() => node.participants, [node]);
  const isSpaceChat = useMemo(() => node.isSpaceChat, [node]);

  return (
    <LabelDiv ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {name && <NameSC>{name}</NameSC>}
      {isSpaceChat && ' - Space Chat'}
      <ParticipantsListSC>
        {participants.length > 0 &&
          participants.map((p, i) => (
            <>
              {i !== 0 && <span className="mr-0.5">,</span>}
              <Text node={p} key={p.key} noWrap />
            </>
          ))}
      </ParticipantsListSC>
    </LabelDiv>
  );
};
