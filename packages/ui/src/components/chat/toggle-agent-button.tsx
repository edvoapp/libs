import { useObserveValue } from '@edvoapp/util';
import styled from 'styled-components';
import { Button, VM } from '../..';

const CreateChatButtonRoot = styled.div<{ active: boolean }>`
  padding: 12px;
  width: 48px;
  height: 48px;

  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 2rem;

  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: ${(props) =>
    props.active ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.20) 0%, rgba(0, 0, 0, 0.20) 100%), #5D34D7' : '#fff'};
  background-blend-mode: overlay, normal;

  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
`;

export const ToggleAgentButton = ({ node }: { node: VM.ToggleAgentButton }) => {
  const active = useObserveValue(() => node.active, [node]);
  return (
    <>
      <Button
        node={node}
        toolTip="Toggle agent"
        // active={active}
      >
        ✨
      </Button>
    </>
  );
};
