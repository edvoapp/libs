import { useDestroyMemo, useEdvoObj, useObserveValue, useSessionManager } from '@edvoapp/util';
import { useObserve as useObserveRs } from 'observable-rs';
import { UserSettingsAvatar } from '../user-settings-avatar';
import './header.scss';
import cx from 'classnames';
import styled from 'styled-components';
import {
  ArrowLeftIcon,
  EdvoLogoFull,
  LogoCircle,
  MenuIcon,
  MenuIconOpen,
  PlusIcon,
  RefreshIcon,
  SearchIconBold,
} from '../../assets';
import * as VM from '../../viewmodel';
import { Tooltip } from '../tooltip';
import { ReactNode } from '../../react';
import { SearchPanel } from '../search-panel/search-panel';
import { Button, TextButton } from '../button';
import { ArrowRightIcon } from '../../assets/icons/arrow-right';

/**
 * Props for the Header component.
 */
interface HeaderProps {
  node: VM.Header;
}

// ANCHOR: Header
/**
 * The header of the desktop layout.
 */

export function Header({ node }: HeaderProps) {
  // Keep node alive in case of later render
  useEdvoObj(() => node, [node]);

  const currentUser = useObserveValue(() => node.context.authService.currentUserVertexObs, [node]);

  const sessionManager = useSessionManager();

  // TODO streamline this like useObserveValue
  let sessionStatusObs = useDestroyMemo(() => {
    return sessionManager.status();
  }, [sessionManager]);

  useObserveRs(sessionStatusObs);
  const status: string = sessionStatusObs.get();
  const userSettingsAvatar = useObserveValue(() => node.userAvatar, [node]);
  const exitTileModeButton = useObserveValue(() => node.exitTileModeButton, [node]);
  const isElectron = node.context.runtime === 'electron';
  const headerHeight = useObserveValue(() => node.heightObs, [node]);
  const navigationHistory = node.navigationHistory;

  return (
    <header
      className="header"
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      style={{ height: headerHeight }}
    >
      <div className="flex items-center gap-2">
        <a href="/">
          <LogoCircle className="pl-logo" data-cy="edvo-logo" data-testid="edvo-logo" />
        </a>
        <span className={cx('session-status-indicator', status)}>&nbsp;</span>
        {/* {currentUser && <JumpSearch node={node.jumpSearch} />} */}
        {isElectron && (
          <Tooltip tooltipChildren={<span>Reload</span>}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => {
                window.electronAPI?.app.reload();
              }}
            >
              <RefreshIcon width={24} height={24} />
            </button>
          </Tooltip>
        )}
        <div className="flex items-center">
          <Button node={node.backButton} toolTip="Go back" toolTipPlacement="bottom" height={32} width={32}>
            <ArrowLeftIcon fill={navigationHistory.canGoBack() ? '#3F3F46' : '#A1A1AA'} />
          </Button>
          <Button node={node.forwardButton} toolTip="Go forward" toolTipPlacement="bottom" height={32} width={32}>
            <ArrowRightIcon fill={navigationHistory.canGoForward() ? '#3F3F46' : '#A1A1AA'} />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {exitTileModeButton && (
          <TextButton node={exitTileModeButton}>
            <span>Exit fullscreen</span>
          </TextButton>
        )}
        <Tooltip
          tooltipChildren={'Find and switch between your things'}
          usePortal
          popperConfig={{ placement: 'bottom-end' }}
        >
          <TextButton node={node.searchButton} backgroundColor="#FAFAFA" fontColor="#18181b" hover={true}>
            <SearchIconBold width={16} height={16} fill={'#52525B'} /> <span> Search</span>
            <div className="p-0.5 bg-[#52525B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
              <span>⌘K</span>
            </div>
          </TextButton>
        </Tooltip>
        <Tooltip
          tooltipChildren={'Create a space to group related things'}
          usePortal
          popperConfig={{ placement: 'bottom-end' }}
        >
          <TextButton node={node.newSpaceButton} borderColor="transparent">
            <span>Create Space</span>
            <div className="p-0.5 bg-[#18181B99]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
              <span>⌘L</span>
            </div>
          </TextButton>
        </Tooltip>
        {userSettingsAvatar && <UserSettingsAvatar node={userSettingsAvatar} />}
      </div>
    </header>
  );
}
