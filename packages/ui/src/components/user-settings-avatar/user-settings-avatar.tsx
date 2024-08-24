import { globalStore } from '@edvoapp/common';
import { useObserveValue, useObserve, Observable, QueryString, useObserveValueMaybe, useEdvoObj } from '@edvoapp/util';
import { AppSettingsModal, UserSettingsModal } from '../user-settings-modal';
import './user-settings-avatar.scss';
import { Link } from 'preact-router';
import { DropdownMenu } from '../dropdown-menu';
import { UserAvatar } from '../user-avatar';
import { InviteModal } from '../invite-modal';
import * as VM from '../../viewmodel';
import styled from 'styled-components';

interface Props {
  node: VM.CurrentUserAvatar;
}

export function UserSettingsAvatar({ node }: Props) {
  const inviteModalOpen = useObserve(() => new Observable(false), []);
  const currentUser = globalStore.getCurrentUser();

  const userSettingsModal = useObserveValue(() => (node.root as VM.AppDesktop).userSettingsModal, [node]);

  const appSettingsModal = useObserveValue(() => (node.root as VM.AppDesktop).appSettingsModal, [node]);

  const dd = node.userSettingsDropmenu;
  const modal = useObserveValue(() => dd.modal, [dd]);

  // HACK - store a copy of menu so safeBindDomElement can be called on object cleanup
  const menu = useEdvoObj(() => modal?.menu as VM.UserSettingsMenu | null, [modal]) as VM.UserSettingsMenu;

  return (
    <div ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {currentUser?.isAnonymous ? (
        <div className="">
          {/* @ts-ignore */}
          <Link
            href={`/auth/login?${QueryString.stringify({
              redirect: window.location.pathname,
            })}`}
            className=""
            style={{
              boxShadow: '0 3px 12px rgba(0, 0, 0, 0.07)',
              padding: '6px 20px',
              borderRadius: 4,
              backgroundColor: '#ddd',
              color: '#6431E0',
            }}
          >
            Log In
          </Link>
        </div>
      ) : (
        <DropdownMenu
          node={dd}
          menuClassName="user-settings-dropdown"
          trigger={<DropdownTrigger node={dd.button as VM.UserSettingsAvatarButton} />}
        >
          {menu && <UserDropdown node={menu} avatarNode={node} />}
        </DropdownMenu>
      )}
      {userSettingsModal && <UserSettingsModal node={userSettingsModal} />}
      {appSettingsModal && <AppSettingsModal node={appSettingsModal} />}
      <InviteModal isOpen={inviteModalOpen.value} onRequestClose={() => inviteModalOpen.set(false)} />
    </div>
  );
}

const DropdownTrigger = ({ node }: { node: VM.UserSettingsAvatarButton }) => {
  const missingExt = useObserveValueMaybe(() => node.missingExt, [node]);

  return (
    <div className="user-settings-avatar">
      <UserAvatar node={(node as VM.UserSettingsAvatarButton).avatar} />
      {missingExt && <div className="red-dot absolute-lower-left" />}
    </div>
  );
};

const UserDropdownRoot = styled.div``;
const UserSettingMenuItemRoot = styled.button<{ hover: string | boolean }>`
  text-align: left;
  padding: 6px 22px;
  font-size: 14px;
  position: relative;
  background: ${(props) => props.hover && 'rgba(93, 52, 215, 0.1)'};
  display: block;
`;

const UserDropdown = ({ node, avatarNode }: { node: VM.UserSettingsMenu; avatarNode: VM.CurrentUserAvatar }) => {
  const fullName = useObserveValue(() => avatarNode.fullName, [avatarNode]) ?? 'Unknown User';
  const email = useObserveValue(() => avatarNode.email, [avatarNode]) ?? '';
  const buttons = useObserveValue(() => node.buttons, [node]);

  return (
    <UserDropdownRoot ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <div className="user-card">
        <div style="center">{fullName}</div>
        {email && <div style="center">{email}</div>}
        <UserAvatar node={node.avatar} />
      </div>
      <hr />

      {buttons.map((button) => (
        <UserSettingMenuItem node={button} key={button.key} />
      ))}
      {/* typeform feedback script */}
      <script src="//embed.typeform.com/next/embed.js"></script>
    </UserDropdownRoot>
  );
};

const UserSettingMenuItem = ({ node }: { node: VM.UserSettingsButton }) => {
  const hover = useObserveValue(() => node.hover, [node]);
  return (
    <UserSettingMenuItemRoot
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      hover={hover}
      target={node.target}
      href={node.href}
      as={node.as}
    >
      {node.type === 'install-extension' && <div className="red-dot absolute-center-left" style="margin-left:4px" />}
      {node.textLabel}
    </UserSettingMenuItemRoot>
  );
};
