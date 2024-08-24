import { Observable, useObserve, useObserveValue } from '@edvoapp/util';
import cx from 'classnames';
import { VM } from '../..';
import { DockMember } from './dock-member';
import './styles.scss';

// TODO: Implement docks for each side
export enum DockSide {
  East = 'east',
  West = 'west',
  South = 'south',
}

type Props = {
  side: DockSide;
  node: VM.Dock;
};

export function Dock({ node, side }: Props) {
  const members = useObserveValue(() => node.members, [node]);
  const isExpanded = useObserve(() => new Observable(true), []);
  const currentUser = useObserveValue(() => node.context.authService.currentUserVertexObs, [node]);
  if (!currentUser) return null;

  const isPopulated = members.length !== 0;

  return (
    <div
      className={cx(`dock`, `dock-side-${side}`, { populated: isPopulated })}
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
    >
      <div className={'dock-bg'}>
        {side === DockSide.South && (
          <>
            <span className={'drop-text drop'}>Drop here to dock</span>
          </>
        )}
      </div>
      {isExpanded.value && (
        <div className={'dock-members'}>
          {members.map((member) => (
            <DockMember node={member} />
          ))}
        </div>
      )}
    </div>
  );
}
