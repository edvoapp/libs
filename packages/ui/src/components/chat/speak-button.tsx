import * as VM from '../../viewmodel';
import styled from 'styled-components';
import { useObserveValue } from '@edvoapp/util';
import { Microphone } from '../../assets';
import { Tooltip } from '../tooltip';

const SpeakButtonRoot = styled.div<{ active: boolean }>`
  background: ${(props) => (props.active ? '#2563EB' : '#E4E4E7')};
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const SpeakButton = ({ node }: { node: VM.SpeakButton }) => {
  const active = useObserveValue(() => node.active, [node]);
  return (
    <Tooltip
      tooltipChildren={active ? 'Release to send' : 'Mouse down to speak, or hold Alt-Meta'}
      usePortal
      popperConfig={{ placement: 'top' }}
    >
      <SpeakButtonRoot active={active} ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}>
        <Microphone width={16} height={16} />
      </SpeakButtonRoot>
    </Tooltip>
  );
};
