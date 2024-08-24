import { FunctionComponent } from 'preact';
import { EdvoObj, WeakProperty } from '@edvoapp/util';
import { EventNav } from './EventNav';
import * as VM from '../viewmodel';
import equals from 'fast-deep-equal';

export interface ActionGroup {
  label: string;
  actions: Action[];
}

export interface Action {
  label?: string;
  hotkey?: string;
  icon?: FunctionComponent;
  apply?: () => void;
  subActions?: Action[];
  cy?: string;
}

export interface Hotkey {
  keys: string[];
  fn: (node: VM.Node) => void;
}

// export class MultiBehavior extends Behavior{
//   getActions(
//     eventNav: EventNav,
//     node: Node[],
//   ): Action[] | Promise<Action[]> {
//     return [];
//   }
// }
// export class SingleBehavior extends Behavior {
//   getActions(
//     eventNav: EventNav,
//     node: Node,
//   ): Action[] | Promise<Action[]> {
//     return [];
//   }
// }

export type DispatchStatus = 'continue' | 'decline' | 'stop' | 'ignore' | 'native';

type KeyBinding = string[] | string[][];
export type KeyMapping = keyof typeof winKeyMappings;

const winKeyMappings = {
  'control-meta-shift-p': ['control', 'p', 'shift'],
  'meta-shift-i': ['control', 'i', 'shift'],
  'meta-shift-alt-u': ['alt', 'control', 'shift', 'u'],
  'alt-meta': ['alt', 'control'],
  'meta-/': ['/', 'control'],
  'meta-u': ['control', 'u'],
  'meta-a': ['a', 'control'],
  'meta-b': ['b', 'control'],
  'meta-e': ['control', 'e'],
  'meta-k': ['control', 'k'],
  'meta-l': ['control', 'l'],
  'meta-o': ['control', 'o'],
  'meta-j': ['control', 'j'],
  'meta-v': ['control', 'v'],
  'meta-x': ['control', 'x'],
  'meta-c': ['c', 'control'],
  'meta-g': ['control', 'g'],
  'meta-t': ['control', 't'],
  'meta-enter': ['control', 'enter'],
  'meta-minus': ['control', '-'],
  'meta-plus': ['control', '='],
  'meta-0': ['control', '0'],
  'shift-home': ['home', 'shift'],
  'shift-end': ['end', 'shift'],
  home: ['home'],
  end: ['end'],
  undo: ['control', 'z'],
  redo: ['control', 'shift', 'z'],
};

const macKeyMappings: Record<KeyMapping, KeyBinding> = {
  'control-meta-shift-p': ['control', 'meta', 'p', 'shift'],
  'meta-shift-i': ['i', 'meta', 'shift'],
  // on mac, alt turns u into ¨
  'meta-shift-alt-u': ['alt', 'meta', 'shift', '¨'],
  'meta-/': ['/', 'meta'],
  'meta-u': ['meta', 'u'],
  'meta-a': ['a', 'meta'],
  'meta-b': ['b', 'meta'],
  'meta-o': ['meta', 'o'],
  'meta-j': ['j', 'meta'],
  'meta-v': ['meta', 'v'],
  'meta-x': ['meta', 'x'],
  'meta-c': ['c', 'meta'],
  'meta-e': ['e', 'meta'],
  'meta-g': ['g', 'meta'],
  'meta-k': ['k', 'meta'],
  'meta-l': ['l', 'meta'],
  'meta-t': ['meta', 't'],
  'meta-enter': ['enter', 'meta'],
  'meta-minus': ['meta', '-'],
  'meta-plus': ['meta', '='],
  'meta-0': ['meta', '0'],
  'alt-meta': ['alt', 'meta'],
  'shift-home': [
    ['a', 'control', 'shift'],
    ['arrowleft', 'meta', 'shift'],
  ],
  'shift-end': [
    ['control', 'e', 'shift'],
    ['arrowright', 'meta', 'shift'],
  ],
  home: [
    ['a', 'control'],
    ['arrowleft', 'meta'],
  ],
  end: [
    ['control', 'e'],
    ['arrowright', 'meta'],
  ],
  undo: ['meta', 'z'],
  redo: ['meta', 'shift', 'z'],
};

export const isMac = /mac/i.test(navigator.userAgent);

export const keyMappings = isMac ? macKeyMappings : winKeyMappings;

export function equalsAny(shortcut: KeyMapping): boolean {
  const mapping = keyMappings[shortcut];
  const eventNav = window.eventNav;
  const sortedDk = [...eventNav.downKeys].sort();
  // array case
  if (Array.isArray(mapping[0])) {
    return (mapping as string[][]).some((keys) => equals(keys.sort(), sortedDk));
  }
  return equals(mapping.sort(), sortedDk);
}

export function equalsKey(key: string) {
  const eventNav = window.eventNav;
  const dk = [...eventNav.downKeys];
  if (dk.length !== 1) return false;
  return dk[0] === key.toLowerCase();
}

export function isMetaClick(e: KeyboardEvent | MouseEvent) {
  if (isMac) return e.metaKey;
  return e.ctrlKey;
}

export const metaKey = isMac ? 'meta' : 'control';

export abstract class Behavior extends EdvoObj {
  // TODO: update all of the below contracts to include targetNode and delegateNode
  // IE: the node which received the stimulus, and the node which we want to act on, respectively
  getBehaviorDelegate(node: VM.Node): VM.Node {
    return node;
  }

  @WeakProperty
  activeNode: VM.Node | null = null;

  getActions(n: VM.Node): ActionGroup[] {
    return [];
  }

  canHandleMulti() {}
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleKeyUp(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleInput(eventNav: EventNav, e: InputEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleMouseOver(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleMouseEnter(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleMouseLeave(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleDoubleClick(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleTripleClick(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleMouseMove(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleRightMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleRightMouseMove(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleRightMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleContextMenu(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleCut(eventNav: EventNav, e: ClipboardEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleCopy(eventNav: EventNav, e: ClipboardEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handlePaste(eventNav: EventNav, e: ClipboardEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleDragOver(eventNav: EventNav, e: DragEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleDragEnter(eventNav: EventNav, e: DragEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleDragLeave(eventNav: EventNav, e: DragEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleDrop(eventNav: EventNav, e: DragEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleWheel(eventNav: EventNav, e: WheelEvent, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleChange(eventNav: EventNav, e: Event, originNode: VM.Node): DispatchStatus {
    return 'ignore';
  }
  handleBindElement(eventNav: EventNav, node: VM.Node): void {}
}

export const DEFAULT_CARD_DIMS = { width: 300, height: 300 };
export const DEFAULT_WEBCARD_DIMS = { width: 1280, height: 720 };
export const DEFAULT_PDF_DIMS = { width: 810, height: 990 };
export const DEFAULT_PORTAL_DIMS = { width: 1620, height: 990 };
