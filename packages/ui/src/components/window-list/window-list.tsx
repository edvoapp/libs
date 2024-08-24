import { useEdvoObj, useObserveValue } from '@edvoapp/util';
import styled from 'styled-components';
import * as VM from '../../viewmodel';
import { Tab } from './tab';

const WindowSC = styled.div`
  display: flex;
  flex-direction: column;
`;

const TabListSC = styled.div`
  display: flex;
  flex-direction: column;
`;

const WindowListWrapper = styled.div`
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

const WindowListHeader = styled.div`
  padding: 20px;
  display: flex;
  align-items: center;
`;
const WindowListHeaderTitle = styled.div`
  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 500;
  font-size: 20px;
  line-height: 140%;
  color: #1f1c20;
  display: flex;
  margin-right: 16px;
`;
const WindowListHeaderSubtitle = styled.div`
  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  line-height: 120%;
  color: #a89fab;
`;

export const WindowsContainer = styled.div`
  flex: 1;
  flex-basis: 250px;
  //padding: 18px 26px;
  //border-top: 1px solid #d4cfd5;
  overflow: auto;
  min-height: 250px;
`;

export const WindowsContainerHeader = styled.div`
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
  line-height: 170%;
  color: #71717a;
  text-transform: uppercase;
`;

type WindowProps = { node: VM.BrowserWindow; index: number };

export const Window = ({ node, index }: WindowProps) => {
  // this sort shouldn't be necessary, but unfortunately it is because sortObs isn't working properly
  const tabs = useObserveValue(() => node.tabs, [node]);
  const expanded = useObserveValue(() => node.expanded, [node]);

  // HACK - store a copy so safeBindDomElement can be called on object cleanup
  const header = useEdvoObj(() => node.header, [node]);

  return (
    <WindowSC ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {/* <WindowHeader
        expanded={expanded}
        ref={(r: HTMLElement | null) => header.safeBindDomElement(r)}
      >
        <ArrowBackIcon width={24} height={24} />
        <WindowTitle>Window {index + 1}</WindowTitle>
      </WindowHeader> */}
      {expanded && (
        <TabListSC>
          {tabs.map((node) => (
            <Tab key={node.key} node={node} />
          ))}
        </TabListSC>
      )}
    </WindowSC>
  );
};
