import { Observable, useObserve, useObserveValue } from '@edvoapp/util';
import { RefObject } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { usePopper } from 'react-popper';
import { Action, ActionGroup, ChevronRight, VM } from '../..';
import cx from 'classnames';
import styled from 'styled-components';
import { createPortal } from 'preact/compat';

const ContextMenuRoot = styled.div`
  //max-height: 600px;
  z-index: 2147483647;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #d4cfd5;
  box-shadow: 0px 0px 10px rgba(10, 8, 11, 0.15);
  backdrop-filter: blur(15px);
  border-radius: 10px;
  padding: 6px;
  gap: 4px;
  font-weight: 400;
  font-size: 14px;
  line-height: 19px;
  width: 250px;
`;

const ContextMenuItemGroup = styled.div`
  display: flex;
  flex-direction: column;
  //align-items: center;
  //justify-content: space-between;
  white-space: nowrap;
  position: relative;
`;

const ContextMenuItemGroupLabel = styled.span`
  flex: 1;
  font-weight: bold;
  border-bottom: solid 1px #cecece;
  padding: 4px;
`;

const ContextMenuItemStyle = styled.div`
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  white-space: nowrap;
  cursor: pointer;
  position: relative;

  &:hover {
    background-color: #eae7ea;
  }

  &:first-child {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }
  &:last-child {
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
  }

  & > svg {
    width: 18px;
    height: 18px;
    margin-right: 4px;
  }

  .color-indicator {
    width: 40px;
    height: 20px;
    border-radius: 5px;
    margin-right: 3px;
    border: 0.5px solid #999;
  }
`;

const ContextMenuItemLabel = styled.span`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SubContextMenu = styled.div`
  position: absolute;
  top: -5px;
  left: 100%;
  //max-height: 600px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #d4cfd5;
  box-shadow: 0px 0px 10px rgba(10, 8, 11, 0.15);
  backdrop-filter: blur(15px);
  border-radius: 10px;
  padding: 6px;
  gap: 4px;
  width: 250px;
`;

const Hotkey = styled.span`
  font-family: IBM Plex Mono, monospace;
  font-weight: 400;
  font-size: 14px;
  line-height: 100%;
  color: #a89fab;
`;

type Props = {
  node: VM.ContextMenu;
};

export function ContextMenuRenderer({ node }: Props) {
  const state = useObserveValue(() => node.menuState, [node]);

  if (!state) return null;
  const { left, top } = state;
  const actionGroups = useObserveValue(() => node.actionGroups, [node]);
  const virtualReference = useMemo(() => {
    return {
      getBoundingClientRect() {
        return new DOMRect(left, top);
      },
    };
  }, [left, top]);

  const [popperEl, setPopperEl] = useState<HTMLDivElement | null>(null);
  const { styles, attributes } = usePopper(virtualReference, popperEl, {
    placement: 'right-start',
    strategy: 'fixed',
  });

  return createPortal(
    <ContextMenuRoot
      ref={(r: any) => {
        if (r) setPopperEl(r);
        node.safeBindDomElement(r);
      }}
      style={styles.popper}
      className="context-menu"
      {...attributes.popper}
    >
      {actionGroups.map((actionGroup) => (
        <ContextMenuGroup node={actionGroup} key={actionGroup.key} />
      ))}
      {actionGroups.length === 0 && <>No actions for this item</>}
    </ContextMenuRoot>,
    document.body,
  );
}

function ContextMenuGroup({ node }: { node: VM.ContextMenuActionGroup }) {
  const label = node.actionGroup.label;
  const actions = useObserveValue(() => node.actions, [node]);
  return (
    <>
      <ContextMenuItemGroup className="context-menu-item-group" ref={(r: any) => node.safeBindDomElement(r)}>
        <ContextMenuItemGroupLabel className="context-menu-item-group-label">{label}</ContextMenuItemGroupLabel>
        {actions.map((action, idx) => (
          <ContextMenuItem node={action} key={action.key} />
        ))}
      </ContextMenuItemGroup>
    </>
  );
}

function ContextMenuItem({ node }: { node: VM.ContextMenuAction }) {
  const expanded = useObserveValue(() => node.expanded, [node]);
  const subActions = useObserveValue(() => node.subActions, [node]);
  const { icon: Icon, label, hotkey } = node.action;
  const ref = useRef<HTMLDivElement | null>(null);
  const hasSubactions = (node.action.subActions?.length ?? 0) > 0;
  return (
    <ContextMenuItemStyle
      className="context-menu-item"
      ref={(r: any) => {
        ref.current = r;
        node.safeBindDomElement(r);
      }}
    >
      {Icon ? <Icon /> : null}
      <ContextMenuItemLabel className="context-menu-item-label">
        {label}{' '}
        {hotkey && (
          <Hotkey>
            {hotkey
              .toLowerCase()
              .replaceAll('-', ' ')
              .replace('cmd', '⌘')
              .replace('shift', '⇧')
              .replace('alt', '⌥')
              .toUpperCase()}
          </Hotkey>
        )}
      </ContextMenuItemLabel>
      {hasSubactions && (
        <>
          <ChevronRight />
          {expanded && <SubContextMenuItems subActions={subActions} parentRef={ref} />}
        </>
      )}
    </ContextMenuItemStyle>
  );
}

const SubContextMenuItems = ({
  subActions,
  parentRef,
}: {
  subActions: VM.ContextMenuAction[];
  parentRef: RefObject<HTMLDivElement | null>;
}) => {
  const [popperEl, setPopperEl] = useState<HTMLDivElement | null>(null);
  const { styles, attributes } = usePopper(parentRef.current, popperEl, {
    placement: 'right-start',
  });

  return (
    <SubContextMenu ref={setPopperEl} style={styles.popper} {...attributes.popper} className="sub-context-menu">
      {subActions?.map((action, idx) => (
        <ContextMenuItem node={action} key={action.key} />
      ))}
    </SubContextMenu>
  );
};
