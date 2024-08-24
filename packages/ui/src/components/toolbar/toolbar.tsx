import { Button, FavoritesPanel, SearchPanel, TextButton, ToolbarButton, Tooltip } from '..';
import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';
import './toolbar.scss';
import { TabsPanel } from './panel/tabs-panel';
interface Props {
  node: VM.Toolbar;
}

export function Toolbar({ node }: Props) {
  const userObs = node.context.authService.currentUserVertexObs;
  const visible = useObserveValue(() => node.visible, [node]);
  const isTiling = useObserveValue(() => node.isTiling, [node]);
  const user = useObserveValue(() => userObs, [userObs]);
  const isUpload = useObserveValue(() => node.uploadModalOpen, [node]);
  const pinnedPanel = useObserveValue(() => node.pinnedItems, [node]);
  const tabsPanel = useObserveValue(() => node.tabsPanel, [node]);

  if (!visible || isTiling) return null;

  return (
    <div
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      className="toolbar absolute flex items-center pointer-events-none h-fit ml-3 left-0"
    >
      <div className="h-fit flex flex-col gap-3 pointer-events-auto" style={{ zIndex: 100_000 }}>
        <div className="creation-palette palette bg-white flex flex-col justify-center gap-1 p-1">
          {/* <Tooltip
            tooltipChildren={'Add browser card'}
            usePortal
            popperConfig={{ placement: 'right' }}
          >
            <ToolbarButton node={node.addBrowserButton}></ToolbarButton>
          </Tooltip> */}
          <Tooltip tooltipChildren={'Add a sticky'} usePortal popperConfig={{ placement: 'right' }}>
            <ToolbarButton node={node.addStickyButton}></ToolbarButton>
          </Tooltip>
          <Tooltip tooltipChildren={'Add a note'} usePortal popperConfig={{ placement: 'right' }}>
            <ToolbarButton node={node.addNoteButton}></ToolbarButton>
          </Tooltip>
          <Tooltip
            tooltipChildren={'Add a space to group related things'}
            usePortal
            popperConfig={{ placement: 'right' }}
          >
            <ToolbarButton node={node.addPortalButton}></ToolbarButton>
          </Tooltip>
        </div>
        <div className="context-palette palette bg-white flex flex-col justify-center gap-1 p-1">
          <div className="relative">
            <Tooltip tooltipChildren={'See a list of your open tabs'} usePortal popperConfig={{ placement: 'right' }}>
              <ToolbarButton node={node.tabsButton}></ToolbarButton>
            </Tooltip>

            {tabsPanel && <TabsPanel node={tabsPanel}></TabsPanel>}
          </div>

          <Tooltip tooltipChildren={'Upload a file'} usePortal popperConfig={{ placement: 'right' }}>
            <ToolbarButton node={node.uploadButton}></ToolbarButton>
          </Tooltip>
          <Tooltip
            tooltipChildren={'Find something in your database and drag/drop into this space'}
            usePortal
            popperConfig={{ placement: 'right' }}
          >
            <ToolbarButton node={node.searchButton}></ToolbarButton>
          </Tooltip>
          {/* <div className="relative">
            <Tooltip
              tooltipChildren={'Favorites'}
              usePortal
              popperConfig={{ placement: 'right' }}
            >
              <ToolbarButton node={node.favoritesButton}></ToolbarButton>
            </Tooltip>

            {pinnedPanel && (
              <FavoritesPanel node={pinnedPanel}></FavoritesPanel>
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
}
