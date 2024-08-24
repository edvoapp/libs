import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import * as VM from '../../../viewmodel';
import './toolbar-panel.scss';
import { createPortal } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { Window } from '../../window-list';
import { config } from '@edvoapp/common';
import GoogleChrome from '../../../assets/icons/google-chrome';
import { Puzzle } from '../../../assets/icons/puzzle';
import { BoundingBox } from '../../../viewmodel/base';
import { Tooltip } from '../../tooltip';
import styled from 'styled-components';

interface Props {
  node: VM.TabsPanel;
}

const WindowsList = styled.div`
  overflow: auto;
  max-height: calc(75vh - 40px); //account for the header
`;

export function TabsPanel({ node }: Props) {
  const windows = useObserveValue(() => node.windows, [node]);
  const tabsCount = useObserveValue(() => node.tabsObs, [node]).length;
  const missingExt = useObserveValueMaybe(() => node.context.extBridge?.extensionStatus, [node]) === 'NOT_INJECTED';
  const isElectron = node.context.runtime === 'electron';

  return createPortal(
    <div
      className="toolbar-panel left-[72px] -translate-y-1/2 top-1/2 w-[320px] max-h-[75vh] absolute"
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
      style={{ zIndex: 100_000 }}
    >
      <Tooltip
        tooltipChildren={'Drag and drop any tab into the space'}
        usePortal
        popperConfig={{ placement: 'bottom' }}
      >
        <div className=" bg-white/60 backdrop-blur p-3">
          {missingExt && !isElectron ? (
            <div className="flex flex-col items-center gap-4 pt-4">
              <Puzzle />
              <span className="text-2xl font-semibold">Install Chrome Extension</span>
              <p className="text-center text-sm leading-[150%]">
                To move your tabs into Edvo spaces via simple drag and drop.
              </p>
              <a
                className="text-sm font-medium flex gap-3 justify-center items-center p-3 bg-edvo-purple-solid text-white rounded-[3px] w-full"
                href={config.extensionURL}
                target="_blank"
              >
                <GoogleChrome width={16} height={16} />
                <span>Install Chrome Extension</span>
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#71717A] uppercase leading-[170%]">
                Open Tabs ({tabsCount})
              </span>
              <WindowsList>
                {windows.map((node, idx) => (
                  <div className="toolbar-panel-list-item">
                    <Window key={node.key} node={node} index={idx} />
                  </div>
                ))}
              </WindowsList>
            </div>
          )}
        </div>
      </Tooltip>
    </div>,
    document.body,
  );
}
