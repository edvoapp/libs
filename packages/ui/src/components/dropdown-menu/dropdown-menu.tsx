import { ComponentChild } from 'preact';
import { MutableRef, useEffect, useRef, useState } from 'preact/hooks'; // Approved
import cx from 'classnames';
import './dropdown-menu.scss';
import { Observable, useEdvoObj, useObserve, useObserveValue } from '@edvoapp/util';
import { VM } from '../..';

interface DropdownMenuProps {
  children: ComponentChild;
  trigger: ComponentChild;
  menuClassName?: string;
  node: VM.DropMenu;
}

export function DropdownMenu({ menuClassName, children, trigger, node }: DropdownMenuProps) {
  const modal = useObserveValue(() => node.modal, [node]);
  const ref = useRef<HTMLDivElement | null>();
  // TODO: handle all this in view model
  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      const key = event.key;
      if (modal && (key === 'Esc' || key === 'Escape')) {
        modal.hide();
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [modal]);

  // HACK - store a copy of button so safeBindDomElement can be called on object cleanup
  let button = useEdvoObj(() => node.button, [node]);

  return (
    <div
      ref={(r: HTMLDivElement | null) => {
        ref.current = r;
        node.safeBindDomElement(r);
      }}
      className="menu-container"
    >
      <button className="menu-button" ref={(r: HTMLElement | null) => button.safeBindDomElement(r)}>
        {trigger}
      </button>
      {modal && (
        <div
          className={cx('menu-root', menuClassName)}
          ref={(r: HTMLElement | null) => modal.safeBindDomElement(r)}
          data-cy="user-dropdown"
        >
          {children}
        </div>
      )}
    </div>
  );
}
