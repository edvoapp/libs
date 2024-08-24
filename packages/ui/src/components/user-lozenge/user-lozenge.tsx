import { CircleAvatar, UserAvatar, VM } from '../..';
import styled from 'styled-components';
import { useObserveValue } from '@edvoapp/util';
import { CloseIcon } from '../icons';
import { Model } from '@edvoapp/common';

import './user-lozenge.scss';

export const Row = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

export type RowAlignItem = 'start' | 'center' | 'end';
export interface ExpandedRowProps {
  alignItems?: RowAlignItem;
  wrap?: boolean;
}
export const ExpandedRow = styled.div<ExpandedRowProps>`
  display: flex;
  width: 100%;
  flex-direction: row;
  align-items: ${({ alignItems }) => alignItems ?? 'center'};
  flex-wrap: ${({ wrap }) => (wrap ? 'wrap' : 'nowrap')};
`;

export function UserLozenge({ node }: { node: VM.UserLozenge }) {
  const closeNode = useObserveValue(() => node.closeIcon, [node]);
  return (
    <div ref={(el: HTMLElement | null) => node.safeBindDomElement(el)} className="user-lozenge">
      <ExpandedRow>
        <UserItem node={node.user} />
        {closeNode && (
          <button ref={(el: HTMLElement | null) => closeNode.safeBindDomElement(el)} style="margin: 4px;">
            <CloseIcon size={12} />
          </button>
        )}
      </ExpandedRow>
    </div>
  );
}

export function UserEmailLozenge({ node }: { node: VM.UserEmailLozenge }) {
  const closeNode = useObserveValue(() => node.closeIcon, [node]);
  return (
    <div ref={(el: HTMLElement | null) => node.safeBindDomElement(el)} className="user-lozenge">
      <ExpandedRow>
        <Row>
          <div className="user-settings-avatar">
            <CircleAvatar size="xs" content={'UU'} avatarImageUrl={undefined} nameTip={node.email} />
          </div>
          <TitleAndSubtitle title={''} subtitle={node.email} />
        </Row>
        {closeNode && (
          <button ref={(el: HTMLElement | null) => closeNode.safeBindDomElement(el)} style="margin: 4px;">
            <CloseIcon size={12} />
          </button>
        )}
      </ExpandedRow>
    </div>
  );
}

export function UserItem({ node }: { node: VM.UserItem }) {
  const size = node.size ?? 'small';
  return (
    <Row ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}>
      <div className="user-settings-avatar">
        <UserAvatar node={node.avatar} />
      </div>
      <UserNameAndEmail user={node.avatar} dense={size == 'xs'} />
    </Row>
  );
}

export function TextItem({ node }: { node: VM.TextItem }) {
  return (
    <Row ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}>
      <TitleAndSubtitle title={''} subtitle={node.value} />
    </Row>
  );
}

export function UserNameAndEmail({ user, dense }: { user: VM.UserAvatar; dense?: boolean }) {
  const fullName = useObserveValue(() => user.fullName, [user]) ?? '';
  const email = useObserveValue(() => user.email, [user]) ?? '';
  return <TitleAndSubtitle title={fullName} subtitle={dense ? '' : email} />;
}

const TileTile = styled.div`
  white-space: nowrap;
  font: 500 0.875rem/1.25rem;
  letter-spacing: 0.00625em;
  color: rgb(60, 64, 67);
`;

const TileSubtitle = styled.div`
  display: block;
  font: 400 0.75rem/1rem;
  font-size: 0.875em;
  letter-spacing: 0.025em;
  color: rgb(95, 99, 104);
`;

export function TitleAndSubtitle({ title, subtitle }: { title: string | JSX.Element; subtitle: string | JSX.Element }) {
  return (
    <div>
      <TileTile>{title}</TileTile>
      <TileSubtitle>{subtitle}</TileSubtitle>
    </div>
  );
}
