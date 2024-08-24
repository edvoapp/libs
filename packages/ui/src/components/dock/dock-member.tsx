import { useEdvoObj, useObserveValue } from '@edvoapp/util';
import cx from 'classnames';
import { FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import * as VM from '../../viewmodel';
import {
  // CornerCircle,
  Overlay,
  TopicSpaceCard,
  TopicSpaceCardBody,
} from '../topic-space/card';
import * as React from 'react';
import { MemberBody } from '../../pages/topic-space/member-body';

interface Props {
  node: VM.DockItem;
}

export const DockMember = ({ node }: Props) => {
  const appearance = useObserveValue(() => node.appearance, [node]);
  const selected = useObserveValue(() => node.isSelected, [node]);
  const focused = useObserveValue(() => node.isFocused, [node]);
  const readonly = !useObserveValue(() => node.editable, [node]);
  const tabRect = useObserveValue(() => node.tab.clientRectObs, [node]);

  const style = useMemo(() => {
    return {
      left: tabRect.left,
      top: tabRect.top,
      bottom: 0,
      backgroundColor: appearance?.color || '#fff',
    };
  }, [tabRect, appearance]);

  const body = useObserveValue(() => node.body, [node]);

  return (
    <div
      className={cx('dock-card', `appearance-${appearance?.type}`, {
        focused,
        selected,
        readonly,
      })}
      data-cy="dock-card"
      style={style}
      // onMouseEnter={() => {
      //   expandedObs.set(true);
      // }}
      // onMouseLeave={() => {
      //   expandedObs.set(false);
      // }}
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
    >
      <DockCardTab node={node.tab} />
      {body && <DockCardBody node={body} />}
    </div>
  );
};

const DockCardBody = ({ node }: { node: VM.DockItemBody }) => {
  const appearance = useObserveValue(() => node.appearance, [node])?.type;
  const selected = useObserveValue(() => node.isSelected, [node]);
  const focused = useObserveValue(() => node.isFocused, [node]);

  const body = node.body;

  const dockCoord = useObserveValue(() => node.parentNode.parentNode.tab.dockCoord, [node]);
  const bodyRect = useObserveValue(() => node.clientRectObs, [body]);

  const yCoord = useMemo(() => {
    const dockY = node.findClosest((n) => n instanceof VM.Dock && n)?.clientRect?.y ?? 0;
    return bodyRect.y - dockY;
  }, [bodyRect, node]);

  return (
    <div
      style={{
        left: bodyRect.left - dockCoord,
        top: yCoord,
        width: bodyRect.width,
        height: bodyRect.height,
        // unfortunately, this cannot be fixed position otherwise it would break everyone's docks since the calculation would be different
        position: 'absolute',
        //bottom: clientRect.bottom,
        //position: 'fixed',
      }}
    >
      <TopicSpaceCard
        ref={(r: any) => node.safeBindDomElement(r)}
        style={{ flex: 1, height: '100%', width: '100%', display: 'flex' }}
        {...{ focused, selected }}
      >
        <TopicSpaceCardBody {...{ appearance }}>
          <MemberBody node={node.body} />
        </TopicSpaceCardBody>
      </TopicSpaceCard>
    </div>
  );
};

interface DockCardTabProps {
  node: VM.DockTab;
}

export const DockCardTab: FunctionComponent<DockCardTabProps> = ({ node }) => {
  const selected = useObserveValue(() => node.isSelected, [node]);
  const focused = useObserveValue(() => node.isFocused, [node]);
  const text = useObserveValue(() => node.text, [node]);
  const pressed = useObserveValue(() => node.pressed, [node]);

  return (
    <div
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
      className={cx('dock-card-tab', { pressed })}
      style={{
        width: 170,
        height: 32,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Overlay data-cy="overlay" {...{ selected, focused }} />
      {/* <div className={cx('avatar-body')}>{avatarBody}</div> */}
      <span className={cx('dock-card-tab-text')}>{text}</span>
    </div>
  );
};
