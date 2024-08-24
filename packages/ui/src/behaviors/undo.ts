import { EventNav, keyMappings } from '..';
import { Behavior, DispatchStatus } from '../service/Behavior';
import * as VM from '../viewmodel';
import equals from 'fast-deep-equal';
import { useUndoManager } from '@edvoapp/util';

export class Undo extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const sortedDk = [...eventNav.downKeys].sort();

    if (equals(keyMappings['undo'], sortedDk)) {
      useUndoManager().undo();
      return 'stop';
    } else if (equals(keyMappings['redo'], sortedDk)) {
      useUndoManager().redo();
      return 'stop';
    }

    return 'decline';
  }
}
