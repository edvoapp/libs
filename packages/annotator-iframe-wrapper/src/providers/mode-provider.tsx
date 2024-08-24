import { createContext, FunctionComponent, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useSubscribeOnMount } from '../hooks/pubsub';
import { getAbsoluteClientRect } from '../util/dom/utils';
import { useProvider } from './common';

export type Mode = 'INACTIVE' | 'BACKGROUND' | 'ACTIVE';
export type ModeContextType = { mode: Mode };

export const ModeContext = createContext<ModeContextType | null>(null);

export function parsePixelValue(s: string): number {
  return parseInt(s.split('px')[0], 10) || 0;
}

export function getExistingMargin(elt: Element): {
  left: number;
  right: number;
  marginLeft: number;
  marginRight: number;
} {
  const { left, right } = getAbsoluteClientRect(elt);
  const { marginLeft, marginRight } = getComputedStyle(elt);
  return {
    left,
    right,
    marginLeft: parsePixelValue(marginLeft),
    marginRight: parsePixelValue(marginRight),
  };
}

export const SIDEBAR_WIDTH = 300;

// TODO: add default build flag to default it to inactive for extension, but active for using the Viewer Proxy
export const ModeProvider: FunctionComponent = ({ children }) => {
  const [mode, setMode] = useState<Mode>('INACTIVE');

  useSubscribeOnMount<{ mode: Mode }>('SET_MODE', ({ mode: m }) => {
    setMode(m);
  });

  useEffect(() => {
    switch (mode) {
      case 'ACTIVE': {
        // add a margin
        document.body.classList.add('edvo__sidebar-open');
        break;
      }
      case 'BACKGROUND':
      case 'INACTIVE': {
        document.body.classList.remove('edvo__sidebar-open');
        break;
      }
      default:
        throw 'invalid mode';
    }
  }, [mode]);

  return <ModeContext.Provider value={{ mode }}>{children}</ModeContext.Provider>;
};

export const ModeConsumer = ModeContext.Consumer;
export const useMode = () => useProvider(ModeContext, 'mode');
