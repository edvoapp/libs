import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';
import './toolbar.scss';
import { GlobeIcon } from '../../assets/icons/globe';
import { StickyIcon } from '../../assets/icons/note-sticky';
import { NoteIcon } from '../../assets/icons/file-icons';
import { UpFromLine } from '../../assets/icons/up-from-line';
import { BrowsersIcon } from '../../assets/icons/browsers';
import { StarIcon } from '../../assets/icons/star';
import { FolderIcon, PlusIcon } from '../../assets';

interface Props {
  node: VM.ToolbarButton;
}

export function ToolbarButton({ node }: Props) {
  const visible = useObserveValue(() => node.visible, [node]);
  const isOpen = useObserveValue(() => node.parentNode.uploadModalOpen, [node]);
  const favoritesPanel = useObserveValue(() => node.parentNode.pinnedItems, [node]);
  const tabsPanel = useObserveValue(() => node.parentNode.tabsPanel, [node]);
  const isSearchOpen = useObserveValue(() => node.isSearchOpen, [node]);

  if (!visible) return null;

  function renderIconComponent() {
    if (node.memberType) {
      switch (node.memberType) {
        case 'browser':
          return <GlobeIcon width={24} height={24} />;
        case 'stickynote':
          return (
            <div className="flex flex-col justify-center items-center gap-1">
              <StickyIcon width={24} height={24} />
              <div className="flex flex-col justify-center items-center">
                <span className="text-[10px] font-bold">Sticky</span>
                <span className="text-[10px] font-medium -mt-px">(S)</span>
              </div>
            </div>
          );
        case 'normal':
          return (
            <div className="flex flex-col justify-center items-center gap-1">
              <NoteIcon width={24} height={24} />
              <div className="flex flex-col justify-center items-center">
                <span className="text-[10px] font-bold">Note</span>
                <span className="text-[10px] font-medium -mt-px">(N)</span>
              </div>
            </div>
          );
        case 'list':
          return (
            <div className="flex flex-col justify-center items-center gap-1">
              <FolderIcon width={24} height={24} />
              <div className="flex flex-col justify-center items-center">
                <span className="text-[10px] font-bold">Space</span>
                <span className="text-[10px] font-medium -mt-px">(A)</span>
              </div>
            </div>
          );
        default:
          return null;
      }
    }
    if (node.mode) {
      switch (node.mode) {
        case 'upload':
          return (
            <div className="flex flex-col justify-center items-center gap-1">
              <UpFromLine width={24} height={24} />
              <div className="flex flex-col justify-center items-center">
                <span className="text-[10px] font-bold">Upload</span>
                <span className="text-[10px] font-medium -mt-px">(⌘U)</span>
              </div>
            </div>
          );
        case 'tabs':
          return (
            <div className="flex flex-col justify-center items-center gap-1">
              <BrowsersIcon width={24} height={24} />
              <div className="flex flex-col justify-center items-center">
                <span className="text-[10px] font-bold">Tabs</span>
                <span className="text-[10px] font-medium -mt-px">(⌘B)</span>
              </div>
            </div>
          );
        case 'pinned':
          return <StarIcon width={24} height={24} />;
        case 'search':
          return (
            <div className="flex flex-col justify-center items-center gap-1">
              <PlusIcon width={24} height={24} fill={'#000000'} />
              <div className="flex flex-col justify-center items-center">
                <span className="text-[10px] font-bold">Add</span>
                <span className="text-[10px] font-medium -mt-px">(⌘K)</span>
              </div>
            </div>
          );
        default:
          return null;
      }
    }
  }
  return (
    <>
      {node.memberType && (
        <div
          ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
          className={`p-1 w-10 flex items-center justify-center transition-all ${
            node.parentNode.parentNode.quickAdd.nextMemberType === node.memberType &&
            node.parentNode.parentNode.quickAdding.value
              ? 'toolbar-button-active'
              : 'toolbar-button'
          }`}
          style={{ zIndex: 100_000 }}
        >
          {renderIconComponent()}
        </div>
      )}
      {node.mode === 'upload' && (
        <div id={`fileUploadButton_${node.key}`}>
          <label
            htmlFor="fileUploadButton"
            className={`p-1 w-10 flex items-center justify-center transition-all ${
              isOpen ? 'toolbar-button-active' : 'toolbar-button'
            } cursor-pointer`}
            style={{ zIndex: 100_000 }}
          >
            {renderIconComponent()}
          </label>
          <input
            id="fileUploadButton"
            type="file"
            multiple
            style={{ display: 'none' }}
            ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
            onClick={() => {
              node.upgrade()?.closeAllPanels();
            }}
          ></input>
        </div>
      )}
      {/* {node.mode === 'pinned' && (
        <div
          ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
          className={`h-10 w-10 flex items-center justify-center transition-all ${
            favoritesPanel ? 'toolbar-button-active' : 'toolbar-button'
          }`}
          style={{ zIndex: 100_000 }}
        >
          {renderIconComponent()}
        </div>
      )} */}
      {node.mode === 'tabs' && (
        <div
          ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
          className={`p-1 w-10 flex items-center justify-center transition-all ${
            tabsPanel ? 'toolbar-button-active' : 'toolbar-button'
          }`}
          style={{ zIndex: 100_000 }}
        >
          {renderIconComponent()}
        </div>
      )}
      {node.mode === 'search' && (
        <div
          ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
          className={`p-1 w-10 flex items-center justify-center transition-all ${
            isSearchOpen === 'standard' ? 'toolbar-button-active' : 'toolbar-button'
          }
          `}
          style={{ zIndex: 100_000 }}
        >
          {renderIconComponent()}
        </div>
      )}
    </>
  );
}
