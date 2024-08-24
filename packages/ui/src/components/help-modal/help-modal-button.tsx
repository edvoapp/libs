import styled from 'styled-components';
import { Tooltip } from '../..';
import { useEffect, useState } from 'preact/hooks';
import { HelpMessageIcon } from '../../assets/icons/help-message';

declare global {
  interface Window {
    Beacon: (command: 'init' | 'open' | 'close' | 'on' | 'off', id?: string | Function, callback?: Function) => void;
  }
}

export const HelpModalButtonRoot = styled.div`
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 200000;
  height: 40px;

  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 2rem;

  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: white;
  background-blend-mode: overlay, normal;

  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);

  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;

  &:hover {
    background: rgba(239, 235, 251, 1)
  }
};`;

export const HelpModalButton = () => {
  const [isBeaconOpen, setIsBeaconOpen] = useState(false);

  useEffect(() => {
    // Setup listeners for open and close to track state
    window.Beacon('on', 'open', () => setIsBeaconOpen(true));
    window.Beacon('on', 'close', () => setIsBeaconOpen(false));

    // Cleanup listeners on component unmount
    return () => {
      window.Beacon('off', 'open');
      window.Beacon('off', 'close');
    };
  }, []);

  const toggleBeacon = (e: MouseEvent) => {
    if (isBeaconOpen) {
      window.Beacon('close');
    } else {
      window.Beacon('open');
    }
    e.stopPropagation();
  };

  return (
    <>
      <HelpModalButtonRoot>
        <Tooltip
          tooltipChildren={'Have a question? Talk to us here!'}
          usePortal
          popperConfig={{ placement: 'top-start' }}
        >
          <button
            onClick={toggleBeacon}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="flex items-center gap-2 p-3"
          >
            <HelpMessageIcon />
            <span className="text-sm font-medium text-[#27272A]">Help</span>
          </button>
        </Tooltip>
      </HelpModalButtonRoot>
    </>
  );
};
