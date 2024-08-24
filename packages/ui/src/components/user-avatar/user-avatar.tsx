import { Tooltip } from '../..';
import { useAwait, useObserveValue } from '@edvoapp/util';
import cx from 'classnames';
import * as VM from '../../viewmodel';
import { useMemo } from 'preact/hooks';
import './user-avatar.scss';
import { style } from 'dom-helpers';
import styled from 'styled-components';

type AvatarSize = 'xs' | 'small' | 'small-medium' | 'medium' | 'large';

interface CircleAvatarProps {
  node?: VM.UserAvatar;
  size: AvatarSize;
  avatarImageUrl?: string;
  nameTip?: string;
  content: string | JSX.Element;
}

// if there's another CircleAvatarSC to the left of this one
//     margin-left: -15px;
const CircleAvatarSC = styled.div``;

export function CircleAvatar({ node, size, avatarImageUrl, nameTip, content }: CircleAvatarProps) {
  const avatar = (
    <CircleAvatarSC
      data-cy="user-avatar"
      className={cx('user-avatar', size)}
      ref={(r: HTMLElement | null) => node?.safeBindDomElement(r)}
    >
      {avatarImageUrl ? <img src={avatarImageUrl} /> : content}
    </CircleAvatarSC>
  );

  if (nameTip) {
    return (
      <Tooltip tooltipProps={{ className: 'user-avatar-wrapper' }} tooltipChildren={<NameTip {...{ text: nameTip }} />}>
        {avatar}
      </Tooltip>
    );
  } else {
    return avatar;
  }
}

interface UserAvatarProps {
  node: VM.UserAvatar;
}

export const UserAvatar = ({ node }: UserAvatarProps) => {
  const size = node.size;
  const nameTip = node.showNameAsTooltip;
  let fullName = useObserveValue(() => node.fullName, [node]);

  let userInitials = useMemo(() => {
    if (fullName) {
      let rgx = new RegExp(/\b[a-zA-Z]/, 'gu');
      let initials = Array.from(fullName.matchAll(rgx) || []);
      return ((initials.shift()?.[0] || '') + (initials.pop()?.[0] || '')).toUpperCase();
    } else {
      return 'UU';
    }
  }, [fullName]);

  let part = useObserveValue(() => node.image, [node]);

  const avatarImageUrl = useAwait(async () => await part?.contentUrl(), [part]) ?? undefined;

  return (
    <CircleAvatar
      node={node}
      size={size}
      content={userInitials}
      avatarImageUrl={avatarImageUrl}
      nameTip={nameTip ? fullName : undefined}
    />
  );
};

function NameTip({ text }: { text: string }) {
  return <span className="user-full-name">{text}</span>;
}
