import { useObserveValue } from '@edvoapp/util';
import { UserAvatar } from '../..';
import cx from 'classnames';
import * as VM from '../../viewmodel';
import styled from 'styled-components';

const AvatarsContainer = styled.div`
  background: white;
  border: solid 1px rgba(0, 0, 0, 0.1);
  border-radius: 5px;
  display: flex;
  height: 40px;
  margin-right: 5px;
  .stale {
    opacity: 0.5;
  }
`;

export const TopicSpaceAvatars = ({ node }: { node: VM.UserPresence }) => {
  const userPresences = useObserveValue(() => node.userPresences, [node]);
  return (
    <AvatarsContainer className="avatars-container" ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}>
      {userPresences.map((presence) => (
        <UserWrapper node={presence} key={presence.key} />
      ))}
    </AvatarsContainer>
  );
};

const UserWrapper = ({ node }: { node: VM.UserPresentWrapper }) => {
  const state = useObserveValue(() => node.state, [node]);
  const isStale = state === 'stale';
  return (
    <div className={cx('user-wrapper', { stale: isStale })} ref={(r) => node.safeBindDomElement(r)} key={node.key}>
      <UserAvatar node={node.avatar} key={node.avatar.key} />
    </div>
  );
};
