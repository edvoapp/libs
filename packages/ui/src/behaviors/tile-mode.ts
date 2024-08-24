import { Destroy, IObservable, Observable, ObservableReader } from '@edvoapp/util';
import { ActionGroup, Behavior, DispatchStatus, EventNav, equalsAny } from '..';
import * as VM from '../viewmodel';
import equals from 'fast-deep-equal';

export interface FullScreenable extends VM.Node {
  setFullScreen(args: VM.OverrideBoundingBox | null): void;
  clientRectObs: ObservableReader<VM.BoundingBox>;
  tiling: ObservableReader<boolean>;
}

export function isFullScreenable(node: VM.Node): node is FullScreenable {
  return 'setFullScreen' in node;
}

export class FullScreen extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const node = originNode.findClosest((n) => isFullScreenable(n) && n);
    if (!node) return [];
    const eventNav = originNode.context.eventNav;

    const appDesktop = originNode.root as VM.AppDesktop;
    const tileContainer = appDesktop.tileContainer;
    const active = tileContainer.visible.value;

    return [
      {
        label: 'Card',
        actions: [
          {
            apply: () => {
              if (active) {
                tileContainer.clear();
                eventNav.unsetGlobalBehaviorOverrides(this);
              } else {
                tileContainer.add(node);
                eventNav.setGlobalBehaviorOverrides(this, ['handleKeyDown']);
              }
            },
            label: active ? 'Go back to Space' : 'Fullscreen',
          },
        ],
      },
    ];
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node<VM.Node<any> | null>): DispatchStatus {
    const selection = eventNav.selectionState.selection.value;
    const isTiling = originNode.isTiling.value;

    const sortedDk = [...eventNav.downKeys].sort();
    const appDesktop = originNode.root as VM.AppDesktop;
    const tileContainer = appDesktop.tileContainer;

    if (equals(['escape'], sortedDk) && isTiling) {
      tileContainer.clear();
      eventNav.unsetGlobalBehaviorOverrides(this);
      return 'stop';
    }

    const node = originNode.findClosest((n) => isFullScreenable(n) && n);
    let items: FullScreenable[];
    if (selection.length > 0 && selection.some(isFullScreenable)) {
      items = selection.filter(isFullScreenable);
    } else if (node) {
      items = [node];
    } else {
      return 'decline';
    }

    if (equalsAny('meta-enter')) {
      if (tileContainer.visible.value) {
        // TODO - It's super weird that the behavior is moderating the un-tile-mode rather than the focus of the tileContainer
        // But thinking about this a little more, how do we focus the tileContainer when the tiles are not really children
        // TLDR: How do we bind the ESC key when something other than this behavior activated tilemode
        tileContainer.clear();
        eventNav.unsetGlobalBehaviorOverrides(this);
      } else {
        tileContainer.set(items);
        eventNav.setGlobalBehaviorOverrides(this, ['handleKeyDown']);
      }

      return 'stop';
    }

    return 'decline';
  }
}
