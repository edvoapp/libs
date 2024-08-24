import { ChildNode, Node, ChildNodeCA, ConditionalNode, globalContext } from './base';
import { AppDesktop } from './app-desktop';
import { EdvoObj, MemoizeOwned, Observable } from '@edvoapp/util';
import { globalStore } from '@edvoapp/common';
import { Member, TopicSpace, ViewportState } from './topic-space';

interface CA extends ChildNodeCA<ConditionalNode<DebugPanel, any, AppDesktop>> {}

interface Stats {
  currentFocus: Node | null;
  currentFocusMember: Member | null;
  rootTopicSpace: TopicSpace | null;
  liveObjects: number;
  totalObjectsEver: number;
  activeQueries: number;
  activeTransactions: number;
}

export class DebugPanel extends ChildNode {
  static new(args: CA) {
    const me = new DebugPanel(args);
    me.init();
    return me;
  }

  _interval: NodeJS.Timeout | undefined;
  @MemoizeOwned()
  get stats() {
    const getStats = () => {
      const context = globalContext();
      const root = context.rootNode;

      const rootTopicSpace = root instanceof AppDesktop ? root.topicSpace.value?.topicSpace ?? null : null;

      let currentFocus = context.focusState.currentFocus;
      let currentFocusMember = currentFocus instanceof Member ? currentFocus : null;

      return {
        rootTopicSpace,
        currentFocus,
        currentFocusMember,
        liveObjects: EdvoObj.liveObjects,
        totalObjectsEver: EdvoObj.totalObjectsEver,
        activeQueries: globalStore.activeQueryCount,
        activeTransactions: globalStore.activeTransactions.count,
      };
    };
    const obs = new Observable<Stats>(getStats());
    this._interval = setInterval(() => {
      obs.set(getStats(), undefined, undefined, true);
    }, 100);

    return obs;
  }
  protected cleanup(debugStack?: Error | undefined): void {
    if (this._interval) clearInterval(this._interval);
    super.cleanup();
  }
}
