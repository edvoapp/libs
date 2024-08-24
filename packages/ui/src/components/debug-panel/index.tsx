import * as VM from '../../viewmodel';
import styled from 'styled-components';
import { EdvoObj, useObserveValue } from '@edvoapp/util';
import { MAX_ZINDEX } from '../../utils';

type Props = {
  node: VM.DebugPanel;
};

const DebugPanelSC = styled.table`
  position: fixed;
  pointer-events: none;
  z-index: ${MAX_ZINDEX};
  left: 150px;
  bottom: 50px;
  border: solid 1px #0004;
  border-radius: 4px;
  padding: 4px;
  background: #fff4;
  display: table;
  table-layout: fixed;
  line-height: 1em;
`;

const DebugPanelRow = styled.tr``;

const ParameterName = styled.td`
  display: table-cell;
  font-weight: bold;
`;

const ParameterValue = styled.td`
  display: table-cell;
  padding: 4px;
`;

export const DebugPanel = ({ node }: Props) => {
  const stats = useObserveValue(() => node.stats, [node]);
  const rootTopicSpace = stats.rootTopicSpace?.upgrade();
  const currentFocus = stats.currentFocus?.upgrade();
  const currentFocusMember = stats.currentFocusMember?.upgrade();

  return (
    <DebugPanelSC ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <DebugPanelRow>
        <ParameterName>Focused</ParameterName>
        <ParameterValue>
          {currentFocus ? currentFocus.getClassName() + ' ' + currentFocus.clientRectObs.value?.debug() : 'NONE'}
        </ParameterValue>
      </DebugPanelRow>
      {currentFocusMember && (
        <DebugPanelRow>
          <ParameterValue>&nbsp;&nbsp;&nbsp;&nbsp;Plane</ParameterValue>
          <ParameterValue>
            {currentFocusMember.renderMode.value} {currentFocusMember.planeCoords.value.debug()}
          </ParameterValue>
        </DebugPanelRow>
      )}

      {rootTopicSpace && (
        <>
          <DebugPanelRow>
            <ParameterName>Space</ParameterName>
            <ParameterValue>{rootTopicSpace.clientRectObs.value?.debug()}</ParameterValue>
          </DebugPanelRow>
          <DebugPanelRow>
            <ParameterValue>&nbsp;&nbsp;&nbsp;&nbsp;Plane</ParameterValue>
            <ParameterValue>{rootTopicSpace.viewportState.value?.debug()}</ParameterValue>
          </DebugPanelRow>
        </>
      )}

      <DebugPanelRow>
        <ParameterName>Queries</ParameterName>
        <ParameterValue>{stats.activeQueries}</ParameterValue>
      </DebugPanelRow>
      <DebugPanelRow>
        <ParameterName>Trx</ParameterName>
        <ParameterValue>{stats.activeTransactions}</ParameterValue>
      </DebugPanelRow>
      <DebugPanelRow>
        <ParameterName>Created</ParameterName>
        <ParameterValue>{stats.totalObjectsEver}</ParameterValue>
      </DebugPanelRow>
      <DebugPanelRow>
        <ParameterName>Resident</ParameterName>
        <ParameterValue>{stats.liveObjects}</ParameterValue>
      </DebugPanelRow>
    </DebugPanelSC>
  );
};
