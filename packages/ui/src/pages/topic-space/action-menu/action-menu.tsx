import { useObserveValue } from '@edvoapp/util';
import { DeleteLeft, MoreHorizontalIcon, Tooltip, VM } from '../../..';
import '../topic-space.scss';
import { useEffect, useRef } from 'preact/hooks';
import { UrlBar } from '../../../components/url-bar';
import { createPortal } from 'preact/compat';
import './action-menu.scss';
import { ColorPalette } from './color-palette';
import { ColorPickerButton } from './color-picker-button';
import { AppearanceButton } from './appearance-button';
import Button from '../../../components/button/button';
import { ExpandCrossIcon } from '../../../assets/icons/expand';
import { Download } from '../../../assets/icons/download';
import { EnterDoorIcon } from '../../../assets/icons/enter-door';
import { NameTagField } from '../name-tag-field';
import styled from 'styled-components';

type ActionMenuProps = {
  node: VM.ActionMenu;
};

export function ActionMenu({ node }: ActionMenuProps) {
  const actionMenuContainerRef = useRef<HTMLDivElement>();
  const actionMenuRef = useRef<HTMLDivElement>();
  const urlBar = useObserveValue(() => node.urlBar, [node]);

  useEffect(() => {
    return node.zIndex.subscribe((zIndex) => {
      node.domElement?.style.setProperty('z-index', zIndex.toString());
    }, true);
  }, [node]);

  if (!node.alive) return null;
  const zIndex = node.zIndex.value;

  const colorPickerButton = useObserveValue(() => node.colorPickerButton, [node]);
  const jumpToButton = useObserveValue(() => node.jumpToButton, [node]);
  const removeButton = useObserveValue(() => node.removeButton, [node]);
  const appearanceButton = useObserveValue(() => node.appearanceButton, [node]);
  const downloadButton = useObserveValue(() => node.downloadButton, [node]);

  const isTiling = useObserveValue(() => node.isTiling, [node]);
  const appearance = useObserveValue(() => node.appearance, [node]);

  // Update the style directly. Don't re-render the react component when clipPath or clientRect change
  useEffect(() => {
    return node.clientRectObs.subscribe((rect) => {
      if (actionMenuContainerRef.current) {
        actionMenuContainerRef.current.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
        actionMenuContainerRef.current.style.width = `${rect.width}px`;
        actionMenuContainerRef.current.style.height = `${rect.height}px`;
      }
      if (actionMenuRef.current) {
        actionMenuRef.current.style.maxWidth = !isTiling ? (rect.width > 720 ? '720px' : '360px') : '';
        actionMenuRef.current.style.width = !isTiling ? 'auto' : '100%';
        actionMenuRef.current.style.height = `${rect.height}px`;
      }
    });
  }, [node, isTiling]);

  const rect = node.clientRectObs.value;

  const actionMenuPositionStyle = {
    position: 'fixed',
    visibility: 'visible',
    transformOrigin: 'top left',
    top: 0,
    left: 0,
    transition: 'none',
    transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex,
  };

  const actionMenuStyle = {
    maxWidth: urlBar && !isTiling ? (rect.width > 720 ? '720px' : '360px') : '',
    width: !isTiling ? 'auto' : '100%',
    height: `${rect.height}px`,
    border: isTiling ? '1px solid #e0e0e0' : '',
    borderRadius: isTiling ? '0px' : '3px',
  };

  return createPortal(
    <div
      style={actionMenuPositionStyle}
      ref={(r: HTMLDivElement | null) => {
        actionMenuContainerRef.current = r ?? undefined;
        node.safeBindDomElement(r);
      }}
      className="flex flex-col gap-2 items-center"
      data-test="action-menu"
    >
      <div
        style={actionMenuStyle}
        ref={(r: HTMLDivElement | null) => {
          actionMenuRef.current = r ?? undefined;
        }}
        className={`menu ${!isTiling ? 'menu-box-shadow' : ''} ${
          appearance?.type == 'stickynote' ? 'justify-center' : 'justify-between'
        } bg-white flex items-center p-1 gap-1`}
      >
        {isTiling && appearance?.type !== 'stickynote' && (
          <div className="ml-2 mr-1 max-w-[500px]">
            <NameTagField node={node.nameTagField} singleLine={true} />
          </div>
        )}
        {urlBar && <UrlBar node={urlBar} />}
        <div className="flex gap-1 items-center">
          {colorPickerButton && (
            <div className="menu-section">
              <ColorPickerButton node={colorPickerButton} />
            </div>
          )}
          {appearanceButton && (
            <div className="menu-section">
              <AppearanceButton node={appearanceButton} />
            </div>
          )}
          {jumpToButton && (
            <div className="menu-section">
              <Button node={jumpToButton} toolTip="Go to Space" toolTipPlacement="top" height={32} width={32}>
                <EnterDoorIcon />
              </Button>
            </div>
          )}
          {downloadButton && (
            <div className="menu-section">
              <Button node={downloadButton} toolTip="Download" toolTipPlacement="top" height={32} width={32}>
                <Download />
              </Button>
            </div>
          )}
          <div className="menu-section">
            <Button node={node.tileButton} toolTip="Fullscreen this" toolTipPlacement="top" height={32} width={32}>
              <ExpandCrossIcon />
            </Button>
          </div>
          {removeButton && (
            <div className="menu-section" data-test="action-menu-remove-button">
              <Button node={removeButton} toolTip="Remove from space" toolTipPlacement="top" height={32} width={32}>
                <DeleteLeft height={17} width={15} />
              </Button>
            </div>
          )}
          <div className="menu-section">
            <Button node={node.contextMenu} toolTip="Open menu" toolTipPlacement="top" height={32} width={32}>
              <MoreHorizontalIcon height={16} width={16} />
            </Button>
          </div>
          {/* )} */}
        </div>
      </div>
    </div>,
    document.body,
  );
}
