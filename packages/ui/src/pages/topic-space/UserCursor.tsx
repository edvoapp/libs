import { useObserveValue } from '@edvoapp/util';
import { RefObject } from 'preact';
import { UserAvatar, VM } from '../..';
import './user-cursor.scss';

export const Cursors = function ({ userPresence }: { userPresence: VM.UserPresence }) {
  const userCursors = useObserveValue(() => userPresence.userCursors, [userPresence]);

  return (
    <>
      {userCursors.map((cursor) => (
        <Cursor node={cursor} key={cursor.key} />
      ))}
    </>
  );
};

const Cursor = ({ node }: { node: VM.UserCursor }) => {
  const pointer = useObserveValue(() => node.clientPointer, [node]);
  if (!pointer) return null;

  const { isOutside, x, y } = pointer;

  return (
    <span
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 100,
        opacity: isOutside ? 0.5 : 1,
        transition: 'all .3s',
        pointerEvents: 'none',
      }}
      ref={(r) => node.safeBindDomElement(r)}
    >
      <UserAvatar node={node.avatar} />
    </span>
  );
};
