import { useObserveValue } from '@edvoapp/util';
import { config, globalStore, Model } from '@edvoapp/common';
import { CircleAvatar, DropdownMenu, Tooltip, UserAvatar, VM } from '../..'; // Approved
import { createToast, POSITION, TYPE } from '../../service';

import './share-controls.scss';
import styled, { css } from 'styled-components';
import { useState } from 'preact/hooks';
import { LinkIcon, PadlockIcon, WorldIcon } from '../../components/icons';
import { AttachedPanel } from '../../components/attached-panel';
import {
  ExpandedRow,
  TextItem,
  TitleAndSubtitle,
  UserEmailLozenge,
  UserItem,
  UserLozenge,
  UserNameAndEmail,
} from '../../components/user-lozenge';
import { Text } from '../../components/topic/body-content/text';
import { PermissionLevel } from '@edvoapp/common/dist/model/privileges';

export const copyAndToast = (id: string, text?: string) => {
  const baseURL = config.webappUrl;
  void navigator.clipboard.writeText(`${baseURL}/topic/${id}`);
  createToast(text || 'Link copied to clipboard!', {
    type: TYPE.INFO,
    autoClose: 2000,
    hideProgressBar: true,
    closeOnClick: true,
    draggable: false,
    position: POSITION.TOP_CENTER,
  });
};

export const ShareDropmenu = ({ node, vertex }: { node: VM.DropMenu; vertex: Model.Vertex }) => {
  const modal = useObserveValue(() => node.modal, [node]);
  return (
    <div className={'share-controls'}>
      <DropdownMenu node={node} menuClassName="dropdown-modal-container" trigger={<SharingStatus vertex={vertex} />}>
        {modal && <ShareMenu node={modal.menu as VM.ShareMenu} />}
      </DropdownMenu>
    </div>
  );
};

function SharingStatus({ vertex }: { vertex: Model.Vertex }) {
  const publicShare = useObserveValue(
    () => vertex.shares.filterObs((s) => s.targetUserID == 'PUBLIC').firstObs(),
    [vertex],
  );
  return (
    <Tooltip tooltipChildren={'Share everything'} usePortal popperConfig={{ placement: 'bottom-start' }}>
      <div className="share-button">{publicShare && <WorldIcon />}Share</div>
    </Tooltip>
  );
}

function ShareMenu({ node }: { node: VM.ShareMenu }) {
  return (
    <div style="width: 11cm" ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}>
      <ShareList node={node.list} />
      <div style="margin-top: 24px;  display: flex; width: 100%; flex-direction: row; align-items: center;">
        <CopyLinkButton menuNode={node} />
        <DoneButton menuNode={node} />
      </div>
    </div>
  );
}

function CopyLinkButton({ menuNode }: { menuNode: VM.ShareMenu }) {
  return (
    <button className="copy-link-button" style="align-items: center" onClick={() => copyAndToast(menuNode.vertex.id)}>
      <div style="display: inline-block;">
        <LinkIcon />
      </div>
      {'  Copy link'}
    </button>
  );
}

function DoneButton({ menuNode }: { menuNode: VM.ShareMenu }) {
  return (
    <button
      className="primary-button"
      onClick={() => {
        menuNode.parentNode.parentNode.parentNode.collapse();
      }}
    >
      Close
    </button>
  );
}

const SectionTitle = styled.div`
  letter-spacing: 0.00625em;
  color: rgb(60, 64, 67);
  padding: 24px 0 0 24px;
`;

function ShareList({ node }: { node: VM.ShareList }) {
  const userShares = useObserveValue(() => node.userShares, [node]);
  const currentUID = globalStore.getCurrentUserID();
  const isAdmin = useObserveValue(
    () => node.validUserIDsForInstructions.mapObs((users) => users?.includes(currentUID) ?? false),
    [node],
  );
  const ownerItem = useObserveValue(() => node.ownerItem, [node]);
  return (
    <div ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}>
      {isAdmin && <UserSelectionBox node={node.userSelectionBox} />}
      <div>
        <SectionTitle>People with access</SectionTitle>
        {ownerItem && <OwnerItem node={ownerItem} />}
        {userShares.map((n) => (
          <UserShare node={n} canAdmin={isAdmin} />
        ))}
      </div>
      <div>
        <SectionTitle>General access</SectionTitle>
        <GeneralShare node={node.generalShare} canAdmin={isAdmin}></GeneralShare>
      </div>
    </div>
  );
}

function UserSelectionBox({ node }: { node: VM.UserSelectionBox }) {
  const selectedUsers = useObserveValue(() => node.selectedUsers, [node], 'useObserveValue(() => node.selectedUsers)');
  const [permissionLevel, setPermissionLevel] = useState<Model.Priv.PermissionLevel>('read');
  return (
    <ExpandedRow alignItems="start">
      <ExpandedRow ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}>
        <ExpandedRow>
          <div className="user-selection-box">
            {/* @ts-ignore */}
            <ExpandedRow wrap={true}>
              {selectedUsers.map((node) =>
                node instanceof VM.UserLozenge ? <UserLozenge node={node} /> : <UserEmailLozenge node={node} />,
              )}
            </ExpandedRow>
            <Text node={node.searchField} noWrap caretHeight={18} />
          </div>
        </ExpandedRow>
        <UserSearchList node={node.searchResults} />
      </ExpandedRow>
      {selectedUsers.length > 0 && (
        <div style="margin-left: 4px;">
          <select
            value={permissionLevel}
            onChange={(e) => setPermissionLevel((e.target as HTMLSelectElement | null)?.value as PermissionLevel)}
          >
            <option value={'read'}>Can view</option>
            <option value={'write'}>Can edit</option>
          </select>
          <br />
          <button
            className="primary-button"
            onClick={async () => {
              copyAndToast(node.parentNode.parentNode.vertex.id);
              await node.sendInvitations(permissionLevel);
            }}
          >
            Send
          </button>
        </div>
      )}
    </ExpandedRow>
  );
}

function UserSearchList({ node }: { node: VM.UserSearchList }) {
  const isLoading = useObserveValue(() => node.isLoading, [node]);
  return (
    <AttachedPanel node={node}>
      {/* UserList component exists because if AttachedPanel is ever not-visible, then we don't want to load its nodes */}
      <UserList node={node.results} isLoading={isLoading} />
    </AttachedPanel>
  );
}

//
const UserList = ({ node, isLoading }: { node: VM.UserSearchList['results']; isLoading: boolean }) => {
  const users = useObserveValue(() => node, [node], 'useObserveValue(() => node.results)');
  const focused = useObserveValue(() => node.isFocused, [node]);

  return isLoading ? (
    <>loading ...</>
  ) : users.length ? (
    <>
      {users.map((u) => {
        const item = u instanceof VM.UserItem ? <UserItem node={u} /> : <TextItem node={u} />;
        return <ItemSC enableHover={!!focused}>{item}</ItemSC>;
      })}
    </>
  ) : (
    <>No results</>
  );
};

const hoverStyles = css`
  color: #4849f3;
  background: rgba(93, 52, 215, 0.05);
`;

const ItemSC = styled.div<{ enableHover?: boolean }>`
  ${(props) => props.enableHover && hoverStyles}
  &:hover {
    ${hoverStyles}
  }
`;

function OwnerItem({ node }: { node: VM.UserItem }) {
  return (
    <ExpandedRow>
      <UserItem node={node} />
      <div style="margin-left: auto;">Owner</div>
    </ExpandedRow>
  );
}

function UserShare({ node, canAdmin }: { node: VM.UserShare; canAdmin: boolean }) {
  const change = (event: any) => {
    switch (event.target.value) {
      case 'unshared':
        node.remove();
        break;
      case 'read':
      case 'write':
        node.changePermission(event.target.value);
        break;
      default:
        break;
    }
  };

  return (
    <ExpandedRow ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}>
      <div className="user-settings-avatar">
        <UserAvatar node={node.avatar} />
      </div>
      <UserNameAndEmail user={node.avatar} />
      <select
        value={node.share.shareCategory}
        onChange={(e) => change(e)}
        disabled={!canAdmin}
        style="margin-left: auto;"
      >
        <option value={'read'}>Can view</option>
        <option value={'write'}>Can edit</option>
        <option value={'unshared'}>Can't access</option>
      </select>
    </ExpandedRow>
  );
}

function GeneralShare({ node, canAdmin }: { node: VM.GeneralShare; canAdmin: boolean }) {
  const share = useObserveValue(() => node.share, [node]);
  const isRestricted = node.status.type == 'RESTRICTED';

  const changeRestictedOrLink = (event: any) => {
    switch (event.target.value) {
      case 'RESTRICTED':
        node.setRestricted();
        break;
      case 'LINK':
      default:
        copyAndToast(node.parentNode.parentNode.vertex.id);
        void node.setAnyOneWithTheLink('write');
        break;
    }
  };

  const changeReadOrWrite = (event: any) => {
    switch (event.target.value) {
      case 'read':
        void node.setAnyOneWithTheLink('read');
        break;
      case 'write':
      default:
        void node.setAnyOneWithTheLink('write');
        break;
    }
    copyAndToast(node.parentNode.parentNode.vertex.id);
  };

  return (
    <ExpandedRow ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}>
      <div className="user-settings-avatar">
        <CircleAvatar size="small" content={isRestricted ? <PadlockIcon /> : <WorldIcon />} />
      </div>
      <TitleAndSubtitle
        title={
          <select value={node.status.type} disabled={!canAdmin} onChange={(e) => changeRestictedOrLink(e)}>
            <option value={'RESTRICTED'}>Restricted</option>
            <option value={'LINK'}>Anyone with the link</option>
          </select>
        }
        subtitle={
          isRestricted
            ? 'Only people with access can open with the link'
            : 'Anyone on the Internet with the link can view'
        }
      />
      {share && (
        <select
          value={share.shareCategory}
          onChange={(e) => changeReadOrWrite(e)}
          disabled={!canAdmin}
          style="margin-left: auto;"
        >
          <option value={'read'}>Can view</option>
          <option value={'write'}>Can edit</option>
        </select>
      )}
    </ExpandedRow>
  );
}
