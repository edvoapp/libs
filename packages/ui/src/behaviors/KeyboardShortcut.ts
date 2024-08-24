import { Model, trxWrap } from '@edvoapp/common';
import { Behavior, DispatchStatus, EventNav, equalsAny, useNavigator } from '../service';
import * as VM from '../viewmodel';
import { isFullScreenable } from './tile-mode';
import { Behaviors } from '..';

export class KeyboardShortcut extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const rootNode = originNode.findClosest((n) => n instanceof VM.AppDesktop && n);

    if (!rootNode) return 'decline';
    const homePage = rootNode.homePage.value;
    const toolbar = rootNode.toolbar;

    if (equalsAny('meta-minus')) {
      const topicSpace = rootNode.topicSpace.value?.topicSpace;
      if (topicSpace) {
        topicSpace.findBehavior(Behaviors.Plane)?.zoomOut(topicSpace, eventNav);
      }
      return 'stop';
    }
    if (equalsAny('meta-plus')) {
      const topicSpace = rootNode.topicSpace.value?.topicSpace;
      if (topicSpace) {
        topicSpace.findBehavior(Behaviors.Plane)?.zoomIn(topicSpace, eventNav);
      }
      return 'stop';
    }
    if (equalsAny('meta-0')) {
      const topicSpace = rootNode.topicSpace.value?.topicSpace;
      if (topicSpace) {
        topicSpace.findBehavior(Behaviors.Plane)?.resetZoom(topicSpace, eventNav);
      }
      return 'stop';
    }

    if (equalsAny('meta-k')) {
      rootNode.tileContainer.clear();
      rootNode.setSearchMode('standard');
      return 'stop';
    }
    if (equalsAny('meta-b')) {
      if (homePage) {
        void trxWrap(async (trx) => {
          const vertex = Model.Vertex.create({ name: 'Untitled', trx });
          return vertex;
        }).then((vertex) => {
          const nav = useNavigator();
          nav.openTopic(vertex);
          toolbar.tabsPanel.open();
          toolbar.context.focusState.setPendingFocus({
            match: (x) => x instanceof VM.TabsPanel,
            context: {},
          });
        });
      } else {
        toolbar.tabsPanel.toggle();
      }

      return 'stop';
    }
    if (equalsAny('meta-u')) {
      if (homePage) {
        homePage.uploadFilesButton.domElement?.click();
      } else {
        toolbar.uploadButton.domElement?.click();
      }

      return 'stop';
    }
    if (equalsAny('meta-e')) {
      if (homePage) {
        if (!rootNode.searchPanel.isFocused.value) {
          rootNode.setSearchMode('share');
        } else {
          if (rootNode.searchMode.value !== 'share') {
            rootNode.setSearchMode('share');
          } else {
            rootNode.setSearchMode('hidden');
          }
        }
      } else {
        const topicSpace = originNode.findClosest((n) => n instanceof VM.TopicSpace && n);
        const dropMenu = topicSpace?.shareTray.shareDropmenu;
        if (dropMenu) {
          dropMenu.toggle();
        }
      }

      return 'stop';
    }
    // TODO resolve new key for this action
    if (equalsAny('meta-l')) {
      const tiledItems = rootNode.tileContainer.children;
      for (const item of tiledItems) {
        if (isFullScreenable(item)) {
          rootNode.tileContainer.remove(item);
        }
      }
      void trxWrap(async (trx) => {
        const vertex = Model.Vertex.create({ name: 'Untitled', trx });
        return vertex;
      }).then((vertex) => {
        const nav = useNavigator();
        eventNav.focusState.setPendingFocus({
          match: (x) => x instanceof VM.TopicSpace && x.vertex === vertex,
          context: {},
        });
        nav.openTopic(vertex);
      });

      return 'stop';
    }

    return 'continue';
  }
}
