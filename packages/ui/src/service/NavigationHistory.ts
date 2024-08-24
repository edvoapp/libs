import { EdvoObj } from '@edvoapp/util';
import { useNavigator } from '..';
import * as VM from '../viewmodel';
import { Model } from '@edvoapp/common';
import { route } from 'preact-router';

export interface NavigationHistoryType {
  stack: string[];
  pointer: number;
}
export class NavigationHistory extends EdvoObj {
  static historyKey = 'navigationHistory';
  static userKey = 'userId';

  _history?: NavigationHistoryType;
  getHistory(): NavigationHistoryType {
    if (!this._history) {
      this._history = this.loadHistory();
    }
    return this._history;
  }

  loadHistory(): NavigationHistoryType {
    const userId = VM.globalContext().authService.currentUserVertexObs.value?.id;
    if (!userId) return { stack: [], pointer: -1 };

    const storedUserId = window.localStorage.getItem(NavigationHistory.userKey);
    let historyJson = window.localStorage.getItem(NavigationHistory.historyKey);

    if (userId !== storedUserId) {
      // If the user ID doesn't match, clear the history stack and reset the stored user ID
      this.clearHistory();
      window.localStorage.setItem(NavigationHistory.userKey, userId ?? '');
      // Initialize history with the current location or "myuniverse/userid" if empty
      const currentLocationPath = this.getCurrentLocationPath(userId);
      historyJson = null; // Ensure history is considered uninitialized
      window.localStorage.setItem(
        NavigationHistory.historyKey,
        JSON.stringify({ stack: [currentLocationPath], pointer: 0 }),
      );
    }

    if (!historyJson) {
      // Log for debugging, indicating initialization of new history
      console.log('Initializing new navigation history for user:', userId);
      return { stack: [this.getCurrentLocationPath(userId)], pointer: 0 };
    } else {
      const history = JSON.parse(historyJson);
      console.log('Loaded existing navigation history:', history);
      return history;
    }
  }

  updateLocation(locationId: string) {
    const history = this.getHistory();
    if (history.pointer === -1 || history.stack[history.pointer] !== locationId) {
      history.stack = history.stack.slice(0, history.pointer + 1);
      history.stack.push(locationId);
      history.pointer = history.stack.length - 1;
    }
    this.saveHistory(history);
  }

  go(direction: number) {
    const history = this.getHistory();
    const newPointer = history.pointer + direction;
    if (newPointer >= 0 && newPointer < history.stack.length) {
      history.pointer = newPointer;
      this.saveHistory(history);
      if (history.stack[newPointer] === '/') {
        route('/');
      } else {
        const vertex = Model.Vertex.getById({ id: history.stack[newPointer] });
        if (vertex) {
          const nav = useNavigator();
          nav.openTopic(vertex);
        }
      }

      return history.stack[newPointer];
    }
    return null;
  }

  saveHistory(history: NavigationHistoryType) {
    this._history = history;
    window.localStorage.setItem(NavigationHistory.historyKey, JSON.stringify(history));
  }

  clearHistory() {
    window.localStorage.removeItem(NavigationHistory.historyKey);
    window.localStorage.removeItem(NavigationHistory.userKey);
  }

  removeVertexFromHistory(vertexId: string) {
    const history = this.getHistory();
    if (history.stack.length === 0) return;

    // Filter the history stack to remove any instances of the vertexId
    const updatedStack = history.stack.filter((locationId) => locationId !== vertexId);

    if (updatedStack.length !== history.stack.length) {
      history.stack = updatedStack;

      // Adjust the pointer if necessary
      if (history.pointer >= updatedStack.length) {
        history.pointer = Math.max(updatedStack.length - 1, 0);
      }

      this.saveHistory(history);
    }
  }

  getCurrentLocationPath(userId: string): string {
    const loc = VM.globalContext().rootNode!.context.currentLocation;
    // Use "myuniverse" vertex ID if current location path is empty
    return loc.path.length === 0 ? '/' : loc.path[loc.path.length - 1];
  }

  canGoBack() {
    const history = this.getHistory();
    return history.pointer > 0;
  }

  canGoForward() {
    const history = this.getHistory();
    return history.pointer < history.stack.length - 1;
  }
}
